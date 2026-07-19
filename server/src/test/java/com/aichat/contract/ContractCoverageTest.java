package com.aichat.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.aichat.kernel.auth.AuthPolicy;
import com.aichat.kernel.auth.ContractOperation;
import com.aichat.kernel.auth.MakerChecker;
import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ContractCoverageTest {
    private static final Set<String> HTTP_METHODS = Set.of("get", "post", "put", "patch", "delete");

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void everyOpenApiOperationHasAnEquivalentControllerAndAuthPolicy() throws IOException {
        Map<String, ActualOperation> actual = scanControllerOperations();
        Map<String, ExpectedOperation> expected = readContractOperations();

        assertThat(actual).hasSize(63);
        assertThat(actual.keySet()).containsExactlyInAnyOrderElementsOf(expected.keySet());
        expected.forEach((operationId, expectedOperation) -> {
            ActualOperation actualOperation = actual.get(operationId);
            assertThat(actualOperation)
                    .as("missing Controller operation %s", operationId)
                    .isNotNull();
            assertThat(actualOperation.path()).isEqualTo(expectedOperation.path());
            assertThat(actualOperation.method()).isEqualTo(expectedOperation.method());
            assertThat(actualOperation.domainOwner()).isEqualTo(expectedOperation.domainOwner());
            assertThat(actualOperation.authRuleId()).isEqualTo(expectedOperation.authRuleId());
            assertThat(actualOperation.operatorPolicyRuleId()).isEqualTo(expectedOperation.operatorPolicyRuleId());
            assertThat(actualOperation.authLevel()).isEqualTo(expectedOperation.authLevel());
            assertThat(actualOperation.acceptedLevels()).containsExactlyInAnyOrderElementsOf(
                    expectedOperation.acceptedLevels());
            assertThat(actualOperation.roles()).containsExactlyInAnyOrderElementsOf(expectedOperation.roles());
            assertThat(actualOperation.mfaRequired()).isEqualTo(expectedOperation.mfaRequired());
            assertThat(actualOperation.rawBodyRequired()).isEqualTo(expectedOperation.rawBodyRequired());
            assertThat(actualOperation.makerChecker()).isEqualTo(expectedOperation.makerChecker());
        });
    }

    private Map<String, ActualOperation> scanControllerOperations() {
        Map<String, ActualOperation> result = new HashMap<>();
        applicationContext.getBeansWithAnnotation(RestController.class).values().forEach(bean -> {
            Class<?> beanType = AopUtils.getTargetClass(bean);
            if (!beanType.getPackageName().startsWith("com.aichat")) {
                return;
            }
            for (Method method : beanType.getDeclaredMethods()) {
                RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(method, RequestMapping.class);
                if (mapping == null) continue;

                ContractOperation contract = method.getAnnotation(ContractOperation.class);
                AuthPolicy auth = method.getAnnotation(AuthPolicy.class);
                assertThat(contract).as("@ContractOperation missing on %s", method).isNotNull();
                assertThat(auth).as("@AuthPolicy missing on %s", method).isNotNull();
                assertThat(mapping.path()).as("single path required on %s", method).hasSize(1);
                assertThat(mapping.method()).as("single HTTP method required on %s", method).hasSize(1);

                MakerChecker makerChecker = method.getAnnotation(MakerChecker.class);
                ActualOperation operation = new ActualOperation(
                        mapping.path()[0],
                        mapping.method()[0].name().toLowerCase(),
                        contract.domainOwner(),
                        auth.ruleId(),
                        auth.operatorPolicyRuleId(),
                        auth.level().name(),
                        Arrays.stream(auth.accepted()).map(Enum::name).toList(),
                        List.of(auth.roles()),
                        auth.mfaRequired(),
                        auth.rawBodyRequired(),
                        makerChecker != null
                );
                assertThat(result.put(contract.operationId(), operation))
                        .as("duplicate operationId %s", contract.operationId())
                        .isNull();
            }
        });
        return result;
    }

    private Map<String, ExpectedOperation> readContractOperations() throws IOException {
        Path contractPath = Path.of("..", "contracts", "openapi.generated.json");
        assertThat(Files.isRegularFile(contractPath)).as("OpenAPI contract location").isTrue();
        JsonNode root = new ObjectMapper().readTree(contractPath.toFile());
        Map<String, ExpectedOperation> result = new HashMap<>();

        Iterator<Map.Entry<String, JsonNode>> paths = root.path("paths").fields();
        while (paths.hasNext()) {
            Map.Entry<String, JsonNode> pathEntry = paths.next();
            Iterator<Map.Entry<String, JsonNode>> methods = pathEntry.getValue().fields();
            while (methods.hasNext()) {
                Map.Entry<String, JsonNode> methodEntry = methods.next();
                if (!HTTP_METHODS.contains(methodEntry.getKey())) continue;
                JsonNode operation = methodEntry.getValue();
                String operationId = operation.path("operationId").asText();
                String level = operation.path("x-auth-level").asText().toUpperCase();
                List<String> accepted = textArray(operation.path("x-accepted-auth-levels"));
                if (accepted.isEmpty()) accepted = List.of(level);

                ExpectedOperation expected = new ExpectedOperation(
                        pathEntry.getKey(),
                        methodEntry.getKey(),
                        operation.path("x-domain-owner").asText(),
                        operation.path("x-auth-rule-id").asText(),
                        operation.path("x-operator-policy-rule-id").asText(),
                        level,
                        accepted.stream().map(String::toUpperCase).toList(),
                        textArray(operation.path("x-required-roles")),
                        operation.path("x-mfa-required").asBoolean(false),
                        operation.path("x-raw-body-required").asBoolean(false),
                        operation.has("x-approval-policy")
                );
                assertThat(result.put(operationId, expected)).as("duplicate operationId %s", operationId).isNull();
            }
        }
        return result;
    }

    private List<String> textArray(JsonNode node) {
        List<String> result = new ArrayList<>();
        if (node.isArray()) node.forEach(value -> result.add(value.asText()));
        return result;
    }

    private record ActualOperation(
            String path,
            String method,
            String domainOwner,
            String authRuleId,
            String operatorPolicyRuleId,
            String authLevel,
            List<String> acceptedLevels,
            List<String> roles,
            boolean mfaRequired,
            boolean rawBodyRequired,
            boolean makerChecker
    ) {
    }

    private record ExpectedOperation(
            String path,
            String method,
            String domainOwner,
            String authRuleId,
            String operatorPolicyRuleId,
            String authLevel,
            List<String> acceptedLevels,
            List<String> roles,
            boolean mfaRequired,
            boolean rawBodyRequired,
            boolean makerChecker
    ) {
    }
}
