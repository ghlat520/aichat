package com.aichat.clarity.infrastructure;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface ClarityMapper {

    @Insert("""
            INSERT INTO ct_clarity_task (
                id, owner_subject_ref, owner_auth_level, entry_type, context_code, state,
                clarity_pre, current_content_version_id, current_safety_assessment_id,
                version_no, created_at, updated_at, deleted_at
            ) VALUES (
                #{id}, #{ownerSubjectRef}, #{ownerAuthLevel}, #{entryType}, #{contextCode}, #{state},
                #{clarityPre}, #{currentContentVersionId}, #{currentSafetyAssessmentId},
                #{versionNo}, #{createdAt}, #{updatedAt}, #{deletedAt}
            )
            """)
    int insertTask(TaskRecord task);

    @Select("""
            SELECT id, owner_subject_ref, owner_auth_level, entry_type, context_code, state,
                   clarity_pre, current_content_version_id, current_safety_assessment_id,
                   version_no, created_at, updated_at, deleted_at
              FROM ct_clarity_task
             WHERE id = #{id}
            """)
    TaskRecord findTask(String id);

    @Update("""
            UPDATE ct_clarity_task
               SET state = #{state},
                   current_content_version_id = #{contentVersionId},
                   current_safety_assessment_id = #{safetyAssessmentId},
                   version_no = version_no + 1,
                   updated_at = #{updatedAt}
             WHERE id = #{taskId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND version_no = #{expectedVersion}
               AND state IN ('DRAFT', 'FIELDS_SAVED', 'SAFETY_CLARIFICATION_REQUIRED')
               AND deleted_at IS NULL
            """)
    int updateCurrentContent(
            @Param("taskId") String taskId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("state") String state,
            @Param("contentVersionId") String contentVersionId,
            @Param("safetyAssessmentId") String safetyAssessmentId,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Insert("""
            INSERT INTO ct_content_version (
                id, task_id, content_type, version_no, confirmation_state,
                ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                key_version, content_hash, created_at
            ) VALUES (
                #{id}, #{taskId}, #{contentType}, #{versionNo}, #{confirmationState},
                #{ciphertext}, #{contentNonce}, #{wrappedDek}, #{wrapNonce},
                #{keyVersion}, #{contentHash}, #{createdAt}
            )
            """)
    int insertContent(ContentRecord content);

    @Select("""
            SELECT id, task_id, content_type, version_no, confirmation_state,
                   ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                   key_version, content_hash, created_at
              FROM ct_content_version
             WHERE id = #{id}
            """)
    ContentRecord findContent(String id);

    @Insert("""
            INSERT INTO ct_safety_assessment (
                id, task_id, content_version_id, checkpoint, route,
                categories_json, mask_codes_json, rule_version, resource_ids_json, created_at
            ) VALUES (
                #{id}, #{taskId}, #{contentVersionId}, #{checkpoint}, #{route},
                #{categoriesJson}, #{maskCodesJson}, #{ruleVersion}, #{resourceIdsJson}, #{createdAt}
            )
            """)
    int insertSafety(SafetyRecord safety);

    @Select("""
            SELECT id, task_id, content_version_id, checkpoint, route,
                   categories_json, mask_codes_json, rule_version, resource_ids_json, created_at
              FROM ct_safety_assessment
             WHERE content_version_id = #{contentVersionId}
               AND checkpoint = 'S1'
            """)
    SafetyRecord findSafetyByContent(String contentVersionId);

    @Insert("""
            INSERT INTO ct_command_dedup (
                command_scope, owner_subject_ref, idempotency_key_hash, request_hash,
                resource_id, result_version, created_at, expires_at
            ) VALUES (
                #{commandScope}, #{ownerSubjectRef}, #{idempotencyKeyHash}, #{requestHash},
                #{resourceId}, #{resultVersion}, #{createdAt}, #{expiresAt}
            )
            """)
    int insertCommand(CommandRecord command);

    @Select("""
            SELECT command_scope, owner_subject_ref, idempotency_key_hash, request_hash,
                   resource_id, result_version, created_at, expires_at
              FROM ct_command_dedup
             WHERE command_scope = #{scope}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND idempotency_key_hash = #{keyHash}
            """)
    CommandRecord findCommand(
            @Param("scope") String scope,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("keyHash") String keyHash
    );

    record TaskRecord(
            String id,
            String ownerSubjectRef,
            String ownerAuthLevel,
            String entryType,
            String contextCode,
            String state,
            int clarityPre,
            String currentContentVersionId,
            String currentSafetyAssessmentId,
            int versionNo,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            LocalDateTime deletedAt
    ) {
    }

    record ContentRecord(
            String id,
            String taskId,
            String contentType,
            int versionNo,
            String confirmationState,
            byte[] ciphertext,
            byte[] contentNonce,
            byte[] wrappedDek,
            byte[] wrapNonce,
            String keyVersion,
            String contentHash,
            LocalDateTime createdAt
    ) {
    }

    record SafetyRecord(
            String id,
            String taskId,
            String contentVersionId,
            String checkpoint,
            String route,
            String categoriesJson,
            String maskCodesJson,
            String ruleVersion,
            String resourceIdsJson,
            LocalDateTime createdAt
    ) {
    }

    record CommandRecord(
            String commandScope,
            String ownerSubjectRef,
            String idempotencyKeyHash,
            String requestHash,
            String resourceId,
            int resultVersion,
            LocalDateTime createdAt,
            LocalDateTime expiresAt
    ) {
    }
}
