package com.aichat.clarity.port;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Read/transition boundary exposed by Clarity to Report. Persistence records and encrypted blobs
 * remain private to Clarity; Report receives only the confirmed in-memory projection it needs.
 */
public interface ReportTaskSourcePort {
    ReportTaskSnapshot loadConfirmedReportInput(
            String ownerSubjectRef,
            String taskId,
            int expectedTaskVersion,
            String confirmedContentVersion,
            List<String> reflectionVersions
    );

    int markReportReady(
            String ownerSubjectRef,
            String taskId,
            int expectedTaskVersion,
            LocalDateTime updatedAt
    );

    record ReportTaskSnapshot(
            String taskId,
            String context,
            int taskVersion,
            List<String> confirmedFacts,
            List<String> unknownsToVerify,
            List<String> emotions,
            List<String> needsOrBoundaries,
            String selfExecutableGoal,
            String inputFingerprint
    ) {
    }
}
