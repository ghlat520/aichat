package com.aichat.report.application;

import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.payment.application.VirtualPaySettings;
import com.aichat.payment.application.VirtualPaymentMapper;
import com.aichat.payment.application.VirtualPaymentMapper.Order;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Report-specific pricing, frozen input and dependent entitlement rules; no WeChat protocol here. */
@Component
public final class GrowthReportPurchasePolicy {
    private final VirtualPaymentMapper mapper;
    private final VirtualPaySettings settings;
    private final ObjectMapper json;
    private final Map<String, String> products;
    private final int basePrice;
    private final int careerPrice;
    private final int upgradePrice;
    public GrowthReportPurchasePolicy(VirtualPaymentMapper mapper, VirtualPaySettings settings, ObjectMapper json, Environment environment) {
        this.mapper = mapper; this.settings = settings; this.json = json;
        products = Map.of("base", value(environment, "base-product-id", ""), "career", value(environment, "career-product-id", ""),
                "upgrade", value(environment, "upgrade-product-id", ""));
        basePrice = Integer.parseInt(value(environment, "base-price-fen", "2990"));
        careerPrice = Integer.parseInt(value(environment, "career-price-fen", "4990"));
        upgradePrice = Integer.parseInt(value(environment, "upgrade-price-fen", "2000"));
        if (basePrice <= 0 || careerPrice <= basePrice || upgradePrice != careerPrice - basePrice
                || (settings.enabled() && (products.values().stream().anyMatch(id -> id.isBlank() || id.length() > 128)
                || Set.copyOf(products.values()).size() != 3)))
            throw new IllegalStateException("报告商品、整数分价格或补差配置不匹配");
    }
    private static String value(Environment environment, String key, String fallback) { return environment.getProperty("aichat.virtual-pay." + key, fallback).strip(); }
    public String productId(String sku) { return products.get(sku); }
    public int price(String sku) { return switch (sku) { case "base" -> basePrice; case "upgrade" -> upgradePrice; default -> careerPrice; }; }
    public boolean canSign(Order order) { return order.productId().equals(productId(order.sku())) && order.priceFen() == price(order.sku()); }
    public String disclosureVersion() { return "personal-virtual-pay-v1"; }
    public String reportVersion() { return "growth-v1"; }
    public boolean canDeliver(Order order) { return order.baseOrderId() == null || active(mapper.order(order.baseOrderId())); }
    public void suspendDependents(Order order, LocalDateTime now) { mapper.suspendUpgrade(order.id(), now); }
    public void resumeDependents(Order order, LocalDateTime now) { mapper.resumeUpgrade(order.id(), now); }
    private static boolean active(Order order) { return order != null && order.hasActiveEntitlement(); }
    public static String purchaseKey(String buyer, String snapshot, String product) {
        return Sha256Fingerprints.canonicalRequest("virtual-purchase", buyer, snapshot, product);
    }
    public Quote quote(String buyer, String product, JsonNode snapshot) {
        ObjectNode baseSnapshot = snapshot.deepCopy();
        baseSnapshot.remove("career");
        String snapshotKey = hash(canonical(baseSnapshot));
        Order base = buyer == null ? null : mapper.activePurchase(purchaseKey(buyer, snapshotKey, "base"));
        Order career = buyer == null ? null : mapper.activePurchase(purchaseKey(buyer, snapshotKey, "career"));
        Order existing = "career".equals(product) ? career : career != null ? career : base;
        String baseId = "career".equals(product) && base != null && active(base) ? base.id() : null;
        // A pending or suspended base purchase must be resolved before a second purchase can supersede it.
        if ("career".equals(product) && base != null && !active(base) && career == null)
            throw conflict("BASE_PURCHASE_UNRESOLVED", "请先查询原基础订单或联系售后");
        if (existing == null && baseId != null && (base.paidFen() == null || base.paidFen() != careerPrice - upgradePrice))
            throw conflict("UPGRADE_PRICE_UNAVAILABLE", "原基础实付与当前补差商品不匹配，请联系售后核实");
        String sku = baseId == null ? product : "upgrade";
        int price = price(sku);
        String version = hash(Sha256Fingerprints.canonicalRequest("virtual-price", settings.appId(),
                settings.offerId(), productId(sku), sku, Integer.toString(price), String.valueOf(baseId)));
        return new Quote(sku, price, snapshotKey, baseId, version, existing);
    }

    public record Quote(String sku, int price, String snapshotKey, String baseOrderId, String priceVersion, Order existing) { }

    public JsonNode snapshot(String product, ContractRequests.GrowthPurchaseSnapshot snapshot) {
        Set<String> tools = Set.of("mbti", "traits", "strengths");
        if (!tools.containsAll(snapshot.answers().keySet()) || !tools.containsAll(snapshot.results().keySet())
                || !tools.containsAll(snapshot.sources().keySet()) || !snapshot.confirmed()
                || !Boolean.TRUE.equals(snapshot.results().get("traits")) || !Boolean.TRUE.equals(snapshot.results().get("strengths"))
                || snapshot.goals().isEmpty()) throw invalidSnapshot();
        snapshot.answers().values().forEach(list -> {
            if (list == null || list.size() > 50 || list.stream().anyMatch(x -> x == null || x < 1 || x > 5)) throw invalidSnapshot();
        });
        snapshot.sources().values().forEach(source -> {
            if (source == null || source.size() > 4 || !Set.of("kind", "name", "date", "type").containsAll(source.keySet())
                    || source.values().stream().anyMatch(value -> value == null || value.length() > 128)) throw invalidSnapshot();
        });
        if (!snapshot.sources().containsKey("traits") || !snapshot.sources().containsKey("strengths")) throw invalidSnapshot();
        if ("career".equals(product) && (snapshot.career() == null || snapshot.career().interests().isEmpty()
                || snapshot.career().values().isEmpty() || snapshot.career().goal().isBlank())) throw invalidSnapshot();
        ObjectNode value = json.valueToTree(snapshot);
        Map<String, Boolean> completed = new TreeMap<>();
        Map<String, Object> answers = new TreeMap<>();
        Map<String, Object> sources = new TreeMap<>();
        for (String tool : tools) {
            boolean included = Boolean.TRUE.equals(snapshot.results().get(tool));
            completed.put(tool, included);
            if (included) {
                answers.put(tool, snapshot.answers().getOrDefault(tool, java.util.List.of()));
                sources.put(tool, snapshot.sources().get(tool));
            }
        }
        value.set("results", json.valueToTree(completed));
        value.set("answers", json.valueToTree(answers));
        value.set("sources", json.valueToTree(sources));
        if ("base".equals(product)) value.remove("career");
        return value;
    }

    public String canonical(Object value) { return write(sorted(json.valueToTree(value))); }
    private Object sorted(JsonNode value) {
        if (value.isObject()) {
            Map<String, Object> fields = new TreeMap<>();
            value.fields().forEachRemaining(e -> fields.put(e.getKey(), sorted(e.getValue())));
            return fields;
        }
        if (value.isArray()) {
            var values = new java.util.ArrayList<>(); value.forEach(child -> values.add(sorted(child))); return values;
        }
        return value;
    }
    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (java.io.IOException exception) { throw new IllegalStateException("购买输入编码失败", exception); }
    }
    private static String hash(String value) { return Sha256Fingerprints.hash(value); }
    private static ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }
    private static ApiException invalidSnapshot() { return new ApiException(HttpStatus.BAD_REQUEST, "GROWTH_SNAPSHOT_NOT_READY", "请完成必需测评、两段经历及探索目标"); }
}
