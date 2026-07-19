package com.aichat.assessment.infrastructure;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface AssessmentMapper {

    @Select("""
            SELECT version, status, item_count, items_json, score_rules_json, score_rules_hash,
                   license_source, boundary_copy, published_at
              FROM ct_assessment_definition
             WHERE status = 'PUBLISHED'
             ORDER BY published_at DESC
             LIMIT 1
            """)
    DefinitionRecord findCurrentDefinition();

    @Select("""
            SELECT version, status, item_count, items_json, score_rules_json, score_rules_hash,
                   license_source, boundary_copy, published_at
              FROM ct_assessment_definition
             WHERE version = #{version}
            """)
    DefinitionRecord findDefinition(String version);

    @Insert("""
            INSERT INTO ct_assessment_run (
                id, owner_subject_ref, owner_auth_level, definition_version, state, version_no,
                score_vector_json, result_code, task_id, completed_at, created_at, updated_at
            ) VALUES (
                #{id}, #{ownerSubjectRef}, #{ownerAuthLevel}, #{definitionVersion}, #{state}, #{versionNo},
                #{scoreVectorJson}, #{resultCode}, #{taskId}, #{completedAt}, #{createdAt}, #{updatedAt}
            )
            """)
    int insertRun(RunRecord run);

    @Select("""
            SELECT id, owner_subject_ref, owner_auth_level, definition_version, state, version_no,
                   score_vector_json, result_code, task_id, completed_at, created_at, updated_at
              FROM ct_assessment_run
             WHERE id = #{id}
            """)
    RunRecord findRun(String id);

    @Update("""
            UPDATE ct_assessment_run
               SET version_no = version_no + 1, updated_at = #{updatedAt}
             WHERE id = #{runId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND state = 'IN_PROGRESS'
               AND version_no = #{expectedVersion}
            """)
    int advanceRunForAnswer(
            @Param("runId") String runId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Update("""
            UPDATE ct_assessment_run
               SET state = 'COMPLETED',
                   score_vector_json = #{scoreVectorJson},
                   result_code = #{resultCode},
                   completed_at = #{completedAt},
                   updated_at = #{completedAt},
                   version_no = version_no + 1
             WHERE id = #{runId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND state = 'IN_PROGRESS'
               AND version_no = #{expectedVersion}
            """)
    int completeRun(
            @Param("runId") String runId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("scoreVectorJson") String scoreVectorJson,
            @Param("resultCode") String resultCode,
            @Param("completedAt") LocalDateTime completedAt
    );

    @Update("""
            UPDATE ct_assessment_run
               SET state = 'MAPPED', task_id = #{taskId}, updated_at = #{updatedAt},
                   version_no = version_no + 1
             WHERE id = #{runId}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND state = 'COMPLETED'
               AND version_no = #{expectedVersion}
               AND task_id IS NULL
            """)
    int mapRunToTask(
            @Param("runId") String runId,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("expectedVersion") int expectedVersion,
            @Param("taskId") String taskId,
            @Param("updatedAt") LocalDateTime updatedAt
    );

    @Insert("""
            INSERT INTO ct_assessment_answer (
                id, run_id, item_id, answer_version, ciphertext, content_nonce,
                wrapped_dek, wrap_nonce, key_version, content_hash,
                created_at, updated_at, expires_at
            ) VALUES (
                #{id}, #{runId}, #{itemId}, #{answerVersion}, #{ciphertext}, #{contentNonce},
                #{wrappedDek}, #{wrapNonce}, #{keyVersion}, #{contentHash},
                #{createdAt}, #{updatedAt}, #{expiresAt}
            )
            """)
    int insertAnswer(AnswerRecord answer);

    @Update("""
            UPDATE ct_assessment_answer
               SET answer_version = #{answerVersion}, ciphertext = #{ciphertext},
                   content_nonce = #{contentNonce}, wrapped_dek = #{wrappedDek},
                   wrap_nonce = #{wrapNonce}, key_version = #{keyVersion},
                   content_hash = #{contentHash}, updated_at = #{updatedAt}, expires_at = #{expiresAt}
             WHERE id = #{id} AND run_id = #{runId} AND item_id = #{itemId}
            """)
    int updateAnswer(AnswerRecord answer);

    @Select("""
            SELECT id, run_id, item_id, answer_version, ciphertext, content_nonce,
                   wrapped_dek, wrap_nonce, key_version, content_hash,
                   created_at, updated_at, expires_at
              FROM ct_assessment_answer
             WHERE run_id = #{runId} AND item_id = #{itemId}
            """)
    AnswerRecord findAnswer(@Param("runId") String runId, @Param("itemId") String itemId);

    @Select("""
            SELECT id, run_id, item_id, answer_version, ciphertext, content_nonce,
                   wrapped_dek, wrap_nonce, key_version, content_hash,
                   created_at, updated_at, expires_at
              FROM ct_assessment_answer
             WHERE run_id = #{runId}
             ORDER BY item_id
            """)
    List<AnswerRecord> findAnswers(String runId);

    @Select("SELECT COUNT(*) FROM ct_assessment_answer WHERE run_id = #{runId}")
    int countAnswers(String runId);

    @Update("UPDATE ct_assessment_answer SET expires_at = #{expiresAt} WHERE run_id = #{runId}")
    int expireAnswersAt(@Param("runId") String runId, @Param("expiresAt") LocalDateTime expiresAt);

    @Delete("DELETE FROM ct_assessment_answer WHERE expires_at <= #{now}")
    int deleteExpiredAnswers(LocalDateTime now);

    @Insert("""
            INSERT INTO ct_assessment_share_preview (
                id, run_id, owner_subject_ref, title, usable_strength, reminder,
                ai_label, assessment_version, status, expires_at, created_at
            ) VALUES (
                #{id}, #{runId}, #{ownerSubjectRef}, #{title}, #{usableStrength}, #{reminder},
                #{aiLabel}, #{assessmentVersion}, #{status}, #{expiresAt}, #{createdAt}
            )
            """)
    int insertSharePreview(SharePreviewRecord preview);

    @Select("""
            SELECT id, run_id, owner_subject_ref, title, usable_strength, reminder,
                   ai_label, assessment_version, status, expires_at, created_at
              FROM ct_assessment_share_preview
             WHERE id = #{id}
            """)
    SharePreviewRecord findSharePreview(String id);

    @Delete("DELETE FROM ct_assessment_share_preview WHERE expires_at <= #{now}")
    int deleteExpiredSharePreviews(LocalDateTime now);

    @Insert("""
            INSERT INTO ct_assessment_command_dedup (
                command_scope, owner_subject_ref, idempotency_key_hash, request_hash,
                resource_id, result_version, resource_version, created_at, expires_at
            ) VALUES (
                #{commandScope}, #{ownerSubjectRef}, #{idempotencyKeyHash}, #{requestHash},
                #{resourceId}, #{resultVersion}, #{resourceVersion}, #{createdAt}, #{expiresAt}
            )
            """)
    int insertCommand(CommandRecord command);

    @Select("""
            SELECT command_scope, owner_subject_ref, idempotency_key_hash, request_hash,
                   resource_id, result_version, resource_version, created_at, expires_at
              FROM ct_assessment_command_dedup
             WHERE command_scope = #{scope}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND idempotency_key_hash = #{keyHash}
            """)
    CommandRecord findCommand(
            @Param("scope") String scope,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("keyHash") String keyHash
    );

    record DefinitionRecord(
            String version,
            String status,
            int itemCount,
            String itemsJson,
            String scoreRulesJson,
            String scoreRulesHash,
            String licenseSource,
            String boundaryCopy,
            LocalDateTime publishedAt
    ) {
    }

    record RunRecord(
            String id,
            String ownerSubjectRef,
            String ownerAuthLevel,
            String definitionVersion,
            String state,
            int versionNo,
            String scoreVectorJson,
            String resultCode,
            String taskId,
            LocalDateTime completedAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    record AnswerRecord(
            String id,
            String runId,
            String itemId,
            int answerVersion,
            byte[] ciphertext,
            byte[] contentNonce,
            byte[] wrappedDek,
            byte[] wrapNonce,
            String keyVersion,
            String contentHash,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            LocalDateTime expiresAt
    ) {
    }

    record SharePreviewRecord(
            String id,
            String runId,
            String ownerSubjectRef,
            String title,
            String usableStrength,
            String reminder,
            String aiLabel,
            String assessmentVersion,
            String status,
            LocalDateTime expiresAt,
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
            int resourceVersion,
            LocalDateTime createdAt,
            LocalDateTime expiresAt
    ) {
    }
}
