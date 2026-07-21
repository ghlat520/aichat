# AIChat

AIChat 是“关系清晰卡”微信小程序的独立工程。工程名与 Git 仓库名固定为 `aichat`；当前 P0 产品名仍为“关系清晰卡”。

## 工程结构

- `docs/`：PRD、MVP 产品规格、架构设计、领域语言和第三方仓库审计。
- `contracts/`：业务 OpenAPI 源码、中央鉴权规则、编译契约和代码生成器。
- `server/`：Java 17 源码兼容、JDK 25 运行目标的 Spring Boot 模块化单体；使用 MyBatis、Flyway 和 MySQL 8。
- `miniprogram/services/api/`：由编译契约生成的小程序 TypeScript Client。
- `.github/workflows/`：契约、Java 和 TypeScript 持续集成门禁。

## 权威来源

`contracts/openapi.yaml` 只维护业务接口，`contracts/auth-rules.yaml` 集中维护 Public、Private、Admin 和 Internal 分类，二者编译生成 `contracts/openapi.generated.json`。业务开发者不得逐接口手写鉴权等级。

## 本地验证

```bash
npx --yes @redocly/cli@2.39.0 bundle contracts/openapi.yaml --output /tmp/aichat-openapi-source.json --ext json
node contracts/compile-auth-rules.mjs /tmp/aichat-openapi-source.json contracts/auth-rules.yaml contracts/openapi.generated.json
node contracts/check-auth-contract.mjs contracts/openapi.generated.json
node --test contracts/compile-auth-rules.test.mjs
node contracts/generate-api-skeleton.mjs contracts/openapi.generated.json
mvn --file server/pom.xml --batch-mode --no-transfer-progress test
npx --yes -p typescript@5.9.3 tsc -p miniprogram/services/api/tsconfig.json
```

当前按 [P0 持续实施目标](docs/P0_IMPLEMENTATION_GOAL.md) 分阶段交付。已经实现 Public 配置/安全资源、匿名 Visitor 会话、18+ 同意、数据库令牌鉴权，Clarity 任务/六字段的 PII 遮蔽、Envelope Encryption 和共享 S1/S2/S3 原型安全策略，默认关闭的原创 8 题 Assessment、确定性计分、脱敏分享预览和核心映射，默认关闭的五段镜像、两轮结构化反思、`deterministic-stub-v1` 密封完整卡和免费安全摘要，默认关闭的受控 8 回复/10 分钟深夜倾诉、结构化总结确认和 `VENT` 核心映射，以及不读取原文的统一安全证据和 Operator 复核队列本地闭环；其余能力仍按 Goal 状态实施，未实现接口保持显式 `501`，不会伪装成功。

本仓库不表示微信公开上线、真实支付、生产 AI 服务、真实 Operator/人工复核或合规审批已经完成。生产启动必须通过环境变量提供 `AICHAT_DB_URL`、`AICHAT_DB_USERNAME`、`AICHAT_DB_PASSWORD`、至少 32 字节 Base64 编码的 `AICHAT_SESSION_TOKEN_KEY`、恰好 32 字节 Base64 编码的 `AICHAT_CONTENT_MASTER_KEY` 和 `AICHAT_CONTENT_KEY_VERSION`；Assessment、Generation 与 Venting 即使代码就绪也默认关闭，只有受控环境分别显式设置 `AICHAT_FEATURE_ASSESSMENT_ENABLED=true`、`AICHAT_FEATURE_GENERATION_ENABLED=true`、`AICHAT_FEATURE_VENTING_ENABLED=true` 才开放。当前完整卡和倾诉回复只由本地确定性 Stub 生成，生产 Operator 身份仍默认拒绝；权益领域完成前 `GET /reports/{id}` 继续显式不可用。测试使用隔离的 H2 MySQL 模式数据库、非生产测试密钥和仅测试上下文可见的 Operator 身份。
