package com.aichat.kernel.auth;

import java.util.Set;

public record AuthenticatedSubject(
        String subjectId,
        AuthLevel level,
        Set<String> roles,
        boolean mfaVerified
) {
    public AuthenticatedSubject {
        roles = roles == null ? Set.of() : Set.copyOf(roles);
    }
}
