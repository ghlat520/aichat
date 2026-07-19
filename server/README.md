# AIChat Spring Boot 服务

这是中央规则编译后的 `contracts/openapi.generated.json` 的可编译落地层，并按 P0 Goal 渐进接入真实应用服务：

- 63 个 operationId 都有生成 Controller、类型化 Delegate、领域 owner 和五级鉴权注解。
- 业务实现只覆盖 Delegate，不直接编辑生成 Controller；未覆盖的 default method 显式返回 `501 API_NOT_IMPLEMENTED`。
- 当前已实现 Public 配置/安全资源、Visitor 会话/同意、Clarity 任务创建/六字段保存/本人读取，以及默认关闭的 8 题 Assessment、确定性计分、脱敏分享预览和核心映射。
- Visitor 使用数据库校验的短期 Opaque Bearer Token；只保存 Token、客户端实例和幂等键的 SHA-256 hash。
- 未完成 18+/政策同意的 Visitor 只能访问同意端点，其他互动接口默认拒绝。
- Principal、Internal 和 Operator 尚未接入时继续默认拒绝。
- Flyway V1 建立 Identity/Access 最小表；V2 建立 Clarity、加密内容版本、S1 安全元数据和领域幂等表；V3 建立版本题库、运行、密文答案、分享预览和 Assessment 命令去重表。
- 六字段入库前执行 PII 遮蔽与 S1；内容使用每版本独立 AES-256-GCM DEK，DEK 由环境主密钥包裹。GCM tag 随 JCA ciphertext 一起保存。
- Assessment 原始答案逐条使用相同 Envelope Encryption 边界，完成后 TTL 不超过 24 小时；计分规则只在服务端保存并校验 hash，结果不输出概率、诊断或人格/依恋标签。
- 微信支付回调保留原始 `byte[] rawBody`；签名适配器必须先校验时间戳、nonce、证书序列号、签名和原始报文，再返回 Internal subject。
- `@MakerChecker` 是契约元数据；高风险应用服务仍必须把命令先写为待审批状态，并保证申请人与审批人不同、审批前零生产效果。
- 资源所有权不能仅靠注解完成，必须在各领域应用服务加载资源时按当前 subject 再校验。
- `AuthClassificationResolver` 是运行时统一入口；`@AuthPolicy` 由编译器生成并携带规则 ID，业务开发者不得逐接口手写分类。

源码按 Java 17 release 编译，方便现有本机工具链验证；CI 和生产运行目标是架构规定的 JDK 25。

```bash
mvn -f server/pom.xml test
```

重新生成 Controller 和小程序 Client：

```bash
npx --yes @redocly/cli@2.39.0 bundle contracts/openapi.yaml --output /tmp/aichat-openapi-source.json --ext json
node contracts/compile-auth-rules.mjs /tmp/aichat-openapi-source.json contracts/auth-rules.yaml contracts/openapi.generated.json
node contracts/check-auth-contract.mjs contracts/openapi.generated.json
node contracts/generate-api-skeleton.mjs contracts/openapi.generated.json
```

生产运行需要：

```text
AICHAT_DB_URL=jdbc:mysql://<host>:3306/<database>?serverTimezone=UTC
AICHAT_DB_USERNAME=<database-user>
AICHAT_DB_PASSWORD=<secret-manager-reference>
AICHAT_SESSION_TOKEN_KEY=<base64-encoded-32-byte-or-longer-key>
AICHAT_CONTENT_MASTER_KEY=<base64-encoded-exactly-32-byte-key>
AICHAT_CONTENT_KEY_VERSION=<active-key-version>
AICHAT_FEATURE_ASSESSMENT_ENABLED=false
```

不得把这些值写入仓库；真实微信支付和生产功能开关仍需单独授权。
