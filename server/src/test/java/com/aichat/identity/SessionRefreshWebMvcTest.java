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

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SessionRefreshWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void activeSessionRefreshesAccessWindowAndBindingUpgradesAuthLevel() throws Exception {
        JsonNode created = createSession("session-" + UUID.randomUUID(), "client-instance-refresh-0001");
        String sessionId = created.path("session_id").asText();
        String accessToken = created.path("access_token").asText();
        String refreshToken = created.path("refresh_token").asText();
        recordConsent(sessionId, accessToken);

        expireAccessWindow(sessionId);
        mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());

        String idempotencyKey = "refresh-" + UUID.randomUUID();
        JsonNode refreshed = refresh(refreshToken, idempotencyKey);
        assertThat(refreshed.path("session_id").asText()).isEqualTo(sessionId);
        assertThat(refreshed.path("access_token").asText()).startsWith("at1.").isEqualTo(accessToken);
        assertThat(refreshed.path("refresh_token").asText()).startsWith("rt1.").isEqualTo(refreshToken);
        assertThat(refreshed.path("token_type").asText()).isEqualTo("Bearer");
        assertThat(refreshed.path("auth_level").asText()).isEqualTo("Visitor");
        assertThat(refreshed.path("status").asText()).isEqualTo("ACTIVE");
        assertThat(refreshed.path("expires_at").asText()).isNotBlank();

        JsonNode replay = refresh(refreshToken, idempotencyKey);
        assertThat(replay).isEqualTo(refreshed);

        mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("FEATURE_DISABLED"));

        insertBindingStub(sessionId);
        JsonNode principal = refresh(refreshToken, "refresh-" + UUID.randomUUID());
        assertThat(principal.path("session_id").asText()).isEqualTo(sessionId);
        assertThat(principal.path("auth_level").asText()).isEqualTo("Principal");

        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "SELECT access_token_hash, refresh_token_hash FROM id_visitor_session WHERE id = ?",
                sessionId
        );
        assertThat(stored.values()).allSatisfy(value ->
                assertThat(String.valueOf(value)).matches("[a-f0-9]{64}"));
        assertThat(stored.values()).doesNotContain(accessToken, refreshToken);
    }

    @Test
    void revokedAndUnknownRefreshTokensAreRejected() throws Exception {
        JsonNode created = createSession("session-" + UUID.randomUUID(), "client-instance-refresh-0002");
        String sessionId = created.path("session_id").asText();
        String refreshToken = created.path("refresh_token").asText();
        recordConsent(sessionId, created.path("access_token").asText());

        jdbcTemplate.update("UPDATE id_visitor_session SET status = 'REVOKED' WHERE id = ?", sessionId);
        mockMvc.perform(post("/api/v1/tokens/refresh")
                        .header("X-Refresh-Token", refreshToken)
                        .header("Idempotency-Key", "refresh-" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("AUTHENTICATION_REQUIRED"));

        mockMvc.perform(post("/api/v1/tokens/refresh")
                        .header("X-Refresh-Token", "rt1." + "0".repeat(64))
                        .header("Idempotency-Key", "refresh-" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void pendingConsentSessionMayRefreshAndThenConsent() throws Exception {
        JsonNode created = createSession("session-" + UUID.randomUUID(), "client-instance-refresh-0003");
        String sessionId = created.path("session_id").asText();
        String accessToken = created.path("access_token").asText();
        String refreshToken = created.path("refresh_token").asText();

        JsonNode refreshed = refresh(refreshToken, "refresh-" + UUID.randomUUID());
        assertThat(refreshed.path("session_id").asText()).isEqualTo(sessionId);
        assertThat(refreshed.path("status").asText()).isEqualTo("PENDING_CONSENT");
        assertThat(refreshed.path("auth_level").asText()).isEqualTo("Visitor");

        recordConsent(sessionId, accessToken);
        JsonNode afterConsent = refresh(refreshToken, "refresh-" + UUID.randomUUID());
        assertThat(afterConsent.path("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void refreshIdempotencyKeyCannotBeReusedAcrossSessions() throws Exception {
        String idempotencyKey = "refresh-" + UUID.randomUUID();
        JsonNode first = createSession("session-" + UUID.randomUUID(), "client-instance-refresh-0004");
        JsonNode second = createSession("session-" + UUID.randomUUID(), "client-instance-refresh-0005");

        refresh(first.path("refresh_token").asText(), idempotencyKey);
        mockMvc.perform(post("/api/v1/tokens/refresh")
                        .header("X-Refresh-Token", second.path("refresh_token").asText())
                        .header("Idempotency-Key", idempotencyKey))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IDEMPOTENCY_KEY_REUSED"));
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
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private void recordConsent(String sessionId, String accessToken) throws Exception {
        mockMvc.perform(post("/api/v1/sessions/{sessionId}/consents", sessionId)
                        .header("Authorization", "Bearer " + accessToken)
                        .header("Idempotency-Key", "consent-" + UUID.randomUUID())
                        .contentType("application/json")
                        .content("""
                                {
                                  "policy_version": "p0-alpha-2026-07-19",
                                  "adult_confirmed": true,
                                  "accepted": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    private JsonNode refresh(String refreshToken, String idempotencyKey) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/tokens/refresh")
                        .header("X-Refresh-Token", refreshToken)
                        .header("Idempotency-Key", idempotencyKey))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private void expireAccessWindow(String sessionId) {
        jdbcTemplate.update("UPDATE id_visitor_session SET access_expires_at = ? WHERE id = ?",
                LocalDateTime.now(ZoneOffset.UTC).minusHours(1), sessionId);
    }

    private void insertBindingStub(String sessionId) {
        jdbcTemplate.update("""
                        INSERT INTO id_wechat_payment_session (visitor_session_id, buyer_id, authenticated_at)
                        VALUES (?, ?, ?)
                        """,
                sessionId,
                "b".repeat(64),
                LocalDateTime.now(ZoneOffset.UTC)
        );
    }
}
