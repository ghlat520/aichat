# G8 前端验收计划（本轮 goal）

> 状态基线：2026-07-21｜工程：`aichat`｜产品：关系清晰卡
> 本文档是本轮 `/goal` 的施工图纸。权威来源：`docs/P0_IMPLEMENTATION_GOAL.md`、`docs/AICHAT_WECHAT_MINIPROGRAM_PRD_2026-07-18.md`、`contracts/openapi.generated.json`。

## 0. 本轮范围与排除

**做**：小程序页面 + 状态管理 + 路由骨架；页面 ↔ 已实现 G1-G4 API 全链对接；AC-11~25 代码层证据映射。

**排除（下一个 goal / 人类闸）**：
- G5/G6/G7 后端实现 → 下个 goal。其接口在后端为显式 `501`，前端 Client 层捕获并显示"功能开发中"。
- G1-G4 的人类签字闸（真实支付/Operator IdP/危机流程/200+ 安全金样）→ 不碰。
- 真实支付、真实推送、生产部署、自动 commit/push。

## 1. 现状基线（已侦察，硬事实）

| 项 | 状态 |
|----|------|
| 小程序页面 | **零**——`miniprogram/` 下只有 `services/api/`（生成的 TS Client），无 `app.json`、无 `pages/`、无 `project.config.json` |
| 生成 Client | `miniprogram/services/api/`（`generated/client.ts` + `generated/types.ts` + `wx-transport.ts`）✅ 存在 |
| 后端 Controller | 15 个模块 Controller 全部存在（生成型，挂 Delegate） |
| 已实现业务 | G1-G4：Visitor 会话 / 18+ 同意 / Opaque Token / 六字段 / PII 遮蔽 / 镜像 / 两轮反思 / Stub 密封报告 / S1-S3 / 受控倾诉（`EVIDENCE_COMPLETE`，卡人类闸） |
| 未实现业务 | G5（action/privacy/support）/ G6（catalog/order/payment/refund）/ G7（ops）—— Delegate 返回 `501 API_NOT_IMPLEMENTED` |
| 鉴权字段 | `x-auth-level` ∈ {`VISITOR`, `PRINCIPAL`} + `x-auth-rule-id`（中央规则生成，不手写） |
| 功能开关 | Assessment/Generation/Venting 默认 `false`，靠 `AICHAT_FEATURE_*_ENABLED` 开启 |
| 契约操作数 | 110 个 operationId（57 路径） |

## 2. 页面清单与路由图

主数据流（P0_IMPLEMENTATION_GOAL §3.4）：
```
边界/18+ → 匿名会话 → 三入口之一 → 六字段核心 → S1 → 镜像确认 → 两轮反思 → S2 → 结构报告 → S3 → SEALED_READY → 免费摘要 → 行动 → 72h/D7 → 结束
                                                                      ↓
                                                              （单次订单/支付/权益 = G6，本轮 stub）
```

### 2.1 页面树（本轮落地）

| 页面路径 | 对应 P0/Goal | 对接 API（operationId） | 本轮状态 |
|---------|-------------|----------------------|---------|
| `pages/entry/entry` | P0-01 边界/18+ (G1) | `createVisitorSession`、`recordConsent`、`getAppConfig`、`getSafetyResources` | **实现** |
| `pages/assessment/assessment` | P0-03 自测 (G2) | `getCurrentAssessment`、`createAssessmentRun`、`putAssessmentAnswer`、`completeAssessmentRun`、`mapAssessmentToTask` | **实现**（开关默认关，UI 提示） |
| `pages/share-card/share-card` | P0-04 分享预览 (G2) | `createAssessmentShareCard` | **实现** |
| `pages/clarity-edit/clarity-edit` | P0-06 六字段 (G3) | `createClarityTask`、`putClarityFields` | **实现** |
| `pages/mirror/mirror` | P0-08 镜像 (G3) | `createTaskMirror`、`confirmTaskMirror` | **实现** |
| `pages/reflection/reflection` | P0-09 两轮反思 (G3) | `createTaskReflection` | **实现** |
| `pages/report/report` | P0-10 报告/免费摘要 (G3) | `createTaskReport`、`getFreeReportSummary`、`getSealedReport` | **实现**（完整卡 Stub） |
| `pages/venting/venting` | P0-05/07 倾诉 (G4) | `createVentSession`、`createVentTurn`、`finishVentSession`、`confirmVentSummary` | **实现**（开关默认关，限轮限时） |
| `pages/safety/safety` | 高风险免费安全页 (G4) | `getSafetyResources` | **实现**（不可关闭） |
| `pages/order/order` | P0-11 订单 (G6) | `createOrder`、`createWechatPrepay` | **stub**（捕获 501，显示"功能开发中"） |
| `pages/action/action` | P0-13 行动 (G5) | `putTaskAction` | **stub**（501） |
| `pages/data-control/data-control` | P0-15 数据控制 (G5) | `listMyTasks`、`getMyDataMap`、`createPrivacyExport`、`createDeletionRequest` | **stub**（501，但 UI 框架在） |
| `pages/support/support` | P0-17 售后 (G5) | `createSupportTicket` | **stub**（501） |

**三入口**（PRD UJ-08）：自测 / 关系核心 / 深夜倾诉 → 都汇入六字段核心。

### 2.2 路由守卫（不变量 INV-01）

- `entry` 完成前，所有互动页拒绝进入（重定向回 `entry`）。
- 守卫依据：全局会话状态中的 `consentRecord.policyVersion === current` 且 `ageConfirmed === true`。
- Token 失效 → `refreshSessionToken`，失败回 `entry`。

## 3. 全局状态模型

```
AppState
├─ session: { sessionId, token, refreshToken, expiresAt }
├─ consent: { policyVersion, ageConfirmed, consentedAt }
├─ currentPath: 'entry'|'assessment'|'clarity'|'venting'|...
├─ activeTask: { taskId, fields, mirrorState, reflectionRound, reportState }
├─ venting: { ventSessionId, turnCount, startedAt, summaryConfirmed }
└─ featureFlags: { assessment, generation, venting }  // 来自 getAppConfig
```

- 持久化：`wx.setStorageSync` 仅存 `session` + `consent`（token 走内存为主，刷新容忍回退）。
- **PII 不入库**（INV-08/AC-22）：`activeTask.fields` 原文只在内存/页面生命周期，不写 storage。

## 4. AC-11~25 → 证据映射初稿

| AC | 一句话 | 本轮代码层证据载体 | 分类 |
|----|--------|------------------|------|
| AC-11 | 18+ 确认前置；自测 6-8 题 | `entry` 守卫单测 + `assessment` 题数断言 + E2E | AUTO_VERIFIED |
| AC-12 | 分享预览可取消；脱敏 0 泄漏 | `share-card` E2E + 网络层 PII 遮蔽断言（样本子集，200 样例属人类闸） | AUTO_VERIFIED（子集）/ HUMAN_GATED（200 样例） |
| AC-13 | 报告六字段/复述/解释/行动完整率 100% | `report` 渲染完整性单测 | AUTO_VERIFIED |
| AC-14 | 高风险金样三处阻断 100% | **依赖 200+ 金样（人类闸）**；本轮只验路由到 `safety` 页 | HUMAN_GATED |
| AC-15 | 读心/诊断/预测高严重输出为 0 | **依赖安全评测（人类闸）** | HUMAN_GATED |
| AC-16 | 倾诉第 8 回合或 10 分钟停止；总结五字段 | `venting` 限轮限时单测 + 五字段完整性断言 | AUTO_VERIFIED |
| AC-17 | 支付确认页完整展示（主体/价格/交付/退款/无续费） | `order` 页渲染完整性单测（支付本身 stub） | AUTO_VERIFIED（UI）/ BLOCKED_BY_G6（真实支付） |
| AC-18 | 完整卡 ≤3 低风险行动；7 天复盘不二次收费 | **依赖 G5/G6 后端** | BLOCKED_BY_G5G6G7 |
| AC-19 | 删除原始输入和报告；24h 回执 | **依赖 G5 后端**；本轮 `data-control` 页框架 + 501 分支 | BLOCKED_BY_G5G6G7 |
| AC-20 | 页面显示 AI/题库/模型/政策/报告版本；纠错不静默重算 | 全局版本横幅渲染单测 + AC-20 E2E | AUTO_VERIFIED |
| AC-21 | 支付重复/超时/故障注入；重复扣款 0 | **依赖 G6 后端** | BLOCKED_BY_G5G6G7 |
| AC-22 | PII 遮蔽；日志/事件/实验仓 0 命中 | 网络层 PII 遮蔽单测 + Client 不记原文断言 | AUTO_VERIFIED（前端层） |
| AC-23 | 不存在恋人/闺蜜/导师人格等 | 文案审计脚本 grep（人格/亲密度/签到等关键词 0 命中） | AUTO_VERIFIED |
| AC-24 | 高线/三四线同 SKU 同价实验 | **依赖 G7 实验 + SC-19（人类闸）** | BLOCKED_BY_G5G6G7 |
| AC-25 | 独立开关；Fail-Closed；免费安全页/删除/纠错可用 | `featureFlags` 下拉 + `safety` 页开关无关性单测 | AUTO_VERIFIED |

**初稿结论**：15 条 AC 中，本轮代码层可 `AUTO_VERIFIED` 约 9 条（AC-11/13/16/17-UI/20/22/23/25 + AC-12 子集），`HUMAN_GATED` 3 条（AC-14/15 + AC-12 全量），`BLOCKED_BY_G5G6G7` 4 条（AC-18/19/21/24）。终态矩阵以实际为准。

## 5. E2E 用例清单（每核心页 ≥1 条）

| 用例 | 页面 | 断言 |
|------|------|------|
| E2E-01 未同意不能进入自测 | entry→assessment | 重定向回 entry |
| E2E-02 同意后进入自测并完成 | entry→assessment→map | 命中 task |
| E2E-03 六字段提交后镜像 | clarity→mirror | 镜像内容回显 |
| E2E-04 两轮反思后生成免费摘要 | reflection→report | 摘要字段完整 |
| E2E-05 倾吐第 8 回合停止 | venting | turnCount=8 拒绝继续 |
| E2E-06 高风险输入路由到安全页 | 任意→safety | 不进入支付 |
| E2E-07 订单页 stub 提示 | order | 显示"功能开发中" |
| E2E-08 PII 不出现在网络请求体 | clarity | 请求体字段遮蔽 |

## 6. 执行切片（4 阶段，40 turns）

- **阶段 1（t1-6）**：本计划 + 拓扑/风险文档 + `app.json`/`project.config.json` 脚手架 + 全局状态 store。
- **阶段 2（t7-18）**：13 个页面骨架 + 路由守卫 + 状态跨页保持。验收：tsc 全绿 + 页面可渲染。
- **阶段 3（t19-30）**：逐页接 Client（G1-G4 实现，G5/G6 stub 501）+ 8 条 E2E + 截图。验收：E2E 全绿 + PII 遮蔽断言通过。
- **阶段 4（t31-40）**：AC 矩阵 + 全量回归（mvn test + tsc + 契约无漂移）。

## 7. 验收命令（README 权威）

```bash
# 改了 contracts/openapi.yaml 才跑前 5 步
npx --yes @redocly/cli@2.39.0 bundle contracts/openapi.yaml --output /tmp/aichat-openapi-source.json --ext json
node contracts/compile-auth-rules.mjs /tmp/aichat-openapi-source.json contracts/auth-rules.yaml contracts/openapi.generated.json
node contracts/check-auth-contract.mjs contracts/openapi.generated.json
node --test contracts/compile-auth-rules.test.mjs
node contracts/generate-api-skeleton.mjs contracts/openapi.generated.json
# 每轮必跑
mvn --file server/pom.xml --batch-mode --no-transfer-progress test
npx --yes -p typescript@5.9.3 tsc -p miniprogram/services/api/tsconfig.json
```

## 8. 2026-07-23 修复复验记录

本节记录修复方本地证据，不替代独立闸 4 签字，也不扩大 G5/G6/G7 和人类安全闸范围。

| 验证 | 结果 | 证据边界 |
|------|------|----------|
| 原始 E2E-01～08 | **8 PASS / 0 FAIL，exit 0** | 只通过可见 WXML 元素输入/点击；活动 runner 不调用页面 `setData`、`callMethod` 或 `e2eState` |
| 13 个 `app.json` 注册页面 smoke | **13 PASS / 0 FAIL，exit 0** | 每页等待可见终态；loading 本身不计通过 |
| store / PII 单测 | **11 PASS / 0 FAIL** | 业务临时态不写 storage；最终请求体递归遮蔽邮箱和手机号 |
| 后端 `mvn test` | **54 PASS / 0 FAIL** | 包含 Principal 到达订单契约并返回显式 `501 API_NOT_IMPLEMENTED` |
| 截图 canary | **预期失败，exit 1** | 强制截图失败会让 E2E-01 失败 |
| selector canary | **预期失败，exit 1** | 强制缺失可见元素会让 E2E-01 失败 |
| 网络 PII canary | **预期失败，exit 1** | 在实际 `PUT /fields` 捕获请求体注回原始手机号后，E2E-08 失败 |
| Stable 2.01.2510290 手动复验 | **通过** | computer-use 从入口逐题完成 8 题；“查看分享预览”打开脱敏卡；干净页面栈中“继续校准”进入六字段 |

当前有效截图仅保留在 `docs/e2e-screenshots/` 根目录，共 8 张且 SHA-256 全部不同。旧假绿截图保存在
`docs/e2e-screenshots/archive/false-green-20260722/`，只用于审计历史。

本地结论：修复方证据已满足原 E2E-01～08、13 页终态、network PII、高风险路由、第 8 回合限制和订单
501 分支的复验条件；生产部署、真实支付、200+ 安全金样和独立闸 4 签字仍不在本结论内。
