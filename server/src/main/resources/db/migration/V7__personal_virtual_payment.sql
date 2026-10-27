CREATE TABLE pay_virtual_buyer (
    buyer_id CHAR(64) NOT NULL COMMENT '由应用与微信身份派生的稳定买家标识',
    app_id VARCHAR(32) NOT NULL COMMENT '所属小程序AppID',
    encrypted_openid MEDIUMBLOB NOT NULL COMMENT '沿用Envelope Encryption封装的微信身份密文',
    created_at DATETIME(3) NOT NULL COMMENT '创建时间UTC',

    PRIMARY KEY (buyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='个人虚拟支付买家';

CREATE TABLE id_wechat_payment_session (
    visitor_session_id CHAR(26) NOT NULL COMMENT '保留原访客资源归属的应用会话',
    buyer_id CHAR(64) NOT NULL COMMENT '经微信登录验证的支付买家',
    encrypted_session_key MEDIUMBLOB COMMENT '当前设备应用会话的微信密钥密文',
    authenticated_at DATETIME(3) NOT NULL COMMENT '最近微信登录验证时间UTC',

    PRIMARY KEY (visitor_session_id),
    KEY ix_wechat_payment_buyer (buyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='微信支付登录态绑定';

CREATE TABLE pay_virtual_order (
    id CHAR(26) NOT NULL COMMENT '唯一业务订单号OutTradeNo',
    buyer_id CHAR(64) NOT NULL COMMENT '稳定支付买家标识',
    app_id VARCHAR(32) NOT NULL COMMENT '冻结的应用标识',
    environment_no INT NOT NULL COMMENT '请求环境0现网1沙箱',

    -- 商品与快照
    sku VARCHAR(16) NOT NULL COMMENT '基础报告职业报告或职业补差',
    product_id VARCHAR(128) NOT NULL COMMENT '已发布的微信道具ID',
    offer_id VARCHAR(32) NOT NULL COMMENT '冻结的虚拟支付账号',
    snapshot_key CHAR(64) NOT NULL COMMENT '基础测评与经历的规范指纹',
    input_hash CHAR(64) NOT NULL COMMENT '本次报告完整输入指纹',
    encrypted_snapshot MEDIUMBLOB NOT NULL COMMENT '可恢复的冻结报告输入密文',
    price_fen INT NOT NULL COMMENT '冻结成交价整数分数量固定1',
    base_order_id CHAR(26) COMMENT '补差依赖的原基础订单',
    active_upgrade_base_id CHAR(26) COMMENT '用于限制同一基础订单的有效升级',
    active_purchase_key CHAR(64) COMMENT '同一买家商品与快照的未决或有效购买键',
    idempotency_key_hash CHAR(64) NOT NULL COMMENT '调用方幂等键指纹',
    request_hash CHAR(64) NOT NULL COMMENT '创建请求语义指纹',

    -- 支付与权益事实
    payment_state VARCHAR(16) NOT NULL COMMENT 'PENDING PAID或CLOSED',
    refund_state VARCHAR(16) NOT NULL COMMENT 'NONE PROCESSING PARTIAL或COMPLETED',
    refunded_fen INT NOT NULL DEFAULT 0 COMMENT '已确认用户到账的累计退款分',
    entitlement_state VARCHAR(16) NOT NULL COMMENT 'NONE ACTIVE SUSPENDED或REVOKED',
    wx_order_id VARCHAR(128) COMMENT '官方查单返回的微信内部支付单号',
    channel_order_id VARCHAR(128) COMMENT '渠道商户单号保留原命名',
    wxpay_order_id VARCHAR(128) COMMENT '微信支付交易单号保留原命名',
    paid_fen INT COMMENT '已核实的原始实付分未核实保持空值',
    paid_at DATETIME(3) COMMENT '已核实的原始付款时间UTC',
    delivery_confirmed_at DATETIME(3) COMMENT '查单确认平台已发货时间UTC',
    last_query_attempt_at DATETIME(3) COMMENT '最近查询尝试时间不等同查询成功',
    next_query_at DATETIME(3) NOT NULL COMMENT '后续核验最早时间UTC',
    purchase_disclosure_version VARCHAR(64) NOT NULL COMMENT '用户确认的购买说明版本',
    report_version VARCHAR(32) NOT NULL COMMENT '冻结报告模板版本',
    encrypted_support MEDIUMBLOB COMMENT '本人售后诉求密文不等同已退款',
    support_requested_at DATETIME(3) COMMENT '售后登记时间UTC',
    created_at DATETIME(3) NOT NULL COMMENT '创建时间UTC',
    updated_at DATETIME(3) NOT NULL COMMENT '业务状态更新时间UTC',
    payment_prepared_at DATETIME(3) COMMENT '原生支付参数首次签发时间禁止未知状态换单重付',
    payment_preparation_key_hash CHAR(64) COMMENT '首次签发命令的幂等键指纹',
    encrypted_payment_parameters MEDIUMBLOB COMMENT '原签名响应密文仅原会话原登录态同键可取回',
    query_version BIGINT NOT NULL DEFAULT 0 COMMENT '查询申请顺序防止旧响应回退退款观察状态',

    PRIMARY KEY (id),
    UNIQUE KEY uq_virtual_request (buyer_id, idempotency_key_hash),
    UNIQUE KEY uq_virtual_active_purchase (active_purchase_key),
    UNIQUE KEY uq_virtual_active_upgrade (active_upgrade_base_id),
    UNIQUE KEY uq_virtual_platform_order (app_id, environment_no, wx_order_id),
    KEY ix_virtual_buyer_orders (buyer_id, id),
    KEY ix_virtual_query_due (next_query_at, payment_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='个人虚拟支付订单与报告权益';

CREATE TABLE pay_virtual_receipt (
    receipt_id CHAR(64) NOT NULL COMMENT '平台事实与来源的幂等指纹',
    order_id CHAR(26) NOT NULL COMMENT '原业务订单号',
    app_id VARCHAR(32) NOT NULL COMMENT '事实所属应用',
    environment_no INT NOT NULL COMMENT '冻结请求环境0现网1沙箱',
    receipt_kind VARCHAR(32) NOT NULL COMMENT '支付核验或独立退款事实',
    provider_order_id VARCHAR(128) NOT NULL COMMENT '保留事实所属平台单号',
    completed_refund_id VARCHAR(128) COMMENT '仅成功退款填写用于跨订单去重',
    amount_fen INT NOT NULL COMMENT '该事实的金额分',
    encrypted_evidence MEDIUMBLOB NOT NULL COMMENT '原始查询或已认证退款消息的加密证据',
    observed_at DATETIME(3) NOT NULL COMMENT '本地取得证据时间UTC',

    PRIMARY KEY (receipt_id),
    UNIQUE KEY uq_virtual_refund (app_id, environment_no, completed_refund_id),
    KEY ix_virtual_receipt_order (order_id, observed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='只追加的虚拟支付平台事实';
