package com.aichat.report.infrastructure;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;

@Mapper
public interface ReportMapper {

    @Insert("""
            INSERT INTO rp_report (
                id, task_id, generation_id, owner_subject_ref, status, report_version,
                free_ciphertext, free_content_nonce, free_wrapped_dek, free_wrap_nonce,
                free_key_version, free_content_hash,
                sealed_ciphertext, sealed_content_nonce, sealed_wrapped_dek, sealed_wrap_nonce,
                sealed_key_version, sealed_content_hash, deliverable_hash,
                model_version, prompt_version, safety_version, template_version,
                expires_at, created_at, updated_at
            ) VALUES (
                #{id}, #{taskId}, #{generationId}, #{ownerSubjectRef}, #{status}, #{reportVersion},
                #{freeCiphertext}, #{freeContentNonce}, #{freeWrappedDek}, #{freeWrapNonce},
                #{freeKeyVersion}, #{freeContentHash},
                #{sealedCiphertext}, #{sealedContentNonce}, #{sealedWrappedDek}, #{sealedWrapNonce},
                #{sealedKeyVersion}, #{sealedContentHash}, #{deliverableHash},
                #{modelVersion}, #{promptVersion}, #{safetyVersion}, #{templateVersion},
                #{expiresAt}, #{createdAt}, #{updatedAt}
            )
            """)
    int insertReport(ReportRecord report);

    @Select("""
            SELECT id, task_id, generation_id, owner_subject_ref, status, report_version,
                   free_ciphertext, free_content_nonce, free_wrapped_dek, free_wrap_nonce,
                   free_key_version, free_content_hash,
                   sealed_ciphertext, sealed_content_nonce, sealed_wrapped_dek, sealed_wrap_nonce,
                   sealed_key_version, sealed_content_hash, deliverable_hash,
                   model_version, prompt_version, safety_version, template_version,
                   expires_at, created_at, updated_at
              FROM rp_report
             WHERE id = #{id}
            """)
    ReportRecord findReport(String id);

    @Select("""
            SELECT id, task_id, generation_id, owner_subject_ref, status, report_version,
                   free_ciphertext, free_content_nonce, free_wrapped_dek, free_wrap_nonce,
                   free_key_version, free_content_hash,
                   sealed_ciphertext, sealed_content_nonce, sealed_wrapped_dek, sealed_wrap_nonce,
                   sealed_key_version, sealed_content_hash, deliverable_hash,
                   model_version, prompt_version, safety_version, template_version,
                   expires_at, created_at, updated_at
              FROM rp_report
             WHERE task_id = #{taskId}
            """)
    ReportRecord findReportByTask(String taskId);

    @Insert("""
            INSERT INTO rp_report_command_dedup (
                command_scope, owner_subject_ref, idempotency_key_hash, request_hash,
                report_id, task_result_version, created_at, expires_at
            ) VALUES (
                #{commandScope}, #{ownerSubjectRef}, #{idempotencyKeyHash}, #{requestHash},
                #{reportId}, #{taskResultVersion}, #{createdAt}, #{expiresAt}
            )
            """)
    int insertCommand(CommandRecord command);

    @Select("""
            SELECT command_scope, owner_subject_ref, idempotency_key_hash, request_hash,
                   report_id, task_result_version, created_at, expires_at
              FROM rp_report_command_dedup
             WHERE command_scope = #{scope}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND idempotency_key_hash = #{keyHash}
               AND expires_at > #{now}
            """)
    CommandRecord findCommand(
            @Param("scope") String scope,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("keyHash") String keyHash,
            @Param("now") LocalDateTime now
    );

    @Delete("""
            DELETE FROM rp_report_command_dedup
             WHERE command_scope = #{scope}
               AND owner_subject_ref = #{ownerSubjectRef}
               AND idempotency_key_hash = #{keyHash}
               AND expires_at <= #{now}
            """)
    int deleteExpiredCommand(
            @Param("scope") String scope,
            @Param("ownerSubjectRef") String ownerSubjectRef,
            @Param("keyHash") String keyHash,
            @Param("now") LocalDateTime now
    );

    @Delete("DELETE FROM rp_report_command_dedup WHERE expires_at <= #{now}")
    int deleteExpiredCommands(LocalDateTime now);

    record ReportRecord(
            String id,
            String taskId,
            String generationId,
            String ownerSubjectRef,
            String status,
            String reportVersion,
            byte[] freeCiphertext,
            byte[] freeContentNonce,
            byte[] freeWrappedDek,
            byte[] freeWrapNonce,
            String freeKeyVersion,
            String freeContentHash,
            byte[] sealedCiphertext,
            byte[] sealedContentNonce,
            byte[] sealedWrappedDek,
            byte[] sealedWrapNonce,
            String sealedKeyVersion,
            String sealedContentHash,
            String deliverableHash,
            String modelVersion,
            String promptVersion,
            String safetyVersion,
            String templateVersion,
            LocalDateTime expiresAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    record CommandRecord(
            String commandScope,
            String ownerSubjectRef,
            String idempotencyKeyHash,
            String requestHash,
            String reportId,
            int taskResultVersion,
            LocalDateTime createdAt,
            LocalDateTime expiresAt
    ) {
    }
}
