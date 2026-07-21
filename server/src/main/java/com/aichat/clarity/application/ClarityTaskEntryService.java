package com.aichat.clarity.application;

import com.aichat.clarity.infrastructure.ClarityMapper;
import com.aichat.clarity.infrastructure.ClarityMapper.ContentRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.SafetyRecord;
import com.aichat.clarity.infrastructure.ClarityMapper.TaskRecord;
import com.aichat.clarity.port.AssessmentTaskEntryPort;
import com.aichat.clarity.port.VentTaskEntryPort;
import com.aichat.contract.ContractRequests;
import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.content.EnvelopeEncryptionService;
import com.aichat.kernel.content.EnvelopeEncryptionService.ContentCryptoException;
import com.aichat.kernel.content.EnvelopeEncryptionService.EncryptedPayload;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.safety.application.SafetyEvidenceRecorder;
import com.aichat.safety.application.SafetyEvidenceRecorder.DecisionData;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public final class ClarityTaskEntryService implements AssessmentTaskEntryPort, VentTaskEntryPort {
    private final ClarityMapper mapper;
    private final UlidGenerator ids;
    private final InputSafetyService safety;
    private final EnvelopeEncryptionService encryption;
    private final ObjectMapper objectMapper;
    private final SafetyEvidenceRecorder safetyEvidence;

    public ClarityTaskEntryService(
            ClarityMapper mapper,
            UlidGenerator ids,
            InputSafetyService safety,
            EnvelopeEncryptionService encryption,
            ObjectMapper objectMapper,
            SafetyEvidenceRecorder safetyEvidence
    ) {
        this.mapper = mapper;
        this.ids = ids;
        this.safety = safety;
        this.encryption = encryption;
        this.objectMapper = objectMapper;
        this.safetyEvidence = safetyEvidence;
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
                null,
                null,
                0,
                0,
                1,
                now,
                now,
                null
        );
        mapper.insertTask(task);
        return new CreatedTask(task.id(), task.state(), task.versionNo());
    }

    @Override
    public CreatedVentTask createFromVent(
            String ownerSubjectRef,
            String ownerAuthLevel,
            VentFields fields,
            LocalDateTime now
    ) {
        ContractRequests.ClarityFields requested = new ContractRequests.ClarityFields(
                fields.context(),
                fields.observedFact(),
                fields.loopingThought(),
                fields.emotion(),
                fields.needOrBoundary(),
                fields.currentGoal()
        );
        InputSafetyService.MaskResult masked = safety.mask(requested);
        InputSafetyService.SafetyDecision decision = safety.assess(masked);
        if (!"ALLOW".equals(decision.route())) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VENT_SUMMARY_SAFETY_REJECTED",
                    "确认总结未通过普通关系任务安全检查",
                    false,
                    Map.of(
                            "route", decision.route(),
                            "categories", decision.categories(),
                            "rule_version", decision.ruleVersion(),
                            "resource_ids", decision.resourceIds()
                    )
            );
        }

        String taskId = ids.next();
        TaskRecord task = new TaskRecord(
                taskId,
                ownerSubjectRef,
                ownerAuthLevel,
                "VENT",
                fields.context(),
                "DRAFT",
                fields.clarityPre(),
                null,
                null,
                null,
                null,
                0,
                0,
                1,
                now,
                now,
                null
        );
        mapper.insertTask(task);

        String contentId = ids.next();
        String assessmentId = ids.next();
        EncryptedPayload encrypted = encrypt(contentId, serialize(masked.fields()));
        mapper.insertContent(new ContentRecord(
                contentId,
                taskId,
                "SIX_FIELDS",
                2,
                "DRAFT",
                encrypted.ciphertext(),
                encrypted.contentNonce(),
                encrypted.wrappedDek(),
                encrypted.wrapNonce(),
                encrypted.keyVersion(),
                encrypted.contentHash(),
                now
        ));
        mapper.insertSafety(new SafetyRecord(
                assessmentId,
                taskId,
                contentId,
                "S1",
                decision.route(),
                serializeList(decision.categories()),
                serializeList(masked.maskCodes()),
                decision.ruleVersion(),
                serializeList(decision.resourceIds()),
                now
        ));
        safetyEvidence.recordInline(
                ownerSubjectRef,
                "CLARITY_CONTENT",
                contentId,
                new DecisionData(
                        "S1_INPUT",
                        decision.route(),
                        decision.categories(),
                        masked.maskCodes(),
                        decision.ruleVersion(),
                        decision.resourceIds()
                ),
                now
        );
        if (mapper.updateCurrentContent(
                taskId,
                ownerSubjectRef,
                1,
                "FIELDS_SAVED",
                contentId,
                assessmentId,
                now
        ) != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "VERSION_CONFLICT", "关系任务版本已经变化");
        }
        return new CreatedVentTask(taskId, "FIELDS_SAVED", 2, contentId);
    }

    @Override
    public CreatedVentTask loadCreatedVentTask(
            String ownerSubjectRef,
            String taskId,
            int taskVersion
    ) {
        TaskRecord task = mapper.findTask(taskId);
        ContentRecord content = mapper.findFieldsContentByTaskAndVersion(taskId, taskVersion);
        if (task == null
                || !ownerSubjectRef.equals(task.ownerSubjectRef())
                || !"VENT".equals(task.entryType())
                || task.deletedAt() != null
                || task.versionNo() < taskVersion
                || content == null) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "VENT_TASK_STATE_CORRUPTED",
                    "倾诉映射任务状态异常"
            );
        }
        return new CreatedVentTask(
                task.id(), "FIELDS_SAVED", taskVersion, content.id());
    }

    private byte[] serialize(Object value) {
        try {
            return objectMapper.writeValueAsBytes(value);
        } catch (JsonProcessingException exception) {
            throw contentUnavailable();
        }
    }

    private String serializeList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw contentUnavailable();
        }
    }

    private EncryptedPayload encrypt(String contentId, byte[] plaintext) {
        try {
            return encryption.encrypt(contentId, plaintext);
        } catch (ContentCryptoException exception) {
            throw contentUnavailable();
        }
    }

    private ApiException contentUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CONTENT_SECURITY_UNAVAILABLE",
                "内容安全服务暂时不可用",
                true,
                Map.of()
        );
    }
}
