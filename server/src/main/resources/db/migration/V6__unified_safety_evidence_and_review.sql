CREATE TABLE sf_safety_evidence (
    id CHAR(26) PRIMARY KEY,
    owner_subject_ref CHAR(26) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id CHAR(26) NOT NULL,
    checkpoint VARCHAR(24) NOT NULL,
    route VARCHAR(16) NOT NULL,
    categories_json VARCHAR(2048) NOT NULL,
    mask_codes_json VARCHAR(1024) NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    resource_ids_json VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_sf_evidence_source_checkpoint UNIQUE (source_type, source_id, checkpoint),
    CONSTRAINT ck_sf_evidence_source CHECK (
        source_type IN ('CLARITY_CONTENT', 'CLARITY_MIRROR', 'CLARITY_REFLECTION',
                        'REPORT', 'VENT_TURN', 'VENT_SUMMARY')
    ),
    CONSTRAINT ck_sf_evidence_checkpoint CHECK (checkpoint IN ('S1_INPUT', 'S2_PRE_GENERATION', 'S3_OUTPUT')),
    CONSTRAINT ck_sf_evidence_route CHECK (route IN ('ALLOW', 'CLARIFY', 'BLOCK'))
);

CREATE INDEX ix_sf_evidence_owner_created
    ON sf_safety_evidence (owner_subject_ref, created_at);
CREATE INDEX ix_sf_evidence_route_created
    ON sf_safety_evidence (route, created_at);

CREATE TABLE sf_safety_review_case (
    id CHAR(26) PRIMARY KEY,
    evidence_id CHAR(26) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    version_no INT NOT NULL DEFAULT 1,
    decision VARCHAR(32),
    reason_hash CHAR(64),
    ticket_hash CHAR(64),
    reviewer_subject_ref VARCHAR(128),
    created_at TIMESTAMP(3) NOT NULL,
    resolved_at TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_sf_review_evidence UNIQUE (evidence_id),
    CONSTRAINT fk_sf_review_evidence FOREIGN KEY (evidence_id) REFERENCES sf_safety_evidence (id),
    CONSTRAINT ck_sf_review_priority CHECK (priority IN ('CRITICAL', 'BOUNDARY')),
    CONSTRAINT ck_sf_review_status CHECK (status IN ('OPEN', 'RESOLVED')),
    CONSTRAINT ck_sf_review_version CHECK (version_no >= 1),
    CONSTRAINT ck_sf_review_decision CHECK (
        decision IS NULL OR decision IN ('CONFIRMED_BLOCK', 'FALSE_POSITIVE', 'POLICY_GAP', 'ESCALATED')
    )
);

CREATE INDEX ix_sf_review_queue
    ON sf_safety_review_case (status, priority, id);

CREATE TABLE sf_safety_review_command_dedup (
    command_scope VARCHAR(96) NOT NULL,
    actor_subject_ref VARCHAR(128) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    case_id CHAR(26) NOT NULL,
    result_version INT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    PRIMARY KEY (command_scope, actor_subject_ref, idempotency_key_hash),
    CONSTRAINT fk_sf_review_command_case FOREIGN KEY (case_id) REFERENCES sf_safety_review_case (id),
    CONSTRAINT ck_sf_review_command_version CHECK (result_version >= 1)
);

CREATE INDEX ix_sf_review_command_expiry
    ON sf_safety_review_command_dedup (expires_at);
