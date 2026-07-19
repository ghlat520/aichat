package com.aichat.identity.infrastructure;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface SessionMapper {

    @Insert("""
            INSERT INTO id_visitor_session (
                id, client_instance_hash, device_class, access_token_hash, refresh_token_hash,
                token_key_version, status, access_expires_at, refresh_expires_at,
                version_no, created_at, updated_at
            ) VALUES (
                #{id}, #{clientInstanceHash}, #{deviceClass}, #{accessTokenHash}, #{refreshTokenHash},
                #{tokenKeyVersion}, #{status}, #{accessExpiresAt}, #{refreshExpiresAt},
                #{versionNo}, #{createdAt}, #{updatedAt}
            )
            """)
    int insertSession(SessionRecord session);

    @Select("""
            SELECT id, client_instance_hash, device_class, access_token_hash, refresh_token_hash,
                   token_key_version, status, access_expires_at, refresh_expires_at,
                   version_no, created_at, updated_at
              FROM id_visitor_session
             WHERE id = #{id}
            """)
    SessionRecord findSessionById(String id);

    @Select("""
            SELECT id, client_instance_hash, device_class, access_token_hash, refresh_token_hash,
                   token_key_version, status, access_expires_at, refresh_expires_at,
                   version_no, created_at, updated_at
              FROM id_visitor_session
             WHERE access_token_hash = #{tokenHash}
               AND access_expires_at > #{now}
            """)
    SessionRecord findByAccessTokenHash(@Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);

    @Select("""
            SELECT id, client_instance_hash, device_class, access_token_hash, refresh_token_hash,
                   token_key_version, status, access_expires_at, refresh_expires_at,
                   version_no, created_at, updated_at
              FROM id_visitor_session
             WHERE refresh_token_hash = #{tokenHash}
               AND refresh_expires_at > #{now}
            """)
    SessionRecord findByRefreshTokenHash(@Param("tokenHash") String tokenHash, @Param("now") LocalDateTime now);

    @Insert("""
            INSERT INTO id_command_dedup (
                command_scope, idempotency_key_hash, request_hash, resource_id, created_at, expires_at
            ) VALUES (
                #{commandScope}, #{idempotencyKeyHash}, #{requestHash}, #{resourceId}, #{createdAt}, #{expiresAt}
            )
            """)
    int insertCommand(CommandRecord command);

    @Select("""
            SELECT command_scope, idempotency_key_hash, request_hash, resource_id, created_at, expires_at
              FROM id_command_dedup
             WHERE command_scope = #{scope}
               AND idempotency_key_hash = #{keyHash}
            """)
    CommandRecord findCommand(@Param("scope") String scope, @Param("keyHash") String keyHash);

    @Insert("""
            INSERT INTO id_consent_record (
                id, session_id, idempotency_key_hash, policy_version,
                adult_confirmed, accepted, consented_at
            ) VALUES (
                #{id}, #{sessionId}, #{idempotencyKeyHash}, #{policyVersion},
                #{adultConfirmed}, #{accepted}, #{consentedAt}
            )
            """)
    int insertConsent(ConsentRecord consent);

    @Select("""
            SELECT id, session_id, idempotency_key_hash, policy_version,
                   adult_confirmed, accepted, consented_at
              FROM id_consent_record
             WHERE session_id = #{sessionId}
               AND idempotency_key_hash = #{keyHash}
            """)
    ConsentRecord findConsent(@Param("sessionId") String sessionId, @Param("keyHash") String keyHash);

    @Update("""
            UPDATE id_visitor_session
               SET status = 'ACTIVE', version_no = version_no + 1, updated_at = #{updatedAt}
             WHERE id = #{sessionId}
               AND status IN ('PENDING_CONSENT', 'ACTIVE')
            """)
    int activateSession(@Param("sessionId") String sessionId, @Param("updatedAt") LocalDateTime updatedAt);

    record SessionRecord(
            String id,
            String clientInstanceHash,
            String deviceClass,
            String accessTokenHash,
            String refreshTokenHash,
            String tokenKeyVersion,
            String status,
            LocalDateTime accessExpiresAt,
            LocalDateTime refreshExpiresAt,
            int versionNo,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    record CommandRecord(
            String commandScope,
            String idempotencyKeyHash,
            String requestHash,
            String resourceId,
            LocalDateTime createdAt,
            LocalDateTime expiresAt
    ) {
    }

    record ConsentRecord(
            String id,
            String sessionId,
            String idempotencyKeyHash,
            String policyVersion,
            boolean adultConfirmed,
            boolean accepted,
            LocalDateTime consentedAt
    ) {
    }
}
