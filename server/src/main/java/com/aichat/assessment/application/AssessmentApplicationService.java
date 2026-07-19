package com.aichat.assessment.application;

import com.aichat.assessment.api.AssessmentApiDelegate;
import com.aichat.assessment.application.AssessmentResultCatalog.ResultCopy;
import com.aichat.assessment.infrastructure.AssessmentMapper;
import com.aichat.assessment.infrastructure.AssessmentMapper.AnswerRecord;
import com.aichat.assessment.infrastructure.AssessmentMapper.CommandRecord;
import com.aichat.assessment.infrastructure.AssessmentMapper.DefinitionRecord;
import com.aichat.assessment.infrastructure.AssessmentMapper.RunRecord;
import com.aichat.assessment.infrastructure.AssessmentMapper.SharePreviewRecord;
import com.aichat.clarity.port.AssessmentTaskEntryPort;
import com.aichat.clarity.port.AssessmentTaskEntryPort.CreatedTask;
import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.content.EnvelopeEncryptionService.ContentCryptoException;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.kernel.feature.FeatureAvailability;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public final class AssessmentApplicationService implements AssessmentApiDelegate {
    private static final String CREATE_SCOPE = "assessment:create-run";
    private static final String ANSWER_SCOPE_PREFIX = "assessment:answer:";
    private static final String COMPLETE_SCOPE_PREFIX = "assessment:complete:";
    private static final String MAP_SCOPE_PREFIX = "assessment:map:";
    private static final String SHARE_SCOPE_PREFIX = "assessment:share:";
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final Duration ANSWER_TTL_AFTER_COMPLETION = Duration.ofHours(24);
    private static final Duration SHARE_PREVIEW_TTL = Duration.ofHours(24);
    private static final Set<String> DIMENSIONS = Set.of(
            "evidence_checking", "direct_expression", "self_protection", "emotion_regulation"
    );

    private final AssessmentMapper mapper;
    private final AssessmentResultCatalog results;
    private final AssessmentTaskEntryPort taskEntry;
    private final FeatureAvailability features;
    private final EnvelopeEncryptionService encryption;
    private final UlidGenerator ids;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionTemplate transactions;

    public AssessmentApplicationService(
            AssessmentMapper mapper,
            AssessmentResultCatalog results,
            AssessmentTaskEntryPort taskEntry,
            FeatureAvailability features,
            EnvelopeEncryptionService encryption,
            UlidGenerator ids,
            ObjectMapper objectMapper,
            Clock clock,
            TransactionTemplate transactions
    ) {
        this.mapper = mapper;
        this.results = results;
        this.taskEntry = taskEntry;
        this.features = features;
        this.encryption = encryption;
        this.ids = ids;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactions = transactions;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getCurrentAssessment(ApiCallContext context) {
        features.requireAssessmentEnabled();
        context.requireSubject();
        DefinitionData definition = requireDefinition(mapper.findCurrentDefinition());
        return ApiEnvelope.success(context.requestId(), Map.of(
                "definition_version", definition.record().version(),
                "item_count", definition.record().itemCount(),
                "items", definition.publicItems(),
                "license_source", definition.record().licenseSource(),
                "boundary_copy", definition.record().boundaryCopy(),
                "ai_disclosure", "由 AI 产品提供结构化自测，不是真人或临床评估"
        ));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createAssessmentRun(
            ApiCallContext context,
            String idempotencyKey,
            ContractRequests.CreateAssessmentRunRequest request
    ) {
        features.requireAssessmentEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        var subject = context.requireSubject();
        DefinitionData definition = requireDefinition(mapper.findDefinition(request.definitionVersion()));
        if (!"PUBLISHED".equals(definition.record().status())) {
            throw new ApiException(HttpStatus.CONFLICT, "ASSESSMENT_DEFINITION_UNAVAILABLE", "题库版本不可用");
        }
        String owner = subject.subjectId();
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(CREATE_SCOPE, request.definitionVersion());

        try {
            RunRecord run = transactions.execute(status -> createOrReplayRun(
                    owner, subject.level().name(), keyHash, requestHash, definition.record()));
            return ApiEnvelope.success(context.requestId(), runResponse(run, mapper.countAnswers(run.id())));
        } catch (DataIntegrityViolationException duplicate) {
            RunRecord run = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(CREATE_SCOPE, owner, keyHash);
                if (command == null) throw duplicate;
                return runFromCommand(command, requestHash, owner);
            });
            return ApiEnvelope.success(context.requestId(), runResponse(run, mapper.countAnswers(run.id())));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> putAssessmentAnswer(
            ApiCallContext context,
            String runId,
            String itemId,
            String idempotencyKey,
            ContractRequests.AssessmentAnswerRequest request
    ) {
        features.requireAssessmentEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = ANSWER_SCOPE_PREFIX + runId + ":" + itemId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope, String.valueOf(request.expectedVersion()), request.optionCode());

        try {
            AnswerResult result = transactions.execute(status -> putOrReplayAnswer(
                    runId, itemId, owner, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), answerResponse(result));
        } catch (DataIntegrityViolationException duplicate) {
            AnswerResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw duplicate;
                return answerFromCommand(command, requestHash, runId, itemId, owner);
            });
            return ApiEnvelope.success(context.requestId(), answerResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> completeAssessmentRun(
            ApiCallContext context,
            String runId,
            String idempotencyKey
    ) {
        features.requireAssessmentEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = COMPLETE_SCOPE_PREFIX + runId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(scope);

        try {
            RunRecord run = transactions.execute(status -> completeOrReplay(
                    runId, owner, scope, keyHash, requestHash));
            return ApiEnvelope.success(context.requestId(), completedRunResponse(run));
        } catch (DataIntegrityViolationException duplicate) {
            RunRecord run = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw duplicate;
                return completedRunFromCommand(command, requestHash, runId, owner);
            });
            return ApiEnvelope.success(context.requestId(), completedRunResponse(run));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> mapAssessmentToTask(
            ApiCallContext context,
            String runId,
            String idempotencyKey,
            ContractRequests.AssessmentTaskMappingRequest request
    ) {
        features.requireAssessmentEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        var subject = context.requireSubject();
        String owner = subject.subjectId();
        String scope = MAP_SCOPE_PREFIX + runId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope,
                String.valueOf(request.expectedVersion()),
                request.context(),
                String.valueOf(request.clarityPre()),
                String.valueOf(request.confirmed())
        );

        try {
            MappingResult result = transactions.execute(status -> mapOrReplay(
                    runId, owner, subject.level().name(), scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), mappingResponse(result));
        } catch (DataIntegrityViolationException duplicate) {
            MappingResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw duplicate;
                return mappingFromCommand(command, requestHash, runId, owner);
            });
            return ApiEnvelope.success(context.requestId(), mappingResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createAssessmentShareCard(
            ApiCallContext context,
            String runId,
            String idempotencyKey
    ) {
        features.requireAssessmentEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = SHARE_SCOPE_PREFIX + runId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(scope);

        try {
            SharePreviewRecord preview = transactions.execute(status -> shareOrReplay(
                    runId, owner, scope, keyHash, requestHash));
            return ApiEnvelope.success(context.requestId(), shareResponse(preview));
        } catch (DataIntegrityViolationException duplicate) {
            SharePreviewRecord preview = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash);
                if (command == null) throw duplicate;
                return shareFromCommand(command, requestHash, runId, owner);
            });
            return ApiEnvelope.success(context.requestId(), shareResponse(preview));
        }
    }

    private RunRecord createOrReplayRun(
            String owner,
            String authLevel,
            String keyHash,
            String requestHash,
            DefinitionRecord definition
    ) {
        CommandRecord existing = mapper.findCommand(CREATE_SCOPE, owner, keyHash);
        if (existing != null) return runFromCommand(existing, requestHash, owner);
        LocalDateTime now = now();
        RunRecord run = new RunRecord(
                ids.next(), owner, authLevel, definition.version(), "IN_PROGRESS", 1,
                null, null, null, null, now, now
        );
        mapper.insertRun(run);
        mapper.insertCommand(command(CREATE_SCOPE, owner, keyHash, requestHash, run.id(), 1, 1, now));
        return run;
    }

    private RunRecord runFromCommand(CommandRecord command, String requestHash, String owner) {
        requireSameRequest(command, requestHash);
        RunRecord run = mapper.findRun(command.resourceId());
        if (run == null || !Objects.equals(owner, run.ownerSubjectRef())) throw corrupted(command.resourceId());
        return run;
    }

    private AnswerResult putOrReplayAnswer(
            String runId,
            String itemId,
            String owner,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.AssessmentAnswerRequest request
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return answerFromCommand(existing, requestHash, runId, itemId, owner);

        RunRecord run = requireOwnedRun(runId, owner);
        requireState(run, "IN_PROGRESS");
        requireVersion(run, request.expectedVersion());
        DefinitionData definition = requireDefinition(mapper.findDefinition(run.definitionVersion()));
        validateItemAndOption(definition, itemId, request.optionCode());

        LocalDateTime now = now();
        AnswerRecord previous = mapper.findAnswer(runId, itemId);
        String answerId = previous == null ? ids.next() : previous.id();
        EncryptedPayload encrypted = encryptAnswer(answerId, request.optionCode());
        AnswerRecord answer = new AnswerRecord(
                answerId,
                runId,
                itemId,
                previous == null ? 1 : previous.answerVersion() + 1,
                encrypted.ciphertext(),
                encrypted.contentNonce(),
                encrypted.wrappedDek(),
                encrypted.wrapNonce(),
                encrypted.keyVersion(),
                encrypted.contentHash(),
                previous == null ? now : previous.createdAt(),
                now,
                now.plus(ANSWER_TTL_AFTER_COMPLETION)
        );
        if (previous == null) mapper.insertAnswer(answer);
        else if (mapper.updateAnswer(answer) != 1) throw corrupted(answer.id());

        if (mapper.advanceRunForAnswer(runId, owner, request.expectedVersion(), now) != 1) {
            throw versionConflict(run.versionNo());
        }
        int resultVersion = request.expectedVersion() + 1;
        mapper.insertCommand(command(
                scope, owner, keyHash, requestHash, answer.id(), resultVersion, answer.answerVersion(), now));
        return new AnswerResult(runId, itemId, answer.answerVersion(), resultVersion, mapper.countAnswers(runId), answer.expiresAt());
    }

    private AnswerResult answerFromCommand(
            CommandRecord command,
            String requestHash,
            String runId,
            String itemId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        requireOwnedRun(runId, owner);
        AnswerRecord answer = mapper.findAnswer(runId, itemId);
        if (answer == null || !Objects.equals(answer.id(), command.resourceId())) throw corrupted(runId);
        return new AnswerResult(
                runId, itemId, command.resourceVersion(), command.resultVersion(), mapper.countAnswers(runId), answer.expiresAt());
    }

    private RunRecord completeOrReplay(
            String runId,
            String owner,
            String scope,
            String keyHash,
            String requestHash
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return completedRunFromCommand(existing, requestHash, runId, owner);

        RunRecord run = requireOwnedRun(runId, owner);
        requireState(run, "IN_PROGRESS");
        DefinitionData definition = requireDefinition(mapper.findDefinition(run.definitionVersion()));
        List<AnswerRecord> answers = mapper.findAnswers(runId);
        if (answers.size() != definition.record().itemCount()) {
            throw new ApiException(HttpStatus.CONFLICT, "ASSESSMENT_INCOMPLETE", "需要完成全部题目后再生成结果");
        }

        Map<String, Integer> scores = new LinkedHashMap<>();
        DIMENSIONS.stream().sorted().forEach(dimension -> scores.put(dimension, 0));
        Set<String> answeredItems = new HashSet<>();
        LocalDateTime now = now();
        for (AnswerRecord answer : answers) {
            if (!answeredItems.add(answer.itemId()) || !definition.itemIds().contains(answer.itemId())) {
                throw corrupted(runId);
            }
            if (!answer.expiresAt().isAfter(now)) {
                throw new ApiException(HttpStatus.CONFLICT, "ASSESSMENT_ANSWERS_EXPIRED", "临时答案已过期，请重新开始");
            }
            String optionCode = decryptOption(answer);
            String dimension = definition.scoreRules().get(optionCode);
            if (dimension == null) throw definitionUnavailable();
            scores.compute(dimension, (ignored, value) -> value == null ? 1 : value + 1);
        }
        String resultCode = resultCode(scores);
        String scoreVector = json(scores);
        if (mapper.completeRun(runId, owner, run.versionNo(), scoreVector, resultCode, now) != 1) {
            throw versionConflict(run.versionNo());
        }
        mapper.expireAnswersAt(runId, now.plus(ANSWER_TTL_AFTER_COMPLETION));
        int resultVersion = run.versionNo() + 1;
        mapper.insertCommand(command(scope, owner, keyHash, requestHash, runId, resultVersion, resultVersion, now));
        return new RunRecord(
                run.id(), run.ownerSubjectRef(), run.ownerAuthLevel(), run.definitionVersion(), "COMPLETED",
                resultVersion, scoreVector, resultCode, null, now, run.createdAt(), now
        );
    }

    private RunRecord completedRunFromCommand(
            CommandRecord command,
            String requestHash,
            String runId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        RunRecord run = requireOwnedRun(runId, owner);
        if (!Objects.equals(command.resourceId(), runId) || run.resultCode() == null) throw corrupted(runId);
        return new RunRecord(
                run.id(), run.ownerSubjectRef(), run.ownerAuthLevel(), run.definitionVersion(), "COMPLETED",
                command.resultVersion(), run.scoreVectorJson(), run.resultCode(), null,
                run.completedAt(), run.createdAt(), run.completedAt()
        );
    }

    private MappingResult mapOrReplay(
            String runId,
            String owner,
            String authLevel,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.AssessmentTaskMappingRequest request
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return mappingFromCommand(existing, requestHash, runId, owner);

        RunRecord run = requireOwnedRun(runId, owner);
        requireState(run, "COMPLETED");
        requireVersion(run, request.expectedVersion());
        LocalDateTime now = now();
        CreatedTask task = taskEntry.createFromAssessment(
                owner, authLevel, request.context(), request.clarityPre(), now);
        if (mapper.mapRunToTask(runId, owner, request.expectedVersion(), task.taskId(), now) != 1) {
            throw versionConflict(run.versionNo());
        }
        int resultVersion = request.expectedVersion() + 1;
        mapper.insertCommand(command(
                scope, owner, keyHash, requestHash, task.taskId(), resultVersion, task.version(), now));
        return new MappingResult(run, task, resultVersion);
    }

    private MappingResult mappingFromCommand(
            CommandRecord command,
            String requestHash,
            String runId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        RunRecord run = requireOwnedRun(runId, owner);
        if (!Objects.equals(run.taskId(), command.resourceId()) || run.resultCode() == null) throw corrupted(runId);
        return new MappingResult(
                run,
                new CreatedTask(command.resourceId(), "DRAFT", command.resourceVersion()),
                command.resultVersion()
        );
    }

    private SharePreviewRecord shareOrReplay(
            String runId,
            String owner,
            String scope,
            String keyHash,
            String requestHash
    ) {
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash);
        if (existing != null) return shareFromCommand(existing, requestHash, runId, owner);
        RunRecord run = requireOwnedRun(runId, owner);
        if (!Set.of("COMPLETED", "MAPPED").contains(run.state()) || run.resultCode() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE_TRANSITION", "自测完成后才能创建分享预览");
        }
        ResultCopy copy = results.require(run.resultCode());
        LocalDateTime now = now();
        SharePreviewRecord preview = new SharePreviewRecord(
                ids.next(), runId, owner, copy.currentTendency(), copy.usableStrength(),
                copy.oneRealWorldReminder(), "AI 辅助生成", run.definitionVersion(),
                "PREVIEW_ONLY", now.plus(SHARE_PREVIEW_TTL), now
        );
        mapper.insertSharePreview(preview);
        mapper.insertCommand(command(scope, owner, keyHash, requestHash, preview.id(), run.versionNo(), 1, now));
        return preview;
    }

    private SharePreviewRecord shareFromCommand(
            CommandRecord command,
            String requestHash,
            String runId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        requireOwnedRun(runId, owner);
        SharePreviewRecord preview = mapper.findSharePreview(command.resourceId());
        if (preview == null
                || !Objects.equals(preview.runId(), runId)
                || !Objects.equals(preview.ownerSubjectRef(), owner)) {
            throw corrupted(runId);
        }
        return preview;
    }

    private DefinitionData requireDefinition(DefinitionRecord record) {
        if (record == null || record.itemCount() < 6 || record.itemCount() > 8) throw definitionUnavailable();
        if (!Objects.equals(Sha256Fingerprints.hash(record.scoreRulesJson()), record.scoreRulesHash())) {
            throw definitionUnavailable();
        }
        try {
            JsonNode root = objectMapper.readTree(record.itemsJson());
            JsonNode items = root.path("items");
            Map<String, String> scoreRules = objectMapper.readValue(
                    record.scoreRulesJson(), new TypeReference<>() { });
            if (record.licenseSource().isBlank()
                    || record.boundaryCopy().isBlank()
                    || !items.isArray()
                    || items.size() != record.itemCount()
                    || !scoreRules.keySet().equals(Set.of("A", "B", "C", "D"))
                    || !new HashSet<>(scoreRules.values()).equals(DIMENSIONS)) {
                throw definitionUnavailable();
            }
            List<Map<String, Object>> publicItems = objectMapper.convertValue(items, new TypeReference<>() { });
            Set<String> itemIds = new HashSet<>();
            for (JsonNode item : items) {
                String itemId = item.path("item_id").asText();
                String prompt = item.path("prompt").asText();
                JsonNode options = item.path("options");
                Set<String> codes = new HashSet<>();
                if (itemId.isBlank() || prompt.isBlank() || !itemIds.add(itemId)
                        || !options.isArray() || options.size() != 4) {
                    throw definitionUnavailable();
                }
                options.forEach(option -> {
                    if (option.path("text").asText().isBlank()) throw definitionUnavailable();
                    codes.add(option.path("code").asText());
                });
                if (!codes.equals(scoreRules.keySet())) throw definitionUnavailable();
            }
            return new DefinitionData(record, List.copyOf(publicItems), Map.copyOf(scoreRules), Set.copyOf(itemIds));
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw definitionUnavailable();
        }
    }

    private void validateItemAndOption(DefinitionData definition, String itemId, String optionCode) {
        if (!definition.itemIds().contains(itemId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ASSESSMENT_ITEM_INVALID", "题目不属于当前题库版本");
        }
        if (!definition.scoreRules().containsKey(optionCode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ASSESSMENT_OPTION_INVALID", "选项不属于该题目");
        }
    }

    private EncryptedPayload encryptAnswer(String answerId, String optionCode) {
        try {
            return encryption.encrypt(answerId, objectMapper.writeValueAsBytes(Map.of("option_code", optionCode)));
        } catch (ContentCryptoException | JsonProcessingException exception) {
            throw securityUnavailable();
        }
    }

    private String decryptOption(AnswerRecord answer) {
        EncryptedPayload payload = new EncryptedPayload(
                answer.ciphertext(), answer.contentNonce(), answer.wrappedDek(), answer.wrapNonce(),
                answer.keyVersion(), answer.contentHash()
        );
        try {
            JsonNode decoded = objectMapper.readTree(encryption.decrypt(answer.id(), payload));
            String optionCode = decoded.path("option_code").asText();
            if (optionCode.isBlank()) throw securityUnavailable();
            return optionCode;
        } catch (ContentCryptoException | IOException exception) {
            throw securityUnavailable();
        }
    }

    private String resultCode(Map<String, Integer> scores) {
        List<Map.Entry<String, Integer>> ranked = new ArrayList<>(scores.entrySet());
        ranked.sort(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder())
                .thenComparing(Map.Entry.comparingByKey()));
        return ranked.get(0).getValue() - ranked.get(1).getValue() >= 2
                ? ranked.get(0).getKey()
                : "mixed";
    }

    private RunRecord requireOwnedRun(String runId, String owner) {
        RunRecord run = mapper.findRun(runId);
        if (run == null) throw new ApiException(HttpStatus.NOT_FOUND, "ASSESSMENT_RUN_NOT_FOUND", "自测运行不存在");
        if (!Objects.equals(owner, run.ownerSubjectRef())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "RESOURCE_OWNERSHIP_DENIED", "无权访问该自测运行");
        }
        return run;
    }

    private void requireState(RunRecord run, String expected) {
        if (!expected.equals(run.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE_TRANSITION", "自测运行状态不允许该操作");
        }
    }

    private void requireVersion(RunRecord run, int expectedVersion) {
        if (run.versionNo() != expectedVersion) throw versionConflict(run.versionNo());
    }

    private void requireSameRequest(CommandRecord command, String requestHash) {
        if (!Objects.equals(command.requestHash(), requestHash)) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同请求");
        }
    }

    private CommandRecord command(
            String scope,
            String owner,
            String keyHash,
            String requestHash,
            String resourceId,
            int resultVersion,
            int resourceVersion,
            LocalDateTime now
    ) {
        return new CommandRecord(
                scope, owner, keyHash, requestHash, resourceId, resultVersion, resourceVersion,
                now, now.plus(IDEMPOTENCY_TTL));
    }

    private Map<String, Object> runResponse(RunRecord run, int answerCount) {
        return Map.of(
                "run_id", run.id(),
                "definition_version", run.definitionVersion(),
                "state", run.state(),
                "version", run.versionNo(),
                "answer_count", answerCount
        );
    }

    private Map<String, Object> answerResponse(AnswerResult result) {
        return Map.of(
                "run_id", result.runId(),
                "item_id", result.itemId(),
                "answer_version", result.answerVersion(),
                "state", "IN_PROGRESS",
                "version", result.runVersion(),
                "answer_count", result.answerCount(),
                "expires_at", result.expiresAt().atOffset(ZoneOffset.UTC).toString()
        );
    }

    private Map<String, Object> completedRunResponse(RunRecord run) {
        DefinitionRecord definition = requireDefinition(mapper.findDefinition(run.definitionVersion())).record();
        ResultCopy copy = results.require(run.resultCode());
        return Map.of(
                "run_id", run.id(),
                "state", run.state(),
                "version", run.versionNo(),
                "result", Map.of(
                        "current_tendency", copy.currentTendency(),
                        "usable_strength", copy.usableStrength(),
                        "possible_blind_spot", copy.possibleBlindSpot(),
                        "one_real_world_reminder", copy.oneRealWorldReminder(),
                        "assessment_version", definition.version(),
                        "license_source", definition.licenseSource(),
                        "boundary_copy", definition.boundaryCopy()
                )
        );
    }

    private Map<String, Object> mappingResponse(MappingResult result) {
        ResultCopy copy = results.require(result.run().resultCode());
        return Map.of(
                "run_id", result.run().id(),
                "state", "MAPPED",
                "version", result.runVersion(),
                "task", Map.of(
                        "task_id", result.task().taskId(),
                        "entry_type", "ASSESSMENT",
                        "state", result.task().state(),
                        "version", result.task().version()
                ),
                "candidate_fields", Map.of(
                        "interpretation", copy.possibleBlindSpot(),
                        "next_step_goal", copy.oneRealWorldReminder()
                ),
                "requires_observed_fact", true
        );
    }

    private Map<String, Object> shareResponse(SharePreviewRecord preview) {
        return Map.of(
                "preview_id", preview.id(),
                "status", preview.status(),
                "expires_at", preview.expiresAt().atOffset(ZoneOffset.UTC).toString(),
                "preview", Map.of(
                        "title", preview.title(),
                        "usable_strength", preview.usableStrength(),
                        "one_real_world_reminder", preview.reminder(),
                        "ai_label", preview.aiLabel(),
                        "assessment_version", preview.assessmentVersion()
                )
        );
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw corrupted("assessment-json");
        }
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private ApiException versionConflict(int currentVersion) {
        return new ApiException(
                HttpStatus.CONFLICT,
                "VERSION_CONFLICT",
                "自测运行版本已经变化",
                false,
                Map.of("current_version", currentVersion)
        );
    }

    private ApiException corrupted(String resourceId) {
        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "ASSESSMENT_STATE_CORRUPTED",
                "自测状态异常",
                false,
                Map.of("resource_id", resourceId)
        );
    }

    private ApiException definitionUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "ASSESSMENT_DEFINITION_INVALID",
                "自测题库暂时不可用",
                true,
                Map.of()
        );
    }

    private ApiException securityUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CONTENT_SECURITY_UNAVAILABLE",
                "内容安全服务暂时不可用",
                true,
                Map.of()
        );
    }

    private record DefinitionData(
            DefinitionRecord record,
            List<Map<String, Object>> publicItems,
            Map<String, String> scoreRules,
            Set<String> itemIds
    ) {
    }

    private record AnswerResult(
            String runId,
            String itemId,
            int answerVersion,
            int runVersion,
            int answerCount,
            LocalDateTime expiresAt
    ) {
    }

    private record MappingResult(RunRecord run, CreatedTask task, int runVersion) {
    }
}
