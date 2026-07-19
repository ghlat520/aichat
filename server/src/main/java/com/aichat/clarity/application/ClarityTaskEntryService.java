package com.aichat.clarity.application;

import com.aichat.clarity.infrastructure.ClarityMapper;
import com.aichat.clarity.infrastructure.ClarityMapper.TaskRecord;
import com.aichat.clarity.port.AssessmentTaskEntryPort;
import com.aichat.kernel.identity.UlidGenerator;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public final class ClarityTaskEntryService implements AssessmentTaskEntryPort {
    private final ClarityMapper mapper;
    private final UlidGenerator ids;

    public ClarityTaskEntryService(ClarityMapper mapper, UlidGenerator ids) {
        this.mapper = mapper;
        this.ids = ids;
    }

    @Override
    public CreatedTask createFromAssessment(
            String ownerSubjectRef,
            String ownerAuthLevel,
            String context,
            int clarityPre,
            LocalDateTime now
    ) {
        TaskRecord task = new TaskRecord(
                ids.next(),
                ownerSubjectRef,
                ownerAuthLevel,
                "ASSESSMENT",
                context,
                "DRAFT",
                clarityPre,
                null,
                null,
                1,
                now,
                now,
                null
        );
        mapper.insertTask(task);
        return new CreatedTask(task.id(), task.state(), task.versionNo());
    }
}
