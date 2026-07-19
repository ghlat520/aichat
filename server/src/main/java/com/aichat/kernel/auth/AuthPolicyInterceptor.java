package com.aichat.kernel.auth;

import com.aichat.kernel.api.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public final class AuthPolicyInterceptor implements HandlerInterceptor {
    public static final String SUBJECT_ATTRIBUTE = AuthPolicyInterceptor.class.getName() + ".subject";

    private final SubjectResolver subjectResolver;
    private final AuthClassificationResolver classificationResolver;

    public AuthPolicyInterceptor(SubjectResolver subjectResolver) {
        this(subjectResolver, new AuthClassificationResolver());
    }

    public AuthPolicyInterceptor(
            SubjectResolver subjectResolver,
            AuthClassificationResolver classificationResolver
    ) {
        this.subjectResolver = subjectResolver;
        this.classificationResolver = classificationResolver;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        AuthPolicy policy = classificationResolver.resolve(request, handlerMethod);
        if (policy.level() == AuthLevel.PUBLIC) {
            return true;
        }

        AuthenticatedSubject subject = subjectResolver.resolve(request, policy)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED,
                        "AUTHENTICATION_REQUIRED",
                        "需要有效身份凭证"
                ));

        Set<AuthLevel> acceptedLevels = Arrays.stream(policy.accepted()).collect(Collectors.toSet());
        if (!acceptedLevels.contains(subject.level())) {
            throw denied("身份等级不允许访问该资源");
        }
        if (policy.mfaRequired() && !subject.mfaVerified()) {
            throw denied("运营操作需要完成 MFA");
        }
        if (policy.roles().length > 0
                && Arrays.stream(policy.roles()).noneMatch(subject.roles()::contains)) {
            throw denied("运营角色不允许执行该操作");
        }

        request.setAttribute(SUBJECT_ATTRIBUTE, subject);
        return true;
    }

    private ApiException denied(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "AUTHORIZATION_DENIED", message, false, Map.of());
    }
}
