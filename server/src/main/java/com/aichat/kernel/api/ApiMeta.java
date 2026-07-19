package com.aichat.kernel.api;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ApiMeta(@JsonProperty("api_version") String apiVersion) {

    public static ApiMeta v1() {
        return new ApiMeta("v1");
    }
}
