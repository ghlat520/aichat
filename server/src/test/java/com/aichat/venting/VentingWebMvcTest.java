package com.aichat.venting;

import com.aichat.venting.application.VentingExpiryJob;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "aichat.features.venting-enabled=true",
        "aichat.venting.cleanup-ms=3600000",
        "aichat.venting.cleanup-initial-ms=3600000"
})
@AutoConfigureMockMvc
class VentingWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private VentingExpiryJob expiryJob;

    @Autowired
    private Clock clock;

    @Test
    void fullFlowIsOwnedIdempotentEncryptedAndMapsConfirmedFieldsToClarity() throws Exception {
        Visitor owner = createConsentedVisitor("full-owner");
        Visitor other = createConsentedVisitor("full-other");
        String createKey = unique("vent-create");
        JsonNode created = createVent(owner, createKey)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.state").value("ACTIVE"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.max_ai_turns").value(8))
                .andExpect(jsonPath("$.data.ai_turns_used").value(0))
                .andExpect(jsonPath("$.data.ai_label").value("AI 辅助整理"))
                .andReturnBody(objectMapper);
        String sessionId = created.path("data").path("vent_session_id").asText();
        createVent(owner, createKey)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.vent_session_id").value(sessionId));

        turn(other, sessionId, unique("other"), 1, "这是一段属于其他用户的倾诉内容。")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));

        String rawTurn = "对方连续两次在约定前取消见面，并让我联系 alice@example.com 或 13800138000。";
        String turnKey = unique("turn");
        JsonNode turn = turn(owner, sessionId, turnKey, 1, rawTurn)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("ACTIVE"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.safety.route").value("ALLOW"))
                .andExpect(jsonPath("$.data.ai_turns_used").value(1))
                .andExpect(jsonPath("$.data.ai_turns_remaining").value(7))
                .andExpect(jsonPath("$.data.can_finish").value(true))
                .andExpect(jsonPath("$.data.reply.ai_label").value("AI 辅助整理"))
                .andReturnBody(objectMapper);
        String turnId = turn.path("data").path("turn_id").asText();
        turn(owner, sessionId, turnKey, 1, rawTurn)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.turn_id").value(turnId))
                .andExpect(jsonPath("$.data.version").value(2));

        String finishKey = unique("finish");
        JsonNode finished = finish(owner, sessionId, finishKey, 2)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.state").value("SUMMARY_READY"))
                .andExpect(jsonPath("$.data.version").value(3))
                .andExpect(jsonPath("$.data.summary.observed_fact").isString())
                .andExpect(jsonPath("$.data.summary.looping_thought").isString())
                .andExpect(jsonPath("$.data.summary.emotion").isArray())
                .andExpect(jsonPath("$.data.summary.need_or_boundary").isArray())
                .andExpect(jsonPath("$.data.summary.current_goal").isString())
                .andReturnBody(objectMapper);
        String summaryVersion = finished.path("data").path("summary_version").asText();
        finish(owner, sessionId, finishKey, 2)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.summary_version").value(summaryVersion));

        Map<String, Object> confirmedFields = safeSummaryFields();
        String confirmKey = unique("confirm");
        JsonNode confirmed = confirm(owner, sessionId, confirmKey, 3, summaryVersion, confirmedFields)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.version").value(4))
                .andExpect(jsonPath("$.data.task_state").value("FIELDS_SAVED"))
                .andExpect(jsonPath("$.data.task_version").value(2))
                .andExpect(jsonPath("$.data.content_version").isString())
                .andReturnBody(objectMapper);
        String taskId = confirmed.path("data").path("task_id").asText();
        String contentVersion = confirmed.path("data").path("content_version").asText();
        confirm(owner, sessionId, confirmKey, 3, summaryVersion, confirmedFields)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.task_id").value(taskId));

        mockMvc.perform(get("/api/v1/tasks/{taskId}", taskId)
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entry_type").value("VENT"))
                .andExpect(jsonPath("$.data.state").value("FIELDS_SAVED"))
                .andExpect(jsonPath("$.data.fields.observed_fact").value(confirmedFields.get("observed_fact")))
                .andExpect(jsonPath("$.data.fields.interpretation").value(confirmedFields.get("looping_thought")));

        createVent(owner, createKey)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.vent_session_id").value(sessionId))
                .andExpect(jsonPath("$.data.state").value("ACTIVE"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.ai_turns_used").value(0));
        turn(owner, sessionId, turnKey, 1, rawTurn)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.turn_id").value(turnId))
                .andExpect(jsonPath("$.data.state").value("ACTIVE"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.ai_turns_used").value(1))
                .andExpect(jsonPath("$.data.can_finish").value(true));
        finish(owner, sessionId, finishKey, 2)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.state").value("SUMMARY_READY"))
                .andExpect(jsonPath("$.data.version").value(3))
                .andExpect(jsonPath("$.data.summary_version").value(summaryVersion))
                .andExpect(jsonPath("$.data.can_confirm").value(true));

        assertThat(jdbcTemplate.update(
                "UPDATE ct_clarity_task SET state = 'MIRROR_REVIEW', version_no = 3 WHERE id = ? AND version_no = 2",
                taskId
        )).isEqualTo(1);
        confirm(owner, sessionId, confirmKey, 3, summaryVersion, confirmedFields)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.version").value(4))
                .andExpect(jsonPath("$.data.task_state").value("FIELDS_SAVED"))
                .andExpect(jsonPath("$.data.task_version").value(2))
                .andExpect(jsonPath("$.data.content_version").value(contentVersion));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vt_vent_turn WHERE session_id = ?", Integer.class, sessionId)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vt_vent_summary WHERE session_id = ?", Integer.class, sessionId)).isEqualTo(2);
        assertNoRawTextOutsideCiphertext("alice@example.com", "13800138000");
    }

    @Test
    void expiredCreateCommandIsRemovedAndTheIdempotencyKeyCanBeReused() throws Exception {
        Visitor owner = createConsentedVisitor("expired-command");
        String key = unique("expired-create");
        String firstSessionId = createVent(owner, key)
                .andExpect(status().isCreated())
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        String ownerSubject = jdbcTemplate.queryForObject(
                "SELECT owner_subject_ref FROM vt_vent_session WHERE id = ?",
                String.class,
                firstSessionId
        );
        assertThat(jdbcTemplate.update(
                "UPDATE vt_vent_command_dedup SET expires_at = ? WHERE command_scope = 'vent:create' AND resource_id = ?",
                utcNow().minusSeconds(1),
                firstSessionId
        )).isEqualTo(1);

        String secondSessionId = createVent(owner, key)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.state").value("ACTIVE"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        assertThat(secondSessionId).isNotEqualTo(firstSessionId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vt_vent_command_dedup WHERE command_scope = 'vent:create' AND owner_subject_ref = ?",
                Integer.class,
                ownerSubject
        )).isEqualTo(1);

        jdbcTemplate.update(
                "UPDATE vt_vent_command_dedup SET expires_at = ? WHERE command_scope = 'vent:create' AND resource_id = ?",
                utcNow().minusSeconds(1),
                secondSessionId
        );
        expiryJob.deleteExpiredData();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vt_vent_command_dedup WHERE command_scope = 'vent:create' AND owner_subject_ref = ?",
                Integer.class,
                ownerSubject
        )).isZero();
    }

    @Test
    void serverEnforcesEightRepliesAndTenMinuteDeadlineButStillAllowsFinish() throws Exception {
        Visitor visitor = createConsentedVisitor("limits");
        String sessionId = createVent(visitor, unique("create"))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        int version = 1;
        for (int index = 1; index <= 8; index++) {
            turn(visitor, sessionId, unique("turn-" + index), version,
                    "第" + index + "轮：对方改变了已经确认的安排，我想先整理可观察事实。")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.ai_turns_used").value(index))
                    .andExpect(jsonPath("$.data.ai_turns_remaining").value(8 - index));
            version++;
        }
        int storedAtLimit = ventTurnCount(sessionId);
        turn(visitor, sessionId, unique("ninth"), version,
                "这是第九轮，不应该被保存或得到新的系统回复。")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("VENT_TURN_LIMIT_REACHED"))
                .andExpect(jsonPath("$.error.details.can_finish").value(true));
        assertThat(ventTurnCount(sessionId)).isEqualTo(storedAtLimit);

        finish(visitor, sessionId, unique("finish"), version)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.state").value("SUMMARY_READY"));

        String deadlineSession = createVent(visitor, unique("deadline-create"))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        turn(visitor, deadlineSession, unique("before-deadline"), 1,
                "对方临时取消了已经确认的安排，我想先写下这个事实。")
                .andExpect(status().isOk());
        jdbcTemplate.update(
                "UPDATE vt_vent_session SET deadline_at = ? WHERE id = ?",
                utcNow().minusMinutes(1), deadlineSession);
        int storedBeforeExpiredAttempt = ventTurnCount(deadlineSession);
        turn(visitor, deadlineSession, unique("after-deadline"), 2,
                "这段内容发生在服务端截止时间以后，不应该被保存。")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("VENT_TIME_LIMIT_REACHED"));
        assertThat(ventTurnCount(deadlineSession)).isEqualTo(storedBeforeExpiredAttempt);
        finish(visitor, deadlineSession, unique("finish-expired"), 2)
                .andExpect(status().isAccepted());
    }

    @Test
    void blockStopsOrdinaryFlowWhileClarifyUsesOnlyABoundedBoundaryReply() throws Exception {
        Visitor visitor = createConsentedVisitor("safety");
        String blockedSession = createVent(visitor, unique("blocked-create"))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        JsonNode blocked = turn(visitor, blockedSession, unique("blocked-turn"), 1,
                "对方现在拿着刀堵住门，我马上会有危险。")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("SAFETY_BLOCKED"))
                .andExpect(jsonPath("$.data.safety.route").value("BLOCK"))
                .andExpect(jsonPath("$.data.safety.resource_ids").isNotEmpty())
                .andExpect(jsonPath("$.data.reply").doesNotExist())
                .andReturnBody(objectMapper);
        assertThat(ventTurnCount(blockedSession)).isEqualTo(1);
        String blockedTurnId = blocked.path("data").path("turn_id").asText();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_evidence e JOIN sf_safety_review_case c ON c.evidence_id = e.id "
                        + "WHERE e.source_type = 'VENT_TURN' AND e.source_id = ? "
                        + "AND e.route = 'BLOCK' AND c.status = 'OPEN'",
                Integer.class, blockedTurnId)).isEqualTo(1);
        finish(visitor, blockedSession, unique("blocked-finish"), 2)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("VENT_SAFETY_BLOCKED"));

        String clarifySession = createVent(visitor, unique("clarify-create"))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        MvcResult clarifyResult = turn(visitor, clarifySession, unique("clarify-turn"), 1,
                "请诊断他的人格并预测我们会不会复合。")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("ACTIVE"))
                .andExpect(jsonPath("$.data.safety.route").value("CLARIFY"))
                .andExpect(jsonPath("$.data.ai_turns_used").value(1))
                .andReturn();
        String response = clarifyResult.getResponse().getContentAsString();
        assertThat(response).contains("事实", "感受", "边界").doesNotContain("人格障碍", "一定会复合");
        turn(visitor, clarifySession, unique("normal-after-clarify"), 2,
                "目前只确认对方连续两次临时取消安排，具体原因仍然未知。")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.safety.route").value("ALLOW"));
    }

    @Test
    void currentSummaryOwnershipAndStructuredConfirmationAreRequiredBeforeMapping() throws Exception {
        Visitor owner = createConsentedVisitor("summary-owner");
        Visitor other = createConsentedVisitor("summary-other");
        String sessionId = createVent(owner, unique("create"))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        turn(owner, sessionId, unique("turn"), 1,
                "对方连续两次取消已经确认的见面安排，我不知道具体原因。")
                .andExpect(status().isOk());
        JsonNode finished = finish(owner, sessionId, unique("finish"), 2)
                .andReturnBody(objectMapper);
        String summaryVersion = finished.path("data").path("summary_version").asText();

        confirm(other, sessionId, unique("other-confirm"), 3, summaryVersion, safeSummaryFields())
                .andExpect(status().isForbidden());
        confirm(owner, sessionId, unique("wrong-summary"), 3,
                "01J00000000000000000000000", safeSummaryFields())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("VENT_SUMMARY_VERSION_MISMATCH"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_clarity_task WHERE entry_type = 'VENT' AND owner_subject_ref = ?",
                Integer.class, owner.sessionId())).isZero();

        Map<String, Object> invalid = Map.of(
                "context", "dating_or_partner",
                "observed_fact", "太短",
                "looping_thought", "",
                "emotion", List.of("anxious"),
                "need_or_boundary", List.of("clarity"),
                "current_goal", "整理事实",
                "clarity_pre", 3
        );
        confirm(owner, sessionId, unique("invalid"), 3, summaryVersion, invalid)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    void cleanupPhysicallyDeletesExpiredTurnsAndSummariesWithoutLoggingContent() throws Exception {
        Visitor visitor = createConsentedVisitor("cleanup");
        String sessionId = createVent(visitor, unique("create"))
                .andReturnBody(objectMapper).path("data").path("vent_session_id").asText();
        turn(visitor, sessionId, unique("turn"), 1,
                "对方连续两次取消已经确认的安排，我想整理这件事。")
                .andExpect(status().isOk());
        finish(visitor, sessionId, unique("finish"), 2)
                .andExpect(status().isAccepted());
        jdbcTemplate.update("UPDATE vt_vent_turn SET expires_at = ? WHERE session_id = ?",
                utcNow().minusSeconds(1), sessionId);
        jdbcTemplate.update("UPDATE vt_vent_summary SET expires_at = ? WHERE session_id = ?",
                utcNow().minusSeconds(1), sessionId);

        expiryJob.deleteExpiredData();

        assertThat(ventTurnCount(sessionId)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vt_vent_summary WHERE session_id = ?", Integer.class, sessionId)).isZero();
    }

    @Test
    void enabledPublicConfigExposesVentWithoutChangingOtherEntrySemantics() throws Exception {
        mockMvc.perform(get("/api/v1/app-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.feature_flags.venting").value(true))
                .andExpect(jsonPath("$.data.entry_paths", org.hamcrest.Matchers.hasItems("DIRECT", "VENT")));
    }

    private LocalDateTime utcNow() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private ResultActionsWithBody createVent(Visitor visitor, String key) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(post("/api/v1/vent-sessions")
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "policy_version", "p0-alpha-2026-07-19",
                        "confirmed", true
                )))));
    }

    private ResultActionsWithBody turn(
            Visitor visitor,
            String sessionId,
            String key,
            int expectedVersion,
            String text
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(post("/api/v1/vent-sessions/{id}/turns", sessionId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "expected_version", expectedVersion,
                        "text", text
                )))));
    }

    private ResultActionsWithBody finish(Visitor visitor, String sessionId, String key, int expectedVersion)
            throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(post("/api/v1/vent-sessions/{id}/finish", sessionId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("expected_version", expectedVersion)))));
    }

    private ResultActionsWithBody confirm(
            Visitor visitor,
            String sessionId,
            String key,
            int expectedVersion,
            String summaryVersion,
            Map<String, Object> fields
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(put("/api/v1/vent-sessions/{id}/summary", sessionId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "expected_version", expectedVersion,
                        "summary_version", summaryVersion,
                        "confirmed", true,
                        "fields", fields
                )))));
    }

    private Map<String, Object> safeSummaryFields() {
        return Map.of(
                "context", "dating_or_partner",
                "observed_fact", "对方连续两次在已经确认的见面时间前临时取消，并没有说明新的时间。",
                "looping_thought", "我反复担心这意味着关系态度发生变化，但目前原因仍然未知。",
                "emotion", List.of("anxious", "disappointed"),
                "need_or_boundary", List.of("clarity", "respect"),
                "current_goal", "未来48小时内整理一次只讨论可观察事实的沟通提纲。",
                "clarity_pre", 3
        );
    }

    private int ventTurnCount(String sessionId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vt_vent_turn WHERE session_id = ?", Integer.class, sessionId);
    }

    private void assertNoRawTextOutsideCiphertext(String... forbidden) {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.addAll(jdbcTemplate.queryForList("""
                SELECT id, session_id, message_no, role, safety_route, categories_json,
                       mask_codes_json, rule_version, resource_ids_json, key_version,
                       content_hash, expires_at, created_at
                  FROM vt_vent_turn
                """));
        rows.addAll(jdbcTemplate.queryForList("""
                SELECT id, session_id, version_no, status, key_version, content_hash,
                       expires_at, created_at
                  FROM vt_vent_summary
                """));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM vt_vent_command_dedup"));
        String plainMetadata = rows.stream()
                .flatMap(row -> row.values().stream())
                .map(String::valueOf)
                .reduce("", (left, right) -> left + "|" + right);
        assertThat(plainMetadata).doesNotContain(forbidden);

        List<Map<String, Object>> encrypted = new ArrayList<>();
        encrypted.addAll(jdbcTemplate.queryForList("SELECT ciphertext FROM vt_vent_turn"));
        encrypted.addAll(jdbcTemplate.queryForList("SELECT ciphertext FROM vt_vent_summary"));
        String ciphertext = encrypted.stream()
                .flatMap(row -> row.values().stream())
                .map(value -> value instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : "")
                .reduce("", String::concat);
        assertThat(ciphertext).doesNotContain(forbidden);
    }

    private Visitor createConsentedVisitor(String suffix) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/sessions")
                        .header("Idempotency-Key", unique("session-" + suffix))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "client_instance_id", "client-" + UUID.randomUUID(),
                                "device_class", "mainstream"
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode data = objectMapper.readTree(created.getResponse().getContentAsString()).path("data");
        Visitor visitor = new Visitor(data.path("session_id").asText(), data.path("access_token").asText());
        mockMvc.perform(post("/api/v1/sessions/{sessionId}/consents", visitor.sessionId())
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", unique("consent-" + suffix))
                        .contentType("application/json")
                        .content("""
                                {
                                  "policy_version": "p0-alpha-2026-07-19",
                                  "adult_confirmed": true,
                                  "accepted": true
                                }
                                """))
                .andExpect(status().isCreated());
        return visitor;
    }

    private String bearer(Visitor visitor) {
        return "Bearer " + visitor.accessToken();
    }

    private String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    private record Visitor(String sessionId, String accessToken) {
    }

    private static final class ResultActionsWithBody {
        private final org.springframework.test.web.servlet.ResultActions delegate;

        private ResultActionsWithBody(org.springframework.test.web.servlet.ResultActions delegate) {
            this.delegate = delegate;
        }

        private ResultActionsWithBody andExpect(org.springframework.test.web.servlet.ResultMatcher matcher)
                throws Exception {
            delegate.andExpect(matcher);
            return this;
        }

        private JsonNode andReturnBody(ObjectMapper mapper) throws Exception {
            return mapper.readTree(delegate.andReturn().getResponse().getContentAsString());
        }

        private MvcResult andReturn() {
            return delegate.andReturn();
        }
    }
}
