package com.aichat.kernel.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

public final class Sha256Fingerprints {
    private Sha256Fingerprints() {
    }

    public static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("SHA-256 不可用", exception);
        }
    }

    public static String canonicalRequest(String scope, String... values) {
        StringBuilder canonical = new StringBuilder(scope);
        for (String value : values) {
            canonical.append('\u0000').append(value == null ? "" : value);
        }
        return hash(canonical.toString());
    }
}
