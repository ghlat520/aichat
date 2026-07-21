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
                current_mirror_version_id, confirmed_content_version_id,
                mirror_regeneration_count, reflection_count,
                version_no, created_at, updated_at, deleted_at
            ) VALUES (
                #{id}, #{ownerSubjectRef}, #{ownerAuthLevel}, #{entryType}, #{contextCode}, #{state},
                #{clarityPre}, #{currentContentVersionId}, #{currentSafetyAssessmentId},
                #{currentMirrorVersionId}, #{confirmedContentVersionId},
                #{mirrorRegenerationCount}, #{reflectionCount},
                #{versionNo}, #{createdAt}, #{updatedAt}, #{deletedAt}
            )
            """)
    int insertTask(TaskRecord task);

    @Select("""
            SELECT id, owner_subject_ref, owner_auth_level, entry_type, context_code, state,
                   clarity_pre, current_content_version_id, current_safety_assessment_id,
                   current_mirror_version_id, confirmed_content_version_id,
                   mirror_regeneration_count, reflection_count,
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

    @Update("""
            UPDATE ct_clarity_task
               SET state = 'MIRROR_REVIEW',
                   current_mirror_version_id = #{mirrorVersionId},
                   mirror_regeneration_count = mirror_regeneration_count
                       + CASE WHEN state = 'MIRROR_REVIEW' THEN 1 ELSE 0 END,
                   version_no = version_no + 1,
                   updated_at = #{updatedAt}
             WHERE id = #{taskId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND version_no = #{expectedVersion}
               AND (
                    state = 'FIELDS_SAVED'
                    OR (state = 'MIRROR_REVIEW' AND mirror_regeneration_count < 1)
               )
               AND deleted_at IS NULL
            """)
    int moveToMirrorReview(
            @Param("taskId") String taskId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("mirrorVersionId") String mirrorVersionId,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Update("""
            UPDATE ct_clarity_task
               SET state = 'REFLECTION',
                   confirmed_content_version_id = #{confirmedContentVersionId},
                   reflection_count = 0,
                   version_no = version_no + 1,
                   updated_at = #{updatedAt}
             WHERE id = #{taskId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND version_no = #{expectedVersion}
               AND state = 'MIRROR_REVIEW'
               AND current_mirror_version_id = #{currentMirrorVersionId}
               AND confirmed_content_version_id IS NULL
               AND deleted_at IS NULL
            """)
    int confirmMirror(
            @Param("taskId") String taskId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("currentMirrorVersionId") String currentMirrorVersionId,
            @Param("confirmedContentVersionId") String confirmedContentVersionId,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Update("""
            UPDATE ct_clarity_task
               SET reflection_count = reflection_count + 1,
                   version_no = version_no + 1,
                   updated_at = #{updatedAt}
             WHERE id = #{taskId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND version_no = #{expectedVersion}
               AND state = 'REFLECTION'
               AND reflection_count = #{expectedReflectionCount}
               AND confirmed_content_version_id IS NOT NULL
               AND deleted_at IS NULL
            """)
    int advanceReflection(
            @Param("taskId") String taskId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("expectedReflectionCount") int expectedReflectionCount,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Update("""
            UPDATE ct_clarity_task
               SET state = 'REPORT_READY',
                   version_no = version_no + 1,
                   updated_at = #{updatedAt}
             WHERE id = #{taskId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND version_no = #{expectedVersion}
               AND state = 'REFLECTION'
               AND reflection_count = 2
               AND deleted_at IS NULL
            """)
    int markReportReady(
            @Param("taskId") String taskId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
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

    @Select("""
            SELECT id, task_id, content_type, version_no, confirmation_state,
                   ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                   key_version, content_hash, created_at
              FROM ct_content_version
             WHERE task_id = #{taskId}
               AND version_no = #{versionNo}
               AND content_type = 'SIX_FIELDS'
            """)
    ContentRecord findFieldsContentByTaskAndVersion(
            @Param("taskId") String taskId,
            @Param("versionNo") int versionNo
    );

    @Insert("""
            INSERT INTO ct_task_reflection (id, task_id, round_no, content_version_id, created_at)
            VALUES (#{id}, #{taskId}, #{roundNo}, #{contentVersionId}, #{createdAt})
            """)
    int insertReflection(ReflectionRecord reflection);

    @Select("""
            SELECT id, task_id, round_no, content_version_id, created_at
              FROM ct_task_reflection
             WHERE task_id = #{taskId} AND round_no = #{roundNo}
            """)
    ReflectionRecord findReflection(
            @Param("taskId") String taskId,
            @Param("roundNo") int roundNo
    );

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
            String currentMirrorVersionId,
            String confirmedContentVersionId,
            int mirrorRegenerationCount,
            int reflectionCount,
            int versionNo,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            LocalDateTime deletedAt
    ) {
    }

    record ReflectionRecord(
            String id,
            String taskId,
            int roundNo,
            String contentVersionId,
            LocalDateTime createdAt
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
