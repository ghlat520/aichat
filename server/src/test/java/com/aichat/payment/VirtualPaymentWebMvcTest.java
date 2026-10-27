package com.aichat.payment;

import com.aichat.payment.application.WechatVirtualPayProtocol;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** HTTP replacement implements the documented WeChat wire shapes; no account or real payment is used. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("virtual-pay-test")
class VirtualPaymentWebMvcTest {
    static final String APP_ID = "wx1234567890abcdef";
    static final String APP_KEY = "test_app_key_1234567890";
    static final String SESSION_KEY = "test_session_key_1234567890";
    static final String AES_KEY = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    static final ObjectMapper JSON = new ObjectMapper();
    static final Map<String, JsonNode> PLATFORM = new ConcurrentHashMap<>();
    static final AtomicInteger PROVIDE_COUNT = new AtomicInteger();
    static final Map<String, DelayedQuery> DELAYS = new ConcurrentHashMap<>();
    static final HttpServer WECHAT = fakeWechat();

    @DynamicPropertySource
    static void config(DynamicPropertyRegistry registry) {
        boolean mysql = Boolean.getBoolean("aichat.virtual-pay.mysql-test");
        registry.add("spring.datasource.url", () -> mysql ? System.getProperty("aichat.virtual-pay.mysql-url")
                : "jdbc:h2:mem:virtualpay;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        if (mysql) {
            registry.add("spring.datasource.username", () -> "root");
            registry.add("spring.datasource.password", () -> System.getProperty("aichat.virtual-pay.mysql-password"));
            registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        }
        registry.add("aichat.virtual-pay.enabled", () -> "true");
        registry.add("aichat.virtual-pay.app-id", () -> APP_ID);
        registry.add("aichat.virtual-pay.app-secret", () -> "test_app_secret_not_real");
        registry.add("aichat.virtual-pay.offer-id", () -> "1234567890");
        registry.add("aichat.virtual-pay.app-key", () -> APP_KEY);
        registry.add("aichat.virtual-pay.push-token", () -> "testPushToken");
        registry.add("aichat.virtual-pay.encoding-aes-key", () -> AES_KEY);
        registry.add("aichat.virtual-pay.base-product-id", () -> "test_base");
        registry.add("aichat.virtual-pay.career-product-id", () -> "test_career");
        registry.add("aichat.virtual-pay.upgrade-product-id", () -> "test_upgrade");
        registry.add("aichat.virtual-pay.api-base", () -> "http://127.0.0.1:" + WECHAT.getAddress().getPort());
        registry.add("aichat.virtual-pay.query-delay-ms", () -> "3600000");
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired com.aichat.payment.application.VirtualPaymentApplicationService payments;

    @AfterAll static void stop() { WECHAT.stop(0); }

    @Test
    void frozenOrderNeedsPlatformProofAndCanBeRecoveredBySameWechatBuyer() throws Exception {
        String buyerCode = "happy_" + UUID.randomUUID();
        String token = visitor();
        bind(token, buyerCode);
        Map<String, Object> snapshot = snapshot(false);
        JsonNode quote = call(post("/api/v1/virtual-pay/quotes"), token,
                Map.of("product", "base", "snapshot", snapshot), 200);
        assertThat(quote.path("price_fen").asInt()).isEqualTo(2990);
        Map<String, Object> body = Map.of("product", "base", "snapshot", snapshot,
                "price_version", quote.path("price_version").asText(),
                "purchase_disclosure_version", "personal-virtual-pay-v1", "accepted", true);
        String key = "create-" + UUID.randomUUID();
        JsonNode order = call(post("/api/v1/virtual-pay/orders").header("Idempotency-Key", key), token, body, 201);
        String id = order.path("order_id").asText();
        assertThat(call(post("/api/v1/virtual-pay/orders").header("Idempotency-Key", key), token, body, 201)
                .path("order_id").asText()).isEqualTo(id);
        assertThat(call(post("/api/v1/virtual-pay/orders"), token, body, 201)
                .path("order_id").asText()).isEqualTo(id);
        JsonNode signed = call(post("/api/v1/virtual-pay/orders/" + id + "/payment"), token, null, 200);
        String wire = signed.path("signData").asText();
        assertThat(signed.path("paySig").asText()).isEqualTo(WechatVirtualPayProtocol.hmac(APP_KEY, "requestVirtualPayment&" + wire));
        assertThat(signed.path("signature").asText()).isEqualTo(WechatVirtualPayProtocol.hmac(SESSION_KEY, wire));
        assertThat(JSON.readTree(wire).path("goodsPrice").asInt()).isEqualTo(2990);
        call(get("/api/v1/virtual-pay/orders/" + id + "/report"), token, null, 403);
        platformOrder(id, 1, 2990);
        assertThat(call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200)
                .path("payment_state").asText()).isEqualTo("PENDING");
        platformOrder(id, 2, 2990);
        JsonNode paid = call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
        assertThat(paid.path("entitlement_state").asText()).isEqualTo("ACTIVE");
        assertThat(paid.path("delivery_confirmed").asBoolean()).isTrue();
        call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
        assertThat(db.queryForObject("SELECT COUNT(*) FROM pay_virtual_receipt WHERE order_id=? AND receipt_kind='PAYMENT'", Integer.class, id)).isEqualTo(1);
        String recovered = visitor();
        bind(recovered, buyerCode);
        assertThat(call(get("/api/v1/virtual-pay/orders/" + id + "/report"), recovered, null, 200)
                .path("snapshot").path("experiences").get(0).path("event").asText()).isEqualTo("整理一次团队协作");
        String stranger = visitor();
        bind(stranger, "stranger_" + UUID.randomUUID());
        call(get("/api/v1/virtual-pay/orders/" + id), stranger, null, 404);
        call(post("/api/v1/identity/wechat/bind"), recovered,
                Map.of("login_code", "different_" + UUID.randomUUID(), "purpose", "payment"), 409);
    }

    @Test
    void missingOrMismatchedQueryCannotMintRightsAndSigningDoesNotResubmitAnUnknownOrder() throws Exception {
        String token = visitor();
        call(get("/api/v1/virtual-pay/orders"), token, null, 403);
        bind(token, "mismatch_" + UUID.randomUUID());
        String id = create(token, "base", snapshot(false)).path("order_id").asText();
        String preparationKey = "prepare-" + UUID.randomUUID();
        JsonNode first = call(post("/api/v1/virtual-pay/orders/" + id + "/payment").header("Idempotency-Key", preparationKey), token, null, 200);
        assertThat(call(post("/api/v1/virtual-pay/orders/" + id + "/payment").header("Idempotency-Key", preparationKey), token, null, 200)).isEqualTo(first);
        call(post("/api/v1/virtual-pay/orders/" + id + "/payment"), token, null, 409);
        call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 409);
        platformOrder(id, 2, 2000);
        call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 409);
        platformOrder(id, 2, 2990);
        ((com.fasterxml.jackson.databind.node.ObjectNode) PLATFORM.get(id)).put("env_type", 2);
        call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 409);
        assertThat(db.queryForMap("SELECT payment_state, paid_fen, entitlement_state FROM pay_virtual_order WHERE id=?", id))
                .containsEntry("payment_state", "PENDING").containsEntry("paid_fen", null).containsEntry("entitlement_state", "NONE");
    }

    @Test
    void authenticatedDeliveryAndRefundAreIdempotentAndNeverEraseOriginalPayment() throws Exception {
        String code = "push_" + UUID.randomUUID();
        String token = visitor(); bind(token, code);
        String id = create(token, "base", snapshot(false)).path("order_id").asText();
        platformOrder(id, 2, 2990);
        Map<String, Object> delivery = delivery(id, code, "test_base", 2990);
        var wrong = new java.util.LinkedHashMap<>(delivery);
        wrong.put("OpenId", "wrong_buyer");
        push(wrong, 409);
        var plaintext = mvc.perform(post("/api/v1/webhooks/wechat-virtual-pay")
                .param("signature", sha1("testPushToken", "1793059200", "testnonce"))
                .param("timestamp", "1793059200").param("nonce", "testnonce")
                .contentType("application/json").content(JSON.writeValueAsBytes(delivery))).andReturn().getResponse();
        assertThat(plaintext.getStatus()).isEqualTo(401);
        push(delivery, 200); push(delivery, 200);
        assertThat(db.queryForObject("SELECT COUNT(*) FROM pay_virtual_receipt WHERE order_id=? AND receipt_kind='PAYMENT'", Integer.class, id)).isEqualTo(1);
        call(get("/api/v1/virtual-pay/orders/" + id + "/report"), token, null, 200);
        push(refund(id, code, "failed", 2990, 1), 200);
        assertThat(call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200).path("entitlement_state").asText()).isEqualTo("ACTIVE");
        Map<String, Object> refund = refund(id, code, "success", 2990, 0);
        push(refund, 200); push(refund, 200);
        JsonNode refunded = call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200);
        assertThat(refunded.path("payment_state").asText()).isEqualTo("PAID");
        assertThat(refunded.path("paid_fen").asInt()).isEqualTo(2990);
        assertThat(refunded.path("refunded_fen").asInt()).isEqualTo(2990);
        assertThat(refunded.path("refund_state").asText()).isEqualTo("COMPLETED");
        call(get("/api/v1/virtual-pay/orders/" + id + "/report"), token, null, 403);
        push(delivery, 409);
        assertThat(db.queryForObject("SELECT COUNT(*) FROM pay_virtual_receipt WHERE order_id=? AND receipt_kind='REFUND'", Integer.class, id)).isEqualTo(1);
        assertThat(db.queryForMap("SELECT active_purchase_key, active_upgrade_base_id FROM pay_virtual_order WHERE id=?", id))
                .containsEntry("active_purchase_key", null).containsEntry("active_upgrade_base_id", null);
    }

    @Test
    void latePaidUpgradeAfterBaseRefundPreservesMoneyAndSuspendsDependentRights() throws Exception {
        String code = "upgrade_" + UUID.randomUUID();
        String token = visitor(); bind(token, code);
        String base = create(token, "base", snapshot(false)).path("order_id").asText();
        platformOrder(base, 2, 2990);
        call(post("/api/v1/virtual-pay/orders/" + base + "/query"), token, null, 200);
        JsonNode upgrade = create(token, "career", snapshot(true));
        String id = upgrade.path("order_id").asText();
        assertThat(upgrade.path("price_fen").asInt()).isEqualTo(2000);
        assertThat(upgrade.path("base_order_id").asText()).isEqualTo(base);
        push(refund(base, code, "base_full", 2990, 0), 200);
        call(post("/api/v1/virtual-pay/orders/" + id + "/payment"), token, null, 409);
        platformOrder(id, 2, 2000);
        push(delivery(id, code, "test_upgrade", 2000), 409);
        JsonNode paid = call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200);
        assertThat(paid.path("payment_state").asText()).isEqualTo("PAID");
        assertThat(paid.path("paid_fen").asInt()).isEqualTo(2000);
        assertThat(paid.path("refunded_fen").asInt()).isZero();
        assertThat(paid.path("entitlement_state").asText()).isEqualTo("SUSPENDED");
        call(get("/api/v1/virtual-pay/orders/" + id + "/report"), token, null, 403);
    }

    @Test
    void refundArrivingBeforeDeliveryIsAppliedAtomicallyAndPartialsAccumulateOnce() throws Exception {
        String code = "refund_first_" + UUID.randomUUID();
        String token = visitor(); bind(token, code);
        String id = create(token, "base", snapshot(false)).path("order_id").asText();
        platformOrder(id, 8, 2990);
        Map<String, Object> partial = refund(id, code, "partial_one", 1000, 0);
        push(partial, 200); push(partial, 200);
        JsonNode order = call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200);
        assertThat(order.path("payment_state").asText()).isEqualTo("PAID");
        assertThat(order.path("refunded_fen").asInt()).isEqualTo(1000);
        assertThat(order.path("entitlement_state").asText()).isEqualTo("SUSPENDED");
        push(refund(id, code, "partial_too_much", 2500, 0), 409);
        push(refund(id, code, "partial_two", 1990, 0), 200);
        assertThat(call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200).path("refunded_fen").asInt()).isEqualTo(2990);
    }

    @Test
    void unresolvedCareerPurchaseCannotBeSupersededByABaseCharge() throws Exception {
        String token = visitor(); bind(token, "career_first_" + UUID.randomUUID());
        JsonNode career = create(token, "career", snapshot(true));
        call(post("/api/v1/virtual-pay/orders/" + career.path("order_id").asText() + "/payment"), token, null, 200);
        JsonNode base = create(token, "base", snapshot(false));
        assertThat(base.path("order_id").asText()).isEqualTo(career.path("order_id").asText());
    }

    @Test
    void refundStateObservedByQueryBlocksNewUpgradeWithoutPretendingMoneyWasRefunded() throws Exception {
        String token = visitor(); bind(token, "query_refund_" + UUID.randomUUID());
        String id = create(token, "base", snapshot(false)).path("order_id").asText();
        platformOrder(id, 2, 2990);
        call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
        platformOrder(id, 5, 2990);
        ((com.fasterxml.jackson.databind.node.ObjectNode) PLATFORM.get(id)).put("wx_order_id", "OTHER");
        call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 409);
        assertThat(call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200).path("refund_state").asText()).isEqualTo("NONE");
        platformOrder(id, 5, 2990);
        JsonNode order = call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
        assertThat(order.path("refund_state").asText()).isEqualTo("PROCESSING");
        assertThat(order.path("refunded_fen").asInt()).isZero();
        call(post("/api/v1/virtual-pay/quotes"), token, Map.of("product", "career", "snapshot", snapshot(true)), 409);
        platformOrder(id, 7, 2990);
        assertThat(call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200).path("refund_state").asText()).isEqualTo("NONE");
        call(get("/api/v1/virtual-pay/orders/" + id + "/report"), token, null, 200);
    }

    @Test
    void nullExperienceEntriesCannotBePurchased() throws Exception {
        String token = visitor();
        var invalid = new java.util.LinkedHashMap<>(snapshot(false));
        invalid.put("experiences", java.util.Arrays.asList(null, null));
        call(post("/api/v1/virtual-pay/quotes"), token, Map.of("product", "base", "snapshot", invalid), 400);
    }

    @Test
    void optionalEnergyNoteMatchesTheExistingExperienceReadinessRule() throws Exception {
        String token = visitor();
        var input = new java.util.LinkedHashMap<>(snapshot(false));
        input.put("experiences", List.of(Map.of("event", "一次协作", "action", "拆分", "result", "完成", "energy", ""),
                Map.of("event", "一次学习", "action", "练习", "result", "反馈", "energy", "")));
        call(post("/api/v1/virtual-pay/quotes"), token, Map.of("product", "base", "snapshot", input), 200);
    }

    @Test
    void iosPaymentKeepsUnavailableOptionalChannelIdentifiersNull() throws Exception {
        String token = visitor(); bind(token, "ios_optional_ids_" + UUID.randomUUID());
        String id = create(token, "base", snapshot(false)).path("order_id").asText();
        platformOrder(id, 4, 2990);
        var proof = (com.fasterxml.jackson.databind.node.ObjectNode) PLATFORM.get(id);
        proof.put("order_type", 7).put("wxpay_order_id", "").putNull("channel_order_id");
        JsonNode paid = call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
        assertThat(paid.path("entitlement_state").asText()).isEqualTo("ACTIVE");
        assertThat(db.queryForMap("SELECT channel_order_id, wxpay_order_id FROM pay_virtual_order WHERE id=?", id))
                .containsEntry("channel_order_id", null).containsEntry("wxpay_order_id", null);
    }

    @Test
    void migrationsAndConcurrentCreationKeepOneFrozenPurchase() throws Exception {
        assertThat(db.queryForList("SELECT version FROM flyway_schema_history WHERE success=TRUE AND version IS NOT NULL ORDER BY installed_rank", String.class))
                .containsExactly("1", "2", "3", "4", "5", "6", "7");
        String token = visitor(); bind(token, "concurrent_" + UUID.randomUUID());
        var pool = java.util.concurrent.Executors.newFixedThreadPool(4);
        try {
            var start = new java.util.concurrent.CyclicBarrier(4);
            var futures = new java.util.ArrayList<java.util.concurrent.Future<String>>();
            for (int i = 0; i < 4; i++) futures.add(pool.submit(() -> {
                start.await(5, java.util.concurrent.TimeUnit.SECONDS);
                return create(token, "base", snapshot(false)).path("order_id").asText();
            }));
            var ids = new java.util.HashSet<String>();
            for (var future : futures) ids.add(future.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertThat(ids).hasSize(1);
            assertThat(db.queryForObject("SELECT COUNT(*) FROM pay_virtual_order WHERE id=?", Integer.class, ids.iterator().next())).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }

    @Test
    void scheduledFallbackHandlerDefersUnknownAndDeliversAnotherDueOrder() throws Exception {
        String token = visitor(); bind(token, "scheduled_" + UUID.randomUUID());
        String unknown = create(token, "base", snapshot(false)).path("order_id").asText();
        String secondToken = visitor(); bind(secondToken, "scheduled_paid_" + UUID.randomUUID());
        String paid = create(secondToken, "base", snapshot(false)).path("order_id").asText();
        platformOrder(paid, 2, 2990);
        db.update("UPDATE pay_virtual_order SET next_query_at=? WHERE id IN (?,?)",
                java.time.LocalDateTime.now(java.time.ZoneOffset.UTC).minusMinutes(1), unknown, paid);
        payments.reconcileDueOrders();
        JsonNode unresolved = call(get("/api/v1/virtual-pay/orders/" + unknown), token, null, 200);
        assertThat(unresolved.path("payment_state").asText()).isEqualTo("PENDING");
        assertThat(unresolved.path("paid_fen").isNull()).isTrue();
        assertThat(db.queryForObject("SELECT last_query_attempt_at IS NOT NULL AND next_query_at > ? FROM pay_virtual_order WHERE id=?",
                Boolean.class, java.time.LocalDateTime.now(java.time.ZoneOffset.UTC), unknown)).isTrue();
        JsonNode delivered = call(get("/api/v1/virtual-pay/orders/" + paid), secondToken, null, 200);
        assertThat(delivered.path("payment_state").asText()).isEqualTo("PAID");
        assertThat(delivered.path("entitlement_state").asText()).isEqualTo("ACTIVE");
        assertThat(delivered.path("delivery_confirmed").asBoolean()).isTrue();
    }

    @Test
    void olderRefundQueryCannotOverwriteANewerAcceptedResultInEitherDirection() throws Exception {
        for (int oldStatus : List.of(5, 7)) {
            String token = visitor(); bind(token, "race_" + UUID.randomUUID());
            String id = create(token, "base", snapshot(false)).path("order_id").asText();
            platformOrder(id, 2, 2990);
            call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
            platformOrder(id, 5, 2990);
            call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
            platformOrder(id, oldStatus, 2990);
            DelayedQuery delayed = new DelayedQuery();
            DELAYS.put(id, delayed);
            var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
            try {
                var older = executor.submit(() -> call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200));
                assertThat(delayed.entered.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                int latestStatus = oldStatus == 5 ? 7 : 5;
                platformOrder(id, latestStatus, 2990);
                call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
                delayed.release.countDown();
                older.get(10, java.util.concurrent.TimeUnit.SECONDS);
                JsonNode result = call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200);
                assertThat(result.path("refund_state").asText()).isEqualTo(latestStatus == 7 ? "NONE" : "PROCESSING");
                assertThat(result.path("entitlement_state").asText()).isEqualTo(latestStatus == 7 ? "ACTIVE" : "SUSPENDED");
            } finally { delayed.release.countDown(); executor.shutdownNow(); }
        }
    }

    @Test
    void newerRefundObservationOnPendingOrderSurvivesAnOlderFirstPaymentReceipt() throws Exception {
        for (int latestStatus : List.of(5, 8)) {
            String token = visitor(); bind(token, "first_paid_race_" + UUID.randomUUID());
            String id = create(token, "base", snapshot(false)).path("order_id").asText();
            platformOrder(id, 4, 2990);
            DelayedQuery delayed = new DelayedQuery(); DELAYS.put(id, delayed);
            var executor = java.util.concurrent.Executors.newSingleThreadExecutor();
            try {
                var older = executor.submit(() -> call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200));
                assertThat(delayed.entered.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                platformOrder(id, latestStatus, 2990);
                call(post("/api/v1/virtual-pay/orders/" + id + "/query"), token, null, 200);
                call(post("/api/v1/virtual-pay/orders/" + id + "/payment"), token, null, 409);
                delayed.release.countDown(); older.get(10, java.util.concurrent.TimeUnit.SECONDS);
                JsonNode result = call(get("/api/v1/virtual-pay/orders/" + id), token, null, 200);
                assertThat(result.path("payment_state").asText()).isEqualTo("PAID");
                assertThat(result.path("paid_fen").asInt()).isEqualTo(2990);
                assertThat(result.path("refund_state").asText()).isEqualTo("PROCESSING");
                assertThat(result.path("entitlement_state").asText()).isEqualTo("SUSPENDED");
                call(get("/api/v1/virtual-pay/orders/" + id + "/report"), token, null, 403);
            } finally { delayed.release.countDown(); executor.shutdownNow(); }
        }
    }

    static final class DelayedQuery {
        final java.util.concurrent.CountDownLatch entered = new java.util.concurrent.CountDownLatch(1);
        final java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
    }

    JsonNode create(String token, String product, Map<String, Object> snapshot) throws Exception {
        JsonNode quote = call(post("/api/v1/virtual-pay/quotes"), token, Map.of("product", product, "snapshot", snapshot), 200);
        return call(post("/api/v1/virtual-pay/orders"), token, Map.of("product", product, "snapshot", snapshot,
                "price_version", quote.path("price_version").asText(),
                "purchase_disclosure_version", "personal-virtual-pay-v1", "accepted", true), 201);
    }

    static Map<String, Object> delivery(String id, String code, String product, int price) {
        return Map.of("MsgType", "event", "Event", "xpay_goods_deliver_notify", "OpenId", "openid_" + code,
                "OutTradeNo", id, "Env", 0, "GoodsInfo", Map.of("ProductId", product, "Quantity", 1,
                        "OrigPrice", price, "ActualPrice", price, "Attach", id));
    }

    static Map<String, Object> refund(String id, String code, String suffix, int amount, int ret) {
        return Map.of("MsgType", "event", "Event", "xpay_refund_notify", "OpenId", "openid_" + code,
                "MchOrderId", id, "WxOrderId", "WX_" + id, "WxRefundId", "REF_" + id + suffix,
                "MchRefundId", "MREF_" + suffix, "RefundFee", amount, "RetCode", ret, "RefundSuccTimestamp", 1793059201);
    }

    void push(Map<String, Object> event, int status) throws Exception {
        byte[] key = java.util.Base64.getDecoder().decode(AES_KEY + "=");
        byte[] content = JSON.writeValueAsBytes(event);
        var plain = java.nio.ByteBuffer.allocate(20 + content.length + APP_ID.length());
        plain.put(new byte[16]).putInt(content.length).put(content).put(APP_ID.getBytes(StandardCharsets.UTF_8));
        int pad = 32 - plain.array().length % 32;
        byte[] padded = java.util.Arrays.copyOf(plain.array(), plain.array().length + pad);
        java.util.Arrays.fill(padded, plain.array().length, padded.length, (byte) pad);
        var cipher = javax.crypto.Cipher.getInstance("AES/CBC/NoPadding");
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, new javax.crypto.spec.SecretKeySpec(key, "AES"),
                new javax.crypto.spec.IvParameterSpec(java.util.Arrays.copyOf(key, 16)));
        String encrypted = java.util.Base64.getEncoder().encodeToString(cipher.doFinal(padded));
        var response = mvc.perform(post("/api/v1/webhooks/wechat-virtual-pay")
                .param("timestamp", "1793059200").param("nonce", "testnonce").param("encrypt_type", "aes")
                .param("msg_signature", sha1("testPushToken", "1793059200", "testnonce", encrypted))
                .contentType("application/json").content(JSON.writeValueAsBytes(Map.of("Encrypt", encrypted))))
                .andReturn().getResponse();
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(status);
        if (status == 200) assertThat(response.getContentAsString()).isEqualTo("success");
    }

    static String sha1(String... values) throws Exception {
        java.util.Arrays.sort(values);
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-1")
                .digest(String.join("", values).getBytes(StandardCharsets.UTF_8)));
    }

    String visitor() throws Exception {
        JsonNode session = call(post("/api/v1/sessions"), null,
                Map.of("client_instance_id", "client-" + UUID.randomUUID(), "device_class", "mainstream"), 201);
        String token = session.path("access_token").asText();
        call(post("/api/v1/sessions/" + session.path("session_id").asText() + "/consents"), token,
                Map.of("policy_version", "p0-alpha-2026-07-19", "adult_confirmed", true, "accepted", true), 201);
        return token;
    }

    void bind(String token, String code) throws Exception {
        call(post("/api/v1/identity/wechat/bind"), token, Map.of("login_code", code, "purpose", "payment"), 200);
    }

    JsonNode call(MockHttpServletRequestBuilder request, String token, Object body, int status) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        // Explicit keys supplied by callers are preserved by the builder's add-header behavior.
        if (request.buildRequest(new org.springframework.mock.web.MockServletContext()).getHeader("Idempotency-Key") == null)
            request.header("Idempotency-Key", "test-" + UUID.randomUUID());
        if (body != null) request.contentType("application/json").content(JSON.writeValueAsBytes(body));
        var response = mvc.perform(request).andReturn().getResponse();
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(status);
        JsonNode envelope = JSON.readTree(response.getContentAsString(StandardCharsets.UTF_8));
        return envelope.has("data") ? envelope.path("data") : envelope;
    }

    static Map<String, Object> snapshot(boolean career) {
        var result = new java.util.LinkedHashMap<String, Object>();
        result.put("answers", Map.of("traits", List.of(3, 4), "strengths", List.of(4, 5)));
        result.put("results", Map.of("traits", true, "strengths", true));
        result.put("sources", Map.of("traits", Map.of("kind", "native", "name", "测试版本"), "strengths", Map.of("kind", "native", "name", "测试版本")));
        result.put("experiences", List.of(Map.of("event", "整理一次团队协作", "action", "拆分工作", "result", "如期完成", "energy", "有精力"),
                Map.of("event", "完成一次学习", "action", "逐步练习", "result", "获得反馈", "energy", "平静")));
        result.put("goals", List.of("探索优势"));
        result.put("confirmed", true);
        if (career) result.put("career", Map.of("interests", List.of("技术"), "values", List.of("成长"), "skills", "软件开发", "goal", "探索下一步", "time", "每周两小时", "constraints", "维持工作"));
        return result;
    }

    static void platformOrder(String id, int status, int price) {
        PLATFORM.put(id, JSON.valueToTree(Map.of("order_id", id, "status", status, "order_type", 0,
                "order_fee", price, "paid_fee", status == 1 ? 0 : price, "left_fee", price,
                "paid_time", 1793059200, "env_type", 1, "wx_order_id", "WX_" + id)));
    }

    static HttpServer fakeWechat() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                byte[] bytes = exchange.getRequestBody().readAllBytes();
                String wire = new String(bytes, StandardCharsets.UTF_8);
                JsonNode body = wire.isBlank() ? JSON.createObjectNode() : JSON.readTree(wire);
                String path = exchange.getRequestURI().getPath();
                String query = exchange.getRequestURI().getRawQuery();
                Object response;
                if (path.equals("/sns/jscode2session")) {
                    String code = java.util.Arrays.stream(query.split("&")).filter(s -> s.startsWith("js_code=")).findFirst().orElseThrow().substring(8);
                    response = Map.of("openid", "openid_" + code, "session_key", SESSION_KEY);
                } else if (path.equals("/cgi-bin/stable_token")) {
                    response = Map.of("access_token", "test_access_token", "expires_in", 7200);
                } else if (path.equals("/xpay/query_order")) {
                    String expected = WechatVirtualPayProtocol.hmac(APP_KEY, path + "&" + wire);
                    if (!query.contains("pay_sig=" + expected)) throw new AssertionError("wrong exact-byte server HMAC");
                    String id = body.path("order_id").asText();
                    JsonNode observed = PLATFORM.getOrDefault(id, JSON.createObjectNode()).deepCopy();
                    DelayedQuery delayed = DELAYS.remove(id);
                    if (delayed != null) {
                        delayed.entered.countDown();
                        try { if (!delayed.release.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new java.io.IOException("local test release timeout"); }
                        catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new java.io.IOException(exception); }
                    }
                    response = Map.of("errcode", 0, "order", observed);
                } else if (path.equals("/xpay/notify_provide_goods")) {
                    PROVIDE_COUNT.incrementAndGet();
                    JsonNode order = PLATFORM.get(body.path("order_id").asText());
                    if (order != null) ((com.fasterxml.jackson.databind.node.ObjectNode) order).put("status", 4);
                    response = Map.of();
                } else response = Map.of("errcode", -1);
                byte[] result = JSON.writeValueAsBytes(response);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, result.length);
                exchange.getResponseBody().write(result);
                exchange.close();
            });
            server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool(task -> {
                Thread thread = new Thread(task, "fake-wechat"); thread.setDaemon(true); return thread;
            }));
            server.start();
            return server;
        } catch (java.io.IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
