package com.aichat.clarity;

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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ClarityTaskWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void taskCreationIsIdempotentAndOwnershipIsServerEnforced() throws Exception {
        Visitor owner = createConsentedVisitor("owner");
        Visitor another = createConsentedVisitor("another");
        String key = unique("task");

        JsonNode first = createTask(owner, key, "dating_or_partner", 3);
        JsonNode replay = createTask(owner, key, "dating_or_partner", 3);
        String taskId = first.path("data").path("task_id").asText();

        assertThat(replay.path("data").path("task_id").asText()).isEqualTo(taskId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_clarity_task WHERE owner_subject_ref = ?",
                Integer.class,
                owner.sessionId()
        )).isEqualTo(1);

        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", bearer(owner))
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(taskBody("family", 3)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IDEMPOTENCY_KEY_REUSED"));

        mockMvc.perform(get("/api/v1/tasks/{taskId}", taskId)
                        .header("Authorization", bearer(another)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));
    }

    @Test
    void fieldsAreMaskedEncryptedAndIdempotentBeforePersistence() throws Exception {
        Visitor visitor = createConsentedVisitor("mask");
        JsonNode task = createTask(visitor, unique("task"), "dating_or_partner", 4);
        String taskId = task.path("data").path("task_id").asText();
        String fieldsKey = unique("fields");
        Map<String, Object> fields = normalFields("""
                对方在7月18日发邮件到alice@example.com，并拨打13800138000联系我，约我去北京市朝阳区建国路88号，要求我提供身份证11010519491231002X、银行卡6222021234567890和微信号wx_alice123。
                """.trim(), "");

        JsonNode first = putFields(visitor, taskId, fieldsKey, 1, fields)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("FIELDS_SAVED"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.safety.route").value("ALLOW"))
                .andReturnBody(objectMapper);
        JsonNode replay = putFields(visitor, taskId, fieldsKey, 1, fields)
                .andExpect(status().isOk())
                .andReturnBody(objectMapper);

        String contentVersion = first.path("data").path("content_version").asText();
        assertThat(replay.path("data").path("content_version").asText()).isEqualTo(contentVersion);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_content_version WHERE task_id = ?",
                Integer.class,
                taskId
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_safety_assessment WHERE task_id = ?",
                Integer.class,
                taskId
        )).isEqualTo(1);

        byte[] ciphertext = jdbcTemplate.queryForObject(
                "SELECT ciphertext FROM ct_content_version WHERE id = ?",
                byte[].class,
                contentVersion
        );
        assertThat(new String(ciphertext, StandardCharsets.UTF_8))
                .doesNotContain("alice@example.com", "13800138000", "建国路88号", "11010519491231002X",
                        "6222021234567890", "wx_alice123");
        assertNoRawTextPersisted(
                "alice@example.com", "13800138000", "建国路88号", "11010519491231002X",
                "6222021234567890", "wx_alice123"
        );

        mockMvc.perform(get("/api/v1/tasks/{taskId}", taskId)
                        .header("Authorization", bearer(visitor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fields.observed_fact").value(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("[邮箱已遮蔽]"),
                        org.hamcrest.Matchers.containsString("[手机号已遮蔽]"),
                        org.hamcrest.Matchers.containsString("[地址已遮蔽]"),
                        org.hamcrest.Matchers.containsString("[证件号已遮蔽]"),
                        org.hamcrest.Matchers.containsString("[银行卡已遮蔽]"),
                        org.hamcrest.Matchers.containsString("[社交账号已遮蔽]")
                )))
                .andExpect(jsonPath("$.data.fields.observed_fact").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("alice@example.com")
                )));
    }

    @Test
    void staleVersionAndAnotherOwnerProduceZeroContentWrites() throws Exception {
        Visitor owner = createConsentedVisitor("version-owner");
        Visitor another = createConsentedVisitor("version-other");
        String taskId = createTask(owner, unique("task"), "friendship", 2)
                .path("data").path("task_id").asText();
        Map<String, Object> fields = normalFields(
                "friendship",
                "对方连续两次在已经确认的见面时间前临时取消，并没有说明新的时间。",
                "我担心这意味着这段关系不再重要。"
        );

        putFields(another, taskId, unique("other"), 1, fields)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("RESOURCE_OWNERSHIP_DENIED"));
        assertThat(contentCount(taskId)).isZero();

        putFields(owner, taskId, unique("first"), 1, fields)
                .andExpect(status().isOk());
        assertThat(contentCount(taskId)).isEqualTo(1);

        putFields(owner, taskId, unique("stale"), 1, fields)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("VERSION_CONFLICT"));
        assertThat(contentCount(taskId)).isEqualTo(1);
    }

    @Test
    void highRiskInputBlocksTheTaskAndCannotResumeOrdinaryFlow() throws Exception {
        Visitor visitor = createConsentedVisitor("blocked");
        String taskId = createTask(visitor, unique("task"), "dating_or_partner", 1)
                .path("data").path("task_id").asText();
        Map<String, Object> blocked = normalFields(
                "对方现在拿着刀威胁要杀了我，并且堵住门不让我离开，我担心马上会受到伤害。",
                "我不知道现在是否安全。"
        );

        putFields(visitor, taskId, unique("block"), 1, blocked)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("SAFETY_BLOCKED"))
                .andExpect(jsonPath("$.data.safety.route").value("BLOCK"))
                .andExpect(jsonPath("$.data.safety.categories").isArray())
                .andExpect(jsonPath("$.data.safety.resource_ids[0]").value("110"));

        putFields(visitor, taskId, unique("resume"), 2,
                normalFields("对方本周两次取消已经确认的见面，并表示以后再约时间。", "我想先确认事实。"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("INVALID_STATE_TRANSITION"));
    }

    @Test
    void predictionClinicalLegalAndFinancialRequestsRequireClarification() throws Exception {
        Visitor visitor = createConsentedVisitor("clarify");
        String taskId = createTask(visitor, unique("task"), "dating_or_partner", 2)
                .path("data").path("task_id").asText();
        Map<String, Object> fields = normalFields(
                "对方连续一周没有回复我关于周末安排的消息，但仍然正常参加共同朋友的活动。",
                "请诊断他的人格，预测我们会不会复合，并告诉我是否应该转账或直接起诉。"
        );

        putFields(visitor, taskId, unique("clarify"), 1, fields)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("SAFETY_CLARIFICATION_REQUIRED"))
                .andExpect(jsonPath("$.data.safety.route").value("CLARIFY"))
                .andExpect(jsonPath("$.data.safety.categories", org.hamcrest.Matchers.hasItems(
                        "clinical_request", "prediction_or_mind_reading", "financial_decision", "legal_request"
                )));
    }

    @Test
    void contractRejectsShortFactsButAllowsEmptyInterpretation() throws Exception {
        Visitor visitor = createConsentedVisitor("validation");
        String taskId = createTask(visitor, unique("task"), "workplace", 5)
                .path("data").path("task_id").asText();

        putFields(visitor, taskId, unique("short"), 1,
                normalFields("workplace", "对方取消会议。", ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));

        putFields(visitor, taskId, unique("valid"), 1,
                normalFields("workplace", "对方连续两次在会议开始前十分钟取消，并且没有给出新的可选时间。", ""))
                .andExpect(status().isOk());
    }

    @Test
    void idempotencyKeyMustMatchTheSharedContractRule() throws Exception {
        Visitor visitor = createConsentedVisitor("idempotency-contract");

        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", "too-short")
                        .contentType("application/json")
                        .content(taskBody("family", 3)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_IDEMPOTENCY_KEY"));

        mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", "invalid key with spaces")
                        .contentType("application/json")
                        .content(taskBody("family", 3)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_IDEMPOTENCY_KEY"));
    }

    private JsonNode createTask(Visitor visitor, String key, String context, int clarityPre) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/tasks")
                        .header("Authorization", bearer(visitor))
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(taskBody(context, clarityPre)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.state").value("DRAFT"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private ResultActionsWithBody putFields(
            Visitor visitor,
            String taskId,
            String key,
            int expectedVersion,
            Map<String, Object> fields
    ) throws Exception {
        return new ResultActionsWithBody(mockMvc.perform(put("/api/v1/tasks/{taskId}/fields", taskId)
                .header("Authorization", bearer(visitor))
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of(
                        "expected_version", expectedVersion,
                        "fields", fields
                )))));
    }

    private Visitor createConsentedVisitor(String suffix) throws Exception {
        String sessionKey = unique("session-" + suffix);
        MvcResult created = mockMvc.perform(post("/api/v1/sessions")
                        .header("Idempotency-Key", sessionKey)
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

    private String taskBody(String context, int clarityPre) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "entry_type", "DIRECT",
                "context", context,
                "clarity_pre", clarityPre
        ));
    }

    private Map<String, Object> normalFields(String fact, String interpretation) {
        return normalFields("dating_or_partner", fact, interpretation);
    }

    private Map<String, Object> normalFields(String context, String fact, String interpretation) {
        return Map.of(
                "context", context,
                "observed_fact", fact,
                "interpretation", interpretation,
                "emotion", List.of("anxious", "hurt"),
                "need_or_boundary", List.of("clarity", "respect"),
                "next_step_goal", "准备一次只讨论可观察事实的沟通"
        );
    }

    private int contentCount(String taskId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ct_content_version WHERE task_id = ?",
                Integer.class,
                taskId
        );
    }

    private void assertNoRawTextPersisted(String... forbiddenValues) {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_clarity_task"));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_content_version"));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_safety_assessment"));
        rows.addAll(jdbcTemplate.queryForList("SELECT * FROM ct_command_dedup"));
        String persisted = rows.stream()
                .flatMap(row -> row.values().stream())
                .map(value -> value instanceof byte[] bytes
                        ? new String(bytes, StandardCharsets.UTF_8)
                        : String.valueOf(value))
                .reduce("", (left, right) -> left + "|" + right);
        assertThat(persisted).doesNotContain(forbiddenValues);
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

        private ResultActionsWithBody andExpect(org.springframework.test.web.servlet.ResultMatcher matcher) throws Exception {
            delegate.andExpect(matcher);
            return this;
        }

        private JsonNode andReturnBody(ObjectMapper mapper) throws Exception {
            return mapper.readTree(delegate.andReturn().getResponse().getContentAsString());
        }
    }
}
