# 本地服务拓扑（G8 起服务前 Hard Gate · Phase 1）

> 依据：用户私有铁律 `local-service-startup`——本地启动前必须先画拓扑 + 风险清单，未完成禁止输出启动命令。
> 本文是**分析文档**，不含启动命令。启动命令在 Phase 2（风险清单完成且自检通过）后才产出。

## 1. 进程与端口

| 进程 | 角色 | 端口（默认/待定） | 启动方式 | 依赖 |
|------|------|----------------|---------|------|
| MySQL 8 | 业务库 | 3306 | 本地 Docker / 宿主 | Flyway V1-V7 已应用 |
| aichat-server | Spring Boot 单体 | 18088（local profile；只绑定 127.0.0.1） | `npm run server:local` | MySQL + 环境变量 |
| 微信开发者工具 | 小程序宿主 | 自动 | 微信开发者工具 CLI / IDE | 指向 `miniprogram/` 目录 |
| 微信工具自动化 + CDP | E2E | 9420 / 9222 | `scripts/e2e/*.mjs` | server 起来 + Stable 2.01.2510290 |

> `application-local.properties` 设置独立端口 18088；启动入口用命令行参数明确端口及 loopback 绑定。8080 当前属于 moneyprinterturbo-api，保持运行。`spring.flyway.clean-disabled=true`（不允许 Flyway clean）。

## 2. 环境变量清单（启动必需，缺一不可）

来自 `server/src/main/resources/application.properties`（全 `${VAR}` 无默认值的为必填）：

| 变量 | 必填 | 说明 | 本地测试值来源 |
|------|------|------|--------------|
| `AICHAT_DB_URL` | ✅ | MySQL JDBC URL | `jdbc:mysql://localhost:3306/aichat?...`（自建库） |
| `AICHAT_DB_USERNAME` | ✅ | DB 用户 | 本地 MySQL 账号 |
| `AICHAT_DB_PASSWORD` | ✅ | DB 密码 | 本地 MySQL 密码 |
| `AICHAT_SESSION_TOKEN_KEY` | ✅ | ≥32 字节 Base64 | 测试密钥（非生产） |
| `AICHAT_CONTENT_MASTER_KEY` | ✅ | 恰好 32 字节 Base64 | 测试密钥（非生产） |
| `AICHAT_CONTENT_KEY_VERSION` | 可选 | 默认 `v1` | — |
| `AICHAT_FEATURE_ASSESSMENT_ENABLED` | 可选 | 默认 `false`；本轮 E2E 需 `true` | `true` |
| `AICHAT_FEATURE_GENERATION_ENABLED` | 可选 | 默认 `false`；报告生成需 `true` | `true` |
| `AICHAT_FEATURE_VENTING_ENABLED` | 可选 | 默认 `false`；倾诉 E2E 需 `true` | `true` |

## 3. 数据流与鉴权

- 鉴权：中央规则编译生成 `x-auth-level`（`VISITOR`/`PRINCIPAL`）+ `x-auth-rule-id`。Controller 挂 `@AuthPolicy`。
- 会话：匿名 Visitor → `POST /sessions` 拿 sessionId/token → 同意 18+ → 后续请求带 Opaque Token。
- Token：不落日志（INV-08）。`POST /tokens/refresh` 续期。
- 测试库：`src/test/resources/application.properties` 用 H2 MySQL 模式 + 非生产密钥（隔离，禁连生产）。

## 4. 配置来源

- 后端配置：`server/src/main/resources/application.properties`（生产环境变量驱动）+ `src/test/resources/application.properties`（测试 H2）。
- 小程序配置：`miniprogram/services/api/`（生成 Client）+ `miniprogram/app.json`。
- 契约真相源：`contracts/openapi.yaml` + `contracts/auth-rules.yaml` → 编译 → `contracts/openapi.generated.json`。

## 5. 小程序 ↔ 后端连通

- 小程序通过 `wx-transport.ts` 调后端（`wx.request` 封装）。
- 本地开发：微信开发者工具需配"不校验合法域名"或本地证书，指向 `http://127.0.0.1:18088`。
- 原生小程序 E2E 已选微信开发者工具自动化端口（9420）+ 页面渲染 CDP（9222）；不走 Web 模式。

## 6. 待确认项（Phase 2 前必须落实）

- [x] `server.port` 实际为 18088，仅监听 127.0.0.1；最终 Java PID 51924
- [x] MySQL 8 已运行，aichat 已成功应用 V1–V7
- [x] 沿用 .env.local 原密钥；123/123 行 wrapped DEK 认证成功，不生成替代密钥
- [x] 微信开发者工具 Stable 2.01.2510290 已安装，CLI / 自动化端口可用
- [x] 小程序 E2E 已选微信开发者工具自动化 + CDP

本地配置从被 Git 忽略的 .env.local 通过 Node 内置 parseEnv 读取，环境变量优先；不执行 shell source。MySQL JDBC 直连 127.0.0.1:3306，不经过 HTTP 代理；现有开发者工具允许本地请求。此次不访问外部 AI 或支付服务。

最终实际路径：小程序 apiBase=127.0.0.1:18088 → AIChat Java PID 51924（local）→ MySQL 127.0.0.1:3306/aichat；Flyway v7 无待迁移。API 10 项与原生模拟器 7 项通过。
