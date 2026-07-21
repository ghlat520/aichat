package com.aichat.report.application;

import com.aichat.clarity.port.ReportTaskSourcePort.ReportTaskSnapshot;
import com.aichat.kernel.api.ApiException;
import com.aichat.safety.application.SafetyPolicyEngine;
import com.aichat.safety.application.SafetyPolicyEngine.Checkpoint;
import com.aichat.safety.application.SafetyPolicyEngine.Decision;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Selects the user/provider-controlled report fields evaluated at S2 and S3. */
@Component
public final class ReportSafetyGate {
    private static final List<String> GENERATED_FIELDS = List.of(
            "confirmed_facts",
            "unverified_interpretations",
            "emotion_and_needs",
            "current_goal",
            "possible_explanations",
            "candidate_actions",
            "communication_draft"
    );

    private final SafetyPolicyEngine policy;
    private final ObjectMapper objectMapper;

    public ReportSafetyGate(SafetyPolicyEngine policy, ObjectMapper objectMapper) {
        this.policy = policy;
        this.objectMapper = objectMapper;
    }

    public Decision requirePreGenerationAllowed(ReportTaskSnapshot snapshot) {
        return requireAllowed(assessPreGeneration(snapshot));
    }

    public Decision assessPreGeneration(ReportTaskSnapshot snapshot) {
        List<String> texts = new ArrayList<>();
        texts.addAll(snapshot.confirmedFacts());
        texts.addAll(snapshot.unknownsToVerify());
        texts.addAll(snapshot.emotions());
        texts.addAll(snapshot.needsOrBoundaries());
        texts.add(snapshot.selfExecutableGoal());
        return policy.assess(
                Checkpoint.S2_PRE_GENERATION,
                List.copyOf(texts),
                List.of()
        );
    }

    public Decision requireOutputAllowed(Map<String, Object> report) {
        return requireAllowed(assessOutput(report));
    }

    public Decision assessOutput(Map<String, Object> report) {
        JsonNode root = objectMapper.valueToTree(report);
        List<String> texts = new ArrayList<>();
        for (String field : GENERATED_FIELDS) collectText(root.path(field), texts);
        return policy.assess(
                Checkpoint.S3_OUTPUT,
                List.copyOf(texts),
                List.of()
        );
    }

    public Decision requireAllowed(Decision decision) {
        if (!"ALLOW".equals(decision.route())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "REPORT_SAFETY_REJECTED",
                    "当前内容未通过普通报告安全检查",
                    false,
                    Map.of(
                            "checkpoint", decision.checkpoint().name(),
                            "route", decision.route(),
                            "categories", decision.categories(),
                            "rule_version", decision.ruleVersion(),
                            "resource_ids", decision.resourceIds()
                    )
            );
        }
        return decision;
    }

    private void collectText(JsonNode node, List<String> texts) {
        if (node.isTextual()) {
            texts.add(node.asText());
            return;
        }
        if (node.isArray()) {
            node.forEach(child -> collectText(child, texts));
            return;
        }
        if (node.isObject()) {
            node.properties().forEach(entry -> {
                if (!metadataField(entry.getKey())) collectText(entry.getValue(), texts);
            });
        }
    }

    private boolean metadataField(String field) {
        return List.of(
                "source",
                "confidence",
                "category",
                "reversible",
                "editable"
        ).contains(field);
    }
}
