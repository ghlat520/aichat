package com.aichat.kernel.auth;

import com.aichat.kernel.api.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.method.HandlerMethod;

/**
 * Runtime entry point for build-time compiled auth classifications.
 * Controllers carry generated policy metadata; application developers do not classify endpoints by hand.
 */
public final class AuthClassificationResolver {

    public AuthPolicy resolve(HttpServletRequest request, HandlerMethod handlerMethod) {
        ContractOperation contract = handlerMethod.getMethodAnnotation(ContractOperation.class);
        AuthPolicy policy = handlerMethod.getMethodAnnotation(AuthPolicy.class);
        if (contract == null || policy == null || policy.ruleId().isBlank()) {
            throw invalid("端点缺少中央规则生成的鉴权策略");
        }
        if (policy.level() == AuthLevel.OPERATOR && policy.operatorPolicyRuleId().isBlank()) {
            throw invalid("运营端点缺少中央 RBAC 规则来源");
        }
        if (policy.level() != AuthLevel.OPERATOR && !policy.operatorPolicyRuleId().isBlank()) {
            throw invalid("非运营端点不得携带运营 RBAC 规则");
        }

        String uri = request.getRequestURI();
        if (uri.startsWith("/ops/v1/") && policy.level() != AuthLevel.OPERATOR) {
            throw invalid("/ops/v1/** 只能归类为 Operator");
        }
        if (uri.startsWith("/api/v1/webhooks/") && policy.level() != AuthLevel.INTERNAL) {
            throw invalid("/api/v1/webhooks/** 只能归类为 Internal");
        }
        if (uri.startsWith("/public/") && policy.level() != AuthLevel.PUBLIC) {
            throw invalid("/public/** 只能归类为 Public");
        }
        return policy;
    }

    private ApiException invalid(String message) {
        return new ApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "AUTH_POLICY_CONFIGURATION_INVALID",
                message
        );
    }
}
