package com.aichat.identity.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;

@Component
public final class SessionTokenService {
    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final byte[] hmacKey;

    public SessionTokenService(@Value("${aichat.security.session-token-key}") String encodedKey) {
        try {
            this.hmacKey = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("aichat.security.session-token-key 必须是 Base64", exception);
        }
        if (hmacKey.length < 32) {
            throw new IllegalStateException("aichat.security.session-token-key 解码后至少需要 32 字节");
        }
    }

    public String accessToken(String sessionId) {
        return derive("at1", sessionId);
    }

    public String refreshToken(String sessionId) {
        return derive("rt1", sessionId);
    }

    private String derive(String prefix, String sessionId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacKey, "HmacSHA256"));
            byte[] digest = mac.doFinal((prefix + ":" + sessionId).getBytes(StandardCharsets.UTF_8));
            return prefix + "." + TOKEN_ENCODER.encodeToString(digest);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HmacSHA256 不可用", exception);
        }
    }
}
