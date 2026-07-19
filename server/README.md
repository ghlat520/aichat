# AIChat Spring Boot 骨架

这是中央规则编译后的 `contracts/openapi.generated.json` 的可编译落地层，不是已实现的业务服务：

- 63 个 operationId 都有 Controller 映射、领域 owner 和五级鉴权注解。
- Public 端点会进入 Controller，但当前统一返回 `501 API_NOT_IMPLEMENTED`。
- Visitor、Principal、Internal、Operator 在真实 `SubjectResolver` 接入前统一返回 401，默认拒绝。
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
npx --yes @redocly/cli@2.39.0 bundle contracts/openapi.yaml --output /tmp/fengshui-openapi-source.json --ext json
node contracts/compile-auth-rules.mjs /tmp/fengshui-openapi-source.json contracts/auth-rules.yaml contracts/openapi.generated.json
node contracts/check-auth-contract.mjs contracts/openapi.generated.json
node contracts/generate-api-skeleton.mjs contracts/openapi.generated.json
```
