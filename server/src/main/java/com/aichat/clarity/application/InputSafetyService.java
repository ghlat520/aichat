package com.aichat.clarity.application;

import com.aichat.contract.ContractRequests;
import com.aichat.kernel.content.SensitiveTextMasker;
import com.aichat.safety.application.SafetyPolicyEngine;
import com.aichat.safety.application.SafetyPolicyEngine.Checkpoint;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public final class InputSafetyService {
    private final SafetyPolicyEngine policy;
    private final SensitiveTextMasker masker;

    public InputSafetyService(SafetyPolicyEngine policy, SensitiveTextMasker masker) {
        this.policy = policy;
        this.masker = masker;
    }

    public MaskResult mask(ContractRequests.ClarityFields fields) {
        List<String> inputs = new ArrayList<>();
        inputs.add(fields.observedFact());
        inputs.add(fields.interpretation());
        int emotionStart = inputs.size();
        inputs.addAll(fields.emotion());
        int boundaryStart = inputs.size();
        inputs.addAll(fields.needOrBoundary());
        int goalIndex = inputs.size();
        inputs.add(fields.nextStepGoal());

        SensitiveTextMasker.MaskedTexts maskedTexts = masker.mask(inputs);
        List<String> values = maskedTexts.values();
        ContractRequests.ClarityFields masked = new ContractRequests.ClarityFields(
                fields.context(),
                values.get(0),
                values.get(1),
                List.copyOf(values.subList(emotionStart, boundaryStart)),
                List.copyOf(values.subList(boundaryStart, goalIndex)),
                values.get(goalIndex)
        );
        return new MaskResult(masked, maskedTexts.maskCodes());
    }

    public MaskedTexts maskTexts(List<String> texts) {
        SensitiveTextMasker.MaskedTexts masked = masker.mask(texts);
        return new MaskedTexts(masked.values(), masked.maskCodes());
    }

    public SafetyDecision assess(MaskResult masked) {
        ContractRequests.ClarityFields fields = masked.fields();
        String joined = String.join("\n",
                fields.observedFact(), fields.interpretation(),
                String.join(" ", fields.emotion()),
                String.join(" ", fields.needOrBoundary()),
                fields.nextStepGoal());

        return assessJoined(joined, masked.maskCodes());
    }

    public SafetyDecision assess(MaskedTexts masked) {
        return assessJoined(String.join("\n", masked.values()), masked.maskCodes());
    }

    private SafetyDecision assessJoined(String joined, List<String> maskCodes) {
        SafetyPolicyEngine.Decision decision = policy.assess(
                Checkpoint.S1_INPUT,
                List.of(joined),
                maskCodes
        );
        return new SafetyDecision(
                decision.route(),
                decision.categories(),
                decision.ruleVersion(),
                decision.resourceIds()
        );
    }

    public record MaskResult(ContractRequests.ClarityFields fields, List<String> maskCodes) {
    }

    public record MaskedTexts(List<String> values, List<String> maskCodes) {
    }

    public record SafetyDecision(
            String route,
            List<String> categories,
            String ruleVersion,
            List<String> resourceIds
    ) {
    }
}
