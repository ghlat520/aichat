package com.aichat.safety.application;

import com.aichat.kernel.api.ApiException;
import com.aichat.kernel.identity.UlidGenerator;
import com.aichat.safety.application.SafetyPolicyEngine.Decision;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper.EvidenceRecord;
import com.aichat.safety.infrastructure.SafetyEvidenceMapper.ReviewCaseRecord;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public final class SafetyEvidenceRecorder {
    private final SafetyEvidenceMapper mapper;
    private final UlidGenerator ids;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate independentTransaction;

    public SafetyEvidenceRecorder(
            SafetyEvidenceMapper mapper,
            UlidGenerator ids,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager
    ) {
        this.mapper = mapper;
        this.ids = ids;
        this.objectMapper = objectMapper;
        this.independentTransaction = new TransactionTemplate(transactionManager);
        this.independentTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public EvidenceReceipt recordInline(
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            Decision decision,
            List<String> maskCodes,
            LocalDateTime now
    ) {
        return record(ownerSubjectRef, sourceType, sourceId, DecisionData.from(decision, maskCodes), now);
    }

    public EvidenceReceipt recordInline(
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            DecisionData decision,
            LocalDateTime now
    ) {
        return record(ownerSubjectRef, sourceType, sourceId, decision, now);
    }

    public EvidenceReceipt recordIndependent(
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            Decision decision,
            List<String> maskCodes,
            LocalDateTime now
    ) {
        return independentTransaction.execute(status -> recordInline(
                ownerSubjectRef, sourceType, sourceId, decision, maskCodes, now));
    }

    public EvidenceReceipt recordIndependent(
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            DecisionData decision,
            LocalDateTime now
    ) {
        return independentTransaction.execute(status -> recordInline(
                ownerSubjectRef, sourceType, sourceId, decision, now));
    }

    private EvidenceReceipt record(
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            DecisionData decision,
            LocalDateTime now
    ) {
        String evidenceId = ids.next();
        mapper.insertEvidence(new EvidenceRecord(
                evidenceId,
                ownerSubjectRef,
                sourceType,
                sourceId,
                decision.checkpoint(),
                decision.route(),
                serialize(decision.categories()),
                serialize(decision.maskCodes()),
                decision.ruleVersion(),
                serialize(decision.resourceIds()),
                now
        ));
        String caseId = null;
        if (!"ALLOW".equals(decision.route())) {
            caseId = ids.next();
            mapper.insertCase(new ReviewCaseRecord(
                    caseId,
                    evidenceId,
                    "BLOCK".equals(decision.route()) ? "CRITICAL" : "BOUNDARY",
                    "OPEN",
                    1,
                    null,
                    null,
                    null,
                    null,
                    now,
                    null,
                    now
            ));
        }
        return new EvidenceReceipt(evidenceId, caseId);
    }

    private String serialize(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values == null ? List.of() : values);
        } catch (JsonProcessingException exception) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "SAFETY_EVIDENCE_UNAVAILABLE",
                    "安全证据服务暂时不可用",
                    true,
                    Map.of()
            );
        }
    }

    public record DecisionData(
            String checkpoint,
            String route,
            List<String> categories,
            List<String> maskCodes,
            String ruleVersion,
            List<String> resourceIds
    ) {
        public DecisionData {
            categories = List.copyOf(categories == null ? List.of() : categories);
            maskCodes = List.copyOf(maskCodes == null ? List.of() : maskCodes);
            resourceIds = List.copyOf(resourceIds == null ? List.of() : resourceIds);
        }

        public static DecisionData from(Decision decision, List<String> maskCodes) {
            return new DecisionData(
                    decision.checkpoint().name(),
                    decision.route(),
                    decision.categories(),
                    maskCodes,
                    decision.ruleVersion(),
                    decision.resourceIds()
            );
        }
    }

    public record EvidenceReceipt(String evidenceId, String reviewCaseId) {
    }
}
