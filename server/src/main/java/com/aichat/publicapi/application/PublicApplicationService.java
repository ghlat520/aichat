package com.aichat.publicapi.application;

import com.aichat.kernel.api.ApiCallContext;
import com.aichat.kernel.api.ApiEnvelope;
import com.aichat.kernel.feature.FeatureAvailability;
import com.aichat.publicapi.api.PublicApiDelegate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public final class PublicApplicationService implements PublicApiDelegate {
    private final FeatureAvailability features;

    public PublicApplicationService(FeatureAvailability features) {
        this.features = features;
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getAppConfig(ApiCallContext context) {
        return ApiEnvelope.success(context.requestId(), Map.of(
                "product_code", "RELATIONSHIP_CLARITY_CARD_V1",
                "product_name", "关系清晰卡",
                "policy_version", "p0-alpha-2026-07-19",
                "adult_confirmation_required", true,
                "ai_disclosure", "由 AI 辅助整理，不是真人，不提供诊断、治疗、预测或重大决定",
                "entry_paths", entryPaths(),
                "feature_flags", Map.of(
                        "assessment", features.assessmentEnabled(),
                        "venting", features.ventingEnabled(),
                        "generation", features.generationEnabled(),
                        "payment", false,
                        "reminder", false
                )
        ));
    }

    private List<String> entryPaths() {
        List<String> paths = new ArrayList<>();
        paths.add("DIRECT");
        if (features.assessmentEnabled()) paths.add("ASSESSMENT");
        if (features.ventingEnabled()) paths.add("VENT");
        return List.copyOf(paths);
    }

    @Override
    public ApiEnvelope<Map<String, Object>> getSafetyResources(ApiCallContext context) {
        return ApiEnvelope.success(context.requestId(), Map.of(
                "version", "cn-mainland-2026-07-19",
                "notice", "本产品不是实时救援服务。如存在立即危险，请优先联系当地紧急服务或可信赖的现实支持者。",
                "resources", List.of(
                        Map.of("code", "110", "name", "公安报警服务", "route", "immediate_danger"),
                        Map.of("code", "120", "name", "医疗急救", "route", "medical_emergency"),
                        Map.of("code", "12356", "name", "全国统一心理援助热线", "route", "psychological_support")
                )
        ));
    }
}
