package com.aichat.safety.application;

import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.operations.api.OperationsApiDelegate;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper.ReviewCaseView;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper.ReviewCommandRecord;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public final class SafetyReviewApplicationService implements OperationsApiDelegate {
    private static final Pattern ULID = Pattern.compile("[0-9A-HJKMNP-TV-Z]{26}");
    private static final Set<String> STATUSES = Set.of("OPEN", "RESOLVED");
    private static final Set<String> ROUTES = Set.of("CLARIFY", "BLOCK");
    private static final Duration COMMAND_TTL = Duration.ofHours(24);

    private final SafetyEvidenceMapper mapper;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final SafetyReviewExpiryJob expiryJob;

    public SafetyReviewApplicationService(
            SafetyEvidenceMapper mapper,
            ObjectMapper objectMapper,
            Clock clock,
            TransactionTemplate transactions,
            SafetyReviewExpiryJob expiryJob
    ) {
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.transactions = transactions;
        this.expiryJob = expiryJob;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> listOpsSafetyReviewCases(
            ApiCallContext context,
            String cursor,
            Integer limit,
            String status,
            String route
    ) {
        requireReviewer(context);
        String effectiveStatus = status == null ? "OPEN" : status;
        int effectiveLimit = limit == null ? 20 : limit;
        if (!STATUSES.contains(effectiveStatus)
                || (route != null && !ROUTES.contains(route))
                || effectiveLimit < 1
                || effectiveLimit > 100
                || (cursor != null && !ULID.matcher(cursor).matches())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REVIEW_FILTER", "安全复核队列筛选条件无效");
        }
        List<ReviewCaseView> fetched = mapper.listCases(
                effectiveStatus, route, cursor, effectiveLimit + 1);
        boolean hasMore = fetched.size() > effectiveLimit;
        List<ReviewCaseView> page = hasMore ? fetched.subList(0, effectiveLimit) : fetched;
        String nextCursor = hasMore ? page.get(page.size() - 1).id() : null;
        LinkedHashMap<String, Object> data = new LinkedHashMap<>();
        data.put("items", page.stream().map(this::caseSummary).toList());
        data.put("has_more", hasMore);
        if (nextCursor != null) data.put("next_cursor", nextCursor);
        data.put("material_access", "NONE");
        return ApiEnvelope.success(context.requestId(), Map.copyOf(data));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getOpsSafetyReviewCase(
            ApiCallContext context,
            String caseId
    ) {
        requireReviewer(context);
        return ApiEnvelope.success(context.requestId(), caseDetail(requireCase(caseId)));
    }

    @Override
    public ApiEnvelope<Map<String, Object>> patchOpsSafetyReviewCase(
            ApiCallContext context,
            String caseId,
            String idempotencyKey,
            ContractRequests.SafetyReviewDecisionRequest request
    ) {
        var reviewer = requireReviewer(context);
        requireUlid(caseId);
        IdempotencyKeys.requireValid(idempotencyKey);
        String scope = "safety-review:resolve:" + caseId;
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                scope,
                String.valueOf(request.expectedVersion()),
                request.decision(),
                request.reason(),
                request.ticket()
        );
        try {
            ReviewCaseView resolved = transactions.execute(status -> resolveOrReplay(
                    reviewer.subjectId(), caseId, scope, keyHash, requestHash, request));
            return ApiEnvelope.success(context.requestId(), caseDetail(resolved));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            ReviewCaseView resolved = transactions.execute(status -> {
                ReviewCommandRecord command = mapper.findCommand(scope, reviewer.subjectId(), keyHash, now());
                if (command == null) throw concurrentDuplicate;
                return replay(command, requestHash, caseId);
            });
            return ApiEnvelope.success(context.requestId(), caseDetail(resolved));
        }
    }

    private ReviewCaseView resolveOrReplay(
            String reviewer,
            String caseId,
            String scope,
            String keyHash,
            String requestHash,
            ContractRequests.SafetyReviewDecisionRequest request
    ) {
        LocalDateTime commandNow = now();
        expiryJob.deleteExpiredCommand(scope, reviewer, keyHash, commandNow);
        ReviewCommandRecord existing = mapper.findCommand(scope, reviewer, keyHash, commandNow);
        if (existing != null) return replay(existing, requestHash, caseId);
        ReviewCaseView reviewCase = requireCase(caseId);
        if (!"OPEN".equals(reviewCase.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "SAFETY_CASE_ALREADY_RESOLVED", "安全复核案例已经结案");
        }
        if (reviewCase.versionNo() != request.expectedVersion()) {
            throw versionConflict(reviewCase.versionNo());
        }
        LocalDateTime now = now();
        int resultVersion = request.expectedVersion() + 1;
        mapper.insertCommand(new ReviewCommandRecord(
                scope,
                reviewer,
                keyHash,
                requestHash,
                caseId,
                resultVersion,
                now,
                now.plus(COMMAND_TTL)
        ));
        if (mapper.resolveCase(
                caseId,
                request.expectedVersion(),
                request.decision(),
                Sha256Fingerprints.hash(request.reason()),
                Sha256Fingerprints.hash(request.ticket()),
                reviewer,
                now
        ) != 1) {
            ReviewCaseView current = requireCase(caseId);
            throw versionConflict(current.versionNo());
        }
        return requireCase(caseId);
    }

    private ReviewCaseView replay(ReviewCommandRecord command, String requestHash, String caseId) {
        if (!requestHash.equals(command.requestHash())) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "幂等键已被不同请求使用");
        }
        if (!caseId.equals(command.caseId())) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SAFETY_CASE_STATE_CORRUPTED", "安全复核状态异常");
        }
        ReviewCaseView reviewCase = requireCase(caseId);
        if (reviewCase.versionNo() != command.resultVersion()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SAFETY_CASE_STATE_CORRUPTED", "安全复核状态异常");
        }
        return reviewCase;
    }

    private ReviewCaseView requireCase(String caseId) {
        requireUlid(caseId);
        ReviewCaseView reviewCase = mapper.findCase(caseId);
        if (reviewCase == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "SAFETY_CASE_NOT_FOUND", "安全复核案例不存在");
        }
        return reviewCase;
    }

    private com.aichat.kernel.auth.AuthenticatedSubject requireReviewer(ApiCallContext context) {
        var subject = context.requireSubject();
        if (subject.level() != AuthLevel.OPERATOR
                || !subject.mfaVerified()
                || !subject.roles().contains("safety-reviewer")) {
            throw new ApiException(HttpStatus.FORBIDDEN, "AUTHORIZATION_DENIED", "运营角色不允许执行该操作");
        }
        return subject;
    }

    private Map<String, Object> caseSummary(ReviewCaseView reviewCase) {
        return Map.of(
                "case_id", reviewCase.id(),
                "priority", reviewCase.priority(),
                "status", reviewCase.status(),
                "version", reviewCase.versionNo(),
                "source_type", reviewCase.sourceType(),
                "source_id", reviewCase.sourceId(),
                "checkpoint", reviewCase.checkpoint(),
                "route", reviewCase.route(),
                "categories", parseList(reviewCase.categoriesJson()),
                "created_at", reviewCase.createdAt().atOffset(ZoneOffset.UTC).toString()
        );
    }

    private Map<String, Object> caseDetail(ReviewCaseView reviewCase) {
        LinkedHashMap<String, Object> detail = new LinkedHashMap<>(caseSummary(reviewCase));
        detail.put("evidence_id", reviewCase.evidenceId());
        detail.put("rule_version", reviewCase.ruleVersion());
        detail.put("mask_codes", parseList(reviewCase.maskCodesJson()));
        detail.put("resource_ids", parseList(reviewCase.resourceIdsJson()));
        detail.put("material_access", "NONE");
        if (reviewCase.decision() != null) detail.put("decision", reviewCase.decision());
        if (reviewCase.resolvedAt() != null) {
            detail.put("resolved_at", reviewCase.resolvedAt().atOffset(ZoneOffset.UTC).toString());
        }
        return Map.copyOf(detail);
    }

    private List<String> parseList(String value) {
        try {
            return objectMapper.readValue(value, new TypeReference<>() { });
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SAFETY_CASE_STATE_CORRUPTED", "安全复核状态异常");
        }
    }

    private void requireUlid(String value) {
        if (value == null || !ULID.matcher(value).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESOURCE_ID", "资源 ID 格式无效");
        }
    }

    private ApiException versionConflict(int currentVersion) {
        return new ApiException(
                HttpStatus.CONFLICT,
                "VERSION_CONFLICT",
                "安全复核版本已经变化",
                false,
                Map.of("current_version", currentVersion)
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
