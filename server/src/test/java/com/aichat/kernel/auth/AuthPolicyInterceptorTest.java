package com.aichat.kernel.auth;

import com.aichat.kernel.api.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthPolicyInterceptorTest {

    @Test
    void principalCanUseAnEndpointThatExplicitlyAcceptsVisitorAndPrincipal() throws Exception {
        AuthenticatedSubject subject = new AuthenticatedSubject("principal-1", AuthLevel.PRINCIPAL, Set.of(), false);
        AuthPolicyInterceptor interceptor = new AuthPolicyInterceptor((request, policy) -> Optional.of(subject));

        boolean allowed = interceptor.preHandle(
                request("/api/v1/tasks/task-1"),
                new MockHttpServletResponse(),
                handler("visitorOrPrincipal")
        );

        assertThat(allowed).isTrue();
    }

    @Test
    void operatorMustHaveMfaAndAnyOneRequiredRole() throws Exception {
        AuthenticatedSubject noMfa = new AuthenticatedSubject(
                "operator-1", AuthLevel.OPERATOR, Set.of("finance"), false);
        AuthPolicyInterceptor interceptor = new AuthPolicyInterceptor((request, policy) -> Optional.of(noMfa));

        assertThatThrownBy(() -> interceptor.preHandle(
                request("/ops/v1/orders/order-1"),
                new MockHttpServletResponse(),
                handler("operator")
        )).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.error().code()).isEqualTo("AUTHORIZATION_DENIED"));

        AuthenticatedSubject authorized = new AuthenticatedSubject(
                "operator-2", AuthLevel.OPERATOR, Set.of("finance"), true);
        AuthPolicyInterceptor allowed = new AuthPolicyInterceptor((request, policy) -> Optional.of(authorized));
        assertThat(allowed.preHandle(
                request("/ops/v1/orders/order-1"),
                new MockHttpServletResponse(),
                handler("operator")
        )).isTrue();
    }

    @Test
    void rejectsGeneratedPolicyThatConflictsWithReservedNamespace() throws Exception {
        AuthPolicyInterceptor interceptor = new AuthPolicyInterceptor((request, policy) -> Optional.empty());

        assertThatThrownBy(() -> interceptor.preHandle(
                request("/ops/v1/orders/order-1"),
                new MockHttpServletResponse(),
                handler("visitorOrPrincipal")
        )).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.error().code())
                        .isEqualTo("AUTH_POLICY_CONFIGURATION_INVALID"));
    }

    @Test
    void rejectsAControllerMethodWithoutCompiledAuthMetadata() throws Exception {
        AuthPolicyInterceptor interceptor = new AuthPolicyInterceptor((request, policy) -> Optional.empty());

        assertThatThrownBy(() -> interceptor.preHandle(
                request("/api/v1/unclassified"),
                new MockHttpServletResponse(),
                handler("missingPolicy")
        )).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.error().code())
                        .isEqualTo("AUTH_POLICY_CONFIGURATION_INVALID"));
    }

    private HandlerMethod handler(String name) throws NoSuchMethodException {
        Method method = SecuredHandler.class.getDeclaredMethod(name);
        return new HandlerMethod(new SecuredHandler(), method);
    }

    private MockHttpServletRequest request(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(uri);
        return request;
    }

    private static final class SecuredHandler {
        @ContractOperation(operationId = "visitorOrPrincipal", domainOwner = "Clarity")
        @AuthPolicy(
                ruleId = "private-user-default",
                level = AuthLevel.VISITOR,
                accepted = {AuthLevel.VISITOR, AuthLevel.PRINCIPAL}
        )
        void visitorOrPrincipal() {
        }

        @ContractOperation(operationId = "operator", domainOwner = "Ordering")
        @AuthPolicy(
                ruleId = "admin-operations",
                operatorPolicyRuleId = "admin-order-support",
                level = AuthLevel.OPERATOR,
                accepted = {AuthLevel.OPERATOR},
                roles = {"support", "finance"},
                mfaRequired = true
        )
        void operator() {
        }

        @ContractOperation(operationId = "missingPolicy", domainOwner = "Test")
        void missingPolicy() {
        }
    }
}
