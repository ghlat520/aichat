package com.aichat.payment.application;

import com.aichat.kernel.api.ApiException;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public final class VirtualPaySettings {
    private final boolean enabled;
    private final String appId;
    private final String appSecret;
    private final String offerId;
    private final String appKey;
    private final String pushToken;
    private final String aesKey;
    private final String apiBase;

    public VirtualPaySettings(Environment environment) {
        enabled = Boolean.parseBoolean(value(environment, "enabled", "false"));
        appId = value(environment, "app-id", "");
        appSecret = value(environment, "app-secret", "");
        offerId = value(environment, "offer-id", "");
        appKey = value(environment, "app-key", "");
        pushToken = value(environment, "push-token", "");
        aesKey = value(environment, "encoding-aes-key", "");
        apiBase = value(environment, "api-base", "https://api.weixin.qq.com").replaceAll("/+$", "");
        URI uri = URI.create(apiBase);
        boolean localTest = environment.acceptsProfiles(Profiles.of("virtual-pay-test", "virtual-pay-local"))
                && "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost())
                && (uri.getPath().isEmpty() || "/".equals(uri.getPath()))
                && uri.getUserInfo() == null && uri.getQuery() == null;
        if (!"https://api.weixin.qq.com".equals(apiBase) && !localTest) {
            throw new IllegalStateException("微信支付API地址必须为官方地址；本地替身仅允许隔离测试profile");
        }
        if (enabled && (!appId.matches("wx[a-zA-Z0-9]{16}") || appSecret.length() < 16
                || !offerId.matches("[0-9]{1,32}") || appKey.length() < 16
                || !pushToken.matches("[a-zA-Z0-9]{3,32}") || !validAesKey(aesKey))) {
            throw new IllegalStateException("虚拟支付已启用，但身份、商品或安全消息配置不完整");
        }
    }

    private static boolean validAesKey(String value) {
        try { return value.length() == 43 && java.util.Base64.getDecoder().decode(value + "=").length == 32; }
        catch (IllegalArgumentException exception) { return false; }
    }

    private static String value(Environment environment, String key, String fallback) {
        return environment.getProperty("aichat.virtual-pay." + key, fallback).strip();
    }

    public void requireEnabled() {
        if (!enabled) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "VIRTUAL_PAY_NOT_CONFIGURED", "个人虚拟支付尚未开通或配置，请稍后再试");
    }

    public boolean enabled() { return enabled; }
    public String appId() { return appId; }
    public String appSecret() { return appSecret; }
    public String offerId() { return offerId; }
    public String appKey() { return appKey; }
    public String apiBase() { return apiBase; }
    public int environment() { return 0; }
    public WechatVirtualPayProtocol.PushConfig pushConfig() {
        return new WechatVirtualPayProtocol.PushConfig(pushToken, aesKey, appId);
    }
}
