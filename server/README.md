# AIChat Spring Boot 服务

这是中央规则编译后的 `contracts/openapi.generated.json` 的可编译落地层，并按 P0 Goal 渐进接入真实应用服务：

- 64 个 operationId 都有生成 Controller、类型化 Delegate、领域 owner 和五级鉴权注解。
- 业务实现只覆盖 Delegate，不直接编辑生成 Controller；未覆盖的 default method 显式返回 `501 API_NOT_IMPLEMENTED`。
- 当前已实现 Public 配置/安全资源、Visitor 会话/同意、Clarity 任务创建/六字段保存/本人读取，默认关闭的 8 题 Assessment、确定性计分、脱敏分享预览和核心映射，默认关闭的五段镜像、两轮结构化反思、确定性 Stub 密封完整卡和免费安全摘要，默认关闭的 8 回复/10 分钟受控倾诉、结构化总结确认和 `VENT` 核心映射，以及统一的无原文安全证据和最小 Operator 复核队列本地闭环。
- Visitor 使用数据库校验的短期 Opaque Bearer Token；只保存 Token、客户端实例和幂等键的 SHA-256 hash。
- 未完成 18+/政策同意的 Visitor 只能访问同意端点，其他互动接口默认拒绝。
- Principal、Internal 和 Operator 尚未接入时继续默认拒绝。
- Flyway V1 建立 Identity/Access 最小表；V2 建立 Clarity、加密内容版本、S1 安全元数据和领域幂等表；V3 建立版本题库、运行、密文答案、分享预览和 Assessment 命令去重表；V4 扩展镜像/反思状态并建立结构化反思、密封报告和报告命令去重表；V5 建立受控倾诉会话、密文回合、密文总结和作用域命令去重表；V6 建立应用层 append-only 安全证据、复核案例和复核命令去重表。
- 六字段入库前执行 PII 遮蔽与 S1；内容使用每版本独立 AES-256-GCM DEK，DEK 由环境主密钥包裹。GCM tag 随 JCA ciphertext 一起保存。
- Assessment 原始答案逐条使用相同 Envelope Encryption 边界，完成后 TTL 不超过 24 小时；计分规则只在服务端保存并校验 hash，结果不输出概率、诊断或人格/依恋标签。
- Generation 当前只使用显式标识的 `deterministic-stub-v1`：镜像、反思、免费摘要和完整卡分别加密保存；免费摘要可由本人读取，完整卡在 Entitlement 完成前继续返回生成 Delegate 的 `501 API_NOT_IMPLEMENTED`。
- Clarity S1 与 Report S2/S3 复用 `safety-policy-prototype-2026-07-19`；S2 在报告构建前检查已确认输入，S3 在结构校验后只检查用户/生成字段，任一非 `ALLOW` 均在报告写入前拒绝。286 次确定性原型样例只用于工程回归，不等同于 200+ 独立安全金样或生产安全批准。
- Venting 每轮先做 PII 遮蔽与共享 S1，再保存独立 Envelope Encryption 密文；服务端强制最多 8 个回复和 10 分钟，`BLOCK` 停止普通回复/总结/映射，Turn/Summary 最长 24 小时后由定时任务物理删除。幂等重放返回首次提交时的稳定快照，不受会话或映射任务后续推进影响。当前仅为 `deterministic-vent-stub-v1` 本地原型。
- Safety Evidence 只保存路由、类别、规则版本、资源引用等白名单元数据；`CLARIFY/BLOCK` 自动建立复核案例，详情固定为 `material_access=NONE`，reason/ticket 只保存 SHA-256。生产 Operator IdP/MFA 尚未接入并继续默认拒绝，测试正路径不构成生产人工闸证据。
- Report、Venting 与 Safety Review 的作用域幂等命令仅在 TTL 内参与重放；过期键在请求路径中先定向清理，并由定时任务兜底物理删除，避免已删除业务内容继续占用旧键。
- 微信支付回调保留原始 `byte[] rawBody`；签名适配器必须先校验时间戳、nonce、证书序列号、签名和原始报文，再返回 Internal subject。
- `@MakerChecker` 是契约元数据；高风险应用服务仍必须把命令先写为待审批状态，并保证申请人与审批人不同、审批前零生产效果。
- 资源所有权不能仅靠注解完成，必须在各领域应用服务加载资源时按当前 subject 再校验。
- `AuthClassificationResolver` 是运行时统一入口；`@AuthPolicy` 由编译器生成并携带规则 ID，业务开发者不得逐接口手写分类。

源码按 Java 17 release 编译，方便现有本机工具链验证；CI 和生产运行目标是架构规定的 JDK 25。

```bash
mvn -f server/pom.xml test
```

真实 MySQL 8 验证是显式 opt-in，不会被默认 H2 测试误触发。先准备一个专用空库和最小权限测试用户，再从 `server/` 执行：

```bash
export AICHAT_MYSQL_IT_URL='jdbc:mysql://127.0.0.1:3306/aichat_it?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true'
export AICHAT_MYSQL_IT_USERNAME='aichat_local'
export AICHAT_MYSQL_IT_PASSWORD="$(security find-generic-password -a aichat_local -s aichat-local-mysql -w)"
mvn -Dtest=RealMySqlV1ToV6IT -Daichat.mysql.it.enabled=true test
```

该测试验证空库 V1→V6、Safety Evidence 的 UNIQUE/CHECK/FK，以及 8 个同键并发请求只推进一次 Case 并只留下 1 条命令记录。凭据只从调用环境传入，不得提交到仓库。

本机与 aiinstock 共用 MySQL 时，复用 `aiinstock-mysql:3306` 实例和现有 `aiin_dev_dbuser1`，但应用必须使用独立 `aichat` schema，不得把 Flyway 指向 `aiin_dev_db01`。真实 MySQL 集成测试继续使用隔离的 `aichat_it` schema 和测试账号。aiinstock 本项目的 `scripts/local/docker-compose.override.yml` 已内置命名持久卷 `aiinstock-mysql-data`（数据走 Docker 具名卷，绕过 Docker Desktop 未共享 `/Applications/soft` 的限制），无需额外的外部 override：

```bash
# aiinstock 的 override.yml 会被 docker compose 自动加载，直接起 mysql 即可
docker compose \
  -f /Applications/soft/aiinstock-workspace/scripts/local/docker-compose.yml \
  up -d mysql

export AICHAT_DB_URL='jdbc:mysql://127.0.0.1:3306/aichat?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true'
export AICHAT_DB_USERNAME='aiin_dev_dbuser1'
# 先从 aiinstock 现有的本地 secret source 加载 MYSQL_PASSWORD；不要复制到 AIChat 仓库。
export AICHAT_DB_PASSWORD="${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
# 同时从本地 secret source 加载以下值；这里只做必填检查，不提供或落盘默认密钥。
: "${AICHAT_SESSION_TOKEN_KEY:?AICHAT_SESSION_TOKEN_KEY is required}"
: "${AICHAT_CONTENT_MASTER_KEY:?AICHAT_CONTENT_MASTER_KEY is required}"
: "${AICHAT_CONTENT_KEY_VERSION:?AICHAT_CONTENT_KEY_VERSION is required}"
mvn --batch-mode --no-transfer-progress spring-boot:run
```

Keychain 服务 `aichat-local-mysql` 仅供隔离的 `aichat_it` 测试账号使用。当前复用的 `aiin_dev_dbuser1` 是仅限本地开发的 schema 级 `ALL PRIVILEGES` 授权，不构成生产最小权限或数据库级防篡改证据；`aiin_dev_db01` 仍不属于 AIChat 迁移范围，生产环境也不能复用本地账号、Compose secret 或该 Keychain 项。

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
AICHAT_FEATURE_GENERATION_ENABLED=false
AICHAT_FEATURE_VENTING_ENABLED=false
AICHAT_IDEMPOTENCY_CLEANUP_MS=3600000
AICHAT_IDEMPOTENCY_CLEANUP_INITIAL_MS=3600000
```

不得把这些值写入仓库；真实微信支付和生产功能开关仍需单独授权。
