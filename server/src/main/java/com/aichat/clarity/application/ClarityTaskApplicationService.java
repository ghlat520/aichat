package com.aichat.clarity.application;

import com.aichat.clarity.api.ClarityApiDelegate;
import com.aichat.clarity.application.InputSafetyService.MaskResult;
import com.aichat.clarity.application.InputSafetyService.MaskedTexts;
import com.aichat.clarity.application.InputSafetyService.SafetyDecision;
import com.aichat.clarity.infrastructure.ClarityMapper;
import com.aichat.clarity.infrastructure.ClarityMapper.CommandRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.ContentRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.ReflectionRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.SafetyRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.TaskRecord;
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
import com.aichat.safety.application.SafetyEvidenceRecorder;
import com.aichat.safety.application.SafetyEvidenceRecorder.DecisionData;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public final class ClarityTaskApplicationService implements ClarityApiDelegate, ReportTaskSourcePort {
    private static final String CREATE_SCOPE = "clarity:create-task";
    private static final String FIELDS_SCOPE_PREFIX = "clarity:put-fields:";
    private static final String MIRROR_SCOPE_PREFIX = "clarity:create-mirror:";
    private static final String MIRROR_CONFIRM_SCOPE_PREFIX = "clarity:confirm-mirror:";
    private static final String REFLECTION_SCOPE_PREFIX = "clarity:create-reflection:";
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final String MIRROR_MODEL_VERSION = "deterministic-stub-v1";
    private static final Pattern OTHER_DEPENDENT_GOAL = Pattern.compile(
            "让对方|要求对方|对方必须|保证(?:永远|一定)|监控|跟踪|报复|转账|汇款|起诉|诊断|预测",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern LIST_SEPARATOR = Pattern.compile("[、,，]+");

    private final ClarityMapper mapper;
    private final UlidGenerator ids;
    private final InputSafetyService safety;
    private final EnvelopeEncryptionService encryption;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final FeatureAvailability features;
    private final SafetyEvidenceRecorder safetyEvidence;

    public ClarityTaskApplicationService(
            ClarityMapper mapper,
            UlidGenerator ids,
            InputSafetyService safety,
            EnvelopeEncryptionService encryption,
            ObjectMapper objectMapper,
            Clock clock,
            TransactionTemplate transactions,
            FeatureAvailability features,
            SafetyEvidenceRecorder safetyEvidence
    ) {
        this.mapper = mapper;
        this.ids = ids;
        this.safety = safety;
        this.encryption = encryption;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactions = transactions;
        this.features = features;
        this.safetyEvidence = safetyEvidence;
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

    @Override
    public ApiEnvelope<Map<String, Object>> createTaskMirror(
            ApiCallContext context,
            String taskId,
            String idempotencyKey,
            ContractRequests.ExpectedVersionRequest request
    ) {
        features.requireGenerationEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = MIRROR_SCOPE_PREFIX + taskId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope, String.valueOf(request.expectedVersion()));

        try {
            MirrorResult result = transactions.execute(status -> createOrReplayMirror(
                    taskId, owner, scope, keyHash, requestHash, request.expectedVersion()));
            return ApiEnvelope.success(context.requestId(), mirrorResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            MirrorResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw concurrentDuplicate;
                return mirrorFromCommand(command, requestHash, taskId, owner);
            });
            return ApiEnvelope.success(context.requestId(), mirrorResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> confirmTaskMirror(
            ApiCallContext context,
            String taskId,
            String idempotencyKey,
            ContractRequests.MirrorConfirmationRequest request
    ) {
        features.requireGenerationEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        validateMirrorEvaluations(request.evaluations());
        String owner = context.requireSubject().subjectId();
        String scope = MIRROR_CONFIRM_SCOPE_PREFIX + taskId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = structuredRequestHash(scope, request);

        try {
            MirrorConfirmationResult result = transactions.execute(status -> confirmOrReplayMirror(
                    taskId, owner, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), mirrorConfirmationResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            MirrorConfirmationResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw concurrentDuplicate;
                return mirrorConfirmationFromCommand(command, requestHash, taskId, owner);
            });
            return ApiEnvelope.success(context.requestId(), mirrorConfirmationResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createTaskReflection(
            ApiCallContext context,
            String taskId,
            String idempotencyKey,
            ContractRequests.ReflectionRequest request
    ) {
        features.requireGenerationEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        validateReflectionShape(request);
        String owner = context.requireSubject().subjectId();
        String scope = REFLECTION_SCOPE_PREFIX + taskId + ":" + request.round();
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = structuredRequestHash(scope, request);

        try {
            ReflectionResult result = transactions.execute(status -> createOrReplayReflection(
                    taskId, owner, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), reflectionResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            ReflectionResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw concurrentDuplicate;
                return reflectionFromCommand(command, requestHash, taskId, owner);
            });
            return ApiEnvelope.success(context.requestId(), reflectionResponse(result));
        }
    }

    @Override
    public ReportTaskSnapshot loadConfirmedReportInput(
            String ownerSubjectRef,
            String taskId,
            int expectedTaskVersion,
            String confirmedContentVersion,
            List<String> reflectionVersions
    ) {
        TaskRecord task = requireOwnedTask(taskId, ownerSubjectRef);
        requireVersion(task, expectedTaskVersion);
        if (!"REFLECTION".equals(task.state()) || task.reflectionCount() != 2) {
            throw unprocessable("REFLECTIONS_INCOMPLETE", "完成两轮反思后才能生成报告");
        }
        ReflectionRecord first = mapper.findReflection(taskId, 1);
        ReflectionRecord second = mapper.findReflection(taskId, 2);
        if (!Objects.equals(task.confirmedContentVersionId(), confirmedContentVersion)
                || first == null
                || second == null
                || !reflectionVersions.equals(List.of(first.contentVersionId(), second.contentVersionId()))) {
            throw unprocessable("REPORT_INPUT_VERSION_MISMATCH", "报告输入版本与任务当前确认版本不一致");
        }

        ContentRecord confirmed = mapper.findContent(confirmedContentVersion);
        ContentRecord firstContent = mapper.findContent(first.contentVersionId());
        ContentRecord secondContent = mapper.findContent(second.contentVersionId());
        if (confirmed == null
                || firstContent == null
                || secondContent == null
                || !Objects.equals(taskId, confirmed.taskId())
                || !Objects.equals(taskId, firstContent.taskId())
                || !Objects.equals(taskId, secondContent.taskId())
                || !"CONFIRMED".equals(confirmed.confirmationState())) {
            throw unprocessable("REPORT_INPUT_VERSION_MISMATCH", "报告输入内容不属于当前任务");
        }

        MirrorDocument mirror = decryptContent(confirmed, MirrorDocument.class);
        ReflectionDocument evidence = decryptContent(firstContent, ReflectionDocument.class);
        ReflectionDocument agency = decryptContent(secondContent, ReflectionDocument.class);
        if (evidence.round() != 1 || agency.round() != 2) throw stateCorrupted(taskId);
        String fingerprint = Sha256Fingerprints.canonicalRequest(
                confirmed.id(), confirmed.contentHash(),
                firstContent.id(), firstContent.contentHash(),
                secondContent.id(), secondContent.contentHash()
        );
        return new ReportTaskSnapshot(
                taskId,
                task.contextCode(),
                task.versionNo(),
                evidence.confirmedFacts(),
                evidence.unknownsToVerify(),
                splitConfirmedList(mirror.feelings()),
                List.of(agency.priorityNeedOrBoundary()),
                agency.selfExecutableGoal(),
                fingerprint
        );
    }

    @Override
    public int markReportReady(
            String ownerSubjectRef,
            String taskId,
            int expectedTaskVersion,
            LocalDateTime updatedAt
    ) {
        return mapper.markReportReady(taskId, ownerSubjectRef, expectedTaskVersion, updatedAt);
    }

    private MirrorResult createOrReplayMirror(
            String taskId,
            String owner,
            String scope,
            String keyHash,
            String requestHash,
            int expectedVersion
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return mirrorFromCommand(existing, requestHash, taskId, owner);

        TaskRecord task = requireOwnedTask(taskId, owner);
        requireVersion(task, expectedVersion);
        int generationIndex;
        if ("FIELDS_SAVED".equals(task.state())) {
            generationIndex = 0;
        } else if ("MIRROR_REVIEW".equals(task.state()) && task.mirrorRegenerationCount() < 1) {
            generationIndex = task.mirrorRegenerationCount() + 1;
        } else if ("MIRROR_REVIEW".equals(task.state())) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "MIRROR_REGENERATION_LIMIT",
                    "镜像最多额外生成一次"
            );
        } else {
            throw unprocessable("TASK_NOT_READY_FOR_MIRROR", "当前任务状态不能生成镜像");
        }

        ContentRecord source = mapper.findContent(task.currentContentVersionId());
        SafetyRecord sourceSafety = mapper.findSafetyByContent(task.currentContentVersionId());
        if (source == null || sourceSafety == null || !"SIX_FIELDS".equals(source.contentType())) {
            throw stateCorrupted(taskId);
        }
        requireAllow(sourceSafety);
        ContractRequests.ClarityFields fields = decryptFields(source);
        MirrorDocument document = new MirrorDocument(
                fields.observedFact(),
                fields.interpretation().isBlank() ? "暂未填写解释，原因仍需验证。" : fields.interpretation(),
                String.join("、", fields.emotion()),
                String.join("、", fields.needOrBoundary()),
                fields.nextStepGoal(),
                "AI 辅助生成",
                MIRROR_MODEL_VERSION,
                source.id(),
                generationIndex,
                Map.of()
        );
        LocalDateTime now = now();
        String mirrorId = ids.next();
        int resultVersion = expectedVersion + 1;
        mapper.insertContent(encryptedContent(
                mirrorId, taskId, "MIRROR", resultVersion, "DRAFT", document, now));
        if (mapper.moveToMirrorReview(taskId, owner, expectedVersion, mirrorId, now) != 1) {
            throw versionConflict(task.versionNo());
        }
        mapper.insertCommand(command(scope, owner, keyHash, requestHash, mirrorId, resultVersion, now));
        return new MirrorResult(taskId, mirrorId, resultVersion, document);
    }

    private MirrorResult mirrorFromCommand(
            CommandRecord command,
            String requestHash,
            String taskId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        requireOwnedTask(taskId, owner);
        ContentRecord mirror = mapper.findContent(command.resourceId());
        if (mirror == null || !Objects.equals(taskId, mirror.taskId()) || !"MIRROR".equals(mirror.contentType())) {
            throw stateCorrupted(taskId);
        }
        return new MirrorResult(
                taskId,
                mirror.id(),
                command.resultVersion(),
                decryptContent(mirror, MirrorDocument.class)
        );
    }

    private MirrorConfirmationResult confirmOrReplayMirror(
            String taskId,
            String owner,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.MirrorConfirmationRequest request
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return mirrorConfirmationFromCommand(existing, requestHash, taskId, owner);

        TaskRecord task = requireOwnedTask(taskId, owner);
        requireVersion(task, request.expectedVersion());
        if (!"MIRROR_REVIEW".equals(task.state())) {
            throw unprocessable("MIRROR_NOT_READY", "当前任务没有待确认镜像");
        }
        if (!Objects.equals(task.currentMirrorVersionId(), request.contentVersion())) {
            throw unprocessable("MIRROR_VERSION_MISMATCH", "镜像版本不是当前任务待确认版本");
        }
        ContentRecord draft = mapper.findContent(request.contentVersion());
        if (draft == null || !Objects.equals(taskId, draft.taskId()) || !"MIRROR".equals(draft.contentType())) {
            throw unprocessable("MIRROR_VERSION_MISMATCH", "镜像版本不属于当前任务");
        }
        MirrorDocument source = decryptContent(draft, MirrorDocument.class);
        List<String> reviewed = List.of(
                applyEvaluation(source.confirmedEvent(), request.evaluations().confirmedEvent()),
                applyEvaluation(source.currentInterpretation(), request.evaluations().currentInterpretation()),
                applyEvaluation(source.feelings(), request.evaluations().feelings()),
                applyEvaluation(source.needOrBoundary(), request.evaluations().needOrBoundary()),
                applyEvaluation(source.questionToSolve(), request.evaluations().questionToSolve())
        );
        LocalDateTime now = now();
        String confirmedId = ids.next();
        MaskedTexts masked = safety.maskTexts(reviewed);
        SafetyDecision mirrorDecision = safety.assess(masked);
        safetyEvidence.recordIndependent(
                owner,
                "CLARITY_MIRROR",
                confirmedId,
                evidenceDecision(mirrorDecision, masked.maskCodes()),
                now
        );
        requireAllow(mirrorDecision);
        MirrorDocument confirmed = new MirrorDocument(
                masked.values().get(0),
                masked.values().get(1),
                masked.values().get(2),
                masked.values().get(3),
                masked.values().get(4),
                source.aiLabel(),
                source.modelVersion(),
                source.sourceContentVersion(),
                source.generationIndex(),
                evaluationStates(request.evaluations())
        );
        int resultVersion = request.expectedVersion() + 1;
        mapper.insertContent(encryptedContent(
                confirmedId, taskId, "MIRROR", resultVersion, "CONFIRMED", confirmed, now));
        if (mapper.confirmMirror(
                taskId, owner, request.expectedVersion(), request.contentVersion(), confirmedId, now) != 1) {
            throw versionConflict(task.versionNo());
        }
        mapper.insertCommand(command(scope, owner, keyHash, requestHash, confirmedId, resultVersion, now));
        return new MirrorConfirmationResult(taskId, confirmedId, resultVersion);
    }

    private MirrorConfirmationResult mirrorConfirmationFromCommand(
            CommandRecord command,
            String requestHash,
            String taskId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        requireOwnedTask(taskId, owner);
        ContentRecord confirmed = mapper.findContent(command.resourceId());
        if (confirmed == null
                || !Objects.equals(taskId, confirmed.taskId())
                || !"MIRROR".equals(confirmed.contentType())
                || !"CONFIRMED".equals(confirmed.confirmationState())) {
            throw stateCorrupted(taskId);
        }
        return new MirrorConfirmationResult(taskId, confirmed.id(), command.resultVersion());
    }

    private ReflectionResult createOrReplayReflection(
            String taskId,
            String owner,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.ReflectionRequest request
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return reflectionFromCommand(existing, requestHash, taskId, owner);

        TaskRecord task = requireOwnedTask(taskId, owner);
        requireVersion(task, request.expectedVersion());
        if (!"REFLECTION".equals(task.state()) || task.confirmedContentVersionId() == null) {
            throw unprocessable("MIRROR_NOT_CONFIRMED", "确认镜像后才能开始反思");
        }
        if (request.round() != task.reflectionCount() + 1) {
            throw unprocessable("REFLECTION_ORDER_INVALID", "必须按第 1、2 轮顺序完成反思");
        }

        LocalDateTime now = now();
        String reflectionId = ids.next();
        ReflectionDocument document = maskedReflection(owner, reflectionId, now, request);
        int resultVersion = request.expectedVersion() + 1;
        mapper.insertContent(encryptedContent(
                reflectionId, taskId, "REFLECTION", resultVersion, "CONFIRMED", document, now));
        mapper.insertReflection(new ReflectionRecord(
                reflectionId, taskId, request.round(), reflectionId, now));
        if (mapper.advanceReflection(
                taskId, owner, request.expectedVersion(), request.round() - 1, now) != 1) {
            throw versionConflict(task.versionNo());
        }
        mapper.insertCommand(command(scope, owner, keyHash, requestHash, reflectionId, resultVersion, now));
        return new ReflectionResult(taskId, reflectionId, request.round(), resultVersion, request.round());
    }

    private ReflectionResult reflectionFromCommand(
            CommandRecord command,
            String requestHash,
            String taskId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        requireOwnedTask(taskId, owner);
        ContentRecord content = mapper.findContent(command.resourceId());
        if (content == null || !Objects.equals(taskId, content.taskId()) || !"REFLECTION".equals(content.contentType())) {
            throw stateCorrupted(taskId);
        }
        ReflectionDocument document = decryptContent(content, ReflectionDocument.class);
        ReflectionRecord reflection = mapper.findReflection(taskId, document.round());
        if (reflection == null || !Objects.equals(reflection.contentVersionId(), content.id())) {
            throw stateCorrupted(taskId);
        }
        return new ReflectionResult(
                taskId, content.id(), document.round(), command.resultVersion(), document.round());
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
                null,
                null,
                0,
                0,
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
        safetyEvidence.recordIndependent(
                owner,
                "CLARITY_CONTENT",
                contentId,
                new DecisionData(
                        "S1_INPUT",
                        decision.route(),
                        decision.categories(),
                        masked.maskCodes(),
                        decision.ruleVersion(),
                        decision.resourceIds()
                ),
                now
        );

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
        return decryptContent(content, ContractRequests.ClarityFields.class);
    }

    private <T> T decryptContent(ContentRecord content, Class<T> type) {
        EncryptedPayload encrypted = new EncryptedPayload(
                content.ciphertext(),
                content.contentNonce(),
                content.wrappedDek(),
                content.wrapNonce(),
                content.keyVersion(),
                content.contentHash()
        );
        try {
            return objectMapper.readValue(encryption.decrypt(content.id(), encrypted), type);
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

    private ContentRecord encryptedContent(
            String contentId,
            String taskId,
            String contentType,
            int version,
            String confirmationState,
            Object value,
            LocalDateTime createdAt
    ) {
        try {
            EncryptedPayload encrypted = encrypt(contentId, objectMapper.writeValueAsBytes(value));
            return new ContentRecord(
                    contentId,
                    taskId,
                    contentType,
                    version,
                    confirmationState,
                    encrypted.ciphertext(),
                    encrypted.contentNonce(),
                    encrypted.wrappedDek(),
                    encrypted.wrapNonce(),
                    encrypted.keyVersion(),
                    encrypted.contentHash(),
                    createdAt
            );
        } catch (JsonProcessingException exception) {
            throw contentUnavailable();
        }
    }

    private CommandRecord command(
            String scope,
            String owner,
            String keyHash,
            String requestHash,
            String resourceId,
            int resultVersion,
            LocalDateTime now
    ) {
        return new CommandRecord(
                scope, owner, keyHash, requestHash, resourceId, resultVersion,
                now, now.plus(IDEMPOTENCY_TTL));
    }

    private String structuredRequestHash(String scope, Object request) {
        try {
            return Sha256Fingerprints.canonicalRequest(scope, objectMapper.writeValueAsString(request));
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "请求无法规范化");
        }
    }

    private void validateMirrorEvaluations(ContractRequests.MirrorEvaluations evaluations) {
        List<ContractRequests.MirrorSectionEvaluation> sections = List.of(
                evaluations.confirmedEvent(),
                evaluations.currentInterpretation(),
                evaluations.feelings(),
                evaluations.needOrBoundary(),
                evaluations.questionToSolve()
        );
        for (ContractRequests.MirrorSectionEvaluation section : sections) {
            if (!"accurate".equals(section.accuracy()) && isBlank(section.correction())) {
                throw unprocessable("MIRROR_CORRECTION_REQUIRED", "部分准确或不准确的段落必须提供纠正文本");
            }
        }
    }

    private String applyEvaluation(
            String original,
            ContractRequests.MirrorSectionEvaluation evaluation
    ) {
        return "accurate".equals(evaluation.accuracy())
                ? original
                : evaluation.correction().trim();
    }

    private Map<String, String> evaluationStates(ContractRequests.MirrorEvaluations evaluations) {
        return Map.of(
                "confirmed_event", evaluations.confirmedEvent().accuracy(),
                "current_interpretation", evaluations.currentInterpretation().accuracy(),
                "feelings", evaluations.feelings().accuracy(),
                "need_or_boundary", evaluations.needOrBoundary().accuracy(),
                "question_to_solve", evaluations.questionToSolve().accuracy()
        );
    }

    private void validateReflectionShape(ContractRequests.ReflectionRequest request) {
        boolean firstShape = hasValues(request.confirmedFacts())
                && hasValues(request.unknownsToVerify())
                && isBlank(request.priorityNeedOrBoundary())
                && isBlank(request.selfExecutableGoal());
        boolean secondShape = !hasValues(request.confirmedFacts())
                && !hasValues(request.unknownsToVerify())
                && !isBlank(request.priorityNeedOrBoundary())
                && !isBlank(request.selfExecutableGoal());
        if ((request.round() == 1 && !firstShape) || (request.round() == 2 && !secondShape)) {
            throw unprocessable("REFLECTION_SHAPE_INVALID", "反思字段与轮次不匹配");
        }
    }

    private ReflectionDocument maskedReflection(
            String owner,
            String reflectionId,
            LocalDateTime now,
            ContractRequests.ReflectionRequest request
    ) {
        if (request.round() == 1) {
            List<String> raw = new ArrayList<>(request.confirmedFacts());
            raw.addAll(request.unknownsToVerify());
            MaskedTexts masked = safety.maskTexts(raw);
            SafetyDecision reflectionDecision = safety.assess(masked);
            safetyEvidence.recordIndependent(
                    owner,
                    "CLARITY_REFLECTION",
                    reflectionId,
                    evidenceDecision(reflectionDecision, masked.maskCodes()),
                    now
            );
            requireAllow(reflectionDecision);
            int factCount = request.confirmedFacts().size();
            return new ReflectionDocument(
                    1,
                    List.copyOf(masked.values().subList(0, factCount)),
                    List.copyOf(masked.values().subList(factCount, masked.values().size())),
                    null,
                    null
            );
        }

        if (OTHER_DEPENDENT_GOAL.matcher(request.selfExecutableGoal()).find()) {
            throw unprocessable(
                    "SELF_EXECUTABLE_GOAL_REQUIRED",
                    "目标必须由用户本人开始，不能以第三人改变为唯一成功条件"
            );
        }
        MaskedTexts masked = safety.maskTexts(List.of(
                request.priorityNeedOrBoundary(), request.selfExecutableGoal()));
        SafetyDecision reflectionDecision = safety.assess(masked);
        safetyEvidence.recordIndependent(
                owner,
                "CLARITY_REFLECTION",
                reflectionId,
                evidenceDecision(reflectionDecision, masked.maskCodes()),
                now
        );
        requireAllow(reflectionDecision);
        return new ReflectionDocument(
                2,
                List.of(),
                List.of(),
                masked.values().get(0),
                masked.values().get(1)
        );
    }

    private DecisionData evidenceDecision(SafetyDecision decision, List<String> maskCodes) {
        return new DecisionData(
                "S1_INPUT",
                decision.route(),
                decision.categories(),
                maskCodes,
                decision.ruleVersion(),
                decision.resourceIds()
        );
    }

    private void requireAllow(SafetyRecord assessment) {
        if (!"ALLOW".equals(assessment.route())) {
            throw unprocessable(
                    "SAFETY_CLEARANCE_REQUIRED",
                    "当前内容未通过普通生成前置条件",
                    Map.of(
                            "route", assessment.route(),
                            "resource_ids", parseList(assessment.resourceIdsJson())
                    )
            );
        }
    }

    private void requireAllow(SafetyDecision decision) {
        if (!"ALLOW".equals(decision.route())) {
            throw unprocessable(
                    "SAFETY_CLEARANCE_REQUIRED",
                    "新增内容未通过安全检查",
                    Map.of("route", decision.route(), "resource_ids", decision.resourceIds())
            );
        }
    }

    private void requireVersion(TaskRecord task, int expectedVersion) {
        if (task.versionNo() != expectedVersion) throw versionConflict(task.versionNo());
    }

    private boolean hasValues(List<String> values) {
        return values != null && !values.isEmpty();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private List<String> splitConfirmedList(String value) {
        List<String> values = LIST_SEPARATOR.splitAsStream(value)
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
        return values.isEmpty() ? List.of(value) : values;
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
        data.put("mirror_regeneration_count", task.mirrorRegenerationCount());
        data.put("reflection_count", task.reflectionCount());
        if (task.currentMirrorVersionId() != null) {
            data.put("current_mirror_version", task.currentMirrorVersionId());
        }
        if (task.confirmedContentVersionId() != null) {
            data.put("confirmed_content_version", task.confirmedContentVersionId());
        }
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

    private Map<String, Object> mirrorResponse(MirrorResult result) {
        MirrorDocument mirror = result.document();
        return Map.of(
                "task_id", result.taskId(),
                "content_version", result.contentVersionId(),
                "state", "MIRROR_REVIEW",
                "version", result.version(),
                "regeneration_count", mirror.generationIndex(),
                "mirror", Map.of(
                        "confirmed_event", mirror.confirmedEvent(),
                        "current_interpretation", mirror.currentInterpretation(),
                        "feelings", mirror.feelings(),
                        "need_or_boundary", mirror.needOrBoundary(),
                        "question_to_solve", mirror.questionToSolve(),
                        "ai_label", mirror.aiLabel(),
                        "model_version", mirror.modelVersion()
                )
        );
    }

    private Map<String, Object> mirrorConfirmationResponse(MirrorConfirmationResult result) {
        return Map.of(
                "task_id", result.taskId(),
                "confirmed_content_version", result.confirmedContentVersionId(),
                "state", "REFLECTION",
                "version", result.version(),
                "reflection_count", 0
        );
    }

    private Map<String, Object> reflectionResponse(ReflectionResult result) {
        return Map.of(
                "task_id", result.taskId(),
                "reflection_version", result.reflectionVersionId(),
                "round", result.round(),
                "state", "REFLECTION",
                "version", result.version(),
                "reflection_count", result.reflectionCount()
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

    private ApiException versionConflict(int currentVersion) {
        return new ApiException(
                HttpStatus.CONFLICT,
                "VERSION_CONFLICT",
                "任务版本已经变化",
                false,
                Map.of("current_version", currentVersion)
        );
    }

    private ApiException unprocessable(String code, String message) {
        return unprocessable(code, message, Map.of());
    }

    private ApiException unprocessable(String code, String message, Map<String, Object> details) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, false, details);
    }

    private record FieldsResult(
            String taskId,
            String contentVersionId,
            String state,
            int version,
            SafetyRecord safety
    ) {
    }

    private record MirrorResult(
            String taskId,
            String contentVersionId,
            int version,
            MirrorDocument document
    ) {
    }

    private record MirrorConfirmationResult(
            String taskId,
            String confirmedContentVersionId,
            int version
    ) {
    }

    private record ReflectionResult(
            String taskId,
            String reflectionVersionId,
            int round,
            int version,
            int reflectionCount
    ) {
    }

    private record MirrorDocument(
            String confirmedEvent,
            String currentInterpretation,
            String feelings,
            String needOrBoundary,
            String questionToSolve,
            String aiLabel,
            String modelVersion,
            String sourceContentVersion,
            int generationIndex,
            Map<String, String> evaluationStates
    ) {
    }

    private record ReflectionDocument(
            int round,
            List<String> confirmedFacts,
            List<String> unknownsToVerify,
            String priorityNeedOrBoundary,
            String selfExecutableGoal
    ) {
    }
}
