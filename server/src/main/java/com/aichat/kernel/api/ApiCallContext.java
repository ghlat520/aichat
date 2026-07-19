package com.aichat.kernel.api;

import com.aichat.kernel.auth.AuthenticatedSubject;
import com.aichat.kernel.auth.AuthPolicyInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Servlet-independent information that generated inbound adapters pass to application services.
 */
public record ApiCallContext(String requestId, AuthenticatedSubject subject) {

    public static ApiCallContext from(HttpServletRequest request) {
        Object subject = request.getAttribute(AuthPolicyInterceptor.SUBJECT_ATTRIBUTE);
        return new ApiCallContext(
                RequestIdFilter.from(request),
                subject instanceof AuthenticatedSubject authenticated ? authenticated : null
        );
    }

    public AuthenticatedSubject requireSubject() {
        if (subject == null) {
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTHENTICATION_REQUIRED",
                    "需要有效身份凭证",
                    false,
                    Map.of()
            );
        }
        return subject;
    }
}
