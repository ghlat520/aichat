package com.aichat.kernel.api;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final boolean retryable;
    private final Map<String, Object> details;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, false, Map.of());
    }

    public ApiException(
            HttpStatus status,
            String code,
            String message,
            boolean retryable,
            Map<String, Object> details
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryable = retryable;
        this.details = details == null ? Map.of() : Map.copyOf(details);
    }

    public HttpStatus status() {
        return status;
    }

    public ApiError error() {
        return new ApiError(code, getMessage(), retryable, details);
    }
}
