package com.aichat.kernel.feature;

import com.aichat.kernel.api.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public final class FeatureAvailability {
    private final boolean assessmentEnabled;
    private final boolean generationEnabled;
    private final boolean ventingEnabled;

    public FeatureAvailability(
            @Value("${aichat.features.assessment-enabled:false}") boolean assessmentEnabled,
            @Value("${aichat.features.generation-enabled:false}") boolean generationEnabled,
            @Value("${aichat.features.venting-enabled:false}") boolean ventingEnabled
    ) {
        this.assessmentEnabled = assessmentEnabled;
        this.generationEnabled = generationEnabled;
        this.ventingEnabled = ventingEnabled;
    }

    public boolean assessmentEnabled() {
        return assessmentEnabled;
    }

    public void requireAssessmentEnabled() {
        if (!assessmentEnabled) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "FEATURE_DISABLED",
                    "自测功能当前未开放"
            );
        }
    }

    public boolean generationEnabled() {
        return generationEnabled;
    }

    public void requireGenerationEnabled() {
        if (!generationEnabled) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "FEATURE_DISABLED",
                    "普通生成当前未开放"
            );
        }
    }

    public boolean ventingEnabled() {
        return ventingEnabled;
    }

    public void requireVentingEnabled() {
        if (!ventingEnabled) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "FEATURE_DISABLED",
                    "倾诉功能当前未开放"
            );
        }
    }
}
