package com.aichat.identity.infrastructure;

import com.aichat.identity.infrastructure.SessionMapper.SessionRecord;
import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.auth.AuthPolicy;
import com.aichat.kernel.auth.AuthenticatedSubject;
import com.aichat.kernel.auth.SubjectResolver;
import com.aichat.kernel.security.Sha256Fingerprints;
import com.aichat.payment.application.VirtualPaymentMapper;
import com.aichat.payment.application.VirtualPaySettings;
import com.aichat.payment.application.VirtualPaymentPushBodyFilter;
import com.aichat.payment.application.WechatVirtualPayProtocol;
import com.aichat.payment.application.VirtualPaymentApplicationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;

@Component
public final class DatabaseSubjectResolver implements SubjectResolver {
    private final SessionMapper mapper;
    private final Clock clock;
    private final VirtualPaymentMapper payments;
    private final VirtualPaySettings virtualPay;

    public DatabaseSubjectResolver(SessionMapper mapper, Clock clock, VirtualPaymentMapper payments, VirtualPaySettings virtualPay) {
        this.mapper = mapper;
        this.clock = clock;
        this.payments = payments;
        this.virtualPay = virtualPay;
    }

    @Override
    public Optional<AuthenticatedSubject> resolve(HttpServletRequest request, AuthPolicy policy) {
        if ("internal-virtual-pay-webhook".equals(policy.ruleId())) {
            virtualPay.requireEnabled();
            var query = VirtualPaymentApplicationService.pushQuery(request.getParameter("signature"),
                    request.getParameter("msg_signature"), request.getParameter("timestamp"),
                    request.getParameter("nonce"), request.getParameter("encrypt_type"));
            if ("GET".equals(request.getMethod())) {
                WechatVirtualPayProtocol.verifyEcho(request.getParameter("echostr"), query, virtualPay.pushConfig());
            } else {
                Object raw = request.getAttribute(VirtualPaymentPushBodyFilter.RAW_BODY);
                WechatVirtualPayProtocol.decodePush(raw instanceof byte[] bytes ? bytes : null, query, virtualPay.pushConfig());
            }
            return Optional.of(new AuthenticatedSubject("wechat-virtual-pay", AuthLevel.INTERNAL, Set.of(), false));
        }
        boolean refreshRequest = request.getRequestURI().endsWith("/api/v1/tokens/refresh");
        String rawToken = refreshRequest
                ? safeToken(request.getHeader("X-Refresh-Token"))
                : safeBearerToken(request.getHeader("Authorization"));
        if (rawToken == null) return Optional.empty();

        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        SessionRecord session = refreshRequest
                ? mapper.findByRefreshTokenHash(Sha256Fingerprints.hash(rawToken), now)
                : mapper.findByAccessTokenHash(Sha256Fingerprints.hash(rawToken), now);
        if (session == null || "REVOKED".equals(session.status())) return Optional.empty();

        boolean consentEndpoint = request.getRequestURI().matches("/api/v1/sessions/[^/]+/consents");
        if (!"ACTIVE".equals(session.status()) && !consentEndpoint) return Optional.empty();
        AuthLevel level = payments.binding(session.id()) == null ? AuthLevel.VISITOR : AuthLevel.PRINCIPAL;
        return Optional.of(new AuthenticatedSubject(session.id(), level, Set.of(), false));
    }

    private String safeBearerToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        return safeToken(authorization.substring("Bearer ".length()));
    }

    private String safeToken(String token) {
        if (token == null || token.isBlank() || token.length() > 256
                || token.indexOf('\r') >= 0 || token.indexOf('\n') >= 0) {
            return null;
        }
        return token;
    }
}
