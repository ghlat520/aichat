package com.aichat.safety;

import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.auth.AuthenticatedSubject;
import com.aichat.kernel.auth.SubjectResolver;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.safety.application.SafetyEvidenceRecorder;
import com.aichat.safety.application.SafetyEvidenceRecorder.EvidenceReceipt;
import com.aichat.safety.application.SafetyPolicyEngine;
import com.aichat.safety.application.SafetyPolicyEngine.Checkpoint;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(SafetyReviewWebMvcTest.OperatorAuthConfig.class)
class SafetyReviewWebMvcTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SafetyEvidenceRecorder recorder;

    @Autowired
    private SafetyPolicyEngine policy;

    @Autowired
    private UlidGenerator ids;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    @Autowired
    private TransactionTemplate transactions;

    @Test
    void operatorQueueRequiresMfaAndSafetyRoleAndNeverReturnsMaterial() throws Exception {
        EvidenceReceipt receipt = blockedEvidence();

        mockMvc.perform(get("/ops/v1/safety-review-cases"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/ops/v1/safety-review-cases")
                        .header("Authorization", "Bearer ops-no-mfa"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/ops/v1/safety-review-cases")
                        .header("Authorization", "Bearer ops-wrong-role"))
                .andExpect(status().isForbidden());

        String listBody = mockMvc.perform(get("/ops/v1/safety-review-cases")
                        .header("Authorization", "Bearer ops-good")
                        .queryParam("status", "OPEN")
                        .queryParam("route", "BLOCK")
                        .queryParam("limit", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].case_id", hasItem(receipt.reviewCaseId())))
                .andExpect(jsonPath("$.data.material_access").value("NONE"))
                .andReturn().getResponse().getContentAsString();
        assertThat(listBody).doesNotContain("马上会有危险").doesNotContain("owner_subject_ref");

        mockMvc.perform(get("/ops/v1/safety-review-cases/{id}", receipt.reviewCaseId())
                        .header("Authorization", "Bearer ops-good"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.route").value("BLOCK"))
                .andExpect(jsonPath("$.data.material_access").value("NONE"))
                .andExpect(jsonPath("$.data.rule_version").value(SafetyPolicyEngine.RULE_VERSION));
    }

    @Test
    void resolutionIsVersionedIdempotentAndStoresOnlyHashes() throws Exception {
        EvidenceReceipt receipt = blockedEvidence();
        String key = unique("resolve");
        Map<String, Object> decision = Map.of(
                "expected_version", 1,
                "decision", "CONFIRMED_BLOCK",
                "reason", "复核确认该案例应保持阻断并继续提供免费安全资源。",
                "ticket", "SAFE-2026-0001"
        );

        JsonNode resolved = objectMapper.readTree(mockMvc.perform(patch(
                                "/ops/v1/safety-review-cases/{id}", receipt.reviewCaseId())
                        .header("Authorization", "Bearer ops-good")
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(decision)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.decision").value("CONFIRMED_BLOCK"))
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(patch("/ops/v1/safety-review-cases/{id}", receipt.reviewCaseId())
                        .header("Authorization", "Bearer ops-good")
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(decision)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));

        Map<String, Object> changed = Map.of(
                "expected_version", 1,
                "decision", "FALSE_POSITIVE",
                "reason", "相同幂等键不能用于另一份不同的人工复核结论。",
                "ticket", "SAFE-2026-0002"
        );
        mockMvc.perform(patch("/ops/v1/safety-review-cases/{id}", receipt.reviewCaseId())
                        .header("Authorization", "Bearer ops-good")
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(changed)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IDEMPOTENCY_KEY_REUSED"));

        assertThat(resolved.path("data").has("reason")).isFalse();
        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "SELECT reason_hash, ticket_hash FROM sf_safety_review_case WHERE id = ?",
                receipt.reviewCaseId());
        assertThat(stored.values()).allSatisfy(value -> assertThat(value.toString()).matches("[a-f0-9]{64}"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_evidence WHERE id = ?",
                Integer.class,
                receipt.evidenceId())).isEqualTo(1);

        assertThat(jdbcTemplate.update(
                "UPDATE sf_safety_review_command_dedup SET expires_at = ? WHERE case_id = ?",
                utcNow().minusSeconds(1),
                receipt.reviewCaseId()
        )).isEqualTo(1);
        mockMvc.perform(patch("/ops/v1/safety-review-cases/{id}", receipt.reviewCaseId())
                        .header("Authorization", "Bearer ops-good")
                        .header("Idempotency-Key", key)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsBytes(decision)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("SAFETY_CASE_ALREADY_RESOLVED"));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_review_command_dedup WHERE case_id = ?",
                Integer.class,
                receipt.reviewCaseId()
        )).isZero();
    }

    @Test
    void allowCreatesEvidenceWithoutCaseAndQueueUsesBoundedCursor() throws Exception {
        String sourceId = ids.next();
        EvidenceReceipt allow = recorder.recordIndependent(
                ids.next(),
                "VENT_TURN",
                sourceId,
                policy.assess(Checkpoint.S1_INPUT, List.of("对方取消了已经确认的安排。"), List.of()),
                List.of(),
                utcNow()
        );
        assertThat(allow.reviewCaseId()).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_review_case WHERE evidence_id = ?",
                Integer.class,
                allow.evidenceId())).isZero();

        blockedEvidence();
        blockedEvidence();
        mockMvc.perform(get("/ops/v1/safety-review-cases")
                        .header("Authorization", "Bearer ops-good")
                        .queryParam("status", "OPEN")
                        .queryParam("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.has_more").value(true))
                .andExpect(jsonPath("$.data.next_cursor").isString());
    }

    @Test
    void independentEvidenceSurvivesARejectedCallerTransaction() {
        String sourceId = ids.next();
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
            recorder.recordIndependent(
                    ids.next(),
                    "VENT_TURN",
                    sourceId,
                    policy.assess(
                            Checkpoint.S1_INPUT,
                            List.of("对方现在拿着刀堵住门，我马上会有危险。"),
                            List.of()
                    ),
                    List.of(),
                    utcNow()
            );
            throw new IllegalStateException("force caller rollback");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_evidence WHERE source_type = 'VENT_TURN' AND source_id = ?",
                Integer.class,
                sourceId
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                  FROM sf_safety_review_case c
                  JOIN sf_safety_evidence e ON e.id = c.evidence_id
                 WHERE e.source_type = 'VENT_TURN' AND e.source_id = ?
                """,
                Integer.class,
                sourceId
        )).isEqualTo(1);
    }

    private EvidenceReceipt blockedEvidence() {
        return recorder.recordIndependent(
                ids.next(),
                "VENT_TURN",
                ids.next(),
                policy.assess(
                        Checkpoint.S1_INPUT,
                        List.of("对方现在拿着刀堵住门，我马上会有危险。"),
                        List.of("mobile")
                ),
                List.of("mobile"),
                utcNow()
        );
    }

    private LocalDateTime utcNow() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    @TestConfiguration
    static class OperatorAuthConfig {
        @Bean
        @Primary
        SubjectResolver testOperatorSubjectResolver() {
            return (request, policy) -> {
                String authorization = request.getHeader("Authorization");
                if ("Bearer ops-good".equals(authorization)) {
                    return Optional.of(new AuthenticatedSubject(
                            "operator-safety-01", AuthLevel.OPERATOR, Set.of("safety-reviewer"), true));
                }
                if ("Bearer ops-no-mfa".equals(authorization)) {
                    return Optional.of(new AuthenticatedSubject(
                            "operator-safety-02", AuthLevel.OPERATOR, Set.of("safety-reviewer"), false));
                }
                if ("Bearer ops-wrong-role".equals(authorization)) {
                    return Optional.of(new AuthenticatedSubject(
                            "operator-support-01", AuthLevel.OPERATOR, Set.of("support"), true));
                }
                return Optional.empty();
            };
        }
    }
}
