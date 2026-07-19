package com.aichat.kernel.auth;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Optional;

/**
 * 认证适配端口。实现方必须校验不透明令牌 hash/状态/刷新族，或微信支付原始报文签名；
 * 本接口从不解析 JWT，也不承担资源所有权检查。
 */
public interface SubjectResolver {
    Optional<AuthenticatedSubject> resolve(HttpServletRequest request, AuthPolicy policy);
}
