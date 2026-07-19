package com.aichat.clarity.port;

import java.time.LocalDateTime;

/** Public application boundary used by Assessment; no Clarity persistence type crosses this port. */
public interface AssessmentTaskEntryPort {
    CreatedTask createFromAssessment(
            String ownerSubjectRef,
            String ownerAuthLevel,
            String context,
            int clarityPre,
            LocalDateTime now
    );

    record CreatedTask(String taskId, String state, int version) {
    }
}
