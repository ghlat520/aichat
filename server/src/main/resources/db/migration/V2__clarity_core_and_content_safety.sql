CREATE TABLE ct_clarity_task (
    id CHAR(26) PRIMARY KEY,
    owner_subject_ref CHAR(26) NOT NULL,
    owner_auth_level VARCHAR(16) NOT NULL,
    entry_type VARCHAR(16) NOT NULL,
    context_code VARCHAR(40) NOT NULL,
    state VARCHAR(48) NOT NULL,
    clarity_pre SMALLINT NOT NULL,
    current_content_version_id CHAR(26),
    current_safety_assessment_id CHAR(26),
    version_no INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(3) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL,
    deleted_at TIMESTAMP(3),
    CONSTRAINT ck_ct_task_auth_level CHECK (owner_auth_level IN ('VISITOR', 'PRINCIPAL')),
    CONSTRAINT ck_ct_task_entry CHECK (entry_type IN ('DIRECT', 'ASSESSMENT', 'VENT')),
    CONSTRAINT ck_ct_task_context CHECK (
        context_code IN ('dating_or_partner', 'family', 'friendship', 'workplace', 'other_relationship')
    ),
    CONSTRAINT ck_ct_task_state CHECK (
        state IN ('DRAFT', 'FIELDS_SAVED', 'SAFETY_CLARIFICATION_REQUIRED', 'SAFETY_BLOCKED')
    ),
    CONSTRAINT ck_ct_task_clarity CHECK (clarity_pre BETWEEN 0 AND 10),
    CONSTRAINT ck_ct_task_version CHECK (version_no >= 1)
);

CREATE INDEX ix_ct_task_owner_updated
    ON ct_clarity_task (owner_subject_ref, updated_at);

CREATE TABLE ct_content_version (
    id CHAR(26) PRIMARY KEY,
    task_id CHAR(26) NOT NULL,
    content_type VARCHAR(32) NOT NULL,
    version_no INT NOT NULL,
    confirmation_state VARCHAR(16) NOT NULL,
    ciphertext VARBINARY(16384) NOT NULL,
    content_nonce VARBINARY(12) NOT NULL,
    wrapped_dek VARBINARY(64) NOT NULL,
    wrap_nonce VARBINARY(12) NOT NULL,
    key_version VARCHAR(64) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_ct_content_version UNIQUE (task_id, content_type, version_no),
    CONSTRAINT fk_ct_content_task FOREIGN KEY (task_id) REFERENCES ct_clarity_task (id),
    CONSTRAINT ck_ct_content_type CHECK (content_type = 'SIX_FIELDS'),
    CONSTRAINT ck_ct_confirmation_state CHECK (confirmation_state IN ('DRAFT', 'BLOCKED')),
    CONSTRAINT ck_ct_content_version_no CHECK (version_no >= 1)
);

CREATE INDEX ix_ct_content_task_created
    ON ct_content_version (task_id, created_at);

CREATE TABLE ct_safety_assessment (
    id CHAR(26) PRIMARY KEY,
    task_id CHAR(26) NOT NULL,
    content_version_id CHAR(26) NOT NULL,
    checkpoint VARCHAR(8) NOT NULL,
    route VARCHAR(16) NOT NULL,
    categories_json VARCHAR(2048) NOT NULL,
    mask_codes_json VARCHAR(1024) NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    resource_ids_json VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_ct_safety_content_checkpoint UNIQUE (content_version_id, checkpoint),
    CONSTRAINT fk_ct_safety_task FOREIGN KEY (task_id) REFERENCES ct_clarity_task (id),
    CONSTRAINT fk_ct_safety_content FOREIGN KEY (content_version_id) REFERENCES ct_content_version (id),
    CONSTRAINT ck_ct_safety_checkpoint CHECK (checkpoint = 'S1'),
    CONSTRAINT ck_ct_safety_route CHECK (route IN ('ALLOW', 'CLARIFY', 'BLOCK'))
);

CREATE INDEX ix_ct_safety_task_created
    ON ct_safety_assessment (task_id, created_at);

CREATE TABLE ct_command_dedup (
    command_scope VARCHAR(96) NOT NULL,
    owner_subject_ref CHAR(26) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    resource_id CHAR(26) NOT NULL,
    result_version INT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (command_scope, owner_subject_ref, idempotency_key_hash),
    CONSTRAINT ck_ct_command_result_version CHECK (result_version >= 1)
);

CREATE INDEX ix_ct_command_expiry ON ct_command_dedup (expires_at);
