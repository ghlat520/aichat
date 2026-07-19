# AIChat

AIChat 是“关系清晰卡”微信小程序的独立工程。工程名与 Git 仓库名固定为 `aichat`；当前 P0 产品名仍为“关系清晰卡”。

## 工程结构

- `docs/`：PRD、MVP 产品规格、架构设计、领域语言和第三方仓库审计。
- `contracts/`：业务 OpenAPI 源码、中央鉴权规则、编译契约和代码生成器。
- `server/`：Java 17 源码兼容、JDK 25 运行目标的 Spring Boot 模块化单体骨架。
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

本仓库目前是代码与契约骨架，不表示微信公开上线、真实支付、生产 AI 服务或合规审批已经完成。
