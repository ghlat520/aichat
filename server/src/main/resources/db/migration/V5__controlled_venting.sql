CREATE TABLE vt_vent_session (
    id CHAR(26) PRIMARY KEY,
    owner_subject_ref CHAR(26) NOT NULL,
    owner_auth_level VARCHAR(16) NOT NULL,
    policy_version VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    ai_turns SMALLINT NOT NULL DEFAULT 0,
    user_turns SMALLINT NOT NULL DEFAULT 0,
    version_no INT NOT NULL DEFAULT 1,
    started_at TIMESTAMP(3) NOT NULL,
    deadline_at TIMESTAMP(3) NOT NULL,
    current_summary_version_id CHAR(26),
    mapped_task_id CHAR(26),
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT ck_vt_session_auth CHECK (owner_auth_level IN ('VISITOR', 'PRINCIPAL')),
    CONSTRAINT ck_vt_session_state CHECK (
        state IN ('ACTIVE', 'SAFETY_BLOCKED', 'SUMMARY_READY', 'CONFIRMED')
    ),
    CONSTRAINT ck_vt_session_ai_turns CHECK (ai_turns BETWEEN 0 AND 8),
    CONSTRAINT ck_vt_session_user_turns CHECK (user_turns BETWEEN 0 AND 8),
    CONSTRAINT ck_vt_session_version CHECK (version_no >= 1),
    CONSTRAINT uq_vt_session_mapped_task UNIQUE (mapped_task_id)
);

CREATE INDEX ix_vt_session_owner_created ON vt_vent_session (owner_subject_ref, created_at);
CREATE INDEX ix_vt_session_expiry ON vt_vent_session (expires_at);

CREATE TABLE vt_vent_turn (
    id CHAR(26) PRIMARY KEY,
    session_id CHAR(26) NOT NULL,
    message_no SMALLINT NOT NULL,
    role VARCHAR(16) NOT NULL,
    safety_route VARCHAR(16) NOT NULL,
    categories_json VARCHAR(2048) NOT NULL,
    mask_codes_json VARCHAR(1024) NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    resource_ids_json VARCHAR(1024) NOT NULL,
    ciphertext VARBINARY(8192) NOT NULL,
    content_nonce VARBINARY(12) NOT NULL,
    wrapped_dek VARBINARY(64) NOT NULL,
    wrap_nonce VARBINARY(12) NOT NULL,
    key_version VARCHAR(64) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_vt_turn_message UNIQUE (session_id, message_no),
    CONSTRAINT fk_vt_turn_session FOREIGN KEY (session_id) REFERENCES vt_vent_session (id),
    CONSTRAINT ck_vt_turn_message_no CHECK (message_no BETWEEN 1 AND 16),
    CONSTRAINT ck_vt_turn_role CHECK (role IN ('USER', 'ASSISTANT')),
    CONSTRAINT ck_vt_turn_route CHECK (safety_route IN ('ALLOW', 'CLARIFY', 'BLOCK'))
);

CREATE INDEX ix_vt_turn_session_created ON vt_vent_turn (session_id, created_at);
CREATE INDEX ix_vt_turn_expiry ON vt_vent_turn (expires_at);

CREATE TABLE vt_vent_summary (
    id CHAR(26) PRIMARY KEY,
    session_id CHAR(26) NOT NULL,
    version_no SMALLINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    ciphertext VARBINARY(16384) NOT NULL,
    content_nonce VARBINARY(12) NOT NULL,
    wrapped_dek VARBINARY(64) NOT NULL,
    wrap_nonce VARBINARY(12) NOT NULL,
    key_version VARCHAR(64) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_vt_summary_version UNIQUE (session_id, version_no),
    CONSTRAINT fk_vt_summary_session FOREIGN KEY (session_id) REFERENCES vt_vent_session (id),
    CONSTRAINT ck_vt_summary_version CHECK (version_no IN (1, 2)),
    CONSTRAINT ck_vt_summary_status CHECK (status IN ('DRAFT', 'CONFIRMED'))
);

CREATE INDEX ix_vt_summary_expiry ON vt_vent_summary (expires_at);

ALTER TABLE vt_vent_session
    ADD CONSTRAINT fk_vt_session_summary FOREIGN KEY (current_summary_version_id)
        REFERENCES vt_vent_summary (id) ON DELETE SET NULL;
ALTER TABLE vt_vent_session
    ADD CONSTRAINT fk_vt_session_task FOREIGN KEY (mapped_task_id)
        REFERENCES ct_clarity_task (id);

CREATE TABLE vt_vent_command_dedup (
    command_scope VARCHAR(96) NOT NULL,
    owner_subject_ref CHAR(26) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    resource_id CHAR(26) NOT NULL,
    result_version INT NOT NULL,
    resource_version INT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (command_scope, owner_subject_ref, idempotency_key_hash),
    CONSTRAINT ck_vt_command_result_version CHECK (result_version >= 1),
    CONSTRAINT ck_vt_command_resource_version CHECK (resource_version >= 1)
);

CREATE INDEX ix_vt_command_expiry ON vt_vent_command_dedup (expires_at);
