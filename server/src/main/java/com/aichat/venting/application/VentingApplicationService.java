package com.aichat.venting.application;

import com.aichat.clarity.port.VentTaskEntryPort;
import com.aichat.clarity.port.VentTaskEntryPort.CreatedVentTask;
import com.aichat.clarity.port.VentTaskEntryPort.VentFields;
import com.aichat.contract.ContractRequests;
import com.aichat.contract.ContractRequests.VentSummaryFields;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.content.EnvelopeEncryptionService.ContentCryptoException;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import com.aichat.kernel.content.SensitiveTextMasker;
import com.aichat.kernel.feature.FeatureAvailability;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.safety.application.SafetyPolicyEngine;
import com.aichat.safety.application.SafetyPolicyEngine.Checkpoint;
import com.aichat.safety.application.SafetyPolicyEngine.Decision;
import com.aichat.safety.application.SafetyEvidenceRecorder;
import com.aichat.venting.api.VentingApiDelegate;
import com.aichat.venting.infrastructure.VentingMapper;
import com.aichat.venting.infrastructure.VentingMapper.CommandRecord;
import com.aichat.venting.infrastructure.VentingMapper.SessionRecord;
import com.aichat.venting.infrastructure.VentingMapper.SummaryRecord;
import com.aichat.venting.infrastructure.VentingMapper.TurnRecord;
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

@Service
public final class VentingApplicationService implements VentingApiDelegate {
    private static final String CURRENT_POLICY_VERSION = "p0-alpha-2026-07-19";
    private static final String CREATE_SCOPE = "vent:create";
    private static final String TURN_SCOPE_PREFIX = "vent:turn:";
    private static final String FINISH_SCOPE_PREFIX = "vent:finish:";
    private static final String CONFIRM_SCOPE_PREFIX = "vent:confirm:";
    private static final String STUB_VERSION = "deterministic-vent-stub-v1";
    private static final String AI_LABEL = "AI 辅助整理";
    private static final int MAX_AI_TURNS = 8;
    private static final Duration SESSION_DURATION = Duration.ofMinutes(10);
    private static final Duration CONTENT_TTL = Duration.ofHours(24);
    private static final Duration SESSION_TTL = Duration.ofDays(30);
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final List<String> ALLOW_REPLIES = List.of(
            "收到。请只聚焦最近发生的一个可观察事件；你可以随时结束并整理。",
            "你对这件事最反复出现的想法是什么？先把它标成仍待验证的解释。",
            "现在最明显的情绪是什么？只描述你的感受，不判断第三人的心理。",
            "此刻你最需要保护的需要或边界是什么？",
            "未来48小时内，你本人可以开始并随时撤回的一个小步骤是什么？",
            "还可以补充一个尚未确认的信息；也可以现在结束并整理。",
            "请检查哪些是事实、哪些是猜测；你也可以现在结束并整理。",
            "已到最后一个回复。请结束并整理，由你确认或修改总结。"
    );
    private static final String CLARIFY_REPLY =
            "这里不能做诊断、读心、预测或替你作重大决定。请改为描述可观察事实、你的感受和需要保护的边界；你也可以现在结束并整理。";

    private final VentingMapper mapper;
    private final FeatureAvailability features;
    private final SensitiveTextMasker masker;
    private final SafetyPolicyEngine safety;
    private final VentTaskEntryPort taskEntry;
    private final UlidGenerator ids;
    private final EnvelopeEncryptionService encryption;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final SafetyEvidenceRecorder safetyEvidence;
    private final VentingExpiryJob expiryJob;

    public VentingApplicationService(
            VentingMapper mapper,
            FeatureAvailability features,
            SensitiveTextMasker masker,
            SafetyPolicyEngine safety,
            VentTaskEntryPort taskEntry,
            UlidGenerator ids,
            EnvelopeEncryptionService encryption,
            ObjectMapper objectMapper,
            Clock clock,
            TransactionTemplate transactions,
            SafetyEvidenceRecorder safetyEvidence,
            VentingExpiryJob expiryJob
    ) {
        this.mapper = mapper;
        this.features = features;
        this.masker = masker;
        this.safety = safety;
        this.taskEntry = taskEntry;
        this.ids = ids;
        this.encryption = encryption;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactions = transactions;
        this.safetyEvidence = safetyEvidence;
        this.expiryJob = expiryJob;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createVentSession(
            ApiCallContext context,
            String idempotencyKey,
            ContractRequests.CreateVentSessionRequest request
    ) {
        features.requireVentingEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        if (!CURRENT_POLICY_VERSION.equals(request.policyVersion())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "POLICY_VERSION_MISMATCH",
                    "请先确认当前产品边界与政策版本",
                    false,
                    Map.of("current_policy_version", CURRENT_POLICY_VERSION)
            );
        }
        var subject = context.requireSubject();
        String owner = subject.subjectId();
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                CREATE_SCOPE, request.policyVersion(), String.valueOf(request.confirmed()));
        try {
            SessionRecord session = transactions.execute(status -> createOrReplaySession(
                    owner, subject.level().name(), keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), sessionResponse(session));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            SessionRecord session = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(CREATE_SCOPE, owner, keyHash, now());
                if (command == null) throw concurrentDuplicate;
                return sessionFromCommand(command, requestHash, owner);
            });
            return ApiEnvelope.success(context.requestId(), sessionResponse(session));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createVentTurn(
            ApiCallContext context,
            String ventSessionId,
            String idempotencyKey,
            ContractRequests.VentTurnRequest request
    ) {
        features.requireVentingEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = TURN_SCOPE_PREFIX + ventSessionId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope, String.valueOf(request.expectedVersion()), request.text());
        try {
            TurnResult result = transactions.execute(status -> createOrReplayTurn(
                    owner, ventSessionId, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), turnResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            TurnResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash, now());
                if (command == null) throw concurrentDuplicate;
                return turnFromCommand(command, requestHash, ventSessionId, owner);
            });
            return ApiEnvelope.success(context.requestId(), turnResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> finishVentSession(
            ApiCallContext context,
            String ventSessionId,
            String idempotencyKey,
            ContractRequests.ExpectedVersionRequest request
    ) {
        features.requireVentingEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        String owner = context.requireSubject().subjectId();
        String scope = FINISH_SCOPE_PREFIX + ventSessionId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope, String.valueOf(request.expectedVersion()));
        try {
            SummaryResult result = transactions.execute(status -> finishOrReplay(
                    owner, ventSessionId, scope, keyHash, requestHash, request.expectedVersion()));
            return ApiEnvelope.success(context.requestId(), summaryResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            SummaryResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash, now());
                if (command == null) throw concurrentDuplicate;
                return summaryFromCommand(command, requestHash, ventSessionId, owner);
            });
            return ApiEnvelope.success(context.requestId(), summaryResponse(result));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> confirmVentSummary(
            ApiCallContext context,
            String ventSessionId,
            String idempotencyKey,
            ContractRequests.VentSummaryRequest request
    ) {
        features.requireVentingEnabled();
        IdempotencyKeys.requireValid(idempotencyKey);
        var subject = context.requireSubject();
        String owner = subject.subjectId();
        String scope = CONFIRM_SCOPE_PREFIX + ventSessionId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = structuredRequestHash(scope, request);
        try {
            ConfirmationResult result = transactions.execute(status -> confirmOrReplay(
                    owner,
                    subject.level().name(),
                    ventSessionId,
                    scope,
                    keyHash,
                    requestHash,
                    request
            ));
            return ApiEnvelope.success(context.requestId(), confirmationResponse(result));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            ConfirmationResult result = transactions.execute(status -> {
                CommandRecord command = mapper.findCommand(scope, owner, keyHash, now());
                if (command == null) throw concurrentDuplicate;
                return confirmationFromCommand(command, requestHash, ventSessionId, owner);
            });
            return ApiEnvelope.success(context.requestId(), confirmationResponse(result));
        }
    }

    private SessionRecord createOrReplaySession(
            String owner,
            String authLevel,
            String keyHash,
            String requestHash,
            ContractRequests.CreateVentSessionRequest request
    ) {
        LocalDateTime now = now();
        expiryJob.deleteExpiredCommand(CREATE_SCOPE, owner, keyHash, now);
        CommandRecord existing = mapper.findCommand(CREATE_SCOPE, owner, keyHash, now);
        if (existing != null) return sessionFromCommand(existing, requestHash, owner);
        SessionRecord session = new SessionRecord(
                ids.next(),
                owner,
                authLevel,
                request.policyVersion(),
                "ACTIVE",
                0,
                0,
                1,
                now,
                now.plus(SESSION_DURATION),
                null,
                null,
                now.plus(SESSION_TTL),
                now,
                now
        );
        mapper.insertSession(session);
        mapper.insertCommand(command(
                CREATE_SCOPE, owner, keyHash, requestHash, session.id(), 1, 1, now));
        return session;
    }

    private SessionRecord sessionFromCommand(CommandRecord command, String requestHash, String owner) {
        requireSameRequest(command, requestHash);
        SessionRecord session = requireOwnedSession(command.resourceId(), owner);
        if (!CREATE_SCOPE.equals(command.commandScope())
                || command.resultVersion() != 1
                || command.resourceVersion() != 1) {
            throw stateCorrupted(command.resourceId());
        }
        return sessionSnapshot(session, "ACTIVE", 0, 0, 1, null, null, session.createdAt());
    }

    private TurnResult createOrReplayTurn(
            String owner,
            String sessionId,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.VentTurnRequest request
    ) {
        LocalDateTime now = now();
        expiryJob.deleteExpiredCommand(scope, owner, keyHash, now);
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash, now);
        if (existing != null) return turnFromCommand(existing, requestHash, sessionId, owner);
        SessionRecord session = requireOwnedSession(sessionId, owner);
        requireVersion(session, request.expectedVersion());
        requireActiveForTurn(session);
        if (session.aiTurns() >= MAX_AI_TURNS) throw turnLimit();
        if (!session.deadlineAt().isAfter(now)) throw timeLimit();

        SensitiveTextMasker.MaskedTexts masked = masker.mask(List.of(request.text()));
        Decision decision = safety.assess(Checkpoint.S1_INPUT, masked.values(), masked.maskCodes());
        int userMessageNo = session.aiTurns() * 2 + 1;
        String userTurnId = ids.next();
        mapper.insertTurn(encryptedTurn(
                userTurnId,
                session.id(),
                userMessageNo,
                "USER",
                decision,
                masked.maskCodes(),
                new TurnDocument(masked.values().get(0), "USER", null),
                now
        ));
        safetyEvidence.recordIndependent(
                owner,
                "VENT_TURN",
                userTurnId,
                decision,
                masked.maskCodes(),
                now
        );

        int resultVersion = session.versionNo() + 1;
        TurnDocument reply = null;
        if ("BLOCK".equals(decision.route())) {
            if (mapper.blockSession(session.id(), owner, session.versionNo(), now) != 1) {
                throw versionConflict(session.versionNo());
            }
        } else {
            reply = new TurnDocument(
                    "CLARIFY".equals(decision.route())
                            ? CLARIFY_REPLY
                            : ALLOW_REPLIES.get(session.aiTurns()),
                    AI_LABEL,
                    STUB_VERSION
            );
            String assistantTurnId = ids.next();
            mapper.insertTurn(encryptedTurn(
                    assistantTurnId,
                    session.id(),
                    userMessageNo + 1,
                    "ASSISTANT",
                    decision,
                    List.of(),
                    reply,
                    now
            ));
            if (mapper.advanceTurn(session.id(), owner, session.versionNo(), now) != 1) {
                throw versionConflict(session.versionNo());
            }
        }
        mapper.insertCommand(command(
                scope, owner, keyHash, requestHash, userTurnId, resultVersion, 1, now));
        return new TurnResult(
                requireOwnedSession(session.id(), owner),
                mapper.findTurn(userTurnId),
                reply,
                decision
        );
    }

    private TurnResult turnFromCommand(
            CommandRecord command,
            String requestHash,
            String sessionId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        SessionRecord session = requireOwnedSession(sessionId, owner);
        TurnRecord userTurn = mapper.findTurn(command.resourceId());
        if (userTurn == null
                || !sessionId.equals(userTurn.sessionId())
                || !"USER".equals(userTurn.role())
                || command.resourceVersion() != 1
                || command.resultVersion() < 2) {
            throw stateCorrupted(sessionId);
        }
        Decision decision = decisionFromTurn(userTurn);
        TurnDocument reply = null;
        if (!"BLOCK".equals(decision.route())) {
            TurnRecord assistant = mapper.findTurnByMessage(sessionId, userTurn.messageNo() + 1);
            if (assistant == null || !"ASSISTANT".equals(assistant.role())) throw stateCorrupted(sessionId);
            reply = decryptTurn(assistant);
        }
        int completedUserTurns = (userTurn.messageNo() + 1) / 2;
        int completedAiTurns = "BLOCK".equals(decision.route())
                ? completedUserTurns - 1
                : completedUserTurns;
        SessionRecord resultSession = sessionSnapshot(
                session,
                "BLOCK".equals(decision.route()) ? "SAFETY_BLOCKED" : "ACTIVE",
                completedAiTurns,
                completedUserTurns,
                command.resultVersion(),
                null,
                null,
                userTurn.createdAt()
        );
        return new TurnResult(resultSession, userTurn, reply, decision);
    }

    private SummaryResult finishOrReplay(
            String owner,
            String sessionId,
            String scope,
            String keyHash,
            String requestHash,
            int expectedVersion
    ) {
        LocalDateTime commandNow = now();
        expiryJob.deleteExpiredCommand(scope, owner, keyHash, commandNow);
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash, commandNow);
        if (existing != null) return summaryFromCommand(existing, requestHash, sessionId, owner);
        SessionRecord session = requireOwnedSession(sessionId, owner);
        requireVersion(session, expectedVersion);
        if ("SAFETY_BLOCKED".equals(session.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "VENT_SAFETY_BLOCKED", "高风险倾诉不能进入普通总结");
        }
        if (!"ACTIVE".equals(session.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "VENT_NOT_ACTIVE", "当前倾诉状态不能生成总结");
        }
        if (session.userTurns() < 1) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VENT_TURN_REQUIRED",
                    "至少输入一轮后才能结束并整理"
            );
        }
        TurnRecord latest = mapper.findLatestUserTurn(session.id());
        if (latest == null) throw stateCorrupted(session.id());
        TurnDocument latestDocument = decryptTurn(latest);
        Map<String, Object> document = draftSummary(latestDocument.text());
        LocalDateTime now = now();
        String summaryId = ids.next();
        mapper.insertSummary(encryptedSummary(
                summaryId, session.id(), 1, "DRAFT", document, now));
        if (mapper.markSummaryReady(session.id(), owner, expectedVersion, summaryId, now) != 1) {
            throw versionConflict(session.versionNo());
        }
        int resultVersion = expectedVersion + 1;
        mapper.insertCommand(command(
                scope, owner, keyHash, requestHash, summaryId, resultVersion, 1, now));
        return new SummaryResult(
                requireOwnedSession(session.id(), owner),
                mapper.findSummary(summaryId),
                document
        );
    }

    private SummaryResult summaryFromCommand(
            CommandRecord command,
            String requestHash,
            String sessionId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        SessionRecord session = requireOwnedSession(sessionId, owner);
        SummaryRecord summary = mapper.findSummary(command.resourceId());
        if (summary == null
                || !sessionId.equals(summary.sessionId())
                || !"DRAFT".equals(summary.status())
                || command.resourceVersion() != summary.versionNo()
                || command.resultVersion() < 2) {
            throw stateCorrupted(sessionId);
        }
        SessionRecord resultSession = sessionSnapshot(
                session,
                "SUMMARY_READY",
                session.aiTurns(),
                session.userTurns(),
                command.resultVersion(),
                summary.id(),
                null,
                summary.createdAt()
        );
        return new SummaryResult(resultSession, summary, decryptSummary(summary));
    }

    private ConfirmationResult confirmOrReplay(
            String owner,
            String authLevel,
            String sessionId,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.VentSummaryRequest request
    ) {
        LocalDateTime commandNow = now();
        expiryJob.deleteExpiredCommand(scope, owner, keyHash, commandNow);
        CommandRecord existing = mapper.findCommand(scope, owner, keyHash, commandNow);
        if (existing != null) return confirmationFromCommand(existing, requestHash, sessionId, owner);
        SessionRecord session = requireOwnedSession(sessionId, owner);
        requireVersion(session, request.expectedVersion());
        if (!"SUMMARY_READY".equals(session.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "VENT_SUMMARY_NOT_READY", "当前倾诉没有待确认总结");
        }
        if (!Objects.equals(session.currentSummaryVersionId(), request.summaryVersion())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VENT_SUMMARY_VERSION_MISMATCH",
                    "总结版本不是当前待确认版本"
            );
        }
        SummaryRecord draft = mapper.findSummary(request.summaryVersion());
        if (draft == null || !sessionId.equals(draft.sessionId()) || !"DRAFT".equals(draft.status())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VENT_SUMMARY_VERSION_MISMATCH",
                    "总结版本不属于当前倾诉"
            );
        }

        LocalDateTime now = now();
        String confirmedSummaryId = ids.next();
        MaskedSummary masked = maskAndRequireAllowed(request.fields());
        safetyEvidence.recordIndependent(
                owner,
                "VENT_SUMMARY",
                confirmedSummaryId,
                masked.decision(),
                masked.maskCodes(),
                now
        );
        requireSummaryAllowed(masked.decision());
        Map<String, Object> confirmedDocument = summaryDocument(masked.fields());
        mapper.insertSummary(encryptedSummary(
                confirmedSummaryId,
                session.id(),
                2,
                "CONFIRMED",
                confirmedDocument,
                now
        ));
        CreatedVentTask task = taskEntry.createFromVent(
                owner,
                authLevel,
                new VentFields(
                        masked.fields().context(),
                        masked.fields().observedFact(),
                        masked.fields().loopingThought(),
                        masked.fields().emotion(),
                        masked.fields().needOrBoundary(),
                        masked.fields().currentGoal(),
                        masked.fields().clarityPre()
                ),
                now
        );
        if (mapper.confirmSummary(
                session.id(),
                owner,
                request.expectedVersion(),
                request.summaryVersion(),
                confirmedSummaryId,
                task.taskId(),
                now
        ) != 1) {
            throw versionConflict(session.versionNo());
        }
        int resultVersion = request.expectedVersion() + 1;
        mapper.insertCommand(command(
                scope,
                owner,
                keyHash,
                requestHash,
                task.taskId(),
                resultVersion,
                task.taskVersion(),
                now
        ));
        return new ConfirmationResult(
                requireOwnedSession(session.id(), owner), task, confirmedSummaryId);
    }

    private ConfirmationResult confirmationFromCommand(
            CommandRecord command,
            String requestHash,
            String sessionId,
            String owner
    ) {
        requireSameRequest(command, requestHash);
        SessionRecord session = requireOwnedSession(sessionId, owner);
        if (!"CONFIRMED".equals(session.state())
                || !Objects.equals(session.mappedTaskId(), command.resourceId())
                || session.currentSummaryVersionId() == null) {
            throw stateCorrupted(sessionId);
        }
        CreatedVentTask task = taskEntry.loadCreatedVentTask(
                owner, command.resourceId(), command.resourceVersion());
        SessionRecord resultSession = sessionSnapshot(
                session,
                "CONFIRMED",
                session.aiTurns(),
                session.userTurns(),
                command.resultVersion(),
                session.currentSummaryVersionId(),
                command.resourceId(),
                session.updatedAt()
        );
        return new ConfirmationResult(resultSession, task, session.currentSummaryVersionId());
    }

    private MaskedSummary maskAndRequireAllowed(VentSummaryFields fields) {
        List<String> inputs = new ArrayList<>();
        inputs.add(fields.observedFact());
        inputs.add(fields.loopingThought());
        int emotionStart = inputs.size();
        inputs.addAll(fields.emotion());
        int boundaryStart = inputs.size();
        inputs.addAll(fields.needOrBoundary());
        int goalIndex = inputs.size();
        inputs.add(fields.currentGoal());

        SensitiveTextMasker.MaskedTexts masked = masker.mask(inputs);
        List<String> values = masked.values();
        VentSummaryFields result = new VentSummaryFields(
                fields.context(),
                values.get(0),
                values.get(1),
                List.copyOf(values.subList(emotionStart, boundaryStart)),
                List.copyOf(values.subList(boundaryStart, goalIndex)),
                values.get(goalIndex),
                fields.clarityPre()
        );
        Decision decision = safety.assess(
                Checkpoint.S1_INPUT,
                List.of(
                        result.observedFact(),
                        result.loopingThought(),
                        String.join(" ", result.emotion()),
                        String.join(" ", result.needOrBoundary()),
                        result.currentGoal()
                ),
                masked.maskCodes()
        );
        return new MaskedSummary(result, decision, masked.maskCodes());
    }

    private void requireSummaryAllowed(Decision decision) {
        if (!"ALLOW".equals(decision.route())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VENT_SUMMARY_SAFETY_REJECTED",
                    "确认总结未通过普通关系任务安全检查",
                    false,
                    Map.of(
                            "route", decision.route(),
                            "categories", decision.categories(),
                            "rule_version", decision.ruleVersion(),
                            "resource_ids", decision.resourceIds()
                    )
            );
        }
    }

    private TurnRecord encryptedTurn(
            String turnId,
            String sessionId,
            int messageNo,
            String role,
            Decision decision,
            List<String> maskCodes,
            TurnDocument document,
            LocalDateTime now
    ) {
        EncryptedPayload encrypted = encrypt(turnId, serialize(document));
        return new TurnRecord(
                turnId,
                sessionId,
                messageNo,
                role,
                decision.route(),
                serializeList(decision.categories()),
                serializeList(maskCodes),
                decision.ruleVersion(),
                serializeList(decision.resourceIds()),
                encrypted.ciphertext(),
                encrypted.contentNonce(),
                encrypted.wrappedDek(),
                encrypted.wrapNonce(),
                encrypted.keyVersion(),
                encrypted.contentHash(),
                now.plus(CONTENT_TTL),
                now
        );
    }

    private SummaryRecord encryptedSummary(
            String summaryId,
            String sessionId,
            int version,
            String status,
            Map<String, Object> document,
            LocalDateTime now
    ) {
        EncryptedPayload encrypted = encrypt(summaryId, serialize(document));
        return new SummaryRecord(
                summaryId,
                sessionId,
                version,
                status,
                encrypted.ciphertext(),
                encrypted.contentNonce(),
                encrypted.wrappedDek(),
                encrypted.wrapNonce(),
                encrypted.keyVersion(),
                encrypted.contentHash(),
                now.plus(CONTENT_TTL),
                now
        );
    }

    private Decision decisionFromTurn(TurnRecord turn) {
        return new Decision(
                Checkpoint.S1_INPUT,
                turn.safetyRoute(),
                parseList(turn.categoriesJson()),
                turn.ruleVersion(),
                parseList(turn.resourceIdsJson())
        );
    }

    private TurnDocument decryptTurn(TurnRecord turn) {
        try {
            return objectMapper.readValue(
                    encryption.decrypt(turn.id(), encrypted(turn)),
                    TurnDocument.class
            );
        } catch (ContentCryptoException | IOException exception) {
            throw contentUnavailable();
        }
    }

    private Map<String, Object> decryptSummary(SummaryRecord summary) {
        try {
            return objectMapper.readValue(
                    encryption.decrypt(summary.id(), encrypted(summary)),
                    new TypeReference<>() { }
            );
        } catch (ContentCryptoException | IOException exception) {
            throw contentUnavailable();
        }
    }

    private EncryptedPayload encrypted(TurnRecord turn) {
        return new EncryptedPayload(
                turn.ciphertext(),
                turn.contentNonce(),
                turn.wrappedDek(),
                turn.wrapNonce(),
                turn.keyVersion(),
                turn.contentHash()
        );
    }

    private EncryptedPayload encrypted(SummaryRecord summary) {
        return new EncryptedPayload(
                summary.ciphertext(),
                summary.contentNonce(),
                summary.wrappedDek(),
                summary.wrapNonce(),
                summary.keyVersion(),
                summary.contentHash()
        );
    }

    private Map<String, Object> draftSummary(String latestUserText) {
        String clipped = latestUserText.length() <= 420
                ? latestUserText
                : latestUserText.substring(0, 420);
        LinkedHashMap<String, Object> summary = new LinkedHashMap<>();
        summary.put("context", "other_relationship");
        summary.put("observed_fact", "待你确认或修改：你在本次倾诉中提到“" + clipped + "”");
        summary.put("looping_thought", "当前反复想法仍需你确认或修改；不要把推测当成事实。");
        summary.put("emotion", List.of("other"));
        summary.put("need_or_boundary", List.of("请填写现在最需要保护的需要或边界"));
        summary.put("current_goal", "结束本次倾诉，并把一件关系事件整理为可核对的事实。");
        summary.put("clarity_pre", 0);
        summary.put("ai_label", AI_LABEL);
        summary.put("model_version", STUB_VERSION);
        return Map.copyOf(summary);
    }

    private Map<String, Object> summaryDocument(VentSummaryFields fields) {
        return Map.of(
                "context", fields.context(),
                "observed_fact", fields.observedFact(),
                "looping_thought", fields.loopingThought(),
                "emotion", fields.emotion(),
                "need_or_boundary", fields.needOrBoundary(),
                "current_goal", fields.currentGoal(),
                "clarity_pre", fields.clarityPre(),
                "ai_label", AI_LABEL,
                "model_version", STUB_VERSION
        );
    }

    private Map<String, Object> sessionResponse(SessionRecord session) {
        return Map.of(
                "vent_session_id", session.id(),
                "state", session.state(),
                "version", session.versionNo(),
                "ai_turns_used", session.aiTurns(),
                "ai_turns_remaining", Math.max(0, MAX_AI_TURNS - session.aiTurns()),
                "max_ai_turns", MAX_AI_TURNS,
                "deadline_at", session.deadlineAt().atOffset(ZoneOffset.UTC).toString(),
                "can_finish", session.userTurns() > 0 && !"SAFETY_BLOCKED".equals(session.state()),
                "ai_label", AI_LABEL,
                "model_version", STUB_VERSION
        );
    }

    private Map<String, Object> turnResponse(TurnResult result) {
        SessionRecord session = result.session();
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("vent_session_id", session.id());
        response.put("turn_id", result.userTurn().id());
        response.put("state", session.state());
        response.put("version", session.versionNo());
        response.put("ai_turns_used", session.aiTurns());
        response.put("ai_turns_remaining", Math.max(0, MAX_AI_TURNS - session.aiTurns()));
        response.put("deadline_at", session.deadlineAt().atOffset(ZoneOffset.UTC).toString());
        response.put("can_finish", session.userTurns() > 0 && !"SAFETY_BLOCKED".equals(session.state()));
        response.put("safety", safetyResponse(result.decision()));
        if (result.reply() != null) {
            response.put("reply", Map.of(
                    "text", result.reply().text(),
                    "ai_label", result.reply().aiLabel(),
                    "model_version", result.reply().modelVersion()
            ));
        }
        return Map.copyOf(response);
    }

    private Map<String, Object> summaryResponse(SummaryResult result) {
        return Map.of(
                "vent_session_id", result.session().id(),
                "state", result.session().state(),
                "version", result.session().versionNo(),
                "summary_version", result.summary().id(),
                "summary", result.document(),
                "can_confirm", true,
                "expires_at", result.summary().expiresAt().atOffset(ZoneOffset.UTC).toString()
        );
    }

    private Map<String, Object> confirmationResponse(ConfirmationResult result) {
        return Map.of(
                "vent_session_id", result.session().id(),
                "state", result.session().state(),
                "version", result.session().versionNo(),
                "confirmed_summary_version", result.confirmedSummaryId(),
                "task_id", result.task().taskId(),
                "task_state", result.task().state(),
                "task_version", result.task().taskVersion(),
                "content_version", result.task().contentVersion()
        );
    }

    private Map<String, Object> safetyResponse(Decision decision) {
        return Map.of(
                "checkpoint", decision.checkpoint().name(),
                "route", decision.route(),
                "categories", decision.categories(),
                "rule_version", decision.ruleVersion(),
                "resource_ids", decision.resourceIds()
        );
    }

    private SessionRecord requireOwnedSession(String sessionId, String owner) {
        SessionRecord session = mapper.findSession(sessionId);
        if (session == null) throw new ApiException(HttpStatus.NOT_FOUND, "VENT_SESSION_NOT_FOUND", "倾诉会话不存在");
        if (!owner.equals(session.ownerSubjectRef())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "RESOURCE_OWNERSHIP_DENIED", "无权访问该倾诉会话");
        }
        return session;
    }

    private SessionRecord sessionSnapshot(
            SessionRecord source,
            String state,
            int aiTurns,
            int userTurns,
            int version,
            String summaryVersionId,
            String mappedTaskId,
            LocalDateTime updatedAt
    ) {
        return new SessionRecord(
                source.id(),
                source.ownerSubjectRef(),
                source.ownerAuthLevel(),
                source.policyVersion(),
                state,
                aiTurns,
                userTurns,
                version,
                source.startedAt(),
                source.deadlineAt(),
                summaryVersionId,
                mappedTaskId,
                source.expiresAt(),
                source.createdAt(),
                updatedAt
        );
    }

    private void requireActiveForTurn(SessionRecord session) {
        if ("SAFETY_BLOCKED".equals(session.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "VENT_SAFETY_BLOCKED", "高风险倾诉不能继续普通回复");
        }
        if (!"ACTIVE".equals(session.state())) {
            throw new ApiException(HttpStatus.CONFLICT, "VENT_NOT_ACTIVE", "当前倾诉状态不能继续回复");
        }
    }

    private void requireVersion(SessionRecord session, int expectedVersion) {
        if (session.versionNo() != expectedVersion) throw versionConflict(session.versionNo());
    }

    private ApiException versionConflict(int currentVersion) {
        return new ApiException(
                HttpStatus.CONFLICT,
                "VERSION_CONFLICT",
                "倾诉会话版本已经变化",
                false,
                Map.of("current_version", currentVersion)
        );
    }

    private ApiException turnLimit() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "VENT_TURN_LIMIT_REACHED",
                "本次倾诉已达到最多8个回复，请结束并整理",
                false,
                Map.of("can_finish", true, "max_ai_turns", MAX_AI_TURNS)
        );
    }

    private ApiException timeLimit() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "VENT_TIME_LIMIT_REACHED",
                "本次倾诉已达到10分钟，请结束并整理",
                false,
                Map.of("can_finish", true, "duration_minutes", 10)
        );
    }

    private ApiException stateCorrupted(String resourceId) {
        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "VENT_STATE_CORRUPTED",
                "倾诉状态异常",
                false,
                Map.of("resource_id", resourceId)
        );
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
                scope,
                owner,
                keyHash,
                requestHash,
                resourceId,
                resultVersion,
                resourceVersion,
                now,
                now.plus(IDEMPOTENCY_TTL)
        );
    }

    private String structuredRequestHash(String scope, Object request) {
        try {
            return Sha256Fingerprints.canonicalRequest(scope, objectMapper.writeValueAsString(request));
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "请求无法规范化");
        }
    }

    private byte[] serialize(Object value) {
        try {
            return objectMapper.writeValueAsBytes(value);
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

    private List<String> parseList(String value) {
        try {
            return objectMapper.readValue(value, new TypeReference<>() { });
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

    private ApiException contentUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CONTENT_SECURITY_UNAVAILABLE",
                "内容安全服务暂时不可用",
                true,
                Map.of()
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private record TurnDocument(String text, String aiLabel, String modelVersion) {
    }

    private record TurnResult(
            SessionRecord session,
            TurnRecord userTurn,
            TurnDocument reply,
            Decision decision
    ) {
    }

    private record SummaryResult(
            SessionRecord session,
            SummaryRecord summary,
            Map<String, Object> document
    ) {
    }

    private record ConfirmationResult(
            SessionRecord session,
            CreatedVentTask task,
            String confirmedSummaryId
    ) {
    }

    private record MaskedSummary(
            VentSummaryFields fields,
            Decision decision,
            List<String> maskCodes
    ) {
    }
}
