CREATE TABLE id_visitor_session (
    id CHAR(26) PRIMARY KEY,
    client_instance_hash CHAR(64) NOT NULL,
    device_class VARCHAR(16) NOT NULL,
    access_token_hash CHAR(64) NOT NULL,
    refresh_token_hash CHAR(64) NOT NULL,
    token_key_version VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    access_expires_at TIMESTAMP(3) NOT NULL,
    refresh_expires_at TIMESTAMP(3) NOT NULL,
    version_no INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(3) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_id_visitor_access_token UNIQUE (access_token_hash),
    CONSTRAINT uq_id_visitor_refresh_token UNIQUE (refresh_token_hash),
    CONSTRAINT ck_id_visitor_status CHECK (status IN ('PENDING_CONSENT', 'ACTIVE', 'REVOKED'))
);

CREATE INDEX ix_id_visitor_access_expiry
    ON id_visitor_session (access_expires_at, status);

CREATE INDEX ix_id_visitor_refresh_expiry
    ON id_visitor_session (refresh_expires_at, status);

CREATE TABLE id_command_dedup (
    command_scope VARCHAR(64) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    resource_id CHAR(26) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (command_scope, idempotency_key_hash),
    CONSTRAINT fk_id_command_session
        FOREIGN KEY (resource_id) REFERENCES id_visitor_session (id)
);

CREATE INDEX ix_id_command_expiry ON id_command_dedup (expires_at);

CREATE TABLE id_consent_record (
    id CHAR(26) PRIMARY KEY,
    session_id CHAR(26) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    policy_version VARCHAR(64) NOT NULL,
    adult_confirmed BOOLEAN NOT NULL,
    accepted BOOLEAN NOT NULL,
    consented_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_id_consent_idempotency UNIQUE (session_id, idempotency_key_hash),
    CONSTRAINT fk_id_consent_session
        FOREIGN KEY (session_id) REFERENCES id_visitor_session (id),
    CONSTRAINT ck_id_consent_adult CHECK (adult_confirmed = TRUE),
    CONSTRAINT ck_id_consent_accepted CHECK (accepted = TRUE)
);

CREATE INDEX ix_id_consent_policy
    ON id_consent_record (session_id, policy_version, consented_at);
