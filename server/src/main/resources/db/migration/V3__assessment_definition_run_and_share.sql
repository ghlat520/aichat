CREATE TABLE ct_assessment_definition (
    version VARCHAR(64) PRIMARY KEY,
    status VARCHAR(16) NOT NULL,
    item_count SMALLINT NOT NULL,
    items_json TEXT NOT NULL,
    score_rules_json VARCHAR(2048) NOT NULL,
    score_rules_hash CHAR(64) NOT NULL,
    license_source VARCHAR(512) NOT NULL,
    boundary_copy VARCHAR(512) NOT NULL,
    published_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT ck_ct_assessment_definition_status CHECK (status IN ('PUBLISHED', 'RETIRED')),
    CONSTRAINT ck_ct_assessment_item_count CHECK (item_count BETWEEN 6 AND 8)
);

CREATE TABLE ct_assessment_run (
    id CHAR(26) PRIMARY KEY,
    owner_subject_ref CHAR(26) NOT NULL,
    owner_auth_level VARCHAR(16) NOT NULL,
    definition_version VARCHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL,
    version_no INT NOT NULL DEFAULT 1,
    score_vector_json VARCHAR(512),
    result_code VARCHAR(40),
    task_id CHAR(26),
    completed_at TIMESTAMP(3),
    created_at TIMESTAMP(3) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_ct_assessment_task UNIQUE (task_id),
    CONSTRAINT fk_ct_assessment_definition FOREIGN KEY (definition_version)
        REFERENCES ct_assessment_definition (version),
    CONSTRAINT fk_ct_assessment_task FOREIGN KEY (task_id) REFERENCES ct_clarity_task (id),
    CONSTRAINT ck_ct_assessment_owner_level CHECK (owner_auth_level IN ('VISITOR', 'PRINCIPAL')),
    CONSTRAINT ck_ct_assessment_run_state CHECK (state IN ('IN_PROGRESS', 'COMPLETED', 'MAPPED')),
    CONSTRAINT ck_ct_assessment_run_version CHECK (version_no >= 1),
    CONSTRAINT ck_ct_assessment_result CHECK (
        result_code IS NULL OR result_code IN (
            'evidence_checking', 'direct_expression', 'self_protection', 'emotion_regulation', 'mixed'
        )
    )
);

CREATE INDEX ix_ct_assessment_run_owner_updated
    ON ct_assessment_run (owner_subject_ref, updated_at);

CREATE TABLE ct_assessment_answer (
    id CHAR(26) PRIMARY KEY,
    run_id CHAR(26) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    answer_version INT NOT NULL,
    ciphertext VARBINARY(512) NOT NULL,
    content_nonce VARBINARY(12) NOT NULL,
    wrapped_dek VARBINARY(64) NOT NULL,
    wrap_nonce VARBINARY(12) NOT NULL,
    key_version VARCHAR(64) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT uq_ct_assessment_answer_item UNIQUE (run_id, item_id),
    CONSTRAINT fk_ct_assessment_answer_run FOREIGN KEY (run_id) REFERENCES ct_assessment_run (id),
    CONSTRAINT ck_ct_assessment_answer_version CHECK (answer_version >= 1)
);

CREATE INDEX ix_ct_assessment_answer_expiry
    ON ct_assessment_answer (expires_at);

CREATE TABLE ct_assessment_share_preview (
    id CHAR(26) PRIMARY KEY,
    run_id CHAR(26) NOT NULL,
    owner_subject_ref CHAR(26) NOT NULL,
    title VARCHAR(128) NOT NULL,
    usable_strength VARCHAR(256) NOT NULL,
    reminder VARCHAR(256) NOT NULL,
    ai_label VARCHAR(64) NOT NULL,
    assessment_version VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    expires_at TIMESTAMP(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT fk_ct_assessment_share_run FOREIGN KEY (run_id) REFERENCES ct_assessment_run (id),
    CONSTRAINT ck_ct_assessment_share_status CHECK (status = 'PREVIEW_ONLY')
);

CREATE INDEX ix_ct_assessment_share_expiry
    ON ct_assessment_share_preview (expires_at);

CREATE TABLE ct_assessment_command_dedup (
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
    CONSTRAINT ck_ct_assessment_command_version CHECK (
        result_version >= 1 AND resource_version >= 1
    )
);

CREATE INDEX ix_ct_assessment_command_expiry
    ON ct_assessment_command_dedup (expires_at);

INSERT INTO ct_assessment_definition (
    version, status, item_count, items_json, score_rules_json, score_rules_hash,
    license_source, boundary_copy, published_at
) VALUES (
    'relationship-response-v1',
    'PUBLISHED',
    8,
    '{"items":[{"item_id":"q01","prompt":"当对方一句话让你不确定时，你更可能先做什么？","options":[{"code":"A","text":"回看对方实际说了什么，区分确定和未知"},{"code":"B","text":"直接说明自己的理解，请对方确认"},{"code":"C","text":"先减少投入，观察是否需要设界限"},{"code":"D","text":"先让情绪降下来，晚一点再回应"}]},{"item_id":"q02","prompt":"对方没有按你期待的时间回复时，你更可能先做什么？","options":[{"code":"A","text":"核对是否约定了回复时间以及已有信息"},{"code":"B","text":"发一条清楚简短的询问"},{"code":"C","text":"暂停连续追问，把注意力放回自己的安排"},{"code":"D","text":"先离开聊天界面做一次情绪调节"}]},{"item_id":"q03","prompt":"一次冲突结束后，你更可能怎样继续？","options":[{"code":"A","text":"复盘冲突中具体发生的行为和原话"},{"code":"B","text":"用事实、感受和需要说明自己的立场"},{"code":"C","text":"明确暂时不接受的互动方式"},{"code":"D","text":"约定冷静后再继续讨论"}]},{"item_id":"q04","prompt":"当你感觉边界被触碰时，你更可能先做什么？","options":[{"code":"A","text":"确认边界是否表达过以及实际发生了什么"},{"code":"B","text":"直接说明边界和希望怎样调整"},{"code":"C","text":"停止让我不舒服的互动并保留空间"},{"code":"D","text":"先稳定情绪，避免在高点升级"}]},{"item_id":"q05","prompt":"当你很想得到关系确认时，你更可能怎么做？","options":[{"code":"A","text":"检查有哪些事实支持或不支持担心"},{"code":"B","text":"提出一次具体的确认请求"},{"code":"C","text":"限定追问次数并回到自己的生活"},{"code":"D","text":"觉察焦虑，等更平稳再决定"}]},{"item_id":"q06","prompt":"情绪到达高点时，你更可能选择什么？","options":[{"code":"A","text":"写下可观察事实，避免混入猜测"},{"code":"B","text":"告知需要暂停并约定恢复时间"},{"code":"C","text":"暂时离开可能继续伤害自己的情境"},{"code":"D","text":"通过呼吸、走动或休息先恢复稳定"}]},{"item_id":"q07","prompt":"当你发现自己可能把猜测当成事实时，你更可能怎样处理？","options":[{"code":"A","text":"把我看到的和我推测的分别列出"},{"code":"B","text":"向对方验证最关键的推测"},{"code":"C","text":"在不确定时不做超出边界的承诺"},{"code":"D","text":"接受暂时不知道，减少反复推演"}]},{"item_id":"q08","prompt":"准备下一步时，你更可能选择哪类本人可执行的小行动？","options":[{"code":"A","text":"选择一个能验证情况的小行动"},{"code":"B","text":"选择一句能清楚表达需要的话"},{"code":"C","text":"选择一个自己能执行的边界动作"},{"code":"D","text":"选择一个先恢复稳定的动作"}]}]}',
    '{"A":"evidence_checking","B":"direct_expression","C":"self_protection","D":"emotion_regulation"}',
    '680e58324b61608679bddfe88625a4461a7ca37f6bc63fbecb7b3cec52cfec5c',
    'AIChat 原创题库 relationship-response-v1；未使用第三方临床、人格或依恋量表',
    '这是当前任务下的非诊断性倾向，不是人格、依恋类型或长期标签。',
    '2026-07-19 00:00:00.000'
);
