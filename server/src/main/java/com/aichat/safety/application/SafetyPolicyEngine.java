package com.aichat.safety.application;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Versioned, deterministic safety policy shared by every P0 entry path.
 * It returns metadata only and never retains or exposes evaluated text.
 */
@Component
public final class SafetyPolicyEngine {
    public static final String RULE_VERSION = "safety-policy-prototype-2026-07-19";

    private static final List<CategoryRule> BLOCK_RULES = List.of(
            rule("self_harm", "自杀|自残|不想活|结束生命"),
            rule("harm_to_others", "杀了(?:他|她|人)|杀人|伤害别人|弄死"),
            rule("immediate_danger", "拿着刀|持刀|马上.{0,8}(?:伤害|危险)|现在.{0,12}(?:威胁|堵住|持刀)"),
            rule("relationship_violence", "家暴|殴打|打我|掐住|堵住门|限制.{0,8}离开"),
            rule("stalking_or_coercion", "跟踪|尾随|监视|控制我|不让我离开"),
            rule("sexual_coercion", "强奸|性侵|强迫.{0,8}(?:性|发生关系)|不愿意.{0,8}(?:性|发生关系)"),
            rule("fraud_or_blackmail", "勒索|诈骗|敲诈|裸照.{0,12}威胁"),
            rule("prompt_injection", "忽略.{0,12}(?:指令|规则)|system prompt|系统提示词|越权指令"),
            rule("unauthorized_access", "破解|入侵|窃取.{0,8}密码|偷看.{0,8}账号")
    );

    private static final List<CategoryRule> CLARIFY_RULES = List.of(
            rule("clinical_request", "诊断|人格障碍|抑郁症|精神病"),
            rule("prediction_or_mind_reading", "预测|会不会复合|他是不是|她是不是|读心|一定会"),
            rule("financial_decision", "转账|汇款|借钱|投资|买股票"),
            rule("legal_request", "起诉|法律|律师|离婚协议|要不要报警"),
            rule("dependency_request", "只相信你|只有你能|不要让我离开")
    );

    public Decision assess(Checkpoint checkpoint, List<String> maskedTexts, List<String> maskCodes) {
        Checkpoint effectiveCheckpoint = checkpoint == null ? Checkpoint.S1_INPUT : checkpoint;
        if (checkpoint == null
                || maskedTexts == null
                || maskedTexts.isEmpty()
                || maskedTexts.stream().anyMatch(value -> value == null)
                || maskedTexts.stream().allMatch(this::blank)) {
            return new Decision(
                    effectiveCheckpoint,
                    "BLOCK",
                    List.of("safety_input_missing"),
                    RULE_VERSION,
                    List.of()
            );
        }
        String joined = String.join("\n", maskedTexts).toLowerCase(Locale.ROOT);
        List<String> blocked = matches(BLOCK_RULES, joined);
        if (!blocked.isEmpty()) {
            return new Decision(
                    checkpoint,
                    "BLOCK",
                    blocked,
                    RULE_VERSION,
                    resourcesFor(blocked)
            );
        }
        List<String> clarify = matches(CLARIFY_RULES, joined);
        if (!clarify.isEmpty()) {
            return new Decision(checkpoint, "CLARIFY", clarify, RULE_VERSION, List.of());
        }
        List<String> allowCategories = maskCodes == null || maskCodes.isEmpty()
                ? List.of()
                : List.of("privacy_or_secret");
        return new Decision(checkpoint, "ALLOW", allowCategories, RULE_VERSION, List.of());
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private List<String> matches(List<CategoryRule> rules, String text) {
        List<String> categories = new ArrayList<>();
        for (CategoryRule rule : rules) {
            if (rule.pattern().matcher(text).find()) categories.add(rule.category());
        }
        return List.copyOf(categories);
    }

    private List<String> resourcesFor(List<String> categories) {
        Set<String> resources = new LinkedHashSet<>();
        if (categories.contains("self_harm")) {
            resources.add("120");
            resources.add("12356");
        }
        if (categories.stream().anyMatch(category -> List.of(
                "harm_to_others",
                "immediate_danger",
                "relationship_violence",
                "stalking_or_coercion",
                "sexual_coercion",
                "fraud_or_blackmail"
        ).contains(category))) {
            resources.add("110");
        }
        if (categories.stream().anyMatch(category -> List.of(
                "immediate_danger",
                "relationship_violence",
                "sexual_coercion"
        ).contains(category))) {
            resources.add("120");
        }
        return List.copyOf(resources);
    }

    private static CategoryRule rule(String category, String regex) {
        return new CategoryRule(category, Pattern.compile(regex, Pattern.CASE_INSENSITIVE));
    }

    public enum Checkpoint {
        S1_INPUT,
        S2_PRE_GENERATION,
        S3_OUTPUT
    }

    public record Decision(
            Checkpoint checkpoint,
            String route,
            List<String> categories,
            String ruleVersion,
            List<String> resourceIds
    ) {
        public Decision {
            categories = List.copyOf(categories);
            resourceIds = List.copyOf(resourceIds);
        }
    }

    private record CategoryRule(String category, Pattern pattern) {
    }
}
