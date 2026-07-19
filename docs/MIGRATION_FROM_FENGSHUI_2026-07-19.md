# AIChat 独立项目迁移记录

## 边界

本迁移只处理误放在 `fengshui` Git 根目录中的 AIChat 新产品资产。`fengshui` 已跟踪文件、原有 `backend/`、`frontend/`、测试截图、`.gitignore` 修改以及其他用户工作均不在迁移和清理范围内。

## 源到目标映射

| 原误放路径 | AIChat 目标路径 |
|---|---|
| `CONTEXT.md` | `docs/UBIQUITOUS_LANGUAGE.md` |
| `KENTANG2017_REPO_AUDIT.md` | `docs/KENTANG2017_REPO_AUDIT_2026-07-18.md` |
| `RELATIONSHIP_CLARITY_MVP_PRODUCT_SPEC_2026-07-18.md` | `docs/AICHAT_MVP_PRODUCT_SPEC_2026-07-18.md` |
| `RELATIONSHIP_CLARITY_MVP_ARCHITECTURE_2026-07-18.md` | `docs/AICHAT_MVP_ARCHITECTURE_2026-07-18.md` |
| `WECHAT_MINIPROGRAM_MVP_RESEARCH_PRD_2026-07-18.md` | `docs/AICHAT_WECHAT_MINIPROGRAM_PRD_2026-07-18.md` |
| `.github/workflows/openapi-contract.yml` | `.github/workflows/openapi-contract.yml` |
| `contracts/` | `contracts/` |
| `server/` 源码、POM 和 README | `server/`，不迁移 `target/` |
| `miniprogram/services/api/` | `miniprogram/services/api/` |

## 工程标识变更

- Git 根目录：独立的 `aichat/` 仓库根目录
- Java 包：`com.relationshipclarity` → `com.aichat`
- 启动类：`RelationshipClarityApplication` → `AiChatApplication`
- Maven artifact：`relationship-clarity-server` → `aichat-server`
- 小程序 Client：`ClarityApiClient` → `AiChatApiClient`

原目录清理必须在目标项目全链路验证通过后执行，并使用可恢复隔离而非永久删除。

## 清理结果

- 状态：`quarantined`，未永久删除。
- 完成时间：`2026-07-19T10:25:48+08:00`。
- 隔离条目：9 组；每组均记录 SHA-256 和原始路径。
- 恢复清单：保留在开发者本机的 Codex 隔离区，不纳入仓库。
- 保留期：30 天，计划于 `2026-08-18 10:30`（Asia/Singapore）复核。

清理后复核显示：`fengshui` 只剩其原有业务代码修改、测试截图和 `.claude/scheduled_tasks.lock`；AIChat 文档、契约、服务端骨架、小程序 API Client 和 CI 工作流均已从其工作树移除。

本机受控删除策略禁止 Codex 永久删除隔离区，且 `codex-safe-delete` 没有 purge 命令。因此 30 天任务只会重新验证迁移完整性并提醒用户手动永久清理，不会绕过或修改全局删除安全策略。
