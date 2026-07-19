package com.aichat.kernel.api;

import java.util.Map;

public record ApiError(
        String code,
        String message,
        boolean retryable,
        Map<String, Object> details
) {
    public ApiError {
        details = details == null ? Map.of() : Map.copyOf(details);
    }
}
