ALTER TABLE ct_clarity_task
    ADD COLUMN current_mirror_version_id CHAR(26);
ALTER TABLE ct_clarity_task
    ADD COLUMN confirmed_content_version_id CHAR(26);
ALTER TABLE ct_clarity_task
    ADD COLUMN mirror_regeneration_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE ct_clarity_task
    ADD COLUMN reflection_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE ct_clarity_task DROP CONSTRAINT ck_ct_task_state;

ALTER TABLE ct_clarity_task
    ADD CONSTRAINT ck_ct_task_state CHECK (
        state IN (
            'DRAFT', 'FIELDS_SAVED', 'SAFETY_CLARIFICATION_REQUIRED', 'SAFETY_BLOCKED',
            'MIRROR_REVIEW', 'REFLECTION', 'REPORT_READY'
        )
    );
ALTER TABLE ct_clarity_task
    ADD CONSTRAINT ck_ct_task_mirror_regeneration CHECK (mirror_regeneration_count BETWEEN 0 AND 1);
ALTER TABLE ct_clarity_task
    ADD CONSTRAINT ck_ct_task_reflection_count CHECK (reflection_count BETWEEN 0 AND 2);
ALTER TABLE ct_clarity_task
    ADD CONSTRAINT fk_ct_task_current_mirror FOREIGN KEY (current_mirror_version_id)
        REFERENCES ct_content_version (id);
ALTER TABLE ct_clarity_task
    ADD CONSTRAINT fk_ct_task_confirmed_content FOREIGN KEY (confirmed_content_version_id)
        REFERENCES ct_content_version (id);

ALTER TABLE ct_content_version DROP CONSTRAINT ck_ct_content_type;
ALTER TABLE ct_content_version DROP CONSTRAINT ck_ct_confirmation_state;

ALTER TABLE ct_content_version
    ADD CONSTRAINT ck_ct_content_type CHECK (content_type IN ('SIX_FIELDS', 'MIRROR', 'REFLECTION'));
ALTER TABLE ct_content_version
    ADD CONSTRAINT ck_ct_confirmation_state CHECK (
        confirmation_state IN ('DRAFT', 'BLOCKED', 'CONFIRMED')
    );

CREATE TABLE ct_task_reflection (
    id CHAR(26) PRIMARY KEY,
    task_id CHAR(26) NOT NULL,
    round_no SMALLINT NOT NULL,
    content_version_id CHAR(26) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_ct_task_reflection_round UNIQUE (task_id, round_no),
    CONSTRAINT uq_ct_task_reflection_content UNIQUE (content_version_id),
    CONSTRAINT fk_ct_task_reflection_task FOREIGN KEY (task_id) REFERENCES ct_clarity_task (id),
    CONSTRAINT fk_ct_task_reflection_content FOREIGN KEY (content_version_id)
        REFERENCES ct_content_version (id),
    CONSTRAINT ck_ct_task_reflection_round CHECK (round_no IN (1, 2))
);

CREATE TABLE rp_report (
    id CHAR(26) PRIMARY KEY,
    task_id CHAR(26) NOT NULL,
    generation_id CHAR(26) NOT NULL,
    owner_subject_ref CHAR(26) NOT NULL,
    status VARCHAR(24) NOT NULL,
    report_version VARCHAR(64) NOT NULL,
    free_ciphertext VARBINARY(16384) NOT NULL,
    free_content_nonce VARBINARY(12) NOT NULL,
    free_wrapped_dek VARBINARY(64) NOT NULL,
    free_wrap_nonce VARBINARY(12) NOT NULL,
    free_key_version VARCHAR(64) NOT NULL,
    free_content_hash CHAR(64) NOT NULL,
    sealed_ciphertext VARBINARY(16384) NOT NULL,
    sealed_content_nonce VARBINARY(12) NOT NULL,
    sealed_wrapped_dek VARBINARY(64) NOT NULL,
    sealed_wrap_nonce VARBINARY(12) NOT NULL,
    sealed_key_version VARCHAR(64) NOT NULL,
    sealed_content_hash CHAR(64) NOT NULL,
    deliverable_hash CHAR(64) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    prompt_version VARCHAR(64) NOT NULL,
    safety_version VARCHAR(64) NOT NULL,
    template_version VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_rp_report_task UNIQUE (task_id),
    CONSTRAINT uq_rp_report_generation UNIQUE (generation_id),
    CONSTRAINT fk_rp_report_task FOREIGN KEY (task_id) REFERENCES ct_clarity_task (id),
    CONSTRAINT ck_rp_report_status CHECK (status IN ('SEALED_READY', 'QUARANTINED', 'FAILED', 'DELETED'))
);

CREATE INDEX ix_rp_report_owner_created ON rp_report (owner_subject_ref, created_at);
CREATE INDEX ix_rp_report_expiry ON rp_report (expires_at);

CREATE TABLE rp_report_command_dedup (
    command_scope VARCHAR(96) NOT NULL,
    owner_subject_ref CHAR(26) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    report_id CHAR(26) NOT NULL,
    task_result_version INT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (command_scope, owner_subject_ref, idempotency_key_hash),
    CONSTRAINT fk_rp_report_command_report FOREIGN KEY (report_id) REFERENCES rp_report (id),
    CONSTRAINT ck_rp_report_command_version CHECK (task_result_version >= 1)
);

CREATE INDEX ix_rp_report_command_expiry ON rp_report_command_dedup (expires_at);
