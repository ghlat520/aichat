# 小程序 API Client 骨架

`generated/` 由中央鉴权规则编译后的 `contracts/openapi.generated.json` 生成，只包含 Public、Visitor 和 Principal 接口及其请求类型；
Internal 微信支付回调、Operator 运营接口和它们的 DTO 都不会进入小程序包。

先把 OpenAPI bundle 为 JSON，再生成并检查 TypeScript：

```bash
npx --yes @redocly/cli@2.39.0 bundle contracts/openapi.yaml -o /tmp/fengshui-openapi-source.json --ext json
node contracts/compile-auth-rules.mjs /tmp/fengshui-openapi-source.json contracts/auth-rules.yaml contracts/openapi.generated.json
node contracts/generate-api-skeleton.mjs contracts/openapi.generated.json
npx --yes -p typescript@5.9.3 tsc -p miniprogram/services/api/tsconfig.json
```

调用方必须注入 `TokenProvider`、`HttpTransport` 和幂等键工厂。Token 被视为不透明字符串，
Client 不解析 JWT，也不会持久化 Token；持久化策略由小程序身份模块负责。
