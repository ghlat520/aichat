package com.aichat.kernel.feature;

import com.aichat.kernel.api.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public final class FeatureAvailability {
    private final boolean assessmentEnabled;

    public FeatureAvailability(
            @Value("${aichat.features.assessment-enabled:false}") boolean assessmentEnabled
    ) {
        this.assessmentEnabled = assessmentEnabled;
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
}
