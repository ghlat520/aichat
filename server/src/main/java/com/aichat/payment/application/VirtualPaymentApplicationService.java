package com.aichat.payment.application;

import com.aichat.contract.ContractRequests;
import com.aichat.identity.infrastructure.SessionMapper;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.payment.api.PaymentApiDelegate;
import com.aichat.payment.application.VirtualPaymentMapper.Order;
import com.aichat.report.application.GrowthReportPurchasePolicy;
import com.aichat.report.application.GrowthReportPurchasePolicy.Quote;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** One frozen purchase, one authenticated buyer, one durable entitlement. */
@Service
public final class VirtualPaymentApplicationService implements PaymentApiDelegate {
    private static final Duration SESSION_KEY_TTL = Duration.ofHours(2);
    private static final Logger LOG = LoggerFactory.getLogger(VirtualPaymentApplicationService.class);
    private final VirtualPaymentMapper mapper;
    private final SessionMapper sessions;
    private final VirtualPaySettings settings;
    private final WechatVirtualPayGateway wechat;
    private final EnvelopeEncryptionService crypto;
    private final ObjectMapper json;
    private final UlidGenerator ids;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final GrowthReportPurchasePolicy purchases;

    public VirtualPaymentApplicationService(VirtualPaymentMapper mapper, SessionMapper sessions,
            VirtualPaySettings settings, WechatVirtualPayGateway wechat, EnvelopeEncryptionService crypto,
            ObjectMapper json, UlidGenerator ids, Clock clock, TransactionTemplate transactions, GrowthReportPurchasePolicy purchases) {
        this.mapper = mapper; this.sessions = sessions; this.settings = settings; this.wechat = wechat;
        this.purchases = purchases; this.crypto = crypto; this.json = json; this.ids = ids; this.clock = clock; this.transactions = transactions;
    }

    public ApiEnvelope<Map<String, Object>> bindWechat(ApiCallContext context, String key,
            ContractRequests.WechatBindRequest request) {
        settings.requireEnabled();
        IdempotencyKeys.requireValid(key);
        String visitor = context.requireSubject().subjectId();
        String scope = "virtual-bind:" + visitor;
        String keyHash = hash(key);
        String requestHash = Sha256Fingerprints.canonicalRequest(scope, request.loginCode(), request.purpose());
        var previous = sessions.findCommand(scope, keyHash);
        if (previous != null) {
            if (!previous.requestHash().equals(requestHash)) throw conflict("IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同登录请求");
            return success(context, bindingResponse());
        }
        var login = wechat.login(request.loginCode());
        String buyerId = Sha256Fingerprints.canonicalRequest("virtual-buyer", settings.appId(), login.openId());
        transactions.executeWithoutResult(status -> {
            mapper.lockVisitor(visitor);
            var existing = mapper.binding(visitor);
            if (existing != null && !existing.buyerId().equals(buyerId))
                throw conflict("WECHAT_IDENTITY_CONFLICT", "当前应用会话已绑定其他微信身份，请使用独立会话");
            var replay = sessions.findCommand(scope, keyHash);
            if (replay != null) {
                if (!replay.requestHash().equals(requestHash)) throw conflict("IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同登录请求");
                return;
            }
            mapper.insertBuyer(new VirtualPaymentMapper.Buyer(buyerId, settings.appId(),
                    encrypt("buyer:" + buyerId, login.openId()), now()));
            var binding = new VirtualPaymentMapper.Binding(visitor, buyerId,
                    encrypt("wechat-session:" + visitor, login.sessionKey()), now());
            if (existing == null) mapper.insertBinding(binding); else mapper.refreshBinding(binding);
            sessions.insertCommand(new SessionMapper.CommandRecord(scope, keyHash, requestHash, visitor, now(), now().plusDays(1)));
        });
        return success(context, bindingResponse());
    }

    private Map<String, Object> bindingResponse() {
        return Map.of("auth_level", "Principal", "bound", true, "session_key_expires_in", SESSION_KEY_TTL.toSeconds());
    }

    @Override
    public ApiEnvelope<Map<String, Object>> quoteVirtualPurchase(ApiCallContext context, String key,
            ContractRequests.VirtualQuoteRequest request) {
        settings.requireEnabled();
        IdempotencyKeys.requireValid(key);
        JsonNode snapshot = purchases.snapshot(request.product(), request.snapshot());
        var binding = mapper.binding(context.requireSubject().subjectId());
        return success(context, quoteResponse(purchases.quote(binding == null ? null : binding.buyerId(), request.product(), snapshot)));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createVirtualOrder(ApiCallContext context, String key,
            ContractRequests.VirtualOrderRequest request) {
        settings.requireEnabled();
        IdempotencyKeys.requireValid(key);
        if (!request.accepted() || !purchases.disclosureVersion().equals(request.purchaseDisclosureVersion()))
            throw conflict("PURCHASE_DISCLOSURE_REQUIRED", "请阅读并确认当前购买说明");
        String buyer = buyer(context);
        JsonNode snapshot = purchases.snapshot(request.product(), request.snapshot());
        String requestHash = hash(purchases.canonical(Map.of("product", request.product(), "snapshot", snapshot,
                "price_version", request.priceVersion(), "disclosure", request.purchaseDisclosureVersion())));
        Order order = transactions.execute(status -> {
            mapper.lockBuyer(buyer);
            Order replay = mapper.requestOrder(buyer, hash(key));
            if (replay != null) {
                if (!replay.requestHash().equals(requestHash)) throw conflict("IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同购买请求");
                return replay;
            }
            Quote quote = purchases.quote(buyer, request.product(), snapshot);
            if (!quote.priceVersion().equals(request.priceVersion())) throw conflict("PRICE_CHANGED", "报价已变化，请重新确认");
            if (quote.existing() != null) return quote.existing();
            LocalDateTime time = now();
            String id = ids.next();
            Order created = new Order(id, buyer, settings.appId(), settings.environment(), quote.sku(),
                    purchases.productId(quote.sku()), settings.offerId(), quote.snapshotKey(), hash(purchases.canonical(snapshot)),
                    encrypt("snapshot:" + id, snapshot), quote.price(), quote.baseOrderId(), quote.baseOrderId(),
                    purchases.purchaseKey(buyer, quote.snapshotKey(), request.product()), hash(key), requestHash,
                    "PENDING", "NONE", 0, "NONE", null, null, null, null, null, null, null,
                    time.plusMinutes(5), purchases.disclosureVersion(), purchases.reportVersion(), null, null, time, time, null, null, null, 0);
            mapper.insertOrder(created);
            return created;
        });
        return success(context, orderResponse(order));
    }

    private Map<String, Object> quoteResponse(Quote quote) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sku", quote.sku()); result.put("price_fen", quote.price()); result.put("currency", "CNY");
        result.put("snapshot_key", quote.snapshotKey()); result.put("base_order_id", quote.baseOrderId());
        result.put("price_version", quote.priceVersion()); result.put("purchase_disclosure_version", purchases.disclosureVersion());
        result.put("existing_order", quote.existing() == null ? null : orderResponse(quote.existing()));
        return result;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> listVirtualOrders(ApiCallContext context, String before) {
        if (before != null) requireOrderId(before);
        List<Order> rows = mapper.orders(buyer(context), before);
        List<Order> page = rows.stream().limit(20).toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", page.stream().map(VirtualPaymentApplicationService::orderResponse).toList());
        data.put("next_cursor", rows.size() > 20 ? page.get(19).id() : null);
        return success(context, data);
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getVirtualOrder(ApiCallContext context, String id) {
        return success(context, orderResponse(owned(context, id)));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> prepareVirtualPayment(ApiCallContext context, String id, String key) {
        settings.requireEnabled();
        IdempotencyKeys.requireValid(key);
        String buyer = buyer(context);
        return success(context, transactions.execute(status -> {
            mapper.lockBuyer(buyer);
            Order order = owned(context, id);
            if (!"PENDING".equals(order.paymentState()) || !"NONE".equals(order.refundState()))
                throw conflict("ORDER_NOT_PAYABLE", "请查询并查看原订单");
            if (!purchases.canDeliver(order))
                throw conflict("BASE_ENTITLEMENT_UNAVAILABLE", "基础订单权益已变化，请联系售后");
            var binding = mapper.binding(context.requireSubject().subjectId());
            if (binding.encryptedSessionKey() == null || binding.authenticatedAt().plus(SESSION_KEY_TTL).isBefore(now()))
                throw conflict("WECHAT_LOGIN_REQUIRED", "微信登录态已过期，请重新登录");
            if (!settings.appId().equals(order.appId()) || !settings.offerId().equals(order.offerId())
                    || !purchases.canSign(order))
                throw conflict("ORDER_CONFIGURATION_CHANGED", "原订单商品配置已变化，请联系售后");
            String sessionKey = decrypt("wechat-session:" + binding.visitorSessionId(), binding.encryptedSessionKey(), String.class);
            if (order.paymentPreparedAt() != null) {
                if (!hash(key).equals(order.paymentPreparationKeyHash()))
                    throw conflict("PAYMENT_ALREADY_PREPARED", "原订单支付状态待确认，请查询原订单，不要重复付款");
                JsonNode previous = decrypt("payment-parameters:" + id, order.encryptedPaymentParameters(), JsonNode.class);
                if (!binding.visitorSessionId().equals(text(previous, "visitor_session_id"))
                        || !hash(sessionKey).equals(text(previous, "session_key_hash")))
                    throw conflict("PAYMENT_LOGIN_CHANGED", "原支付登录态已变化，请查询原订单并联系售后");
                return json.convertValue(previous.path("parameters"), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
            }
            Map<String, Object> sign = new LinkedHashMap<>();
            sign.put("offerId", order.offerId()); sign.put("buyQuantity", 1); sign.put("env", order.environmentNo());
            sign.put("currencyType", "CNY"); sign.put("productId", order.productId()); sign.put("goodsPrice", order.priceFen());
            sign.put("outTradeNo", order.id()); sign.put("attach", order.id());
            Map<String, Object> parameters = WechatVirtualPayProtocol.signPayment(write(sign), settings.appKey(), sessionKey);
            byte[] encrypted = encrypt("payment-parameters:" + id, Map.of("visitor_session_id", binding.visitorSessionId(),
                    "session_key_hash", hash(sessionKey), "parameters", parameters));
            if (mapper.claimPayment(id, hash(key), encrypted, now()) != 1)
                throw conflict("PAYMENT_ALREADY_PREPARED", "原订单正在处理，请查询原订单");
            return parameters;
        }));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> queryVirtualPayment(ApiCallContext context, String id, String key) {
        IdempotencyKeys.requireValid(key);
        Order order = owned(context, id);
        synchronize(order, true);
        return success(context, orderResponse(mapper.order(id)));
    }

    private void synchronize(Order order, boolean notifyProvided) {
        settings.requireEnabled();
        QueryObservation proof = queryPlatform(order);
        Order updated = transactions.execute(status -> applyQuery(order, proof, false));
        if (notifyProvided && active(updated) && updated.deliveryConfirmedAt() == null) {
            wechat.notifyProvided(order.id(), order.environmentNo());
            // A successful HTTP response is not a documented delivery receipt.
            QueryObservation readback = queryPlatform(order);
            transactions.executeWithoutResult(status -> applyQuery(order, readback, false));
        }
    }

    private record QueryObservation(JsonNode body, long version) { }

    private QueryObservation queryPlatform(Order order) {
        long version = transactions.execute(status -> {
            Order current = mapper.lockOrder(order.id());
            mapper.advanceQuery(order.id(), now(), now().plusMinutes(5));
            return current.queryVersion() + 1;
        });
        return new QueryObservation(wechat.queryOrder(openId(order), order.environmentNo(), order.id()), version);
    }

    private Order applyQuery(Order supplied, QueryObservation observation, boolean refundEvidence) {
        JsonNode response = observation.body();
        mapper.lockBuyer(supplied.buyerId());
        Order order = mapper.lockOrder(supplied.id());
        JsonNode proof = response.path("order");
        if (!order.id().equals(text(proof, "order_id"))
                || integer(proof, "env_type") != order.environmentNo() + 1
                || integer(proof, "order_fee") != order.priceFen()
                || !Set.of(0, 7).contains(integer(proof, "order_type"))) throw invalidEvidence();
        int state = integer(proof, "status");
        if (state == 6) {
            if (observation.version() != order.queryVersion()) return order;
            if ("PAID".equals(order.paymentState())) throw invalidEvidence();
            mapper.markClosed(order.id(), now());
            return mapper.order(order.id());
        }
        boolean refundObservation = Set.of(5, 7, 8).contains(state);
        if (!Set.of(2, 3, 4).contains(state) && !refundObservation
                && !(refundEvidence && Set.of(5, 8).contains(state))) return order;
        String platformId = text(proof, "wx_order_id");
        if (platformId.isBlank() || platformId.length() > 128 || integer(proof, "paid_fee") != order.priceFen()
                || !proof.path("paid_time").canConvertToLong() || proof.path("paid_time").asLong() <= 0
                || (order.wxOrderId() != null && !order.wxOrderId().equals(platformId))) throw invalidEvidence();
        // Payment/refund receipts are immutable facts. Only reversible query observations need this fence.
        if (refundObservation && !refundEvidence && observation.version() != order.queryVersion()) return order;
        if (state == 5 || state == 8) {
            mapper.observeRefundProcessing(order.id(), platformId, now());
            purchases.suspendDependents(order, now());
        }
        if (state == 7 && "PROCESSING".equals(order.refundState()) && order.refundedFen() == 0) {
            String entitlement = !"PAID".equals(order.paymentState()) ? "NONE" : purchases.canDeliver(order) ? "ACTIVE" : "SUSPENDED";
            mapper.clearFailedRefund(order.id(), entitlement, now());
            if ("ACTIVE".equals(entitlement)) purchases.resumeDependents(order, now());
        }
        if (refundObservation && !refundEvidence) return mapper.order(order.id());
        if (!"PAID".equals(order.paymentState())) {
            String entitlement = refundEvidence || !"NONE".equals(order.refundState()) || "CLOSED".equals(order.paymentState()) || !purchases.canDeliver(order)
                    ? "SUSPENDED" : "ACTIVE";
            mapper.markPaid(order.id(), platformId, optionalId(proof, "channel_order_id"), optionalId(proof, "wxpay_order_id"),
                    order.priceFen(), LocalDateTime.ofInstant(Instant.ofEpochSecond(proof.path("paid_time").asLong()), ZoneOffset.UTC),
                    entitlement, now());
            receipt(order, "PAYMENT", platformId, null, order.priceFen(), response, hash("PAYMENT:" + order.appId() + ":" + order.environmentNo() + ":" + platformId));
        }
        if (state == 4) mapper.confirmDelivery(order.id(), now());
        if (state == 5) mapper.observeRefundProcessing(order.id(), platformId, now());
        return mapper.order(order.id());
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getPurchasedGrowthSnapshot(ApiCallContext context, String id) {
        Order order = owned(context, id);
        if (!active(order) || (!purchases.canDeliver(order)))
            throw new ApiException(HttpStatus.FORBIDDEN, "REPORT_ENTITLEMENT_REQUIRED", "此报告尚未取得有效购买权益");
        return success(context, Map.of("order", orderResponse(order), "report_version", order.reportVersion(),
                "snapshot", decrypt("snapshot:" + id, order.encryptedSnapshot(), JsonNode.class)));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> requestVirtualPaymentSupport(ApiCallContext context, String id, String key,
            ContractRequests.VirtualSupportRequest request) {
        IdempotencyKeys.requireValid(key);
        Order order = owned(context, id);
        mapper.requestSupport(id, encrypt("support:" + id, request), now());
        return success(context, Map.of("order_id", order.id(), "support_state", "RECORDED", "refund_submitted", false,
                "message", "售后诉求已登记；iOS退款请向App Store申请，其他终端由商家在微信后台处理。登记不代表已退款。"));
    }

    @Override
    public String verifyVirtualPaymentPushUrl(ApiCallContext context, String signature, String msgSignature,
            String timestamp, String nonce, String encryptType, String echo) {
        settings.requireEnabled();
        return WechatVirtualPayProtocol.verifyEcho(echo, pushQuery(signature, msgSignature, timestamp, nonce, encryptType), settings.pushConfig());
    }

    @Override
    public String acceptVirtualPaymentPush(ApiCallContext context, String signature, String msgSignature,
            String timestamp, String nonce, String encryptType, byte[] rawBody) {
        settings.requireEnabled();
        JsonNode event = WechatVirtualPayProtocol.decodePush(rawBody,
                pushQuery(signature, msgSignature, timestamp, nonce, encryptType), settings.pushConfig());
        if (!"event".equals(text(event, "MsgType"))) throw invalidEvidence();
        switch (text(event, "Event")) {
            case "xpay_goods_deliver_notify" -> deliver(event);
            case "xpay_refund_notify" -> refund(event);
            default -> throw invalidEvidence();
        }
        return "success";
    }

    private void deliver(JsonNode event) {
        Order order = order(text(event, "OutTradeNo"));
        JsonNode goods = event.path("GoodsInfo");
        if (!openId(order).equals(text(event, "OpenId")) || integer(event, "Env") != order.environmentNo()
                || !order.productId().equals(text(goods, "ProductId")) || integer(goods, "Quantity") != 1
                || integer(goods, "OrigPrice") != order.priceFen() || integer(goods, "ActualPrice") != order.priceFen()
                || !order.id().equals(text(goods, "Attach"))) throw invalidEvidence();
        QueryObservation proof = queryPlatform(order);
        var info = event.path("WeChatPayInfo");
        if (info.has("TransactionId") && !text(info, "TransactionId").equals(text(proof.body().path("order"), "wxpay_order_id")))
            throw invalidEvidence();
        Order fulfilled = transactions.execute(status -> applyQuery(order, proof, false));
        if (!active(fulfilled)) throw conflict("DELIVERY_NOT_FULFILLED", "原订单权益未发放，请核实原支付及售后状态");
    }

    private void refund(JsonNode event) {
        Order original = order(text(event, "MchOrderId"));
        if (!openId(original).equals(text(event, "OpenId"))) throw invalidEvidence();
        String refundId = requiredId(event, "WxRefundId");
        requiredId(event, "MchRefundId");
        String wxOrderId = requiredId(event, "WxOrderId");
        int amount = integer(event, "RefundFee");
        int retCode = integer(event, "RetCode");
        if (amount <= 0 || amount > original.priceFen()) throw invalidEvidence();
        QueryObservation proof = retCode == 0 ? queryPlatform(original) : null;
        if (retCode == 0 && (!wxOrderId.equals(text(proof.body().path("order"), "wx_order_id"))
                || longInteger(event, "RefundSuccTimestamp") <= 0)) throw invalidEvidence();
        transactions.executeWithoutResult(status -> {
            mapper.lockBuyer(original.buyerId());
            Order order = mapper.lockOrder(original.id());
            if (retCode != 0) {
                if (order.wxOrderId() != null && !order.wxOrderId().equals(wxOrderId)) throw invalidEvidence();
                receipt(order, "REFUND_FAILED", wxOrderId, null, amount, event,
                        hash("REFUND_FAILED:" + order.appId() + ":" + refundId + ":" + retCode));
                return;
            }
            var previous = mapper.completedRefund(order.appId(), order.environmentNo(), refundId);
            if (previous != null) {
                if (!previous.orderId().equals(order.id()) || previous.amountFen() != amount) throw invalidEvidence();
                return;
            }
            order = applyQuery(order, proof, true);
            if (!"PAID".equals(order.paymentState()) || !wxOrderId.equals(order.wxOrderId())
                    || order.refundedFen() + amount > order.paidFen()) throw invalidEvidence();
            int total = order.refundedFen() + amount;
            boolean full = total == order.paidFen();
            receipt(order, "REFUND", wxOrderId, refundId, amount, event,
                    hash("REFUND:" + order.appId() + ":" + order.environmentNo() + ":" + refundId));
            mapper.markRefund(order.id(), total, full ? "COMPLETED" : "PARTIAL", full ? "REVOKED" : "SUSPENDED", now());
            purchases.suspendDependents(order, now());
        });
    }

    private void receipt(Order order, String kind, String platformId, String refundId, int amount, JsonNode evidence, String id) {
        if (mapper.receipt(id) != null) return;
        mapper.insertReceipt(new VirtualPaymentMapper.Receipt(id, order.id(), order.appId(), order.environmentNo(), kind,
                platformId, refundId, amount, encrypt("receipt:" + id, evidence), now()));
    }

    @Scheduled(fixedDelayString = "${aichat.virtual-pay.query-delay-ms:300000}", initialDelayString = "${aichat.virtual-pay.query-delay-ms:300000}")
    public void reconcileDueOrders() {
        if (!settings.enabled()) return;
        mapper.expireSessionKeys(now().minus(SESSION_KEY_TTL));
        for (Order order : mapper.dueOrders(now())) {
            try { synchronize(order, true); }
            catch (ApiException exception) {
                LOG.warn("Virtual payment reconciliation deferred order={} code={}", order.id(), exception.error().code());
            }
        }
    }

    private static boolean active(Order order) {
        return order != null && order.hasActiveEntitlement();
    }

    private String buyer(ApiCallContext context) {
        var binding = mapper.binding(context.requireSubject().subjectId());
        if (binding == null) throw new ApiException(HttpStatus.FORBIDDEN, "WECHAT_LOGIN_REQUIRED", "购买及恢复权益需要微信登录");
        return binding.buyerId();
    }

    private Order owned(ApiCallContext context, String id) {
        Order order = order(id);
        if (!order.buyerId().equals(buyer(context))) throw notFound();
        return order;
    }

    private Order order(String id) {
        requireOrderId(id);
        Order order = mapper.order(id);
        if (order == null) throw notFound();
        return order;
    }

    private String openId(Order order) {
        var buyer = mapper.buyer(order.buyerId());
        if (buyer == null || !buyer.appId().equals(order.appId()) || !settings.appId().equals(order.appId())) throw invalidEvidence();
        return decrypt("buyer:" + order.buyerId(), buyer.encryptedOpenid(), String.class);
    }

    private byte[] encrypt(String id, Object value) {
        try { return json.writeValueAsBytes(crypto.encrypt("virtual-pay:" + id, json.writeValueAsBytes(value))); }
        catch (java.io.IOException exception) { throw new IllegalStateException("支付记录编码失败", exception); }
    }

    private <T> T decrypt(String id, byte[] value, Class<T> type) {
        try { return json.readValue(crypto.decrypt("virtual-pay:" + id,
                json.readValue(value, EnvelopeEncryptionService.EncryptedPayload.class)), type); }
        catch (java.io.IOException exception) { throw new IllegalStateException("支付记录解码失败", exception); }
    }

    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (java.io.IOException exception) { throw new IllegalStateException("支付数据编码失败", exception); }
    }
    private static String hash(String value) { return Sha256Fingerprints.hash(value); }
    private LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC); }
    private static void requireOrderId(String id) { if (id == null || !id.matches("[0-9A-HJKMNP-TV-Z]{26}")) throw notFound(); }
    private static String text(JsonNode node, String key) { return node.path(key).asText(""); }
    private static int integer(JsonNode node, String key) {
        long value = longInteger(node, key);
        if (value < Integer.MIN_VALUE || value > Integer.MAX_VALUE) throw invalidEvidence();
        return (int) value;
    }
    private static long longInteger(JsonNode node, String key) {
        JsonNode value = node.path(key);
        String text = value.asText("");
        if (!text.matches("-?[0-9]{1,18}")) throw invalidEvidence();
        try { return Long.parseLong(text); } catch (NumberFormatException exception) { throw invalidEvidence(); }
    }
    private static String requiredId(JsonNode node, String key) {
        String value = text(node, key);
        if (value.isBlank() || value.length() > 128) throw invalidEvidence();
        return value;
    }
    private static String optionalId(JsonNode node, String key) {
        if (!node.hasNonNull(key) || text(node, key).isBlank()) return null;
        return requiredId(node, key);
    }
    public static WechatVirtualPayProtocol.PushQuery pushQuery(String signature, String messageSignature, String timestamp, String nonce, String type) {
        return new WechatVirtualPayProtocol.PushQuery(signature, messageSignature, timestamp, nonce, type);
    }
    private static Map<String, Object> orderResponse(Order order) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("order_id", order.id()); data.put("sku", order.sku()); data.put("price_fen", order.priceFen());
        data.put("snapshot_key", order.snapshotKey()); data.put("base_order_id", order.baseOrderId());
        data.put("payment_state", order.paymentState()); data.put("refund_state", order.refundState());
        data.put("refunded_fen", order.refundedFen()); data.put("paid_fen", order.paidFen());
        data.put("entitlement_state", order.entitlementState()); data.put("delivery_confirmed", order.deliveryConfirmedAt() != null);
        data.put("created_at", order.createdAt().atOffset(ZoneOffset.UTC).toString());
        data.put("payment_started", order.paymentPreparedAt() != null);
        data.put("support_requested", order.supportRequestedAt() != null); data.put("report_version", order.reportVersion());
        return data;
    }
    private static ApiEnvelope<Map<String, Object>> success(ApiCallContext context, Map<String, Object> value) { return ApiEnvelope.success(context.requestId(), value); }
    private static ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }
    private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "VIRTUAL_ORDER_NOT_FOUND", "支付订单不存在"); }
    private static ApiException invalidEvidence() { return conflict("WECHAT_PAYMENT_EVIDENCE_MISMATCH", "微信支付证据与冻结订单不一致，未变更权益"); }
}
