package com.aichat.identity.application;

import com.aichat.contract.ContractRequests;
import com.aichat.identity.api.IdentityApiDelegate;
import com.aichat.identity.infrastructure.SessionMapper;
import com.aichat.identity.infrastructure.SessionMapper.CommandRecord;
import com.aichat.identity.infrastructure.SessionMapper.ConsentRecord;
import com.aichat.identity.infrastructure.SessionMapper.SessionRecord;
import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.api.IdempotencyKeys;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.payment.application.VirtualPaymentApplicationService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
public final class SessionApplicationService implements IdentityApiDelegate {
    private static final String CREATE_SESSION_SCOPE = "identity:create-session";
    private static final Duration ACCESS_TTL = Duration.ofHours(2);
    private static final Duration REFRESH_TTL = Duration.ofDays(30);
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    private final SessionMapper mapper;
    private final SessionTokenService tokens;
    private final UlidGenerator ids;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final VirtualPaymentApplicationService virtualPayments;

    public SessionApplicationService(
            SessionMapper mapper,
            SessionTokenService tokens,
            UlidGenerator ids,
            Clock clock,
            TransactionTemplate transactions,
            VirtualPaymentApplicationService virtualPayments
    ) {
        this.mapper = mapper;
        this.tokens = tokens;
        this.ids = ids;
        this.clock = clock;
        this.transactions = transactions;
        this.virtualPayments = virtualPayments;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> bindWechatIdentity(ApiCallContext context, String idempotencyKey,
            ContractRequests.WechatBindRequest request) {
        return virtualPayments.bindWechat(context, idempotencyKey, request);
    }

    @Override
    public ApiEnvelope<Map<String, Object>> createVisitorSession(
            ApiCallContext context,
            String idempotencyKey,
            ContractRequests.CreateSessionRequest request
    ) {
        IdempotencyKeys.requireValid(idempotencyKey);
        String deviceClass = request.deviceClass() == null ? "unknown" : request.deviceClass();
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);
        String requestHash = Sha256Fingerprints.canonicalRequest(
                CREATE_SESSION_SCOPE,
                request.clientInstanceId(),
                deviceClass
        );

        try {
            SessionRecord session = transactions.execute(status ->
                    createOrReplaySession(keyHash, requestHash, request.clientInstanceId(), deviceClass));
            return ApiEnvelope.success(context.requestId(), sessionResponse(session));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            SessionRecord session = transactions.execute(status -> replaySession(keyHash, requestHash));
            return ApiEnvelope.success(context.requestId(), sessionResponse(session));
        }
    }

    @Override
    public ApiEnvelope<Map<String, Object>> recordConsent(
            ApiCallContext context,
            String sessionId,
            String idempotencyKey,
            ContractRequests.ConsentRequest request
    ) {
        IdempotencyKeys.requireValid(idempotencyKey);
        String subjectId = context.requireSubject().subjectId();
        if (!Objects.equals(subjectId, sessionId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "RESOURCE_OWNERSHIP_DENIED", "无权修改该会话");
        }
        String keyHash = Sha256Fingerprints.hash(idempotencyKey);

        try {
            ConsentRecord consent = transactions.execute(status ->
                    recordOrReplayConsent(sessionId, keyHash, request));
            return ApiEnvelope.success(context.requestId(), consentResponse(consent));
        } catch (DataIntegrityViolationException concurrentDuplicate) {
            ConsentRecord consent = transactions.execute(status -> replayConsent(sessionId, keyHash, request));
            return ApiEnvelope.success(context.requestId(), consentResponse(consent));
        }
    }

    private SessionRecord createOrReplaySession(
            String keyHash,
            String requestHash,
            String clientInstanceId,
            String deviceClass
    ) {
        CommandRecord existing = mapper.findCommand(CREATE_SESSION_SCOPE, keyHash);
        if (existing != null) return sessionFromCommand(existing, requestHash);

        LocalDateTime now = now();
        String sessionId = ids.next();
        String accessToken = tokens.accessToken(sessionId);
        String refreshToken = tokens.refreshToken(sessionId);
        SessionRecord session = new SessionRecord(
                sessionId,
                Sha256Fingerprints.hash(clientInstanceId),
                deviceClass,
                Sha256Fingerprints.hash(accessToken),
                Sha256Fingerprints.hash(refreshToken),
                "v1",
                "PENDING_CONSENT",
                now.plus(ACCESS_TTL),
                now.plus(REFRESH_TTL),
                1,
                now,
                now
        );
        mapper.insertSession(session);
        mapper.insertCommand(new CommandRecord(
                CREATE_SESSION_SCOPE,
                keyHash,
                requestHash,
                sessionId,
                now,
                now.plus(IDEMPOTENCY_TTL)
        ));
        return session;
    }

    private SessionRecord replaySession(String keyHash, String requestHash) {
        CommandRecord command = mapper.findCommand(CREATE_SESSION_SCOPE, keyHash);
        if (command == null) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "IDEMPOTENCY_CONFLICT",
                    "相同幂等请求正在处理，请安全重试",
                    true,
                    Map.of()
            );
        }
        return sessionFromCommand(command, requestHash);
    }

    private SessionRecord sessionFromCommand(CommandRecord command, String requestHash) {
        if (!Objects.equals(command.requestHash(), requestHash)) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同请求");
        }
        SessionRecord session = mapper.findSessionById(command.resourceId());
        if (session == null) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "IDEMPOTENCY_STATE_CORRUPTED",
                    "幂等记录状态异常",
                    false,
                    Map.of("resource_id", command.resourceId())
            );
        }
        return session;
    }

    private ConsentRecord recordOrReplayConsent(
            String sessionId,
            String keyHash,
            ContractRequests.ConsentRequest request
    ) {
        ConsentRecord existing = mapper.findConsent(sessionId, keyHash);
        if (existing != null) return validateConsentReplay(existing, request);

        SessionRecord session = mapper.findSessionById(sessionId);
        if (session == null || "REVOKED".equals(session.status())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "会话不存在或已失效");
        }
        LocalDateTime now = now();
        ConsentRecord consent = new ConsentRecord(
                ids.next(),
                sessionId,
                keyHash,
                request.policyVersion(),
                request.adultConfirmed(),
                request.accepted(),
                now
        );
        mapper.insertConsent(consent);
        if (mapper.activateSession(sessionId, now) != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STATE_CONFLICT", "会话状态已经变化");
        }
        return consent;
    }

    private ConsentRecord replayConsent(
            String sessionId,
            String keyHash,
            ContractRequests.ConsentRequest request
    ) {
        ConsentRecord consent = mapper.findConsent(sessionId, keyHash);
        if (consent == null) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "IDEMPOTENCY_CONFLICT",
                    "相同幂等请求正在处理，请安全重试",
                    true,
                    Map.of()
            );
        }
        return validateConsentReplay(consent, request);
    }

    private ConsentRecord validateConsentReplay(
            ConsentRecord existing,
            ContractRequests.ConsentRequest request
    ) {
        if (!Objects.equals(existing.policyVersion(), request.policyVersion())
                || existing.adultConfirmed() != request.adultConfirmed()
                || existing.accepted() != request.accepted()) {
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED", "幂等键已用于不同请求");
        }
        return existing;
    }

    private Map<String, Object> sessionResponse(SessionRecord session) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("session_id", session.id());
        data.put("access_token", tokens.accessToken(session.id()));
        data.put("refresh_token", tokens.refreshToken(session.id()));
        data.put("token_type", "Bearer");
        data.put("auth_level", "Visitor");
        data.put("status", session.status());
        data.put("expires_at", session.accessExpiresAt().atOffset(ZoneOffset.UTC).toString());
        return Map.copyOf(data);
    }

    private Map<String, Object> consentResponse(ConsentRecord consent) {
        return Map.of(
                "consent_id", consent.id(),
                "session_id", consent.sessionId(),
                "policy_version", consent.policyVersion(),
                "adult_confirmed", consent.adultConfirmed(),
                "accepted", consent.accepted(),
                "status", "ACTIVE",
                "consented_at", consent.consentedAt().atOffset(ZoneOffset.UTC).toString()
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

}
