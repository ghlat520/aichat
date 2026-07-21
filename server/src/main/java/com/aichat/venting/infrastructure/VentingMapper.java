package com.aichat.venting.infrastructure;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface VentingMapper {
    @Insert("""
            INSERT INTO vt_vent_session (
                id, owner_subject_ref, owner_auth_level, policy_version, state,
                ai_turns, user_turns, version_no, started_at, deadline_at,
                current_summary_version_id, mapped_task_id, expires_at, created_at, updated_at
            ) VALUES (
                #{id}, #{ownerSubjectRef}, #{ownerAuthLevel}, #{policyVersion}, #{state},
                #{aiTurns}, #{userTurns}, #{versionNo}, #{startedAt}, #{deadlineAt},
                #{currentSummaryVersionId}, #{mappedTaskId}, #{expiresAt}, #{createdAt}, #{updatedAt}
            )
            """)
    int insertSession(SessionRecord session);

    @Select("""
            SELECT id, owner_subject_ref, owner_auth_level, policy_version, state,
                   ai_turns, user_turns, version_no, started_at, deadline_at,
                   current_summary_version_id, mapped_task_id, expires_at, created_at, updated_at
              FROM vt_vent_session
             WHERE id = #{id}
            """)
    SessionRecord findSession(String id);

    @Update("""
            UPDATE vt_vent_session
               SET ai_turns = ai_turns + 1,
                   user_turns = user_turns + 1,
                   version_no = version_no + 1,
                   updated_at = #{now}
             WHERE id = #{id}
               AND owner_subject_ref = #{owner}
               AND state = 'ACTIVE'
               AND version_no = #{expectedVersion}
               AND ai_turns < 8
               AND deadline_at > #{now}
            """)
    int advanceTurn(
            @Param("id") String id,
            @Param("owner") String owner,
            @Param("expectedVersion") int expectedVersion,
            @Param("now") LocalDateTime now
    );

    @Update("""
            UPDATE vt_vent_session
               SET state = 'SAFETY_BLOCKED',
                   user_turns = user_turns + 1,
                   version_no = version_no + 1,
                   updated_at = #{now}
             WHERE id = #{id}
               AND owner_subject_ref = #{owner}
               AND state = 'ACTIVE'
               AND version_no = #{expectedVersion}
               AND ai_turns < 8
               AND deadline_at > #{now}
            """)
    int blockSession(
            @Param("id") String id,
            @Param("owner") String owner,
            @Param("expectedVersion") int expectedVersion,
            @Param("now") LocalDateTime now
    );

    @Update("""
            UPDATE vt_vent_session
               SET state = 'SUMMARY_READY',
                   current_summary_version_id = #{summaryId},
                   version_no = version_no + 1,
                   updated_at = #{now}
             WHERE id = #{id}
               AND owner_subject_ref = #{owner}
               AND state = 'ACTIVE'
               AND version_no = #{expectedVersion}
               AND user_turns >= 1
            """)
    int markSummaryReady(
            @Param("id") String id,
            @Param("owner") String owner,
            @Param("expectedVersion") int expectedVersion,
            @Param("summaryId") String summaryId,
            @Param("now") LocalDateTime now
    );

    @Update("""
            UPDATE vt_vent_session
               SET state = 'CONFIRMED',
                   current_summary_version_id = #{confirmedSummaryId},
                   mapped_task_id = #{taskId},
                   version_no = version_no + 1,
                   updated_at = #{now}
             WHERE id = #{id}
               AND owner_subject_ref = #{owner}
               AND state = 'SUMMARY_READY'
               AND version_no = #{expectedVersion}
               AND current_summary_version_id = #{draftSummaryId}
               AND mapped_task_id IS NULL
            """)
    int confirmSummary(
            @Param("id") String id,
            @Param("owner") String owner,
            @Param("expectedVersion") int expectedVersion,
            @Param("draftSummaryId") String draftSummaryId,
            @Param("confirmedSummaryId") String confirmedSummaryId,
            @Param("taskId") String taskId,
            @Param("now") LocalDateTime now
    );

    @Insert("""
            INSERT INTO vt_vent_turn (
                id, session_id, message_no, role, safety_route,
                categories_json, mask_codes_json, rule_version, resource_ids_json,
                ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                key_version, content_hash, expires_at, created_at
            ) VALUES (
                #{id}, #{sessionId}, #{messageNo}, #{role}, #{safetyRoute},
                #{categoriesJson}, #{maskCodesJson}, #{ruleVersion}, #{resourceIdsJson},
                #{ciphertext}, #{contentNonce}, #{wrappedDek}, #{wrapNonce},
                #{keyVersion}, #{contentHash}, #{expiresAt}, #{createdAt}
            )
            """)
    int insertTurn(TurnRecord turn);

    @Select("""
            SELECT id, session_id, message_no, role, safety_route,
                   categories_json, mask_codes_json, rule_version, resource_ids_json,
                   ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                   key_version, content_hash, expires_at, created_at
              FROM vt_vent_turn
             WHERE id = #{id}
            """)
    TurnRecord findTurn(String id);

    @Select("""
            SELECT id, session_id, message_no, role, safety_route,
                   categories_json, mask_codes_json, rule_version, resource_ids_json,
                   ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                   key_version, content_hash, expires_at, created_at
              FROM vt_vent_turn
             WHERE session_id = #{sessionId} AND message_no = #{messageNo}
            """)
    TurnRecord findTurnByMessage(
            @Param("sessionId") String sessionId,
            @Param("messageNo") int messageNo
    );

    @Select("""
            SELECT id, session_id, message_no, role, safety_route,
                   categories_json, mask_codes_json, rule_version, resource_ids_json,
                   ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                   key_version, content_hash, expires_at, created_at
              FROM vt_vent_turn
             WHERE session_id = #{sessionId} AND role = 'USER'
             ORDER BY message_no DESC
             LIMIT 1
            """)
    TurnRecord findLatestUserTurn(String sessionId);

    @Insert("""
            INSERT INTO vt_vent_summary (
                id, session_id, version_no, status,
                ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                key_version, content_hash, expires_at, created_at
            ) VALUES (
                #{id}, #{sessionId}, #{versionNo}, #{status},
                #{ciphertext}, #{contentNonce}, #{wrappedDek}, #{wrapNonce},
                #{keyVersion}, #{contentHash}, #{expiresAt}, #{createdAt}
            )
            """)
    int insertSummary(SummaryRecord summary);

    @Select("""
            SELECT id, session_id, version_no, status,
                   ciphertext, content_nonce, wrapped_dek, wrap_nonce,
                   key_version, content_hash, expires_at, created_at
              FROM vt_vent_summary
             WHERE id = #{id}
            """)
    SummaryRecord findSummary(String id);

    @Insert("""
            INSERT INTO vt_vent_command_dedup (
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
              FROM vt_vent_command_dedup
             WHERE command_scope = #{scope}
               AND owner_subject_ref = #{owner}
               AND idempotency_key_hash = #{keyHash}
               AND expires_at > #{now}
            """)
    CommandRecord findCommand(
            @Param("scope") String scope,
            @Param("owner") String owner,
            @Param("keyHash") String keyHash,
            @Param("now") LocalDateTime now
    );

    @Delete("""
            DELETE FROM vt_vent_command_dedup
             WHERE command_scope = #{scope}
               AND owner_subject_ref = #{owner}
               AND idempotency_key_hash = #{keyHash}
               AND expires_at <= #{now}
            """)
    int deleteExpiredCommand(
            @Param("scope") String scope,
            @Param("owner") String owner,
            @Param("keyHash") String keyHash,
            @Param("now") LocalDateTime now
    );

    @Delete("DELETE FROM vt_vent_command_dedup WHERE expires_at <= #{now}")
    int deleteExpiredCommands(LocalDateTime now);

    @Delete("DELETE FROM vt_vent_turn WHERE expires_at <= #{now}")
    int deleteExpiredTurns(LocalDateTime now);

    @Delete("DELETE FROM vt_vent_summary WHERE expires_at <= #{now}")
    int deleteExpiredSummaries(LocalDateTime now);

    record SessionRecord(
            String id,
            String ownerSubjectRef,
            String ownerAuthLevel,
            String policyVersion,
            String state,
            int aiTurns,
            int userTurns,
            int versionNo,
            LocalDateTime startedAt,
            LocalDateTime deadlineAt,
            String currentSummaryVersionId,
            String mappedTaskId,
            LocalDateTime expiresAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    record TurnRecord(
            String id,
            String sessionId,
            int messageNo,
            String role,
            String safetyRoute,
            String categoriesJson,
            String maskCodesJson,
            String ruleVersion,
            String resourceIdsJson,
            byte[] ciphertext,
            byte[] contentNonce,
            byte[] wrappedDek,
            byte[] wrapNonce,
            String keyVersion,
            String contentHash,
            LocalDateTime expiresAt,
            LocalDateTime createdAt
    ) {
    }

    record SummaryRecord(
            String id,
            String sessionId,
            int versionNo,
            String status,
            byte[] ciphertext,
            byte[] contentNonce,
            byte[] wrappedDek,
            byte[] wrapNonce,
            String keyVersion,
            String contentHash,
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
