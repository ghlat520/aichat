package com.aichat.kernel.api;

import org.springframework.http.HttpStatus;

import java.util.regex.Pattern;

public final class IdempotencyKeys {
    private static final Pattern ALLOWED = Pattern.compile("[A-Za-z0-9._:-]+");

    private IdempotencyKeys() {
    }

    public static void requireValid(String value) {
        if (value == null
                || value.length() < 16
                || value.length() > 128
                || !ALLOWED.matcher(value).matches()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_IDEMPOTENCY_KEY",
                    "幂等键必须为 16–128 位，且只能包含字母、数字、点、下划线、冒号或连字符"
            );
        }
    }
}
