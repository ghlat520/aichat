package com.aichat.assessment;

import com.aichat.assessment.application.AssessmentExpiryJob;
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
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "aichat.features.assessment-enabled=true")
@AutoConfigureMockMvc
class AssessmentWebMvcTest {
    private static final String DEFINITION = "relationship-response-v1";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AssessmentExpiryJob expiryJob;

    @Test
    void publishedDefinitionIsTraceableAndDoesNotExposeScoreRules() throws Exception {
        Visitor visitor = createConsentedVisitor("definition");

        MvcResult result = mockMvc.perform(get("/api/v1/assessments/current")
                        .header("Authorization", bearer(visitor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.definition_version").value(DEFINITION))
                .andExpect(jsonPath("$.data.item_count").value(8))
                .andExpect(jsonPath("$.data.items.length()").value(8))
                .andExpect(jsonPath("$.data.items[0].options.length()").value(4))
                .andExpect(jsonPath("$.data.license_source").isString())
                .andExpect(jsonPath("$.data.boundary_copy").isString())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body)
                .doesNotContain("score_rules", "evidence_checking\"", "attachment_type");
    }

    @Test
    void runAndAnswerCommandsAreOwnedIdempotentEncryptedAndOptimisticallyLocked() throws Exception {
        Visitor owner = createConsentedVisitor("answer-owner");
        Visitor other = createConsentedVisitor("answer-other");
        String createKey = unique("assessment-run");
        JsonNode created = createRun(owner, createKey);
        JsonNode replay = createRun(owner, createKey);
        String runId = created.path("data").path("run_id").asText();
        assertThat(replay.path("data").path("run_id").asText()).isEqualTo(runId);

        putAnswer(other, runId, "q01", unique("other-answer"), 1, "A")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));

        String answerKey = unique("answer");
        putAnswer(owner, runId, "q01", answerKey, 1, "A")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.answer_count").value(1));
        putAnswer(owner, runId, "q01", answerKey, 1, "A")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));

        putAnswer(owner, runId, "q02", unique("stale"), 1, "A")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("VERSION_CONFLICT"));
        assertThat(answerCount(runId)).isEqualTo(1);

        putAnswer(owner, runId, "q01", unique("overwrite"), 2, "B")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(3))
                .andExpect(jsonPath("$.data.answer_version").value(2));
        assertThat(answerCount(runId)).isEqualTo(1);

        putAnswer(owner, runId, "q01", answerKey, 1, "A")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.answer_version").value(1));

        byte[] ciphertext = jdbcTemplate.queryForObject(
                "SELECT ciphertext FROM ct_assessment_answer WHERE run_id = ? AND item_id = 'q01'",
                byte[].class,
                runId
        );
        assertThat(new String(ciphertext, StandardCharsets.UTF_8)).doesNotContain("{\"option_code\":\"B\"}");
    }

    @Test
    void incompleteAndInvalidAnswersCannotProduceAResult() throws Exception {
        Visitor visitor = createConsentedVisitor("invalid");
        String runId = createRun(visitor, unique("run")).path("data").path("run_id").asText();

        putAnswer(visitor, runId, "q99", unique("bad-item"), 1, "A")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("ASSESSMENT_ITEM_INVALID"));
        putAnswer(visitor, runId, "q01", unique("bad-option"), 1, "Z")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("ASSESSMENT_OPTION_INVALID"));
        assertThat(answerCount(runId)).isZero();

        completeRun(visitor, runId, unique("incomplete"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("ASSESSMENT_INCOMPLETE"));
    }

    @Test
    void deterministicScoringProducesLeadingAndMixedResultsWithoutProbabilities() throws Exception {
        Visitor visitor = createConsentedVisitor("score");
        String leadingRun = createRun(visitor, unique("leading")).path("data").path("run_id").asText();
        answerAll(visitor, leadingRun, new String[]{"A", "A", "A", "A", "A", "A", "B", "B"});

        MvcResult leading = completeRun(visitor, leadingRun, unique("complete-leading"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("COMPLETED"))
                .andExpect(jsonPath("$.data.version").value(10))
                .andExpect(jsonPath("$.data.result.current_tendency").value("当前更常先核对信息"))
                .andReturn();
        assertResultHasOnlyAllowedShape(leading);

        String mixedRun = createRun(visitor, unique("mixed")).path("data").path("run_id").asText();
        answerAll(visitor, mixedRun, new String[]{"A", "A", "B", "B", "C", "C", "D", "D"});
        MvcResult mixed = completeRun(visitor, mixedRun, unique("complete-mixed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.result.current_tendency").value("当前呈现混合倾向"))
                .andReturn();
        assertResultHasOnlyAllowedShape(mixed);
    }

    @Test
    void sharePreviewUsesAStrictPrivacyAllowlist() throws Exception {
        Visitor visitor = createConsentedVisitor("share");
        String runId = completedRun(visitor, new String[]{"A", "A", "A", "A", "A", "A", "B", "B"});

        for (int sample = 0; sample < 100; sample++) {
            MvcResult result = mockMvc.perform(post("/api/v1/assessment-runs/{runId}/share-card", runId)
                            .header("Authorization", bearer(visitor))
                            .header("Idempotency-Key", unique("share-preview-" + sample)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.status").value("PREVIEW_ONLY"))
                    .andExpect(jsonPath("$.data.preview.ai_label").value("AI 辅助生成"))
                    .andReturn();

            JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
            assertThat(fieldNames(data.path("preview"))).isEqualTo(Set.of(
                    "title", "usable_strength", "one_real_world_reminder", "ai_label", "assessment_version"
            ));
            assertThat(result.getResponse().getContentAsString()).doesNotContain(
                    "answers", "score_vector", "possible_blind_spot", "observed_fact",
                    "北京市朝阳区", "13800138000", "payment_status"
            );
        }
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_assessment_share_preview WHERE run_id = ?",
                Integer.class,
                runId
        )).isEqualTo(100);
    }

    @Test
    void confirmedMappingCreatesOneAssessmentTaskAndNeverWritesObservedFact() throws Exception {
        Visitor visitor = createConsentedVisitor("mapping");
        String runId = completedRun(visitor, new String[]{"D", "D", "D", "D", "D", "D", "A", "A"});
        String key = unique("map-to-task");
        String body = objectMapper.writeValueAsString(Map.of(
                "expected_version", 10,
                "context", "family",
                "clarity_pre", 3,
                "confirmed", true
        ));

        MvcResult first = mockMvc.perform(post("/api/v1/assessment-runs/{runId}/map-to-task", runId)
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.state").value("MAPPED"))
                .andExpect(jsonPath("$.data.task.entry_type").value("ASSESSMENT"))
                .andExpect(jsonPath("$.data.task.state").value("DRAFT"))
                .andExpect(jsonPath("$.data.candidate_fields.interpretation").isString())
                .andExpect(jsonPath("$.data.candidate_fields.next_step_goal").isString())
                .andExpect(jsonPath("$.data.candidate_fields.observed_fact").doesNotExist())
                .andExpect(jsonPath("$.data.requires_observed_fact").value(true))
                .andReturn();
        String taskId = objectMapper.readTree(first.getResponse().getContentAsString())
                .path("data").path("task").path("task_id").asText();

        mockMvc.perform(post("/api/v1/assessment-runs/{runId}/map-to-task", runId)
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.task.task_id").value(taskId));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_clarity_task WHERE id = ? AND entry_type = 'ASSESSMENT'",
                Integer.class,
                taskId
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_content_version WHERE task_id = ?",
                Integer.class,
                taskId
        )).isZero();
    }

    @Test
    void expiredAnswersAndSharePreviewsAreActuallyDeleted() throws Exception {
        Visitor visitor = createConsentedVisitor("expiry");
        String runId = completedRun(visitor, new String[]{"A", "A", "B", "B", "C", "C", "D", "D"});
        mockMvc.perform(post("/api/v1/assessment-runs/{runId}/share-card", runId)
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", unique("expiring-preview")))
                .andExpect(status().isCreated());
        jdbcTemplate.update(
                "UPDATE ct_assessment_answer SET expires_at = '2000-01-01 00:00:00' WHERE run_id = ?",
                runId
        );
        jdbcTemplate.update(
                "UPDATE ct_assessment_share_preview SET expires_at = '2000-01-01 00:00:00' WHERE run_id = ?",
                runId
        );

        expiryJob.deleteExpiredData();

        assertThat(answerCount(runId)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_assessment_share_preview WHERE run_id = ?",
                Integer.class,
                runId
        )).isZero();
    }

    private JsonNode createRun(Visitor visitor, String key) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/assessment-runs")
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("definition_version", DEFINITION))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.state").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private org.springframework.test.web.servlet.ResultActions putAnswer(
            Visitor visitor,
            String runId,
            String itemId,
            String key,
            int expectedVersion,
            String optionCode
    ) throws Exception {
        return mockMvc.perform(put("/api/v1/assessment-runs/{runId}/answers/{itemId}", runId, itemId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "expected_version", expectedVersion,
                        "option_code", optionCode
                ))));
    }

    private org.springframework.test.web.servlet.ResultActions completeRun(
            Visitor visitor,
            String runId,
            String key
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/assessment-runs/{runId}/complete", runId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key));
    }

    private String completedRun(Visitor visitor, String[] options) throws Exception {
        String runId = createRun(visitor, unique("run")).path("data").path("run_id").asText();
        answerAll(visitor, runId, options);
        completeRun(visitor, runId, unique("complete")).andExpect(status().isOk());
        return runId;
    }

    private void answerAll(Visitor visitor, String runId, String[] options) throws Exception {
        for (int index = 0; index < 8; index++) {
            putAnswer(visitor, runId, "q0" + (index + 1), unique("answer"), index + 1, options[index])
                    .andExpect(status().isOk());
        }
    }

    private void assertResultHasOnlyAllowedShape(MvcResult result) throws Exception {
        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode assessmentResult = response.path("data").path("result");
        assertThat(fieldNames(assessmentResult)).isEqualTo(Set.of(
                "current_tendency", "usable_strength", "possible_blind_spot",
                "one_real_world_reminder", "assessment_version", "license_source", "boundary_copy"
        ));
        assertThat(assessmentResult.toString()).doesNotContain(
                "probability", "score", "diagnosis", "personality_type", "attachment_type"
        );
    }

    private Set<String> fieldNames(JsonNode node) {
        java.util.HashSet<String> names = new java.util.HashSet<>();
        node.fieldNames().forEachRemaining(names::add);
        return Set.copyOf(names);
    }

    private int answerCount(String runId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_assessment_answer WHERE run_id = ?",
                Integer.class,
                runId
        );
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
}
