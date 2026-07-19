package com.aichat.identity.infrastructure;

import com.aichat.identity.infrastructure.SessionMapper.SessionRecord;
import com.aichat.kernel.auth.AuthLevel;
import com.aichat.kernel.auth.AuthPolicy;
import com.aichat.kernel.auth.AuthenticatedSubject;
import com.aichat.kernel.auth.SubjectResolver;
import com.aichat.kernel.security.Sha256Fingerprints;
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

    public DatabaseSubjectResolver(SessionMapper mapper, Clock clock) {
        this.mapper = mapper;
        this.clock = clock;
    }

    @Override
    public Optional<AuthenticatedSubject> resolve(HttpServletRequest request, AuthPolicy policy) {
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
        return Optional.of(new AuthenticatedSubject(session.id(), AuthLevel.VISITOR, Set.of(), false));
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
