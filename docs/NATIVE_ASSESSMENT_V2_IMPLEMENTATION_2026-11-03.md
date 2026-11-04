---
documentType: implementation-notes
project: aichat
module: 自测 V2（MBTI · VIA · 16 型探索）
asOf: 2026-11-03（V2 原型提交 92d4442 → 原生接入 35bb3d1 / 001ace0 / 669e8f6）
source: docs/ui/self-growth-{mbti,via,types}.js + docs/ui/self-growth-prototype.html（V2 目录 27 屏中的自测 9 页）
target: miniprogram/（微信小程序原生实现）
---

# 自测 V2 原生实现与数据模型（2026-11-03）

对应原型 V2（`92d4442 feat(ui): V2 统一 MBTI、VIA 与十六型探索原型`）。本文记录原生落点、数据契约、本地存储数据模型与验证证据，作为 [V1.2 实现复核](NATIVE_GROWTH_IMPLEMENTATION_REVIEW_2026-10-26.md) 的 V2 增补。

**边界**：全部为前端本地实现——题目与计分为固定样例/探索性自评，VIA 与 16 型数据以脚本从原型源机械提取（逐字一致）；不连接后端，**服务端 API 与数据库无任何变更**（`contracts/openapi.yaml` 不涉及）。虚拟支付链路不变。

## 一、页面与路由（自测 9 屏）

| # | 原型 screen | 原生页面 | 关键交互 | 变更类型 |
| --- | --- | --- | --- | --- |
| 1 | discover | `pages/assessment/assessment`（catalog 模式） | 16 型轻阅读 teaser、MBTI/VIA/对照三卡、MBTI 继续作答卡、免费结果回看 | 重构 |
| 2 | mbti-types | `pages/mbti-types/mbti-types` | 看自己/看 TA、类型 picker、NT/NF/SJ/SP 分组、16 卡（4 优点/4 盲点）、带类型互跳 | 新增 |
| 3 | intro | `pages/growth-intro/growth-intro?tool=mbti` | 四维介绍、40 题作答说明、ENTP 样例入口 | V1（11-03 上午接入） |
| 4 | question | `pages/growth-question/growth-question?tool=mbti[&page=1-4\|&q=1-40]` | 五档圆圈、选中即存 320ms 自动切题、四步跳维、末题查漏 | V1 |
| 5 | result | `pages/growth-result/growth-result?tool=mbti[&sample=1]` | ENTP 摘要卡+八维雷达+性格分析+**新增探索双链接**（→mbti-types / via-mbti，固定 ENTP 类型） | 增补 |
| 6 | via-intro | `pages/via-intro/via-intro` | 六美德介绍、开始/继续/样例三入口 | 新增 |
| 7 | via-question | `pages/via-question/via-question[?q=1-72]` | 72 题一题一卡、五档圆圈带文字标签、美德维度 picker 跳组首未答、暂停面板 | 新增 |
| 8 | via-result | `pages/via-result/via-result` | Top5 + 完整 24 项条形排序；`preview=true` 为排版样例（不写入完成记录） | 新增 |
| 9 | via-mbti | `pages/via-mbti/via-mbti[?code=XXXX]` | 16 型 × 5 优势对照、类型筛选、"责任/适应"标补充描述、带类型返回 16 型卡 | 新增 |

**V2 退休的入口**（原型语义：旧 URL 兼容、数据保留）：自测首页的三枚轻入口、借力量 teaser、名人观察 teaser、关系轻自测入口。关系轻自测迁至"我的"（`pages/profile` → `#profile-relationship-entry` → `reLaunch /pages/assessment/assessment?relationship=1`；switchTab 不支持 query）。traits/strengths 两项测评及其页面（growth-intro/question/result 的通用分支、portrait、growth-report 等）保留注册与数据，仅不再从当前自测流程暴露。

**MBTI 与 VIA 共用的答题交互语义**（移植自 MBTI 已验证实现）：选中即持久化（不等定时器）、定时器仅负责 320ms 后切题、任意取消路径（上一题/跳维/暂停/onHide）清定时器即解锁、末题查漏跳首个未答。

## 二、数据层契约（miniprogram/growth-content.js）

| 导出 | 结构 | 说明 |
| --- | --- | --- |
| `VIA_GROUPS` | `[{ v: 美德名, items: [{ en, zh, d, q: [3 道题干] }] }]` × 6 组 | 6 美德 × 24 优势 × 3 题 = 72 题；题干逐字来自 VIA 72 题版 |
| `VIA_LABELS` | `['非常不像我','不太像','一般','比较像','非常像我']` | 五档含义 |
| `VIA_NOTE` / `VIA_SAMPLE_TOTALS` | string / number[24] | 探索性声明；排版样例的 24 项总分（`viaRanked(true)` 用） |
| `VIA_CROSS` | `[{ code, name, strengths: [5], description }]` × 16 | 16 型优势参考映射（探索性推断，非官方交叉验证） |
| `VIA_SUPPLEMENT_STRENGTHS` | `['责任','适应']` | 原表补充描述词，不属 24 项计分维度（对照卡灰标） |
| `MBTI_TYPE_GROUPS` | `{ NT:'分析组', NF:'理想组', SJ:'守护组', SP:'探索组' }` | 分组标签 |
| `MBTI_TYPE_CONTENT` | `[{ code, name, alias, group, up:[4], dn:[4] }]` × 16 | 16 型优缺点全文（参考阅读，不产生测评记录） |
| `TOOLS.via` / `VIA_TOOL_ORDER` | 工具元数据 / `['mbti','via']` | 当前自测流程工具序（`TOOL_ORDER` 保留供历史页面） |

计分规则（`growth-store.viaRanked(demo)`）：每项 3 题求和 → `score = round(total/3, 2)`；按 `total` 降序，同分按原题序；`demo=true` 用 `VIA_SAMPLE_TOTALS`，与本人答案严格隔离。

## 三、本地存储数据模型（wx storage key: `aichat_growth_state_v1`）

纯本地 JSON 单键，`growth-store.createGrowthStore` 读写；**无服务端同步**。V2 变更两处，其余键为 V1.2 既有（见 V1.2 复核文档）。

**本轮新增：**

```
via: {
  answers: number[72]   // 稀疏数组，元素 1..5；缺项/0 视为未答
  index:   number       // 当前题号 0..71（续答位置）
  preview: boolean      // true=正在看排版样例（不写入完成记录）
}
```

（对照表的类型筛选是 `via-mbti` 页内状态，不进全局存储。）

**defaults 变更（对齐原型 V2 defaults）：**
- `answers.mbti`：`[3,4]`（演示进行中）→ `[]`（从零开始）
- `sources`：预置 traits/strengths 来源记录 → `{}`（不再预置免费记录）
- `results.traits / results.strengths`：**保留 true 不变**（历史报告页兼容；但 reports 免费分类与自测首页不再按其展示）

**既有键中与自测展示相关的消费规则（V2 后）：**
- "已完成 MBTI"判定 = `results.mbti && answeredCount('mbti') === 40`（answeredCount 按 1..5 过滤，支持稀疏）
- "已完成 VIA"判定 = `viaComplete()`（72 题全部有效）
- `reportFilter`（'all'|'free'|'paid'）中 free 分类仅渲染上两项，浏览样例不计入

### 3.1 与服务端数据模型的关系（后端化路径）

V2 自测区不使用任何服务端资源；将来正式题库/计分接入时按 [MVP 架构文档](AICHAT_MVP_ARCHITECTURE_2026-07-18.md) §9 的通用测评表承载，**不新增表结构**：

- `ct_assessment_definition`：以新版本号登记题库（如 `mbti_40_ui_v1` / `via_72_ui_v1` → 正式版），`items_json` 存题面与计分规则哈希；
- `ct_assessment_run`：`score_vector` 存 VIA 24 项均分排序快照 / MBTI 四维计数，`result_code` 存类型码或优势 Top5 标识；
- `ct_assessment_answer`：沿用 24h TTL 临时答案语义（现由本地 storage 承担）；
- API 侧复用 `POST /assessment-runs` 等端点，以 `tool`/`definition_version` 参数区分；openapi 契约届时随实现更新。

当前 Flyway 迁移停留在 V1–V7，无 V8 需求。

## 四、E2E 变更（需 DevTools 实跑回归）

| 脚本 | 变更 |
| --- | --- |
| `scripts/e2e/run-all.mjs` | E2E-01：`#growth-voices-teaser` → `#growth-explore-teaser`；E2E-02：关系自测改经 `pages/profile` 的 `#profile-relationship-entry`（reLaunch 带参）进入 |
| `scripts/e2e/smoke-pages.mjs` | 自测目录等待 selector 同步；关系入口同样改经 profile |

⚠️ E2E 已改语法核对，**尚未在 DevTools 实跑**；reLaunch 后 automator 的页面栈跟踪需真机链路确认。

## 五、验证证据

| 验证 | 命令 | 结果 |
| --- | --- | --- |
| 状态机单测（含 VIA 计分排序/样例隔离/维度进度/稀疏续答） | `npm run test:store` | 135/135 通过 |
| 全部改动 JS 语法 | `node --check`（13 个文件） | 通过 |
| VIA/16 型数据与原型一致性 | 提取脚本内置断言（6 组/24 项/72 题/16 型×5/16 型×8 条目） | 通过 |
| DevTools 编译 + 页面渲染 | 待跑（见"四"） | ⏳ |

## 六、遗留与下一步

- E2E DevTools 实跑回归（重点 E2E-02 新路径）。
- 视觉走查：自测首页三卡、VIA 答题圆圈文字标签、16 型筛选、对照表筛选。
- 产品说明书（`AICHAT_SELF_ASSESSMENT_PRODUCT_SPEC_2026-10-26.md`）仍为 V1.0 评审稿口径，V2 目录与 VIA 内容以 `docs/ui/README.md` 与本文为准；待产品侧定稿后升版。
