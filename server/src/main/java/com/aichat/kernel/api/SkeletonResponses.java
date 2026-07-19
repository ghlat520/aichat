package com.aichat.kernel.api;

import org.springframework.http.HttpStatus;

import java.util.Map;

public final class SkeletonResponses {
    private SkeletonResponses() {
    }

    public static <T> T notImplemented(String operationId) {
        throw new ApiException(
                HttpStatus.NOT_IMPLEMENTED,
                "API_NOT_IMPLEMENTED",
                "该契约端点已建立，但应用服务尚未接入",
                false,
                Map.of("operation_id", operationId)
        );
    }
}
