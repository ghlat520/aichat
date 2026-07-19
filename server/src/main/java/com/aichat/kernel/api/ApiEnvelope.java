package com.aichat.kernel.api;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ApiEnvelope<T>(
        @JsonProperty("request_id") String requestId,
        T data,
        ApiError error,
        ApiMeta meta
) {
    public static <T> ApiEnvelope<T> success(String requestId, T data) {
        return new ApiEnvelope<>(requestId, data, null, ApiMeta.v1());
    }

    public static ApiEnvelope<Void> failure(String requestId, ApiError error) {
        return new ApiEnvelope<>(requestId, null, error, ApiMeta.v1());
    }
}
