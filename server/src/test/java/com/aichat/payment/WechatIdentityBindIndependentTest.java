package com.aichat.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 登录身份绑定只依赖小程序 AppID/AppSecret（code2Session 基础能力），
// 不得被虚拟支付总开关拦截；支付类操作仍须虚拟支付启用。规格见
// docs/WECHAT_IDENTITY_LOGIN_SPEC_2026-10-27.md §P1 与 §附（耦合债修正）。
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("virtual-pay-test")
class WechatIdentityBindIndependentTest {
    static final ObjectMapper JSON = new ObjectMapper();
    static final Map<String, String> OPENIDS = new ConcurrentHashMap<>();
    static final HttpServer WECHAT = fakeWechat();

    @DynamicPropertySource
    static void config(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:wechatbind;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        registry.add("aichat.virtual-pay.enabled", () -> "false");
        registry.add("aichat.virtual-pay.app-id", () -> "wx1234567890abcdef");
        registry.add("aichat.virtual-pay.app-secret", () -> "test_app_secret_not_real");
        registry.add("aichat.virtual-pay.api-base", () -> "http://127.0.0.1:" + WECHAT.getAddress().getPort());
    }

    @Autowired org.springframework.test.web.servlet.MockMvc mvc;

    @AfterAll static void stop() { WECHAT.stop(0); }

    private static HttpServer fakeWechat() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                String code = exchange.getRequestURI().getQuery().replaceAll(".*js_code=([^&]*).*", "$1");
                String openid = OPENIDS.computeIfAbsent(code, key -> "o" + UUID.randomUUID().toString().replace("-", ""));
                byte[] body = ("{\"openid\":\"" + openid + "\",\"session_key\":\"sk_test_123456\"}")
                        .getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
            return server;
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    @Test
    void bindSucceedsWithOnlyAppIdAndSecretWhileVirtualPayDisabled() throws Exception {
        JsonNode session = call(post("/api/v1/sessions"), null,
                Map.of("client_instance_id", "client-" + UUID.randomUUID(), "device_class", "mainstream"), 201);
        String token = session.path("access_token").asText();
        call(post("/api/v1/sessions/" + session.path("session_id").asText() + "/consents"), token,
                Map.of("policy_version", "p0-alpha-2026-07-19", "adult_confirmed", true, "accepted", true), 201);
        mvc.perform(post("/api/v1/identity/wechat/bind")
                        .header("Authorization", "Bearer " + token)
                        .header("Idempotency-Key", "bind-" + UUID.randomUUID())
                        .contentType("application/json")
                        .content("{\"login_code\":\"login_" + UUID.randomUUID() + "\",\"purpose\":\"payment\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.auth_level").value("Principal"));
    }

    @Test
    void paymentQuoteStillRequiresVirtualPayEnabled() throws Exception {
        JsonNode session = call(post("/api/v1/sessions"), null,
                Map.of("client_instance_id", "client-" + UUID.randomUUID(), "device_class", "mainstream"), 201);
        String token = session.path("access_token").asText();
        call(post("/api/v1/sessions/" + session.path("session_id").asText() + "/consents"), token,
                Map.of("policy_version", "p0-alpha-2026-07-19", "adult_confirmed", true, "accepted", true), 201);
        mvc.perform(post("/api/v1/virtual-pay/quotes")
                        .header("Authorization", "Bearer " + token)
                        .header("Idempotency-Key", "quote-" + UUID.randomUUID())
                        .contentType("application/json")
                        .content(JSON.writeValueAsString(Map.of("product", "base", "snapshot", validSnapshot()))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("VIRTUAL_PAY_NOT_CONFIGURED"));
    }

    static Map<String, Object> validSnapshot() {
        var result = new java.util.LinkedHashMap<String, Object>();
        result.put("answers", Map.of("traits", java.util.List.of(3, 4), "strengths", java.util.List.of(4, 5)));
        result.put("results", Map.of("traits", true, "strengths", true));
        result.put("sources", Map.of("traits", Map.of("kind", "native", "name", "测试版本"), "strengths", Map.of("kind", "native", "name", "测试版本")));
        result.put("experiences", java.util.List.of(
                Map.of("event", "整理一次团队协作", "action", "拆分工作", "result", "如期完成", "energy", "有精力"),
                Map.of("event", "完成一次学习", "action", "逐步练习", "result", "获得反馈", "energy", "平静")));
        result.put("goals", java.util.List.of("探索优势"));
        result.put("confirmed", true);
        return result;
    }

    JsonNode call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token,
            Object body, int status) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        request.header("Idempotency-Key", "call-" + UUID.randomUUID());
        String response = mvc.perform(request.contentType("application/json")
                        .content(JSON.writeValueAsString(body)))
                .andExpect(status().is(status))
                .andReturn().getResponse().getContentAsString();
        return JSON.readTree(response).path("data");
    }
}
