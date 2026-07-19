package com.aichat.kernel.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class FailClosedWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicEndpointReachesTheSkeletonWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/app-config"))
                .andExpect(status().isNotImplemented())
                .andExpect(header().exists("X-Request-ID"))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("API_NOT_IMPLEMENTED"))
                .andExpect(jsonPath("$.meta.api_version").value("v1"));
    }

    @Test
    void protectedEndpointIsDeniedUntilARealOpaqueTokenResolverIsInstalled() throws Exception {
        mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", "Bearer not-a-real-session"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void requestDtoRejectsPropertiesThatTheContractDoesNotDeclare() throws Exception {
        mockMvc.perform(post("/api/v1/sessions")
                        .contentType("application/json")
                        .header("Idempotency-Key", "session-create-0001")
                        .content("""
                                {
                                  "client_instance_id": "client-instance-00000001",
                                  "unexpected": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("MALFORMED_REQUEST"));
    }
}
