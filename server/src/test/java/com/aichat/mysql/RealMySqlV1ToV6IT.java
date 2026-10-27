package com.aichat.mysql;

import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.auth.AuthenticatedSubject;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.safety.application.SafetyEvidenceRecorder;
import com.aichat.safety.application.SafetyPolicyEngine;
import com.aichat.safety.application.SafetyReviewApplicationService;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper.EvidenceRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@EnabledIfSystemProperty(named = "aichat.mysql.it.enabled", matches = "true")
class RealMySqlV1ToV6IT {
    private static final int CONCURRENT_REQUESTS = 8;

    @DynamicPropertySource
    static void realMySqlProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> requiredSetting(
                "aichat.mysql.it.url", "AICHAT_MYSQL_IT_URL"));
        registry.add("spring.datasource.username", () -> requiredSetting(
                "aichat.mysql.it.username", "AICHAT_MYSQL_IT_USERNAME"));
        registry.add("spring.datasource.password", () -> requiredSetting(
                "aichat.mysql.it.password", "AICHAT_MYSQL_IT_PASSWORD"));
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        registry.add("spring.datasource.hikari.maximum-pool-size", () -> "12");
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SafetyEvidenceMapper evidenceMapper;

    @Autowired
    private SafetyEvidenceRecorder evidenceRecorder;

    @Autowired
    private SafetyPolicyEngine policyEngine;

    @Autowired
    private SafetyReviewApplicationService reviewService;

    @Autowired
    private UlidGenerator ids;

    @Autowired
    private Clock clock;

    @Test
    void emptyDatabaseMigratesThroughV7AndEnforcesExistingConstraints() {
        assertThat(jdbcTemplate.queryForObject("SELECT VERSION()", String.class)).startsWith("8.0.");
        assertThat(jdbcTemplate.queryForList(
                "SELECT version FROM flyway_schema_history WHERE success = TRUE ORDER BY installed_rank",
                String.class
        )).containsExactly("1", "2", "3", "4", "5", "6", "7");

        LocalDateTime now = utcNow();
        String sourceId = ids.next();
        evidenceMapper.insertEvidence(evidence(ids.next(), sourceId, "ALLOW", now));

        assertThatThrownBy(() -> evidenceMapper.insertEvidence(evidence(ids.next(), sourceId, "ALLOW", now)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> evidenceMapper.insertEvidence(evidence(ids.next(), ids.next(), "UNSAFE", now)))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO sf_safety_review_case (
                    id, evidence_id, priority, status, version_no, created_at, updated_at
                ) VALUES (?, ?, 'CRITICAL', 'OPEN', 1, ?, ?)
                """,
                ids.next(), ids.next(), now, now
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void concurrentSameKeyResolutionReturnsOneResultAndPersistsOneCommand() throws Exception {
        var decision = policyEngine.assess(
                SafetyPolicyEngine.Checkpoint.S1_INPUT,
                List.of("对方现在拿着刀堵住门，我马上会有危险。"),
                List.of("mysql-it")
        );
        var receipt = evidenceRecorder.recordIndependent(
                ids.next(), "VENT_TURN", ids.next(), decision, List.of(), utcNow());
        var context = new ApiCallContext(
                "mysql-it-request",
                new AuthenticatedSubject(
                        "operator-mysql-it", AuthLevel.OPERATOR, Set.of("safety-reviewer"), true)
        );
        var request = new ContractRequests.SafetyReviewDecisionRequest(
                1,
                "CONFIRMED_BLOCK",
                "真实 MySQL 并发验证确认该案例继续保持阻断。",
                "MYSQL-IT-20260719"
        );
        String idempotencyKey = "mysql-it-" + UUID.randomUUID();
        CyclicBarrier start = new CyclicBarrier(CONCURRENT_REQUESTS);
        ExecutorService executor = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);
        List<Future<Map<String, Object>>> futures = new ArrayList<>();

        try {
            for (int index = 0; index < CONCURRENT_REQUESTS; index++) {
                futures.add(executor.submit(() -> {
                    start.await(10, TimeUnit.SECONDS);
                    return reviewService.patchOpsSafetyReviewCase(
                            context, receipt.reviewCaseId(), idempotencyKey, request).data();
                }));
            }
            for (Future<Map<String, Object>> future : futures) {
                assertThat(future.get(20, TimeUnit.SECONDS))
                        .containsEntry("case_id", receipt.reviewCaseId())
                        .containsEntry("status", "RESOLVED")
                        .containsEntry("version", 2);
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM sf_safety_review_command_dedup WHERE case_id = ?",
                Integer.class,
                receipt.reviewCaseId()
        )).isEqualTo(1);
        assertThat(jdbcTemplate.queryForMap(
                "SELECT status, version_no FROM sf_safety_review_case WHERE id = ?",
                receipt.reviewCaseId()
        )).containsEntry("status", "RESOLVED").containsEntry("version_no", 2);
    }

    private EvidenceRecord evidence(String id, String sourceId, String route, LocalDateTime now) {
        return new EvidenceRecord(
                id,
                ids.next(),
                "VENT_TURN",
                sourceId,
                "S1_INPUT",
                route,
                "[]",
                "[]",
                SafetyPolicyEngine.RULE_VERSION,
                "[]",
                now
        );
    }

    private LocalDateTime utcNow() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private static String requiredSetting(String propertyName, String environmentName) {
        String value = System.getProperty(propertyName);
        if (value == null || value.isBlank()) value = System.getenv(environmentName);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "Missing required real MySQL integration setting: "
                            + propertyName + " or " + environmentName);
        }
        return value;
    }
}
