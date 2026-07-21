package com.aichat.safety.infrastructure;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SafetyEvidenceMapper {
    @Insert("""
            INSERT INTO sf_safety_evidence (
                id, owner_subject_ref, source_type, source_id, checkpoint, route,
                categories_json, mask_codes_json, rule_version, resource_ids_json, created_at
            ) VALUES (
                #{id}, #{ownerSubjectRef}, #{sourceType}, #{sourceId}, #{checkpoint}, #{route},
                #{categoriesJson}, #{maskCodesJson}, #{ruleVersion}, #{resourceIdsJson}, #{createdAt}
            )
            """)
    int insertEvidence(EvidenceRecord evidence);

    @Insert("""
            INSERT INTO sf_safety_review_case (
                id, evidence_id, priority, status, version_no,
                decision, reason_hash, ticket_hash, reviewer_subject_ref,
                created_at, resolved_at, updated_at
            ) VALUES (
                #{id}, #{evidenceId}, #{priority}, #{status}, #{versionNo},
                #{decision}, #{reasonHash}, #{ticketHash}, #{reviewerSubjectRef},
                #{createdAt}, #{resolvedAt}, #{updatedAt}
            )
            """)
    int insertCase(ReviewCaseRecord reviewCase);

    @Select("""
            SELECT c.id, c.evidence_id, c.priority, c.status, c.version_no,
                   c.decision, c.reason_hash, c.ticket_hash, c.reviewer_subject_ref,
                   c.created_at, c.resolved_at, c.updated_at,
                   e.owner_subject_ref, e.source_type, e.source_id, e.checkpoint, e.route,
                   e.categories_json, e.mask_codes_json, e.rule_version, e.resource_ids_json,
                   e.created_at AS evidence_created_at
              FROM sf_safety_review_case c
              JOIN sf_safety_evidence e ON e.id = c.evidence_id
             WHERE c.id = #{id}
            """)
    ReviewCaseView findCase(String id);

    @Select("""
            <script>
            SELECT c.id, c.evidence_id, c.priority, c.status, c.version_no,
                   c.decision, c.reason_hash, c.ticket_hash, c.reviewer_subject_ref,
                   c.created_at, c.resolved_at, c.updated_at,
                   e.owner_subject_ref, e.source_type, e.source_id, e.checkpoint, e.route,
                   e.categories_json, e.mask_codes_json, e.rule_version, e.resource_ids_json,
                   e.created_at AS evidence_created_at
              FROM sf_safety_review_case c
              JOIN sf_safety_evidence e ON e.id = c.evidence_id
             WHERE c.status = #{status}
               <if test='route != null'>AND e.route = #{route}</if>
               <if test='cursor != null'>AND c.id &lt; #{cursor}</if>
             ORDER BY c.id DESC
             LIMIT #{limit}
            </script>
            """)
    List<ReviewCaseView> listCases(
            @Param("status") String status,
            @Param("route") String route,
            @Param("cursor") String cursor,
            @Param("limit") int limit
    );

    @Update("""
            UPDATE sf_safety_review_case
               SET status = 'RESOLVED',
                   version_no = version_no + 1,
                   decision = #{decision},
                   reason_hash = #{reasonHash},
                   ticket_hash = #{ticketHash},
                   reviewer_subject_ref = #{reviewer},
                   resolved_at = #{now},
                   updated_at = #{now}
             WHERE id = #{id}
               AND status = 'OPEN'
               AND version_no = #{expectedVersion}
            """)
    int resolveCase(
            @Param("id") String id,
            @Param("expectedVersion") int expectedVersion,
            @Param("decision") String decision,
            @Param("reasonHash") String reasonHash,
            @Param("ticketHash") String ticketHash,
            @Param("reviewer") String reviewer,
            @Param("now") LocalDateTime now
    );

    @Insert("""
            INSERT INTO sf_safety_review_command_dedup (
                command_scope, actor_subject_ref, idempotency_key_hash, request_hash,
                case_id, result_version, created_at, expires_at
            ) VALUES (
                #{commandScope}, #{actorSubjectRef}, #{idempotencyKeyHash}, #{requestHash},
                #{caseId}, #{resultVersion}, #{createdAt}, #{expiresAt}
            )
            """)
    int insertCommand(ReviewCommandRecord command);

    @Select("""
            SELECT command_scope, actor_subject_ref, idempotency_key_hash, request_hash,
                   case_id, result_version, created_at, expires_at
              FROM sf_safety_review_command_dedup
             WHERE command_scope = #{scope}
               AND actor_subject_ref = #{actor}
               AND idempotency_key_hash = #{keyHash}
               AND expires_at > #{now}
            """)
    ReviewCommandRecord findCommand(
            @Param("scope") String scope,
            @Param("actor") String actor,
            @Param("keyHash") String keyHash,
            @Param("now") LocalDateTime now
    );

    @Delete("""
            DELETE FROM sf_safety_review_command_dedup
             WHERE command_scope = #{scope}
               AND actor_subject_ref = #{actor}
               AND idempotency_key_hash = #{keyHash}
               AND expires_at <= #{now}
            """)
    int deleteExpiredCommand(
            @Param("scope") String scope,
            @Param("actor") String actor,
            @Param("keyHash") String keyHash,
            @Param("now") LocalDateTime now
    );

    @Delete("DELETE FROM sf_safety_review_command_dedup WHERE expires_at <= #{now}")
    int deleteExpiredCommands(LocalDateTime now);

    record EvidenceRecord(
            String id,
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            String checkpoint,
            String route,
            String categoriesJson,
            String maskCodesJson,
            String ruleVersion,
            String resourceIdsJson,
            LocalDateTime createdAt
    ) {
    }

    record ReviewCaseRecord(
            String id,
            String evidenceId,
            String priority,
            String status,
            int versionNo,
            String decision,
            String reasonHash,
            String ticketHash,
            String reviewerSubjectRef,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt,
            LocalDateTime updatedAt
    ) {
    }

    record ReviewCaseView(
            String id,
            String evidenceId,
            String priority,
            String status,
            int versionNo,
            String decision,
            String reasonHash,
            String ticketHash,
            String reviewerSubjectRef,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt,
            LocalDateTime updatedAt,
            String ownerSubjectRef,
            String sourceType,
            String sourceId,
            String checkpoint,
            String route,
            String categoriesJson,
            String maskCodesJson,
            String ruleVersion,
            String resourceIdsJson,
            LocalDateTime evidenceCreatedAt
    ) {
    }

    record ReviewCommandRecord(
            String commandScope,
            String actorSubjectRef,
            String idempotencyKeyHash,
            String requestHash,
            String caseId,
            int resultVersion,
            LocalDateTime createdAt,
            LocalDateTime expiresAt
    ) {
    }
}
