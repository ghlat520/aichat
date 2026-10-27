package com.aichat.payment.application;

import com.aichat.kernel.api.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public final class WechatVirtualPayGateway {
    private final VirtualPaySettings settings;
    private final ObjectMapper json;
    private final Clock clock;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private String accessToken;
    private Instant tokenExpires = Instant.EPOCH;

    public WechatVirtualPayGateway(VirtualPaySettings settings, ObjectMapper json, Clock clock) {
        this.settings = settings;
        this.json = json;
        this.clock = clock;
    }

    public LoginSession login(String code) {
        settings.requireEnabled();
        String path = "/sns/jscode2session?appid=" + encode(settings.appId())
                + "&secret=" + encode(settings.appSecret()) + "&js_code=" + encode(code)
                + "&grant_type=authorization_code";
        JsonNode result = exchange(path, null, false);
        String openId = result.path("openid").asText();
        String sessionKey = result.path("session_key").asText();
        if (result.path("errcode").asInt() != 0 || openId.isBlank() || openId.length() > 128 || sessionKey.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WECHAT_LOGIN_FAILED", "微信登录凭据失效，请重新进入购买");
        }
        return new LoginSession(openId, sessionKey);
    }

    public JsonNode queryOrder(String openId, int environment, String orderId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("openid", openId);
        body.put("env", environment);
        body.put("order_id", orderId);
        String wire = write(body);
        String path = "/xpay/query_order";
        return exchange(path + "?access_token=" + encode(token()) + "&pay_sig="
                + WechatVirtualPayProtocol.hmac(settings.appKey(), path + "&" + wire), wire, true);
    }

    public void notifyProvided(String orderId, int environment) {
        String wire = write(Map.of("order_id", orderId, "env", environment));
        exchange("/xpay/notify_provide_goods?access_token=" + encode(token()), wire, true);
    }

    private synchronized String token() {
        settings.requireEnabled();
        if (accessToken != null && tokenExpires.isAfter(clock.instant())) return accessToken;
        JsonNode response = exchange("/cgi-bin/stable_token", write(Map.of(
                "grant_type", "client_credential", "appid", settings.appId(),
                "secret", settings.appSecret(), "force_refresh", false)), true);
        String next = response.path("access_token").asText();
        long seconds = response.path("expires_in").asLong();
        if (next.isBlank() || seconds < 1) throw unavailable();
        accessToken = next;
        tokenExpires = clock.instant().plusSeconds(Math.max(1, seconds - Math.min(120, seconds / 2)));
        return next;
    }

    private JsonNode exchange(String path, String wire, boolean rejectApiError) {
        settings.requireEnabled();
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(settings.apiBase() + path))
                    .timeout(Duration.ofSeconds(8)).header("Accept", "application/json");
            if (wire == null) request.GET();
            else request.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(wire));
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) throw unavailable();
            // notify_provide_goods documents no response schema; transport receipt alone is not delivery proof.
            if (response.body().isBlank()) return json.createObjectNode();
            JsonNode value = json.readTree(response.body());
            if (!value.isObject() || (rejectApiError && value.path("errcode").asInt() != 0)) throw unavailable();
            return value;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (IOException exception) {
            throw unavailable();
        }
    }

    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException exception) { throw new IllegalStateException("支付请求序列化失败", exception); }
    }

    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "WECHAT_PAY_UNAVAILABLE",
                "微信支付状态暂时无法确认，请查询原订单", true, Map.of());
    }

    public record LoginSession(String openId, String sessionKey) {
        @Override public String toString() { return "LoginSession[redacted]"; }
    }
}
