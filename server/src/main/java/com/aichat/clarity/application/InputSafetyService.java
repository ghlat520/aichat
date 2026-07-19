package com.aichat.clarity.application;

import com.aichat.contract.ContractRequests;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;

@Component
public final class InputSafetyService {
    public static final String RULE_VERSION = "s1-prototype-2026-07-19";

    private static final List<MaskRule> MASK_RULES = List.of(
            new MaskRule("email", "[邮箱已遮蔽]", Pattern.compile(
                    "(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}")),
            new MaskRule("national_id", "[证件号已遮蔽]", Pattern.compile(
                    "(?<!\\d)(?:\\d{17}[0-9Xx]|\\d{15})(?!\\d)")),
            new MaskRule("bank_card", "[银行卡已遮蔽]", Pattern.compile(
                    "(?<!\\d)\\d{16,19}(?!\\d)")),
            new MaskRule("mobile_phone", "[手机号已遮蔽]", Pattern.compile(
                    "(?<!\\d)1[3-9]\\d{9}(?!\\d)")),
            new MaskRule("exact_address", "[地址已遮蔽]", Pattern.compile(
                    "(?:(?:北京|上海|天津|重庆)市|[\\p{IsHan}]{2,8}(?:省|自治区))?"
                            + "[\\p{IsHan}]{1,8}(?:市|州)?[\\p{IsHan}]{1,8}(?:区|县)"
                            + "[\\p{IsHan}A-Za-z0-9]{1,20}(?:路|街|道|巷)\\d{1,6}号")),
            new MaskRule("social_account", "[社交账号已遮蔽]", Pattern.compile(
                    "(?i)(?:微信号|微信|QQ号|QQ|小红书号|抖音号)[:：]?\\s*[a-z0-9_-]{5,32}"))
    );

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

    public MaskResult mask(ContractRequests.ClarityFields fields) {
        Set<String> codes = new LinkedHashSet<>();
        UnaryOperator<String> masker = value -> mask(value, codes);
        ContractRequests.ClarityFields masked = new ContractRequests.ClarityFields(
                fields.context(),
                masker.apply(fields.observedFact()),
                masker.apply(fields.interpretation()),
                fields.emotion().stream().map(masker).toList(),
                fields.needOrBoundary().stream().map(masker).toList(),
                masker.apply(fields.nextStepGoal())
        );
        return new MaskResult(masked, List.copyOf(codes));
    }

    public SafetyDecision assess(MaskResult masked) {
        ContractRequests.ClarityFields fields = masked.fields();
        String joined = String.join("\n",
                fields.observedFact(), fields.interpretation(),
                String.join(" ", fields.emotion()),
                String.join(" ", fields.needOrBoundary()),
                fields.nextStepGoal()).toLowerCase(Locale.ROOT);

        List<String> blocked = matches(BLOCK_RULES, joined);
        if (!blocked.isEmpty()) {
            return new SafetyDecision("BLOCK", blocked, RULE_VERSION, List.of("110", "120"));
        }
        List<String> clarify = matches(CLARIFY_RULES, joined);
        if (!clarify.isEmpty()) {
            return new SafetyDecision("CLARIFY", clarify, RULE_VERSION, List.of());
        }
        List<String> allowCategories = masked.maskCodes().isEmpty()
                ? List.of()
                : List.of("privacy_or_secret");
        return new SafetyDecision("ALLOW", allowCategories, RULE_VERSION, List.of());
    }

    private String mask(String input, Set<String> codes) {
        String result = input;
        for (MaskRule rule : MASK_RULES) {
            if (rule.pattern().matcher(result).find()) {
                codes.add(rule.code());
                result = rule.pattern().matcher(result).replaceAll(rule.replacement());
            }
        }
        return result;
    }

    private List<String> matches(List<CategoryRule> rules, String text) {
        List<String> categories = new ArrayList<>();
        for (CategoryRule rule : rules) {
            if (rule.pattern().matcher(text).find()) categories.add(rule.category());
        }
        return List.copyOf(categories);
    }

    private static CategoryRule rule(String category, String regex) {
        return new CategoryRule(category, Pattern.compile(regex, Pattern.CASE_INSENSITIVE));
    }

    public record MaskResult(ContractRequests.ClarityFields fields, List<String> maskCodes) {
    }

    public record SafetyDecision(
            String route,
            List<String> categories,
            String ruleVersion,
            List<String> resourceIds
    ) {
    }

    private record MaskRule(String code, String replacement, Pattern pattern) {
    }

    private record CategoryRule(String category, Pattern pattern) {
    }
}
