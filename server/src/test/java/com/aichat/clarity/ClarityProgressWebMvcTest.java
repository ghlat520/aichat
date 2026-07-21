package com.aichat.clarity;

import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import com.aichat.report.application.ReportExpiryJob;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "aichat.features.generation-enabled=true")
@AutoConfigureMockMvc
class ClarityProgressWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EnvelopeEncryptionService encryption;

    @Autowired
    private ReportExpiryJob reportExpiryJob;

    @Test
    void oneConfirmedCoreProducesTwoReflectionsASealedReportAndACompleteFreeSummary() throws Exception {
        Visitor visitor = createConsentedVisitor("happy");
        TaskSetup task = createTaskWithFields(visitor, "happy");

        JsonNode mirror = createMirror(visitor, task.taskId(), unique("mirror"), 2)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.state").value("MIRROR_REVIEW"))
                .andExpect(jsonPath("$.data.version").value(3))
                .andExpect(jsonPath("$.data.regeneration_count").value(0))
                .andExpect(jsonPath("$.data.mirror.confirmed_event").value(
                        org.hamcrest.Matchers.containsString("连续两次")))
                .andExpect(jsonPath("$.data.mirror.current_interpretation").isString())
                .andExpect(jsonPath("$.data.mirror.feelings").isString())
                .andExpect(jsonPath("$.data.mirror.need_or_boundary").isString())
                .andExpect(jsonPath("$.data.mirror.question_to_solve").isString())
                .andExpect(jsonPath("$.data.mirror.ai_label").value("AI 辅助生成"))
                .andReturnBody(objectMapper);

        String mirrorVersion = mirror.path("data").path("content_version").asText();
        JsonNode confirmed = confirmMirror(visitor, task.taskId(), unique("confirm"), 3, mirrorVersion,
                evaluationsWithInterpretationCorrection("目前只确认了行为，原因仍然未知。"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("REFLECTION"))
                .andExpect(jsonPath("$.data.version").value(4))
                .andExpect(jsonPath("$.data.reflection_count").value(0))
                .andReturnBody(objectMapper);
        String confirmedVersion = confirmed.path("data").path("confirmed_content_version").asText();

        JsonNode firstReflection = reflect(visitor, task.taskId(), unique("reflection-1"), Map.of(
                        "expected_version", 4,
                        "round", 1,
                        "confirmed_facts", List.of("对方连续两次在约定前取消见面。"),
                        "unknowns_to_verify", List.of("还不知道取消是否代表关系态度发生变化。")
                ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.round").value(1))
                .andExpect(jsonPath("$.data.version").value(5))
                .andExpect(jsonPath("$.data.reflection_count").value(1))
                .andReturnBody(objectMapper);

        JsonNode secondReflection = reflect(visitor, task.taskId(), unique("reflection-2"), Map.of(
                        "expected_version", 5,
                        "round", 2,
                        "priority_need_or_boundary", "我现在优先保护清晰和尊重的边界。",
                        "self_executable_goal", "未来48小时内整理一次只讨论可观察事实的沟通提纲。"
                ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.round").value(2))
                .andExpect(jsonPath("$.data.version").value(6))
                .andExpect(jsonPath("$.data.reflection_count").value(2))
                .andReturnBody(objectMapper);

        List<String> reflectionVersions = List.of(
                firstReflection.path("data").path("reflection_version").asText(),
                secondReflection.path("data").path("reflection_version").asText()
        );
        String reportKey = unique("report");
        JsonNode report = createReport(
                        visitor, task.taskId(), reportKey, 6, confirmedVersion, reflectionVersions)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.state").value("SEALED_READY"))
                .andExpect(jsonPath("$.data.task_state").value("REPORT_READY"))
                .andExpect(jsonPath("$.data.task_version").value(7))
                .andExpect(jsonPath("$.data.poll_after_ms").value(0))
                .andReturnBody(objectMapper);
        String reportId = report.path("data").path("report_id").asText();
        createReport(visitor, task.taskId(), reportKey, 6, confirmedVersion, reflectionVersions)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.report_id").value(reportId))
                .andExpect(jsonPath("$.data.task_version").value(7));
        createReport(visitor, task.taskId(), unique("second-report"), 7, confirmedVersion, reflectionVersions)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("REPORT_ALREADY_EXISTS"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_evidence WHERE source_type = 'CLARITY_CONTENT' AND source_id = ?",
                Integer.class, task.sixFieldVersion())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_evidence WHERE source_type = 'CLARITY_MIRROR' AND source_id = ?",
                Integer.class, confirmedVersion)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_evidence WHERE source_type = 'CLARITY_REFLECTION' AND source_id IN (?, ?)",
                Integer.class, reflectionVersions.get(0), reflectionVersions.get(1))).isEqualTo(2);
        assertThat(jdbcTemplate.queryForList(
                "SELECT checkpoint FROM sf_safety_evidence WHERE source_type = 'REPORT' AND source_id = ? ORDER BY checkpoint",
                String.class, reportId)).containsExactly("S2_PRE_GENERATION", "S3_OUTPUT");

        MvcResult freeResult = mockMvc.perform(get("/api/v1/reports/{reportId}/free-summary", reportId)
                        .header("Authorization", bearer(visitor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SEALED_READY"))
                .andExpect(jsonPath("$.data.free_summary.confirmed_facts.length()").value(1))
                .andExpect(jsonPath("$.data.free_summary.unknowns_to_verify.length()").value(1))
                .andExpect(jsonPath("$.data.free_summary.emotion_and_needs.emotions.length()").value(2))
                .andExpect(jsonPath("$.data.free_summary.boundary_reminder").isString())
                .andExpect(jsonPath("$.data.free_summary.uncertainty_and_limits.length()").value(2))
                .andExpect(jsonPath("$.data.free_summary.safety_resources").isArray())
                .andExpect(jsonPath("$.data.free_summary.self_executable_goal").value(
                        "未来48小时内整理一次只讨论可观察事实的沟通提纲。"))
                .andExpect(jsonPath("$.data.free_summary.ai_label").value("AI 辅助生成"))
                .andExpect(jsonPath("$.data.free_summary.possible_explanations").doesNotExist())
                .andExpect(jsonPath("$.data.free_summary.communication_draft").doesNotExist())
                .andReturn();
        String freeBody = freeResult.getResponse().getContentAsString();
        assertThat(freeBody).doesNotContain("坏消息", "只有付费", "付费才能", "立即购买");

        Visitor other = createConsentedVisitor("report-other");
        mockMvc.perform(get("/api/v1/reports/{reportId}/free-summary", reportId)
                        .header("Authorization", bearer(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));

        mockMvc.perform(get("/api/v1/reports/{reportId}", reportId)
                        .header("Authorization", bearer(visitor)))
                .andExpect(status().isForbidden());

        JsonNode sealed = decryptSealedReport(reportId);
        assertThat(sealed.path("possible_explanations")).hasSize(3);
        assertThat(sealed.path("candidate_actions").size()).isBetween(1, 3);
        sealed.path("confirmed_facts").forEach(fact ->
                assertThat(fact.path("source").asText()).isEqualTo("user_confirmed"));
        sealed.path("unverified_interpretations").forEach(item ->
                assertThat(item.path("confidence").asText()).isEqualTo("unknown"));
        sealed.path("possible_explanations").forEach(item ->
                assertThat(item.path("missing_evidence").isArray()).isTrue());
        sealed.path("candidate_actions").forEach(action -> {
            assertThat(action.path("reversible").asBoolean()).isTrue();
            assertThat(action.path("success_observation").asText()).isNotBlank();
            assertThat(action.path("stop_condition").asText()).isNotBlank();
        });
        assertThat(sealed.path("versions").path("s2_policy").asText())
                .isEqualTo("safety-policy-prototype-2026-07-19");
        assertThat(sealed.path("versions").path("s3_policy").asText())
                .isEqualTo("safety-policy-prototype-2026-07-19");
        assertThat(sealed.path("versions").path("output_validator").asText())
                .isEqualTo("s3-deterministic-stub-v1");
        assertThat(jdbcTemplate.update(
                "UPDATE rp_report_command_dedup SET expires_at = ? WHERE report_id = ?",
                java.time.LocalDateTime.of(2000, 1, 1, 0, 0),
                reportId
        )).isEqualTo(1);
        reportExpiryJob.deleteExpiredCommands();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rp_report_command_dedup WHERE report_id = ?",
                Integer.class,
                reportId
        )).isZero();
        assertNoRawTextPersistedOutsideCiphertext("连续两次在约定前取消见面", "原因仍然未知");
    }

    @Test
    void mirrorIsOwnedIdempotentAndAllowsAtMostOneRegeneration() throws Exception {
        Visitor owner = createConsentedVisitor("mirror-owner");
        Visitor other = createConsentedVisitor("mirror-other");
        TaskSetup task = createTaskWithFields(owner, "mirror-limit");
        String key = unique("mirror");

        JsonNode first = createMirror(owner, task.taskId(), key, 2)
                .andExpect(status().isAccepted())
                .andReturnBody(objectMapper);
        createMirror(owner, task.taskId(), key, 2)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.content_version").value(
                        first.path("data").path("content_version").asText()))
                .andExpect(jsonPath("$.data.version").value(3));

        createMirror(other, task.taskId(), unique("other"), 3)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));

        createMirror(owner, task.taskId(), unique("regenerate"), 3)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.version").value(4))
                .andExpect(jsonPath("$.data.regeneration_count").value(1));

        createMirror(owner, task.taskId(), unique("too-many"), 4)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("MIRROR_REGENERATION_LIMIT"));
        assertThat(contentCount(task.taskId(), "MIRROR")).isEqualTo(2);
    }

    @Test
    void nonAllowS1ContentCannotEnterMirrorGeneration() throws Exception {
        Visitor visitor = createConsentedVisitor("non-allow");
        TaskSetup task = createTaskWithFields(visitor, "non-allow");

        mockMvc.perform(put("/api/v1/tasks/{taskId}/fields", task.taskId())
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", unique("clarify-fields"))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expected_version", 2,
                                "fields", Map.of(
                                        "context", "dating_or_partner",
                                        "observed_fact", "对方连续一周没有回复关于周末安排的消息，但仍参加共同朋友的活动。",
                                        "interpretation", "请诊断他的人格并预测我们是否一定会复合。",
                                        "emotion", List.of("anxious"),
                                        "need_or_boundary", List.of("clarity"),
                                        "next_step_goal", "先弄清哪些是事实"
                                )
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("SAFETY_CLARIFICATION_REQUIRED"));

        createMirror(visitor, task.taskId(), unique("mirror-blocked"), 3)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("TASK_NOT_READY_FOR_MIRROR"));
        assertThat(contentCount(task.taskId(), "MIRROR")).isZero();
    }

    @Test
    void mirrorConfirmationRequiresCorrectionAndTheCurrentMirrorVersion() throws Exception {
        Visitor visitor = createConsentedVisitor("confirmation");
        TaskSetup task = createTaskWithFields(visitor, "confirmation");
        JsonNode mirror = createMirror(visitor, task.taskId(), unique("mirror"), 2)
                .andReturnBody(objectMapper);
        String mirrorVersion = mirror.path("data").path("content_version").asText();

        confirmMirror(visitor, task.taskId(), unique("missing-correction"), 3, mirrorVersion,
                evaluationsWithInterpretationCorrection(null))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("MIRROR_CORRECTION_REQUIRED"));

        confirmMirror(visitor, task.taskId(), unique("wrong-version"), 3, task.sixFieldVersion(),
                allAccurateEvaluations())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("MIRROR_VERSION_MISMATCH"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT confirmed_content_version_id FROM ct_clarity_task WHERE id = ?",
                String.class,
                task.taskId()
        )).isNull();
    }

    @Test
    void reflectionsEnforceShapeOrderAgencyAndIdempotency() throws Exception {
        Visitor visitor = createConsentedVisitor("reflection");
        ConfirmedSetup setup = createConfirmedMirror(visitor, "reflection");

        reflect(visitor, setup.taskId(), unique("round-2-first"), Map.of(
                        "expected_version", 4,
                        "round", 2,
                        "priority_need_or_boundary", "尊重",
                        "self_executable_goal", "整理自己的沟通提纲"
                ))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("REFLECTION_ORDER_INVALID"));

        reflect(visitor, setup.taskId(), unique("round-1-shape"), Map.of(
                        "expected_version", 4,
                        "round", 1,
                        "confirmed_facts", List.of("对方取消了两次见面")
                ))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("REFLECTION_SHAPE_INVALID"));

        String firstKey = unique("round-1");
        Map<String, Object> firstBody = Map.of(
                "expected_version", 4,
                "round", 1,
                "confirmed_facts", List.of("对方取消了两次见面"),
                "unknowns_to_verify", List.of("不知道取消的具体原因")
        );
        JsonNode first = reflect(visitor, setup.taskId(), firstKey, firstBody)
                .andExpect(status().isCreated())
                .andReturnBody(objectMapper);
        reflect(visitor, setup.taskId(), firstKey, firstBody)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.reflection_version").value(
                        first.path("data").path("reflection_version").asText()));

        reflect(visitor, setup.taskId(), unique("other-dependent"), Map.of(
                        "expected_version", 5,
                        "round", 2,
                        "priority_need_or_boundary", "清晰",
                        "self_executable_goal", "让对方必须改变并保证永远及时回复我"
                ))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("SELF_EXECUTABLE_GOAL_REQUIRED"));

        reflect(visitor, setup.taskId(), unique("round-2"), Map.of(
                        "expected_version", 5,
                        "round", 2,
                        "priority_need_or_boundary", "清晰",
                        "self_executable_goal", "未来48小时内写下我能接受的联系边界"
                ))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.reflection_count").value(2));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_task_reflection WHERE task_id = ?",
                Integer.class,
                setup.taskId()
        )).isEqualTo(2);
    }

    @Test
    void reportRejectsIncompleteOrMismatchedVersionsWithoutCreatingAReport() throws Exception {
        Visitor visitor = createConsentedVisitor("report-invalid");
        ConfirmedSetup setup = createConfirmedMirror(visitor, "report-invalid");

        createReport(visitor, setup.taskId(), unique("incomplete"), 4, setup.confirmedVersion(),
                List.of(setup.confirmedVersion(), setup.mirrorVersion()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("REFLECTIONS_INCOMPLETE"));
        assertThat(reportCount(setup.taskId())).isZero();

        JsonNode first = reflect(visitor, setup.taskId(), unique("r1"), Map.of(
                        "expected_version", 4,
                        "round", 1,
                        "confirmed_facts", List.of("对方取消了两次见面"),
                        "unknowns_to_verify", List.of("不知道具体原因")
                )).andReturnBody(objectMapper);
        JsonNode second = reflect(visitor, setup.taskId(), unique("r2"), Map.of(
                        "expected_version", 5,
                        "round", 2,
                        "priority_need_or_boundary", "尊重",
                        "self_executable_goal", "未来48小时内整理自己的边界"
                )).andReturnBody(objectMapper);

        createReport(visitor, setup.taskId(), unique("stale"), 5, setup.confirmedVersion(), List.of(
                        first.path("data").path("reflection_version").asText(),
                        second.path("data").path("reflection_version").asText()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("VERSION_CONFLICT"));

        createReport(visitor, setup.taskId(), unique("wrong-reflections"), 6, setup.confirmedVersion(),
                List.of(setup.mirrorVersion(), setup.confirmedVersion()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("REPORT_INPUT_VERSION_MISMATCH"));
        assertThat(reportCount(setup.taskId())).isZero();
    }

    private TaskSetup createTaskWithFields(Visitor visitor, String suffix) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", unique("task-" + suffix))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "entry_type", "DIRECT",
                                "context", "dating_or_partner",
                                "clarity_pre", 3
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        String taskId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("data").path("task_id").asText();
        MvcResult fields = mockMvc.perform(put("/api/v1/tasks/{taskId}/fields", taskId)
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", unique("fields-" + suffix))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "expected_version", 1,
                                "fields", Map.of(
                                        "context", "dating_or_partner",
                                        "observed_fact", "对方连续两次在已经确认的见面时间前取消，并且没有说明新的可选时间。",
                                        "interpretation", "我担心这表示关系的重要性正在下降。",
                                        "emotion", List.of("anxious", "hurt"),
                                        "need_or_boundary", List.of("clarity", "respect"),
                                        "next_step_goal", "准备一次只讨论可观察事实的沟通"
                                )
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("FIELDS_SAVED"))
                .andReturn();
        String sixFieldVersion = objectMapper.readTree(fields.getResponse().getContentAsString())
                .path("data").path("content_version").asText();
        return new TaskSetup(taskId, sixFieldVersion);
    }

    private ConfirmedSetup createConfirmedMirror(Visitor visitor, String suffix) throws Exception {
        TaskSetup task = createTaskWithFields(visitor, suffix);
        JsonNode mirror = createMirror(visitor, task.taskId(), unique("mirror-" + suffix), 2)
                .andExpect(status().isAccepted())
                .andReturnBody(objectMapper);
        String mirrorVersion = mirror.path("data").path("content_version").asText();
        JsonNode confirmed = confirmMirror(visitor, task.taskId(), unique("confirm-" + suffix), 3,
                        mirrorVersion, allAccurateEvaluations())
                .andExpect(status().isOk())
                .andReturnBody(objectMapper);
        return new ConfirmedSetup(
                task.taskId(),
                mirrorVersion,
                confirmed.path("data").path("confirmed_content_version").asText()
        );
    }

    private ResultActionsWithBody createMirror(
            Visitor visitor,
            String taskId,
            String key,
            int expectedVersion
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(post("/api/v1/tasks/{taskId}/mirror", taskId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("expected_version", expectedVersion)))));
    }

    private ResultActionsWithBody confirmMirror(
            Visitor visitor,
            String taskId,
            String key,
            int expectedVersion,
            String contentVersion,
            Map<String, Object> evaluations
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(put(
                        "/api/v1/tasks/{taskId}/mirror-confirmation", taskId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "expected_version", expectedVersion,
                        "content_version", contentVersion,
                        "confirmed", true,
                        "evaluations", evaluations
                )))));
    }

    private ResultActionsWithBody reflect(
            Visitor visitor,
            String taskId,
            String key,
            Map<String, Object> body
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(post("/api/v1/tasks/{taskId}/reflections", taskId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(body))));
    }

    private ResultActionsWithBody createReport(
            Visitor visitor,
            String taskId,
            String key,
            int expectedVersion,
            String confirmedVersion,
            List<String> reflectionVersions
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(post("/api/v1/tasks/{taskId}/reports", taskId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "expected_task_version", expectedVersion,
                        "confirmed_content_version", confirmedVersion,
                        "reflection_versions", reflectionVersions
                )))));
    }

    private Map<String, Object> allAccurateEvaluations() {
        Map<String, Object> accurate = Map.of("accuracy", "accurate");
        return Map.of(
                "confirmed_event", accurate,
                "current_interpretation", accurate,
                "feelings", accurate,
                "need_or_boundary", accurate,
                "question_to_solve", accurate
        );
    }

    private Map<String, Object> evaluationsWithInterpretationCorrection(String correction) {
        LinkedHashMap<String, Object> interpretation = new LinkedHashMap<>();
        interpretation.put("accuracy", "partially_accurate");
        if (correction != null) interpretation.put("correction", correction);
        LinkedHashMap<String, Object> evaluations = new LinkedHashMap<>(allAccurateEvaluations());
        evaluations.put("current_interpretation", Map.copyOf(interpretation));
        return Map.copyOf(evaluations);
    }

    private JsonNode decryptSealedReport(String reportId) throws Exception {
        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT * FROM rp_report WHERE id = ?", reportId);
        EncryptedPayload payload = new EncryptedPayload(
                (byte[]) row.get("sealed_ciphertext"),
                (byte[]) row.get("sealed_content_nonce"),
                (byte[]) row.get("sealed_wrapped_dek"),
                (byte[]) row.get("sealed_wrap_nonce"),
                String.valueOf(row.get("sealed_key_version")),
                String.valueOf(row.get("sealed_content_hash"))
        );
        return objectMapper.readTree(encryption.decrypt(reportId + ":sealed", payload));
    }

    private int contentCount(String taskId, String type) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_content_version WHERE task_id = ? AND content_type = ?",
                Integer.class,
                taskId,
                type
        );
    }

    private int reportCount(String taskId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rp_report WHERE task_id = ?",
                Integer.class,
                taskId
        );
    }

    private void assertNoRawTextPersistedOutsideCiphertext(String... forbiddenValues) {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_clarity_task"));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_task_reflection"));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_command_dedup"));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM rp_report_command_dedup"));
        rows.addAll(jdbcTemplate.queryForList("""
                SELECT id, task_id, generation_id, owner_subject_ref, status, report_version,
                       deliverable_hash, model_version, prompt_version, safety_version,
                       template_version, expires_at, created_at, updated_at
                  FROM rp_report
                """));
        String persisted = rows.stream()
                .flatMap(row -> row.values().stream())
                .map(value -> value instanceof byte[] bytes
                        ? new String(bytes, StandardCharsets.UTF_8)
                        : String.valueOf(value))
                .reduce("", (left, right) -> left + "|" + right);
        assertThat(persisted).doesNotContain(forbiddenValues);

        List<Map<String, Object>> encryptedRows = new ArrayList<>();
        encryptedRows.addAll(jdbcTemplate.queryForList("SELECT ciphertext FROM ct_content_version"));
        encryptedRows.addAll(jdbcTemplate.queryForList("SELECT free_ciphertext, sealed_ciphertext FROM rp_report"));
        String ciphertext = encryptedRows.stream()
                .flatMap(row -> row.values().stream())
                .map(value -> value instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : "")
                .reduce("", (left, right) -> left + right);
        assertThat(ciphertext).doesNotContain(forbiddenValues);
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

    private record TaskSetup(String taskId, String sixFieldVersion) {
    }

    private record ConfirmedSetup(String taskId, String mirrorVersion, String confirmedVersion) {
    }

    private static final class ResultActionsWithBody {
        private final org.springframework.test.web.servlet.ResultActions delegate;

        private ResultActionsWithBody(org.springframework.test.web.servlet.ResultActions delegate) {
            this.delegate = delegate;
        }

        private ResultActionsWithBody andExpect(org.springframework.test.web.servlet.ResultMatcher matcher) throws Exception {
            delegate.andExpect(matcher);
            return this;
        }

        private JsonNode andReturnBody(ObjectMapper mapper) throws Exception {
            return mapper.readTree(delegate.andReturn().getResponse().getContentAsString());
        }
    }
}
