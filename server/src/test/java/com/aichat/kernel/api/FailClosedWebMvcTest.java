package com.aichat.kernel.api;

import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.auth.AuthenticatedSubject;
import com.aichat.kernel.auth.SubjectResolver;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.Set;

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
    void publicSafetyConfigurationWorksWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/app-config"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-ID"))
                .andExpect(jsonPath("$.data.product_code").value("RELATIONSHIP_CLARITY_CARD_V1"))
                .andExpect(jsonPath("$.data.feature_flags.assessment").value(false))
                .andExpect(jsonPath("$.data.feature_flags.venting").value(false))
                .andExpect(jsonPath("$.data.feature_flags.generation").value(false))
                .andExpect(jsonPath("$.data.feature_flags.payment").value(false))
                .andExpect(jsonPath("$.data.entry_paths.length()").value(1))
                .andExpect(jsonPath("$.data.entry_paths[0]").value("DIRECT"))
                .andExpect(jsonPath("$.error").doesNotExist())
                .andExpect(jsonPath("$.meta.api_version").value("v1"));
    }

    @Test
    void protectedEndpointIsDeniedUntilARealOpaqueTokenResolverIsInstalled() throws Exception {
        mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", "Bearer not-a-real-session"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("AUTHENTICATION_REQUIRED"));
        mockMvc.perform(get("/ops/v1/safety-review-cases")
                        .header("Authorization", "Bearer not-a-real-operator"))
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

    @Test
    void principalReachesOrderingContractAndReceivesExplicit501Stub() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer test-principal")
                        .header("Idempotency-Key", "order-stub-contract-0001")
                        .contentType("application/json")
                        .content("""
                                {
                                  "report_id": "01J00000000000000000000000",
                                  "sku": "RELATIONSHIP_CLARITY_CARD_V1",
                                  "purchase_disclosure_version": "purchase-v1",
                                  "accepted": true
                                }
                                """))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.error.code").value("API_NOT_IMPLEMENTED"))
                .andExpect(jsonPath("$.error.details.operation_id").value("createOrder"));
    }

    @TestConfiguration
    static class PrincipalAuthConfig {
        @Bean
        @Primary
        SubjectResolver testPrincipalSubjectResolver() {
            return (request, policy) -> {
                if ("Bearer test-principal".equals(request.getHeader("Authorization"))) {
                    return Optional.of(new AuthenticatedSubject(
                            "principal-order-contract", AuthLevel.PRINCIPAL, Set.of(), false));
                }
                return Optional.empty();
            };
        }
    }
}
