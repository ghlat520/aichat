package com.aichat.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SessionConsentWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void sessionCreationIsIdempotentAndStoresOnlyHashes() throws Exception {
        String idempotencyKey = "session-" + UUID.randomUUID();
        JsonNode first = createSession(idempotencyKey, "client-instance-00000001");
        JsonNode replay = createSession(idempotencyKey, "client-instance-00000001");

        assertThat(replay.path("data").path("session_id").asText())
                .isEqualTo(first.path("data").path("session_id").asText());
        assertThat(replay.path("data").path("access_token").asText())
                .isEqualTo(first.path("data").path("access_token").asText());
        assertThat(replay.path("data").path("refresh_token").asText())
                .isEqualTo(first.path("data").path("refresh_token").asText());

        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "SELECT client_instance_hash, access_token_hash, refresh_token_hash FROM id_visitor_session WHERE id = ?",
                first.path("data").path("session_id").asText()
        );
        assertThat(stored.values()).allSatisfy(value ->
                assertThat(String.valueOf(value)).matches("[a-f0-9]{64}"));
        assertThat(stored.values()).doesNotContain(
                "client-instance-00000001",
                first.path("data").path("access_token").asText(),
                first.path("data").path("refresh_token").asText()
        );
    }

    @Test
    void sameIdempotencyKeyCannotBeReusedForAnotherRequest() throws Exception {
        String idempotencyKey = "session-" + UUID.randomUUID();
        createSession(idempotencyKey, "client-instance-00000002");

        mockMvc.perform(post("/api/v1/sessions")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType("application/json")
                        .content("""
                                {
                                  "client_instance_id": "different-client-0000002",
                                  "device_class": "mainstream"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void consentIsRequiredBeforeInteractiveApisAndOwnershipIsEnforced() throws Exception {
        JsonNode created = createSession(
                "session-" + UUID.randomUUID(),
                "client-instance-00000003"
        );
        String sessionId = created.path("data").path("session_id").asText();
        String accessToken = created.path("data").path("access_token").asText();

        mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("AUTHENTICATION_REQUIRED"));

        mockMvc.perform(post("/api/v1/sessions/01J00000000000000000000000/consents")
                        .header("Authorization", "Bearer " + accessToken)
                        .header("Idempotency-Key", "consent-wrong-" + UUID.randomUUID())
                        .contentType("application/json")
                        .content(consentBody()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));

        String consentKey = "consent-" + UUID.randomUUID();
        MvcResult consent = mockMvc.perform(post("/api/v1/sessions/{sessionId}/consents", sessionId)
                        .header("Authorization", "Bearer " + accessToken)
                        .header("Idempotency-Key", consentKey)
                        .contentType("application/json")
                        .content(consentBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.session_id").value(sessionId))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();

        String consentId = objectMapper.readTree(consent.getResponse().getContentAsString())
                .path("data").path("consent_id").asText();
        mockMvc.perform(post("/api/v1/sessions/{sessionId}/consents", sessionId)
                        .header("Authorization", "Bearer " + accessToken)
                        .header("Idempotency-Key", consentKey)
                        .contentType("application/json")
                        .content(consentBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.consent_id").value(consentId));

        mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("FEATURE_DISABLED"));
    }

    @Test
    void safetyResourcesRemainAvailableWithoutSession() throws Exception {
        mockMvc.perform(get("/api/v1/safety-resources"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value("cn-mainland-2026-07-19"))
                .andExpect(jsonPath("$.data.resources[0].code").value("110"))
                .andExpect(jsonPath("$.data.resources[1].code").value("120"))
                .andExpect(jsonPath("$.data.resources[2].code").value("12356"));
    }

    private JsonNode createSession(String idempotencyKey, String clientInstanceId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/sessions")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType("application/json")
                        .content("""
                                {
                                  "client_instance_id": "%s",
                                  "device_class": "mainstream"
                                }
                                """.formatted(clientInstanceId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING_CONSENT"))
                .andExpect(jsonPath("$.data.auth_level").value("Visitor"))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String consentBody() {
        return """
                {
                  "policy_version": "p0-alpha-2026-07-19",
                  "adult_confirmed": true,
                  "accepted": true
                }
                """;
    }
}
