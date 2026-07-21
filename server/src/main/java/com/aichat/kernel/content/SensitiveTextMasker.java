package com.aichat.kernel.content;

import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Shared, deterministic PII masking mechanism. It has no domain routing policy. */
@Component
public final class SensitiveTextMasker {
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

    public MaskedTexts mask(List<String> texts) {
        Set<String> codes = new LinkedHashSet<>();
        List<String> masked = texts.stream().map(value -> maskOne(value, codes)).toList();
        return new MaskedTexts(masked, List.copyOf(codes));
    }

    private String maskOne(String input, Set<String> codes) {
        String result = input;
        for (MaskRule rule : MASK_RULES) {
            if (rule.pattern().matcher(result).find()) {
                codes.add(rule.code());
                result = rule.pattern().matcher(result).replaceAll(rule.replacement());
            }
        }
        return result;
    }

    public record MaskedTexts(List<String> values, List<String> maskCodes) {
        public MaskedTexts {
            values = List.copyOf(values);
            maskCodes = List.copyOf(maskCodes);
        }
    }

    private record MaskRule(String code, String replacement, Pattern pattern) {
    }
}
