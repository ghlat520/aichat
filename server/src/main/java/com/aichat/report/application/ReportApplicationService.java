package com.aichat.report.application;

import com.aichat.clarity.port.ReportTaskSourcePort;
import com.aichat.clarity.port.ReportTaskSourcePort.ReportTaskSnapshot;
import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.content.EnvelopeEncryptionService.ContentCryptoException;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import com.aichat.kernel.feature.FeatureAvailability;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.report.api.ReportApiDelegate;
import com.aichat.report.infrastructure.ReportMapper;
import com.aichat.report.infrastructure.ReportMapper.CommandRecord;
import com.aichat.report.infrastructure.ReportMapper.ReportRecord;
import com.aichat.safety.application.SafetyEvidenceRecorder;
import com.aichat.safety.application.SafetyPolicyEngine;
import com.aichat.safety.application.SafetyPolicyEngine.Decision;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public final class ReportApplicationService implements ReportApiDelegate {
    private static final String CREATE_SCOPE_PREFIX = "report:create:";
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final Duration REPORT_TTL = Duration.ofDays(30);
    private static final String REPORT_VERSION = "relationship-card-v1";
    private static final String MODEL_VERSION = "deterministic-stub-v1";
    private static final String PROMPT_VERSION = "stub-template-v1";
    private static final String SAFETY_VERSION = "s3-deterministic-stub-v1";
    private static final String TEMPLATE_VERSION = "relationship-card-template-v1";
    private static final Set<String> ACTION_CATEGORIES = Set.of(
            "communicate", "pause", "boundary", "step_back", "real_world_support");

    private final ReportMapper mapper;
    private final ReportTaskSourcePort taskSource;
    private final FeatureAvailability features;
    private final ReportSafetyGate safetyGate;
    private final UlidGenerator ids;
    private final EnvelopeEncryptionService encryption;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final SafetyEvidenceRecorder safetyEvidence;
    private final ReportExpiryJob expiryJob;

    public ReportApplicationService(
            ReportMapper mapper,
            ReportTaskSourcePort taskSource,
            FeatureAvailability features,
            ReportSafetyGate safetyGate,
            UlidGenerator ids,
            EnvelopeEncryptionService encryption,
            ObjectMapper objectMapper,
            Clock clock,
            TransactionTemplate transactions,
            SafetyEvidenceRecorder safetyEvidence,
            ReportExpiryJob expiryJob
    ) {
        this.mapper = mapper;
        this.taskSource = taskSource;
        this.features = features;
        this.safetyGate = safetyGate;
        this.ids = ids;
        this.encryption = encryption;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactions = transactions;
        this.safetyEvidence = safetyEvidence;
        this.expiryJob = expiryJob;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createTaskReport(
            ApiCallContext context,
            String taskId,
            String idempotencyKey,
            ContractRequests.CreateReportRequest request
    ) {
        features.requireGenerationEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = CREATE_SCOPE_PREFIX + taskId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope,
                String.valueOf(request.expectedTaskVersion()),
                request.confirmedContentVersion(),
                String.join("\u0001", request.reflectionVersions())
        );

        try {
            ReportResult result = transactions.execute(status -> createOrReplay(
                    owner, taskId, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), createResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            ReportResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash, now());
                if (command == null) {
                    if (mapper.findReportByTask(taskId) != null) throw reportAlreadyExists();
                    throw concurrentDuplicate;
                }
                return resultFromCommand(command, requestHash, taskId, owner);
            });
            return ApiEnvelope.success(context.requestId(), createResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getFreeReportSummary(
            ApiCallContext context,
            String reportId
    ) {
        String owner = context.requireSubject().subjectId();
        ReportRecord report = mapper.findReport(reportId);
        if (report == null || "DELETED".equals(report.status()) || !report.expiresAt().isAfter(now())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "报告不存在");
        }
        if (!Objects.equals(owner, report.ownerSubjectRef())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "RESOURCE_OWNERSHIP_DENIED", "无权访问该报告");
        }
        if (!"SEALED_READY".equals(report.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "REPORT_NOT_READY", "免费摘要尚未就绪");
        }
        Map<String, Object> freeSummary = decryptFreeSummary(report);
        return ApiEnvelope.success(context.requestId(), Map.of(
                "report_id", report.id(),
                "task_id", report.taskId(),
                "status", report.status(),
                "report_version", report.reportVersion(),
                "free_summary", freeSummary
        ));
    }

    private ReportResult createOrReplay(
            String owner,
            String taskId,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.CreateReportRequest request
    ) {
        LocalDateTime commandNow = now();
        expiryJob.deleteExpiredCommand(scope, owner, keyHash, commandNow);
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash, commandNow);
        if (existing != null) return resultFromCommand(existing, requestHash, taskId, owner);
        if (mapper.findReportByTask(taskId) != null) throw reportAlreadyExists();

        String reportId = ids.next();
        ReportTaskSnapshot snapshot = taskSource.loadConfirmedReportInput(
                owner,
                taskId,
                request.expectedTaskVersion(),
                request.confirmedContentVersion(),
                request.reflectionVersions()
        );
        Decision s2 = safetyGate.assessPreGeneration(snapshot);
        safetyEvidence.recordIndependent(owner, "REPORT", reportId, s2, List.of(), now());
        safetyGate.requireAllowed(s2);
        Map<String, Object> sealed = buildSealedReport(snapshot);
        Map<String, Object> free = buildFreeSummary(snapshot, sealed);
        validateOutput(snapshot, free, sealed);
        Decision s3 = safetyGate.assessOutput(sealed);
        safetyEvidence.recordIndependent(owner, "REPORT", reportId, s3, List.of(), now());
        safetyGate.requireAllowed(s3);

        LocalDateTime now = now();
        String generationId = ids.next();
        byte[] freeBytes = serialize(free);
        byte[] sealedBytes = serialize(sealed);
        EncryptedPayload freeEncrypted = encrypt(reportId + ":free", freeBytes);
        EncryptedPayload sealedEncrypted = encrypt(reportId + ":sealed", sealedBytes);
        String deliverableHash = Sha256Fingerprints.hash(new String(sealedBytes, StandardCharsets.UTF_8));
        ReportRecord report = new ReportRecord(
                reportId,
                taskId,
                generationId,
                owner,
                "SEALED_READY",
                REPORT_VERSION,
                freeEncrypted.ciphertext(),
                freeEncrypted.contentNonce(),
                freeEncrypted.wrappedDek(),
                freeEncrypted.wrapNonce(),
                freeEncrypted.keyVersion(),
                freeEncrypted.contentHash(),
                sealedEncrypted.ciphertext(),
                sealedEncrypted.contentNonce(),
                sealedEncrypted.wrappedDek(),
                sealedEncrypted.wrapNonce(),
                sealedEncrypted.keyVersion(),
                sealedEncrypted.contentHash(),
                deliverableHash,
                MODEL_VERSION,
                PROMPT_VERSION,
                SAFETY_VERSION + "+" + SafetyPolicyEngine.RULE_VERSION,
                TEMPLATE_VERSION,
                now.plus(REPORT_TTL),
                now,
                now
        );
        mapper.insertReport(report);
        if (taskSource.markReportReady(owner, taskId, snapshot.taskVersion(), now) != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "VERSION_CONFLICT", "任务版本已经变化");
        }
        int taskResultVersion = snapshot.taskVersion() + 1;
        mapper.insertCommand(new CommandRecord(
                scope,
                owner,
                keyHash,
                requestHash,
                reportId,
                taskResultVersion,
                now,
                now.plus(IDEMPOTENCY_TTL)
        ));
        return new ReportResult(report, taskResultVersion);
    }

    private ReportResult resultFromCommand(
            CommandRecord command,
            String requestHash,
            String taskId,
            String owner
    ) {
        if (!Objects.equals(command.requestHash(), requestHash)) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同请求");
        }
        ReportRecord report = mapper.findReport(command.reportId());
        if (report == null
                || !Objects.equals(taskId, report.taskId())
                || !Objects.equals(owner, report.ownerSubjectRef())) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "REPORT_STATE_CORRUPTED", "报告状态异常");
        }
        return new ReportResult(report, command.taskResultVersion());
    }

    private Map<String, Object> buildSealedReport(ReportTaskSnapshot snapshot) {
        List<Map<String, Object>> confirmedFacts = snapshot.confirmedFacts().stream()
                .map(text -> Map.<String, Object>of("text", text, "source", "user_confirmed"))
                .toList();
        List<Map<String, Object>> unknowns = snapshot.unknownsToVerify().stream()
                .map(text -> Map.<String, Object>of("text", text, "confidence", "unknown"))
                .toList();
        List<Map<String, Object>> explanations = List.of(
                explanation(
                        "可观察到的安排变化可能与信息或时间条件有关。",
                        List.of("当前有用户确认的具体行为记录。"),
                        List.of("缺少对具体变化原因的直接说明。")
                ),
                explanation(
                        "双方对联系节奏或边界的期待可能并不一致。",
                        List.of("用户已经明确当前优先需要或边界。"),
                        List.of("缺少双方对期待的直接确认。")
                ),
                explanation(
                        "现有信息不足以确认原因，需要保留未知。",
                        List.of("用户已经列出至少一个待验证项。"),
                        List.of("缺少后续可观察行为和直接沟通结果。")
                )
        );
        Map<String, Object> action = new LinkedHashMap<>();
        action.put("category", actionCategory(snapshot.selfExecutableGoal()));
        action.put("action", "未来48小时内开始：" + snapshot.selfExecutableGoal());
        action.put("reversible", true);
        action.put("success_observation", "已完成一个由本人控制的具体步骤，并记录实际结果。");
        action.put("stop_condition", "若出现安全风险、明显升级或需要专业支持，停止该行动并转向现实支持。");

        LinkedHashMap<String, Object> report = new LinkedHashMap<>();
        report.put("confirmed_facts", confirmedFacts);
        report.put("unverified_interpretations", unknowns);
        report.put("emotion_and_needs", Map.of(
                "emotions", snapshot.emotions(),
                "needs_or_boundaries", snapshot.needsOrBoundaries()
        ));
        report.put("current_goal", snapshot.selfExecutableGoal());
        report.put("possible_explanations", explanations);
        report.put("risks_and_limits", List.of(
                "这些解释只用于整理可能性，不代表第三人的真实心理或意图。",
                "产品不提供诊断、预测、法律、医疗或重大财务决定。"
        ));
        report.put("candidate_actions", List.of(Map.copyOf(action)));
        report.put("communication_draft", Map.of(
                "text", "我想只基于已经确认的事实说明感受和边界，并确认下一步是否需要继续沟通。",
                "editable", true
        ));
        report.put("safety_resources", List.of());
        report.put("versions", versions(snapshot.inputFingerprint()));
        return Map.copyOf(report);
    }

    private Map<String, Object> buildFreeSummary(
            ReportTaskSnapshot snapshot,
            Map<String, Object> sealed
    ) {
        LinkedHashMap<String, Object> free = new LinkedHashMap<>();
        free.put("confirmed_facts", snapshot.confirmedFacts());
        free.put("unknowns_to_verify", snapshot.unknownsToVerify());
        free.put("emotion_and_needs", sealed.get("emotion_and_needs"));
        free.put("boundary_reminder", "先保护本人可执行的边界；不确定时不把推测当成事实。 ".trim());
        free.put("uncertainty_and_limits", List.of(
                "目前仍有信息需要验证，摘要不会判断第三人的真实心理。",
                "这不是诊断、预测，也不替代现实中的专业或紧急支持。"
        ));
        free.put("safety_resources", sealed.get("safety_resources"));
        free.put("self_executable_goal", snapshot.selfExecutableGoal());
        free.put("action_decision", Map.of(
                "editable", true,
                "can_reject", true,
                "action_text", "未来48小时内开始：" + snapshot.selfExecutableGoal()
        ));
        free.put("ai_label", "AI 辅助生成");
        free.put("versions", versions(snapshot.inputFingerprint()));
        return Map.copyOf(free);
    }

    private Map<String, Object> explanation(
            String explanation,
            List<String> supportingSignals,
            List<String> missingEvidence
    ) {
        return Map.of(
                "explanation", explanation,
                "supporting_signals", supportingSignals,
                "missing_evidence", missingEvidence
        );
    }

    private Map<String, String> versions(String inputFingerprint) {
        return Map.of(
                "model", MODEL_VERSION,
                "prompt", PROMPT_VERSION,
                "safety", SAFETY_VERSION,
                "s2_policy", SafetyPolicyEngine.RULE_VERSION,
                "s3_policy", SafetyPolicyEngine.RULE_VERSION,
                "output_validator", SAFETY_VERSION,
                "template", TEMPLATE_VERSION,
                "input_fingerprint", inputFingerprint
        );
    }

    private void validateOutput(
            ReportTaskSnapshot snapshot,
            Map<String, Object> free,
            Map<String, Object> sealed
    ) {
        JsonNode full = objectMapper.valueToTree(sealed);
        JsonNode freeNode = objectMapper.valueToTree(free);
        require(full.path("confirmed_facts").size() == snapshot.confirmedFacts().size());
        require(snapshot.confirmedFacts().equals(textValues(full.path("confirmed_facts"), "text")));
        full.path("confirmed_facts").forEach(fact -> require("user_confirmed".equals(fact.path("source").asText())));
        require(snapshot.unknownsToVerify().equals(textValues(full.path("unverified_interpretations"), "text")));
        full.path("unverified_interpretations").forEach(item ->
                require("unknown".equals(item.path("confidence").asText())));
        require(snapshot.selfExecutableGoal().equals(full.path("current_goal").asText()));
        require(full.path("possible_explanations").size() == 3);
        full.path("possible_explanations").forEach(item -> {
            require(item.path("missing_evidence").isArray() && !item.path("missing_evidence").isEmpty());
            require(!item.has("probability"));
            require(!item.has("confidence"));
        });
        require(full.path("candidate_actions").size() >= 1 && full.path("candidate_actions").size() <= 3);
        full.path("candidate_actions").forEach(action -> {
            require(ACTION_CATEGORIES.contains(action.path("category").asText()));
            require(action.path("reversible").asBoolean(false));
            require(!action.path("success_observation").asText().isBlank());
            require(!action.path("stop_condition").asText().isBlank());
        });
        require(full.path("risks_and_limits").isArray() && !full.path("risks_and_limits").isEmpty());
        require(full.path("communication_draft").path("editable").asBoolean(false));
        require(full.path("safety_resources").isArray());
        require(full.path("versions").path("model").asText().equals(MODEL_VERSION));
        require(full.path("versions").path("prompt").asText().equals(PROMPT_VERSION));
        require(full.path("versions").path("safety").asText().equals(SAFETY_VERSION));
        require(full.path("versions").path("s2_policy").asText().equals(SafetyPolicyEngine.RULE_VERSION));
        require(full.path("versions").path("s3_policy").asText().equals(SafetyPolicyEngine.RULE_VERSION));
        require(full.path("versions").path("output_validator").asText().equals(SAFETY_VERSION));
        require(full.path("versions").path("template").asText().equals(TEMPLATE_VERSION));
        require(jsonStringValues(freeNode.path("confirmed_facts")).equals(snapshot.confirmedFacts()));
        require(jsonStringValues(freeNode.path("unknowns_to_verify")).equals(snapshot.unknownsToVerify()));
        require(snapshot.selfExecutableGoal().equals(freeNode.path("self_executable_goal").asText()));
        require(freeNode.path("emotion_and_needs").isObject());
        require(!freeNode.path("boundary_reminder").asText().isBlank());
        require(freeNode.path("uncertainty_and_limits").isArray()
                && !freeNode.path("uncertainty_and_limits").isEmpty());
        require(freeNode.path("safety_resources").isArray());
        require(freeNode.path("action_decision").path("editable").asBoolean(false));
        require(freeNode.path("action_decision").path("can_reject").asBoolean(false));
        String freeText = freeNode.toString();
        require(!freeText.contains("只有付费"));
        require(!freeText.contains("付费才能"));
        require(!freeText.contains("坏消息"));
        require(!freeText.contains("立即购买"));
    }

    private List<String> textValues(JsonNode items, String field) {
        java.util.ArrayList<String> values = new java.util.ArrayList<>();
        items.forEach(item -> values.add(item.path(field).asText()));
        return List.copyOf(values);
    }

    private List<String> jsonStringValues(JsonNode items) {
        java.util.ArrayList<String> values = new java.util.ArrayList<>();
        items.forEach(item -> values.add(item.asText()));
        return List.copyOf(values);
    }

    private void require(boolean condition) {
        if (!condition) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "REPORT_OUTPUT_REJECTED",
                    "报告未通过输出安全校验",
                    true,
                    Map.of("safety_version", SAFETY_VERSION)
            );
        }
    }

    private String actionCategory(String goal) {
        if (goal.contains("沟通")) return "communicate";
        if (goal.contains("暂停")) return "pause";
        if (goal.contains("退出") || goal.contains("减少")) return "step_back";
        if (goal.contains("支持") || goal.contains("求助")) return "real_world_support";
        return "boundary";
    }

    private byte[] serialize(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsBytes(value);
        } catch (JsonProcessingException exception) {
            throw contentUnavailable();
        }
    }

    private EncryptedPayload encrypt(String contentId, byte[] plaintext) {
        try {
            return encryption.encrypt(contentId, plaintext);
        } catch (ContentCryptoException exception) {
            throw contentUnavailable();
        }
    }

    private Map<String, Object> decryptFreeSummary(ReportRecord report) {
        EncryptedPayload encrypted = new EncryptedPayload(
                report.freeCiphertext(),
                report.freeContentNonce(),
                report.freeWrappedDek(),
                report.freeWrapNonce(),
                report.freeKeyVersion(),
                report.freeContentHash()
        );
        try {
            return objectMapper.readValue(
                    encryption.decrypt(report.id() + ":free", encrypted),
                    new TypeReference<>() { }
            );
        } catch (ContentCryptoException | IOException exception) {
            throw contentUnavailable();
        }
    }

    private Map<String, Object> createResponse(ReportResult result) {
        ReportRecord report = result.report();
        return Map.of(
                "generation_id", report.generationId(),
                "report_id", report.id(),
                "state", report.status(),
                "task_state", "REPORT_READY",
                "task_version", result.taskResultVersion(),
                "report_version", report.reportVersion(),
                "poll_after_ms", 0
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private ApiException reportAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "REPORT_ALREADY_EXISTS", "当前任务已经生成报告");
    }

    private ApiException contentUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CONTENT_SECURITY_UNAVAILABLE",
                "内容安全服务暂时不可用",
                true,
                Map.of()
        );
    }

    private record ReportResult(ReportRecord report, int taskResultVersion) {
    }
}
