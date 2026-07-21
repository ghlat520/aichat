package com.aichat.clarity.port;

import java.time.LocalDateTime;
import java.util.List;

/** Clarity-owned command boundary used after a user confirms a Vent summary. */
public interface VentTaskEntryPort {
    CreatedVentTask createFromVent(
            String ownerSubjectRef,
            String ownerAuthLevel,
            VentFields fields,
            LocalDateTime now
    );

    CreatedVentTask loadCreatedVentTask(String ownerSubjectRef, String taskId, int taskVersion);

    record VentFields(
            String context,
            String observedFact,
            String loopingThought,
            List<String> emotion,
            List<String> needOrBoundary,
            String currentGoal,
            int clarityPre
    ) {
    }

    record CreatedVentTask(
            String taskId,
            String state,
            int taskVersion,
            String contentVersion
    ) {
    }
}
