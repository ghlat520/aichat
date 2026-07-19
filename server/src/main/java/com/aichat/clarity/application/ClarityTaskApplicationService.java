package com.aichat.clarity.application;

import com.aichat.clarity.api.ClarityApiDelegate;
import com.aichat.clarity.application.InputSafetyService.MaskResult;
import com.aichat.clarity.application.InputSafetyService.SafetyDecision;
import com.aichat.clarity.infrastructure.ClarityMapper;
import com.aichat.clarity.infrastructure.ClarityMapper.CommandRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.ContentRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.SafetyRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.TaskRecord;
import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.content.EnvelopeEncryptionService.ContentCryptoException;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public final class ClarityTaskApplicationService implements ClarityApiDelegate {
    private static final String CREATE_SCOPE = "clarity:create-task";
    private static final String FIELDS_SCOPE_PREFIX = "clarity:put-fields:";
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    private final ClarityMapper mapper;
    private final UlidGenerator ids;
    private final InputSafetyService safety;
    private final EnvelopeEncryptionService encryption;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionTemplate transactions;

    public ClarityTaskApplicationService(
            ClarityMapper mapper,
            UlidGenerator ids,
            InputSafetyService safety,
            EnvelopeEncryptionService encryption,
            ObjectMapper objectMapper,
            Clock clock,
            TransactionTemplate transactions
    ) {
        this.mapper = mapper;
        this.ids = ids;
        this.safety = safety;
        this.encryption = encryption;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactions = transactions;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createClarityTask(
            ApiCallContext context,
            String idempotencyKey,
            ContractRequests.CreateTaskRequest request
    ) {
        IdempotencyKeys.requireValid(idempotencyKey);
        var subject = context.requireSubject();
        String owner = subject.subjectId();
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                CREATE_SCOPE,
                request.entryType(),
                request.context(),
                String.valueOf(request.clarityPre())
        );
        try {
            TaskRecord task = transactions.execute(status -> createOrReplayTask(
                    owner, subject.level().name(), keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), taskResponse(task));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            TaskRecord task = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(CREATE_SCOPE, owner, keyHash);
                if (command == null) throw concurrentDuplicate;
                return taskFromCommand(command, requestHash, owner);
            });
            return ApiEnvelope.success(context.requestId(), taskResponse(task));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getClarityTask(ApiCallContext context, String taskId) {
        String owner = context.requireSubject().subjectId();
        TaskRecord task = requireOwnedTask(taskId, owner);
        Map<String, Object> data = taskResponse(task);
        if (task.currentContentVersionId() == null) {
            return ApiEnvelope.success(context.requestId(), data);
        }

        ContentRecord content = mapper.findContent(task.currentContentVersionId());
        SafetyRecord assessment = mapper.findSafetyByContent(task.currentContentVersionId());
        if (content == null || assessment == null) {
            throw stateCorrupted(taskId);
        }
        ContractRequests.ClarityFields fields = decryptFields(content);
        LinkedHashMap<String, Object> complete = new LinkedHashMap<>(data);
        complete.put("content_version", content.id());
        complete.put("fields", fields);
        complete.put("safety", safetyResponse(assessment));
        return ApiEnvelope.success(context.requestId(), Map.copyOf(complete));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> putClarityFields(
            ApiCallContext context,
            String taskId,
            String idempotencyKey,
            ContractRequests.ClarityFieldsRequest request
    ) {
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = FIELDS_SCOPE_PREFIX + taskId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = requestHash(scope, request);

        try {
            FieldsResult result = transactions.execute(status -> putOrReplayFields(
                    taskId, owner, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), fieldsResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            FieldsResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw concurrentDuplicate;
                return fieldsFromCommand(command, requestHash, taskId, owner);
            });
            return ApiEnvelope.success(context.requestId(), fieldsResponse(result));
        }
    }

    private TaskRecord createOrReplayTask(
            String owner,
            String ownerAuthLevel,
            String keyHash,
            String requestHash,
            ContractRequests.CreateTaskRequest request
    ) {
        CommandRecord existing = mapper.findCommand(CREATE_SCOPE, owner, keyHash);
        if (existing != null) return taskFromCommand(existing, requestHash, owner);

        LocalDateTime now = now();
        TaskRecord task = new TaskRecord(
                ids.next(),
                owner,
                ownerAuthLevel,
                request.entryType(),
                request.context(),
                "DRAFT",
                request.clarityPre(),
                null,
                null,
                1,
                now,
                now,
                null
        );
        mapper.insertTask(task);
        mapper.insertCommand(new CommandRecord(
                CREATE_SCOPE,
                owner,
                keyHash,
                requestHash,
                task.id(),
                1,
                now,
                now.plus(IDEMPOTENCY_TTL)
        ));
        return task;
    }

    private TaskRecord taskFromCommand(CommandRecord command, String requestHash, String owner) {
        requireSameRequest(command, requestHash);
        TaskRecord task = mapper.findTask(command.resourceId());
        if (task == null || !Objects.equals(owner, task.ownerSubjectRef())) {
            throw stateCorrupted(command.resourceId());
        }
        return task;
    }

    private FieldsResult putOrReplayFields(
            String taskId,
            String owner,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.ClarityFieldsRequest request
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return fieldsFromCommand(existing, requestHash, taskId, owner);

        TaskRecord task = requireOwnedTask(taskId, owner);
        if ("SAFETY_BLOCKED".equals(task.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE_TRANSITION", "安全阻断任务不能继续普通内容流程");
        }
        if (task.versionNo() != request.expectedVersion()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "VERSION_CONFLICT",
                    "任务版本已经变化",
                    false,
                    Map.of("current_version", task.versionNo())
            );
        }
        if (!Objects.equals(task.contextCode(), request.fields().context())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CONTEXT_MISMATCH", "任务场景与六字段场景不一致");
        }

        MaskResult masked = safety.mask(request.fields());
        SafetyDecision decision = safety.assess(masked);
        LocalDateTime now = now();
        String contentId = ids.next();
        String assessmentId = ids.next();
        int resultVersion = task.versionNo() + 1;
        byte[] serialized = serialize(masked.fields());
        EncryptedPayload encrypted = encrypt(contentId, serialized);

        ContentRecord content = new ContentRecord(
                contentId,
                taskId,
                "SIX_FIELDS",
                resultVersion,
                "BLOCK".equals(decision.route()) ? "BLOCKED" : "DRAFT",
                encrypted.ciphertext(),
                encrypted.contentNonce(),
                encrypted.wrappedDek(),
                encrypted.wrapNonce(),
                encrypted.keyVersion(),
                encrypted.contentHash(),
                now
        );
        SafetyRecord assessment = new SafetyRecord(
                assessmentId,
                taskId,
                contentId,
                "S1",
                decision.route(),
                serializeList(decision.categories()),
                serializeList(masked.maskCodes()),
                decision.ruleVersion(),
                serializeList(decision.resourceIds()),
                now
        );
        mapper.insertContent(content);
        mapper.insertSafety(assessment);

        String nextState = stateFor(decision.route());
        if (mapper.updateCurrentContent(
                taskId,
                owner,
                request.expectedVersion(),
                nextState,
                contentId,
                assessmentId,
                now
        ) != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "VERSION_CONFLICT", "任务版本已经变化");
        }
        mapper.insertCommand(new CommandRecord(
                scope,
                owner,
                keyHash,
                requestHash,
                contentId,
                resultVersion,
                now,
                now.plus(IDEMPOTENCY_TTL)
        ));
        return new FieldsResult(taskId, contentId, nextState, resultVersion, assessment);
    }

    private FieldsResult fieldsFromCommand(
            CommandRecord command,
            String requestHash,
            String taskId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        TaskRecord task = requireOwnedTask(taskId, owner);
        ContentRecord content = mapper.findContent(command.resourceId());
        SafetyRecord assessment = mapper.findSafetyByContent(command.resourceId());
        if (content == null || assessment == null || !Objects.equals(taskId, content.taskId())) {
            throw stateCorrupted(taskId);
        }
        return new FieldsResult(
                taskId,
                content.id(),
                stateFor(assessment.route()),
                command.resultVersion(),
                assessment
        );
    }

    private TaskRecord requireOwnedTask(String taskId, String owner) {
        TaskRecord task = mapper.findTask(taskId);
        if (task == null || task.deletedAt() != null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "任务不存在");
        }
        if (!Objects.equals(owner, task.ownerSubjectRef())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "RESOURCE_OWNERSHIP_DENIED", "无权访问该任务");
        }
        return task;
    }

    private ContractRequests.ClarityFields decryptFields(ContentRecord content) {
        EncryptedPayload encrypted = new EncryptedPayload(
                content.ciphertext(),
                content.contentNonce(),
                content.wrappedDek(),
                content.wrapNonce(),
                content.keyVersion(),
                content.contentHash()
        );
        try {
            return objectMapper.readValue(encryption.decrypt(content.id(), encrypted), ContractRequests.ClarityFields.class);
        } catch (ContentCryptoException | IOException exception) {
            throw contentUnavailable();
        }
    }

    private byte[] serialize(ContractRequests.ClarityFields fields) {
        try {
            return objectMapper.writeValueAsBytes(fields);
        } catch (JsonProcessingException exception) {
            throw contentUnavailable();
        }
    }

    private String serializeList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw contentUnavailable();
        }
    }

    private EncryptedPayload encrypt(String contentId, byte[] serialized) {
        try {
            return encryption.encrypt(contentId, serialized);
        } catch (ContentCryptoException exception) {
            throw contentUnavailable();
        }
    }

    private String requestHash(String scope, ContractRequests.ClarityFieldsRequest request) {
        try {
            return Sha256Fingerprints.canonicalRequest(
                    scope,
                    String.valueOf(request.expectedVersion()),
                    objectMapper.writeValueAsString(request.fields())
            );
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "请求无法规范化");
        }
    }

    private Map<String, Object> taskResponse(TaskRecord task) {
        LinkedHashMap<String, Object> data = new LinkedHashMap<>();
        data.put("task_id", task.id());
        data.put("entry_type", task.entryType());
        data.put("context", task.contextCode());
        data.put("clarity_pre", task.clarityPre());
        data.put("state", task.state());
        data.put("version", task.versionNo());
        data.put("created_at", task.createdAt().atOffset(ZoneOffset.UTC).toString());
        data.put("updated_at", task.updatedAt().atOffset(ZoneOffset.UTC).toString());
        return Map.copyOf(data);
    }

    private Map<String, Object> fieldsResponse(FieldsResult result) {
        return Map.of(
                "task_id", result.taskId(),
                "content_version", result.contentVersionId(),
                "state", result.state(),
                "version", result.version(),
                "safety", safetyResponse(result.safety())
        );
    }

    private Map<String, Object> safetyResponse(SafetyRecord assessment) {
        return Map.of(
                "route", assessment.route(),
                "categories", parseList(assessment.categoriesJson()),
                "mask_codes", parseList(assessment.maskCodesJson()),
                "rule_version", assessment.ruleVersion(),
                "resource_ids", parseList(assessment.resourceIdsJson())
        );
    }

    private List<String> parseList(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() { });
        } catch (JsonProcessingException exception) {
            throw stateCorrupted("safety-metadata");
        }
    }

    private String stateFor(String route) {
        return switch (route) {
            case "ALLOW" -> "FIELDS_SAVED";
            case "CLARIFY" -> "SAFETY_CLARIFICATION_REQUIRED";
            case "BLOCK" -> "SAFETY_BLOCKED";
            default -> throw stateCorrupted("safety-route");
        };
    }

    private void requireSameRequest(CommandRecord command, String requestHash) {
        if (!Objects.equals(command.requestHash(), requestHash)) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同请求");
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private ApiException stateCorrupted(String resourceId) {
        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "CONTENT_STATE_CORRUPTED",
                "内容状态异常",
                false,
                Map.of("resource_id", resourceId)
        );
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

    private record FieldsResult(
            String taskId,
            String contentVersionId,
            String state,
            int version,
            SafetyRecord safety
    ) {
    }
}
