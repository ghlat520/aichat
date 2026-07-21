# AIChat P0 持续实施目标

> 状态基线：2026-07-19；工程：`aichat`；产品：关系清晰卡。
> 本文件把已经批准的产品与架构合同转换为可由 AI 持续执行、可逐项验收、可跨任务恢复的工程目标。它不替代 PRD，也不批准公开上线或真实支付。

## 1. 一句话目标

为 18 岁以上微信用户交付一个可在封闭 Alpha 中验证的“关系清晰卡”P0：用户可从人格自测、关系核心直达或受控深夜倾诉进入同一六字段任务，获得安全免费摘要、可选完整卡、低风险行动与复盘，并能够控制自己的数据；运营人员能在不读取默认原文的前提下管理版本、开关、订单、退款、删除和发布证据。

## 2. 完成边界

### 2.1 必须实现

- 产品规格中的 P0-01～P0-19。
- 主 PRD 的 FR-031～FR-050、AC-11～AC-25 和 NFR-019～NFR-035。
- OpenAPI 中 63 个操作的真实应用服务；`501 API_NOT_IMPLEMENTED` 只允许存在于尚未进入当前阶段的操作，不能计作完成。
- 微信小程序三入口、共同核心、免费摘要、一次性交付、行动、隐私和售后关键旅程。
- MySQL/Flyway/MyBatis 持久化、资源所有权、幂等、加密边界、无原文事件和可审计状态机。
- 自动化测试、故障注入、安全评测、生成物漂移检查和需求追踪证据。

### 2.2 当前允许模拟

- 模型供应商使用受约束的确定性 Stub，直到供应商、数据地域、删除和模型评测完成。
- 微信支付只能接沙箱或本地 Provider Stub；没有新的明确授权不得启用真实商户支付。
- 推送使用本地 Job/通知 Stub；不得主动夜间召回。
- 深夜倾诉只允许封闭白名单，生产默认关闭。

### 2.3 不进入本目标

- 黄历、搬家、婚丧嫁娶、星座、紫微、八字、取名、测字、求签、解梦、运势和财运。
- 社区、达人、会员、订阅、自动续费、次数包、积分、虚拟币、广告和分享奖励。
- 长期陪伴人格、长期情感记忆、语音、图片、截图、通讯录和精确位置。
- 未经人类负责人批准的公开发布、生产支付、合规结论或市场赢家结论。

## 3. 七槽实施规格

### 3.1 约束

- 复用 `contracts/openapi.yaml`、`contracts/auth-rules.yaml`、统一错误模型和生成器，不另建第二套 API 真相源。
- 服务端保持 Spring Boot 模块化单体；领域只能通过应用服务、Port 或白名单事件协作。
- 生成 Controller 不承载业务逻辑；重新生成不得覆盖人工业务实现。
- Public、Visitor、Principal、Internal、Operator 分类继续由中央鉴权规则生成。
- 所有写命令具备作用域幂等键；资源读取和写入必须校验当前 subject 所有权。
- 高风险优先于生成、实验、支付、提醒和增长；安全依赖失败时 Fail-Closed。
- 原始关系文本、测试答案、报告、Token 和支付凭据不得进入普通日志、分析事件、URL 或客服默认视图。

### 3.2 输入合同

- HTTP 输入和验证以 `contracts/openapi.yaml` 为准。
- 产品语义以 FR-031～FR-050 为准。
- 运行时鉴权以编译后的 `x-auth-*` 字段和 `@AuthPolicy` 为准。
- 每个 AI 工作单必须提供：目标 ID、关联 FR/AC、允许修改文件、非目标、状态机/不变量、验收命令和回滚条件。

### 3.3 输出合同

- API 使用统一 `ApiEnvelope`、请求 ID 和稳定错误码。
- 每个阶段必须输出代码、迁移、测试和追踪证据；只有文档或 Controller 映射不算功能完成。
- 每项 P0 能力状态只能是 `NOT_STARTED`、`IN_PROGRESS`、`CODE_COMPLETE`、`EVIDENCE_COMPLETE`、`HUMAN_GATED` 或 `DONE`。
- `DONE` 要求机器证据和所需人类批准同时齐全；未验证不得从“看起来可用”推断完成。

### 3.4 主数据流

```text
边界/18+ -> 匿名会话 -> 三入口之一 -> 六字段核心 -> S1
                                               |
                                               v
                              镜像确认 -> 两轮反思 -> S2
                                               |
                                               v
                                    结构报告 -> S3 -> SEALED_READY
                                               |             |
                                               |             +-> 单次订单/支付/权益
                                               v
                                         免费摘要 -> 行动 -> 72h/D7 -> 结束

任意节点高风险 -> 免费安全页；任意用户节点 -> 复制/删除/纠错/售后
```

### 3.5 核心不变量

- INV-01：未完成当前政策版本 18+ 同意的会话不能进入任何互动能力。
- INV-02：未确认内容、测试倾向和 AI 推断不能进入 `confirmed_facts`。
- INV-03：高风险状态不能调用普通生成、创建订单、发起支付或发送提醒。
- INV-04：报告不是 `SEALED_READY` 时不能创建订单。
- INV-05：一个任务最多一个有效完整卡权益；支付回调重复处理不会重复扣款、授予权益或记账。
- INV-06：金额和 SKU 只取服务端有效价格版本。
- INV-07：所有受保护资源只能被其 Visitor/Principal 所有者读取或修改。
- INV-08：分析事件采用字段白名单，未知字段和任何原文均被拒绝。
- INV-09：自测、倾诉、生成、支付、提醒可独立关闭，安全页、删除和售后不可关闭。
- INV-10：D7 完成后任务终止，不自动新建任务或触发连续召回。

### 3.6 最小测试矩阵

| 类型 | 必须证明 |
|---|---|
| 合同 | 64 个 operationId、路径、鉴权、幂等和生成物与 OpenAPI 一致 |
| 单元 | 状态转换、确定性计分、PII 遮蔽、风险路由、报告不变量、事件白名单 |
| 数据库 | Flyway 空库升级、唯一约束、乐观锁、幂等、所有权、事务回滚 |
| API 集成 | Public/Visitor/Principal/Operator 正反路径和统一错误模型 |
| 安全评测 | 200+ 金样、三检查点、读心/诊断/预测/注入零高严重度漏出 |
| 隐私 | 100 个分享样例零泄漏、日志/事件 DLP、删除回执和供应商删除模拟 |
| 支付 | 重复/乱序回调、金额不一致、超时、查单、退款、权益和复式子账 |
| 小程序 E2E | 三入口进入同一核心、免费摘要、行动、删除、故障降级和低端机路径 |

## 4. 目标树与阶段出口

| Goal | 范围 | 主要 P0 | 阶段出口证据 | 当前状态 |
|---|---|---|---|---|
| G0 执行底座 | 生成 Controller 接入类型化 Delegate；修正 CI 漂移路径；建立状态账本 | 全部 | 重新生成后业务实现不丢失；契约、Java、TS 测试通过 | EVIDENCE_COMPLETE |
| G1 共同进入 | Public 配置/安全资源、匿名会话、18+ 同意、Opaque Token、所有权 | P0-01/02/18 | 会话幂等、同意前拒绝、同意后放行、Token 不落日志 | IN_PROGRESS / HUMAN_GATED |
| G2 人格自测 | 8 题版本题库、运行、答案 TTL、确定性计分、分享预览、映射 | P0-03/04 | 计分金样；100 个分享隐私样例；可进入共同核心 | IN_PROGRESS / HUMAN_GATED |
| G3 关系核心 | 六字段、PII 遮蔽、镜像确认、两轮反思、免费摘要、Stub 密封报告 | P0-06/08/09/10 | 六字段和事实归属 100%；报告 Schema 与状态机通过 | IN_PROGRESS / HUMAN_GATED |
| G4 安全与倾诉 | S1/S2/S3、风险队列、8 回合/10 分钟、五字段确认总结 | P0-05/07 | 200+ 金样；限轮限时；高风险全程绕过支付 | IN_PROGRESS / HUMAN_GATED |
| G5 行动和数据控制 | 48h 行动、72h/D7、复制、删除、纠错、工单、无原文事件 | P0-13/14/15/16/17 | D7 终止；删除演练；事件/日志 DLP 零命中 | NOT_STARTED |
| G6 固定交付交易 | Catalog、Order、支付 Stub/沙箱、Entitlement、Refund、Ledger、对账 | P0-11/12 | 报告 READY 前拒单；重复回调零重复；退款和账务守恒 | NOT_STARTED |
| G7 运营与发布治理 | 独立开关、版本、实验、审计、发布证据、回滚 | P0-18/19 | Kill Switch 演练；maker-checker；证据包可追溯 | NOT_STARTED |
| G8 小程序与全量验收 | 页面、状态管理、真机/E2E、性能、可访问性、SC-20 | 全部 | AC-11～25/NFR/G1～G6 全量矩阵；人类签字 | NOT_STARTED |

## 5. AI 工作单规则

每次只领取一个能够独立验收的纵向切片，按以下顺序执行：

1. 从本文件和权威 PRD 读取 Goal、FR、AC 与不变量。
2. 搜索现有 Controller、Delegate、应用服务、Mapper、迁移和测试；记录复用结论。
3. 先写失败测试或机器断言，再做最小实现。
4. 不直接编辑生成 Controller；需要变化时修改生成器并重新生成。
5. 运行聚焦测试，再运行契约、全量 Java、TypeScript、生成物漂移和敏感信息扫描。
6. 更新本表状态时附上证据路径/测试名；没有新鲜证据不得升级状态。
7. 不自动提交、推送、部署、启用真实支付或公开功能。

单个工作单的完成模板：

```text
Goal/FR/AC:
行为变化:
修改文件:
不变量:
测试先行证据:
全量验证:
未验证项:
回滚条件:
```

## 6. 当前基线与第一个工作单

### 6.1 已证实基线

- OpenAPI 定义 63 个操作；4 个操作已有真实 Delegate 实现，其余操作继续显式 `501`。
- 中央鉴权编译、运行时 `@AuthPolicy`、统一错误模型和小程序 TypeScript Client 已存在。
- MyBatis/Flyway/MySQL 运行依赖、Identity/Access V1 migration 和数据库 SubjectResolver 已接入；尚无小程序页面。
- CI 的生成代码漂移路径已从旧包名修正为 `com/aichat`。

### 6.2 Work Item G0-G1-01

**定义**：让生成 Controller 通过类型化 Delegate 调用人工应用服务，并交付 Public 配置/安全资源、匿名 Visitor 会话和 18+ 同意闭环。

**输入**：`GET /app-config`、`GET /safety-resources`、`POST /sessions`、`POST /sessions/{id}/consents`。

**输出**：安全默认功能开关；版本化静态安全资源；幂等创建的短期 Opaque Token；追加式同意记录；同意前互动拒绝、同意后 Visitor 鉴权放行。

**数据**：首个 Flyway migration 只建立 Identity/Access 必需表和唯一约束，不提前创建其他领域空表。

**验收**：

- 生成器重复运行后业务应用服务文件不变化。
- Public 两接口返回 200；会话首次创建返回 201，同幂等键同请求返回相同资源。
- 同一幂等键不同请求返回 409；Token 仅保存 hash。
- 未同意会话不能访问互动接口；同意后能通过鉴权到达对应 Delegate。
- 会话 ID 不匹配时拒绝记录同意；Token、client instance 和幂等键不进入普通日志。
- Flyway 在测试数据库从空库执行；聚焦 API 测试、全部 Maven 测试和契约生成检查通过。

### 6.3 Work Item G0-G1-01 证据

状态：`EVIDENCE_COMPLETE`（等待远端 JDK 25 CI 后可关闭该工作单）。

- `SessionConsentWebMvcTest` 4 个场景通过：创建/重放、同键异请求、同意/所有权、Public 安全资源。
- 全量 Maven：12 tests，0 failures，0 errors；Flyway 从空测试库执行 V1。
- 鉴权编译器：5 tests 通过；63 个操作分类校验通过。
- 生成器重复执行前后 diff 一致；业务应用服务未被覆盖。
- TypeScript 5.9.3 类型检查通过；`git diff --check` 和定向密钥扫描通过。
- 当前 G4-07 已补真实 MySQL 8.0.45 的整体 V1→V6 空库 migration；本工作单仍未证明 G1 命令的跨实例并发幂等、JDK 25 远端 CI 和生产密钥轮换。

### 6.4 Work Item G1-G3-02：六字段、密文与 S1

状态：`EVIDENCE_COMPLETE`（本地证据；G1/G3 整体仍为 `IN_PROGRESS`）。

#### 一句话定义

已完成 18+ 同意的 Visitor 创建一件关系任务，保存经过必要 PII 遮蔽和 S1 判断的六字段密文，并只能读取自己的当前版本与安全路由。

#### 约束与复用

- 复用生成的 `ClarityApiDelegate`、`ApiCallContext`、`UlidGenerator`、统一错误模型和 Identity 提供的当前 subject。
- Content 域建立自己的 Mapper、表和幂等记录，不跨域读写 `id_*` 私表。
- `observed_fact` 为 20–500 字；`interpretation` 允许空且最多 500 字；情绪和需要各 1–3 项；目标最多 200 字。
- 任务 `context` 与六字段 `context` 必须一致。
- 入库前必须先遮蔽手机号、身份证、邮箱、银行卡号、社交账号和可识别精确地址，再执行 S1。
- 关系原文只能以每内容版本独立 DEK 的 AES-256-GCM 密文存储；DEK 再由环境主密钥包裹。测试密钥不用于生产。
- JCA 把 128-bit GCM authentication tag 附加在 `ciphertext` 中保存；当前 schema 不另拆 `auth_tag` 列。
- Controller、普通日志、安全元数据、幂等记录和错误响应不保存或回显原始未遮蔽文本。
- 不调用模型、不生成镜像、不创建报告或支付；这些属于后续工作单。

#### 输入与输出合同

| API | 输入 | 成功输出 | 主要错误 |
|---|---|---|---|
| `POST /api/v1/tasks` | entry、context、clarity_pre、幂等键 | task_id、`DRAFT`、version=1 | 400 校验；409 幂等键复用 |
| `PUT /api/v1/tasks/{id}/fields` | expected_version、六字段、幂等键 | content_version、task version、S1 route/categories、mask codes | 403 所有权；409 版本/幂等冲突；503 加密或安全不可用 |
| `GET /api/v1/tasks/{id}` | task_id | 中性状态、当前版本、本人已遮蔽字段与安全决定 | 403 所有权；404 不存在/已删除 |

#### 状态与数据流

```text
create -> DRAFT(v1)
put fields -> mask -> S1 -> encrypt -> append content/safety -> optimistic update
                           | ALLOW   -> FIELDS_SAVED
                           | CLARIFY -> SAFETY_CLARIFICATION_REQUIRED
                           | BLOCK   -> SAFETY_BLOCKED

SAFETY_BLOCKED 不能继续普通字段/生成路径，只能走安全页、删除或退出。
```

#### 不变量

- WI-02-INV-01：task.owner_subject_ref 必须等于当前 subject；路径 ID 不能授予所有权。
- WI-02-INV-02：同一 task 只有一个单调递增 `version_no`；expected_version 不匹配时零写入。
- WI-02-INV-03：同一作用域幂等键和相同请求返回同一资源；不同请求返回 409。
- WI-02-INV-04：数据库文本列、幂等列和安全列均不含输入原文；只有密文列承载已遮蔽内容。
- WI-02-INV-05：BLOCK 与内容版本、安全决定、任务状态在同一事务提交；任一失败全部回滚。
- WI-02-INV-06：S1 只输出规则版本、route、类别和资源 ID，不输出诊断或内部风险分数。

#### 测试矩阵

| 场景 | 预期 | 类型 |
|---|---|---|
| 创建并重放任务 | 同 task_id/version；只有一行任务 | API/DB |
| 同键异请求 | 409；无第二个任务 | API/DB |
| 保存正常六字段 | version 1→2；ALLOW；密文可由本人读取 | API/DB |
| 手机/邮箱/证件/银行卡/地址 | 返回 mask codes；本人读取时只见占位符；DB 无明文 | API/安全 |
| 他人读取或写入 | 403；版本和内容行不变 | API/所有权 |
| 旧 expected_version | 409；零新增内容和安全记录 | API/并发 |
| 重放字段命令 | 返回同 content_version；版本不再次增加 | API/幂等 |
| 自伤/伤人/暴力等阻断样例 | BLOCK、`SAFETY_BLOCKED`、安全资源；无普通下一步 | API/安全 |
| 预测/诊断/财务/法律等模糊请求 | CLARIFY；禁止进入后续生成 | API/安全 |
| 加密主密钥缺失/非法 | 应用 Fail-Fast，不以明文降级 | 启动/安全 |

#### 本地证据（2026-07-19）

- `ClarityTaskWebMvcTest` 7 个场景通过：任务幂等/所有权、六字段约束、全类 PII 遮蔽、全表无原文、密文读取、乐观锁零写入、BLOCK/CLARIFY 路由和统一幂等键规则。
- `EnvelopeEncryptionServiceTest` 3 个场景通过：每版本新 DEK/nonce、密文与元数据篡改 Fail-Closed、非法主密钥启动失败。
- 全量 Maven 22 tests，0 failures，0 errors；Flyway 从空 H2 MySQL 模式数据库执行 V1→V2。
- OpenAPI 3.1 lint 通过；中央鉴权 5 tests 通过；63 operations 分类检查通过；TypeScript 5.9.3 检查通过。
- 契约编译与 Controller/Delegate/Client 生成连续执行两次 hash 一致；`git diff --check` 和定向秘密/原文日志/动态 SQL 扫描无命中。
- 当前 G4-07 已补真实 MySQL 8.0.45 的整体 V1→V6 空库 migration；本工作单仍未证明 G2 命令的跨实例并发幂等、JDK 25 CI、生产 KMS/旧密钥轮换和 200+ S1 金样。当前 S1 仅为受约束 prototype，不可据此批准公开上线。

### 6.5 Work Item G2-03：8 题自测、确定性计分、脱敏预览与核心映射

状态：`EVIDENCE_COMPLETE`（服务端本地证据；G2 整体仍为 `IN_PROGRESS`）。

#### 一句话定义

已完成 18+ 同意的 Visitor 无需资料档案即可完成原创 8 题关系应对自测，得到仅限当前任务的可追溯非诊断结果，预览零答案/零关系文本的分享卡，并在明确确认后创建 Clarity 任务与可编辑候选。

#### 约束与合同修正

- 关联 P0-03/04、FR-033～035、AC-11/12、NFR-027/033；不使用第三方量表或人格/依恋标签。
- 题库版本固定为 `relationship-response-v1`，8 题、每题 4 个非优劣选项；题面公开，计分映射仅在服务端保存并以 SHA-256 追溯。
- 每个选项只给 `evidence_checking`、`direct_expression`、`self_protection`、`emotion_regulation` 之一 +1；第一名领先第二名至少 2 分才输出该倾向，否则为 `mixed`。
- 原始答案按条使用 Envelope Encryption；完成后设置不超过 24 小时的删除期限；结果/分享/幂等/日志不含答案。
- 分享接口只创建 `PREVIEW_ONLY` 数据：中性标题、一个优势、一个提醒、AI 标识、题库版本和有效期；真正发送由小程序用户后续主动确认。
- `map-to-task` 原合同只有 `expected_version`，无法满足任务必填字段和明确确认；现改为专用请求：`expected_version/context/clarity_pre/confirmed=true`。
- 映射只返回 `interpretation`（盲点）和 `next_step_goal`（提醒）候选；`observed_fact` 永远为空且必须由用户在核心编辑器自行填写。
- Assessment 不直接写 Clarity 私表；通过 Clarity 暴露的应用 Port 在同一事务创建 `ASSESSMENT` 入口任务。

#### 状态机

```text
definition(PUBLISHED) -> run IN_PROGRESS(v1)
answer/overwrite -> run version +1, encrypted answer TTL
8/8 answers -> complete -> COMPLETED, deterministic result, answer expiry <= 24h
                         | share preview -> COMPLETED
                         | confirmed map -> MAPPED + Clarity DRAFT task
```

#### 不变量

- WI-03-INV-01：run、answer、share preview 和 mapped task 均绑定当前 subject；路径 ID 不授予所有权。
- WI-03-INV-02：题库版本、题数、计分映射 hash 与许可声明必须一致，否则 503 Fail-Closed。
- WI-03-INV-03：缺题不能完成；旧 expected_version 和非法 item/option 零写入。
- WI-03-INV-04：结果不含概率、原始分数对外暴露、诊断、人格类型、依恋类型或长期标签。
- WI-03-INV-05：100 个分享隐私样例中答案、关系文本、身份、位置、负面标签和付费状态泄漏为 0。
- WI-03-INV-06：映射不能写 `observed_fact`，且同一 run 最多创建一个 Clarity task。

#### 本地证据（2026-07-19）

- `AssessmentWebMvcTest` 7 个场景通过：题库边界、所有权、幂等与历史版本重放、乐观锁、密文覆盖、非法/缺题零结果、领先/混合计分、100 个分享隐私样例、核心映射与 TTL 真实删除。
- Flyway 从空 H2 MySQL 模式数据库完整执行 V1→V3；V3 建立题库、运行、密文答案、分享预览和命令去重表。
- 全量 Maven 29 tests，0 failures，0 errors；OpenAPI 3.1 lint、中央鉴权 5 tests、63 operations 分类检查和 TypeScript 5.9.3 检查均通过。
- Assessment 生产默认关闭；关闭时 Public `entry_paths` 只公开 `DIRECT`，显式启用后才公开 `ASSESSMENT`。
- 当前 G4-07 已补真实 MySQL 8.0.45 的整体 V1→V6 空库 migration；本工作单仍未证明多实例并发、JDK 25 CI、生产 KMS/旧密钥轮换、小程序预览与发送前确认 UX、题库原创/发布权人类签字，以及根级 LICENSE/NOTICE/SBOM。公开发布前不得据本地代码证据跳过这些闸门。

### 6.6 Work Item G3-04：五段镜像、两轮结构化反思、Stub 密封报告与免费摘要

状态：`EVIDENCE_COMPLETE`（仅限本地服务端 Stub；G3 总目标仍为 `IN_PROGRESS`）。

#### 一句话定义

S1 允许的六字段任务生成一次可校准的五段中性镜像，用户逐段确认或纠正后按固定顺序完成两轮反思；服务端据此同步生成并加密保存一个通过确定性结构/禁区校验的 Stub 完整卡，公开完整的免费安全子集，但在 Entitlement 完成前绝不返回密封正文。

#### 范围与非目标

- 关联 P0-08/09/10、FR-036/039～041、AC-13/15、NFR-019～021/027/029。
- 本工作单允许修改 OpenAPI/DTO/生成物、Clarity/Report 应用与持久化、Flyway V4、测试、功能开关和本 Goal 证据。
- 本工作单使用明确标识的 `deterministic-stub-v1`，不接真实模型，不声称完成 200+ 独立安全金样、生产 S2/S3、模型备案/地域/删除合同或性能验收。
- 不实现完整卡 Entitlement 读取、订单、支付、行动、提醒、小程序页面或生产功能启用；`GET /reports/{id}` 继续 Fail-Closed/未实现。

#### 合同修正

- `mirror-confirmation` 必须携带五个固定段落的 `accurate/partially_accurate/inaccurate` 评价；非 `accurate` 段必须同时给出纠正文本，不能用自由字典假装逐段确认。
- `reflections` 第 1 轮必须提交至少一个用户确认事实和一个未知/待验证项；第 2 轮必须提交一个优先需要/边界和一个本人可执行目标。错轮字段、跳轮和重复轮次均拒绝且零写入。
- 报告创建只接受当前任务版本、当前已确认镜像版本和该任务第 1/2 轮反思版本；客户端 ID 不能越权或拼接其他任务内容。

#### 状态机

```text
FIELDS_SAVED --create mirror--> MIRROR_REVIEW
MIRROR_REVIEW --regenerate once--> MIRROR_REVIEW
MIRROR_REVIEW --confirm five sections--> REFLECTION(0/2)
REFLECTION --round 1--> REFLECTION(1/2)
REFLECTION --round 2--> REFLECTION(2/2)
REFLECTION(2/2) --create report--> REPORT_READY + report SEALED_READY
```

#### 不变量

- WI-04-INV-01：所有 task/content/reflection/report 均校验当前 subject、路径资源所有权、expected version 和作用域幂等键。
- WI-04-INV-02：镜像只重组已遮蔽六字段，不生成第三人心理、忠诚、诊断、预测或重大决定；最多额外重生成一次。
- WI-04-INV-03：五段未全部评价、非准确段无纠正、镜像不是当前任务当前版本时不能进入反思。
- WI-04-INV-04：第 1 轮至少一个事实和一个未知；第 2 轮目标必须本人可开始、可撤回且不以第三人改变为唯一成功条件。
- WI-04-INV-05：镜像、反思、免费摘要和完整卡全部 Envelope Encryption；命令表、普通日志、错误和分析元数据不保存原文。
- WI-04-INV-06：完整对象固定 3 个不排序为真相的合理解释，每项含缺失证据；1～3 个行动均本人可做、48 小时内可开始、可撤回且有成功观察/停止条件。
- WI-04-INV-07：免费摘要包含确认事实/未知、情绪需要、基础边界、限制、安全资源和本人目标，不含恐惧付费话术；完整卡在权益前不可读取。
- WI-04-INV-08：generation 默认关闭；关闭、内容安全不可用、S1 非 ALLOW、状态/hash/版本不一致时 Fail-Closed，零报告和零可购买事实。

#### 本地证据

- `ClarityProgressWebMvcTest` 6 个场景通过：完整镜像→确认→两轮反思→密封报告→免费摘要链路；镜像所有权/幂等/最多一次重生成；S1 非 `ALLOW` 零镜像；非准确段纠正与当前版本约束；反思结构/顺序/本人能动性/幂等；输入不完整或版本拼接时零报告写入。
- 服务端完整回归 35/35 通过，Flyway 在空 H2 MySQL 模式数据库中完整执行 V1→V4；该工作单当时只有本地兼容证据，当前整体 V1→V6 的真实 MySQL 8 migration 证据见 G4-07。
- OpenAPI 3.1 源契约成功编译为 63 个 operation，中央鉴权覆盖 63/63；鉴权编译器 5/5 规则测试、Redocly 校验和小程序 TypeScript 编译通过。
- Spring Controller/Delegate/DTO 与小程序 TypeScript Client 重复生成前后 hash 一致，证明本次契约生成物可确定复现。
- generation 默认 `false`；关闭时 Public 配置不公开生成能力，生成命令返回 `503`。完整卡读取仍由默认 Delegate 返回 `501`，没有绕过 Entitlement 暴露密封正文。
- 测试解密验证密封对象结构、来源、未知项、三个中性解释、可撤回行动、版本元数据及免费子集边界；数据库断言原始镜像、反思、免费摘要和完整卡只存在于密文字段，其他元数据列不含测试原文。
- 静态边界扫描未发现硬编码私钥/常见云密钥、用户内容日志、动态 SQL 拼接或 Report 对 Clarity application/infrastructure 的反向依赖；Report 只依赖 `clarity.port.ReportTaskSourcePort`。

#### 尚未通过的闸门

- 当前 G4-07 已补单机真实 MySQL 8.0.45 的 V1→V6 空库 migration；JDK 25 CI、多实例竞争与故障恢复仍未验证，V4 不能仅凭单机证据进入生产。
- 当前为同步 `deterministic-stub-v1`，未接真实模型、供应商数据处理协议、地域/删除保障、超时重试或生产级异步生成。
- 未完成 200+ 独立安全金样、生产 S2/S3、人审抽检、模型/提示词版本发布审批与回滚演练。
- 未完成生产 KMS 与旧密钥轮换、完整卡 Entitlement、订单/支付/退款/账务、微信小程序镜像校准与发送前确认 UX、性能和无障碍验收。

### 6.7 Work Item G4-05：统一安全策略与 200+ 原型回归语料

状态：`EVIDENCE_COMPLETE`（仅限本地确定性原型；G4 总目标仍为 `IN_PROGRESS`）。

#### 决策与范围

**业务结果**：Clarity 输入、报告生成前和输出后必须使用同一个版本化安全策略，任何高风险或越界内容都不能因入口或应用服务不同而得到相反路由。

**当前事实**：S1 规则位于 `InputSafetyService`，报告 S3 只有 Report 内部结构/禁区校验；尚无统一 S2、统一版本、可复用测试语料或生产安全复核证据。

**本工作单包含**：

- 一个模块化单体内的纯确定性 `SafetyPolicyEngine`，固定 `S1_INPUT`、`S2_PRE_GENERATION`、`S3_OUTPUT` 三个检查点和 `ALLOW/CLARIFY/BLOCK` 语义。
- Clarity S1 迁入共享策略；现有 PII 遮蔽继续留在输入适配层，不把 Privacy 和风险路由强行合并。
- Report 在生成前执行 S2，在结构化输出校验后执行 S3；任一非 `ALLOW` 均 Fail-Closed，零 `SEALED_READY` 写入。
- 至少 200 个确定性原型回归样例，覆盖高风险、读心/诊断/预测、提示注入、混合优先级、三个检查点和正常内容。

**非目标**：不把原型回归语料声称为“200+ 独立安全金样”；不实现真实模型、运营复核接口/队列、脱敏受限材料查看、生产告警、人审 SLA、倾诉会话或新的安全数据库迁移。

#### 方案比较

| 方案 | 一致性与安全 | 交付/运维成本 | 可逆性 | 结论 |
|---|---|---|---|---|
| A0 各应用保留自己的规则 | 规则已分散，新增 Venting 会形成第三份策略 | 短期最低，长期漂移和回归成本最高 | 差 | 拒绝 |
| A1 模块化单体内共享 Safety 策略 | 单一规则版本；Clarity/Report/Venting 可通过稳定接口复用 | 无远程故障和独立运维；符合当前单体规模 | 高 | **采用** |
| A2 独立 Safety 微服务 | 可独立扩容和隔离，但引入网络、超时、重试、鉴权与值守 | 当前没有独立团队、负载或部署证据 | 中 | 暂不采用 |

#### 不变量与质量场景

- WI-05-INV-01：`BLOCK` 优先级高于 `CLARIFY`；同一输入、同一规则版本在三个检查点的基础类别和路由必须确定性一致。
- WI-05-INV-02：安全引擎只返回 route、categories、resource IDs、checkpoint 和 rule version；不得记录或返回被评估原文。
- WI-05-INV-03：S2 非 `ALLOW` 时不调用报告构建；S3 非 `ALLOW` 或结构校验失败时不写免费摘要、密封正文或可购买状态。
- WI-05-INV-04：安全策略没有业务 Kill Switch；Assessment、Venting、Generation 关闭时，公开安全资源仍可用。
- WI-05-QS-01：包含立即危险、自伤、伤人、暴力/胁迫、诈骗勒索、提示注入或越权访问的样例，在三个检查点均同步返回 `BLOCK` 和适用免费资源。
- WI-05-QS-02：诊断、读心/确定性预测、重大财务/法律决定或依赖请求返回 `CLARIFY`，不能进入普通报告。
- WI-05-QS-03：普通关系事实、情绪、边界和本人可执行目标保持 `ALLOW`；不得因为报告中的安全免责声明出现“诊断”等词而误杀。

#### 残余风险与推翻条件

- 原型正则规则只能做本地工程护栏，不能代替模型分类、人工复核、真实语境/方言/隐喻覆盖或危机流程。
- 若真实运行证明安全判定需要独立故障隔离、独立发布节奏或显著不同负载，并且已有独立 owner、SLA、鉴权、超时和故障演练证据，再重审 A2。
- 进入 G4-06 深夜倾诉前，G4-05 必须完成共享策略接入和明确的未覆盖清单；进入公开 Alpha 前仍必须补独立 200+ 金样、人审和生产复核队列。

#### 本地证据

- `SafetyPolicyEngineTest` 4/4 通过：18 个 `BLOCK` 种子、10 个 `CLARIFY` 种子、3 种上下文包装和 3 个检查点组成 252 次风险回归；另有 30 次正常内容、3 次混合优先级和 1 次 PII 元数据判定，共执行 286 次确定性原型决策。
- `SafetyPolicyEngine` 是风险正则、类别、路由优先级和资源映射的唯一代码位置；Clarity `InputSafetyService` 只保留 PII 遮蔽和六字段适配，不再维护第二份风险规则。
- `ReportSafetyGateTest` 2/2 通过：S2 普通输入放行/高风险拒绝，S3 生成字段扫描、服务端固定限制文案不误杀，拒绝错误只含 checkpoint/route/categories/version/resources，不含被评估原文。
- `ClarityProgressWebMvcTest` 解密密封报告并验证 `s2_policy`、`s3_policy` 和 `output_validator` 版本；S2 在报告构建前执行，S3 在结构校验后、任何数据库报告写入前执行。
- 服务端完整回归 41/41 通过；Flyway 仍为 V1→V4，本工作单未新增或修改已执行 migration。
- 静态扫描确认 Safety 模块不依赖 Clarity/Report、规则关键词只存在于 Safety、无 Safety Kill Switch、无安全输入/报告原文日志；`git diff --check` 通过。

#### 仍未完成

- 本语料由实现团队编写并复用显式触发词，不能证明方言、隐喻、否定语境、长文本对抗、模型越狱或真实危机路由质量；NFR-020 的独立 200+ 金样仍为硬闸。
- G4-07 已补本地统一不可变 S1/S2/S3 证据表和无原文复核队列；仍无受限材料访问、真实 Operator IdP/MFA、人工 SLA、告警、规则发布审批和生产回滚证据。
- S2/S3 目前是本地同步确定性策略；真实模型接入后必须增加供应商前后置安全、超时 Fail-Closed、隔离态、故障注入与人工抽检。
- G4-06 已完成本地确定性原型并复用共享 S1；公开 Alpha 前仍需独立安全金样、真实语境验证、运营复核队列和生产危机流程。

### 6.8 Work Item G4-06：受控深夜倾诉与五字段确认映射

状态：`EVIDENCE_COMPLETE`（仅限本地确定性原型；G4 总目标仍为 `IN_PROGRESS`）。

#### 一句话定义

已完成 18+ 与政策同意的用户可主动开始一次默认关闭的文字倾诉，在服务端 10 分钟/最多 8 个系统回复的硬边界内逐轮接受 S1；用户可随时结束，编辑确认结构化五字段总结后，才创建一个 `VENT` 来源的共享 Clarity 任务。

#### 范围与非目标

- 关联 P0-05/07、FR-038/043/044/050、AC-14/16/23/25、NFR-020/021/023/026/029/034。
- 使用明确标识的 `deterministic-vent-stub-v1` 短回复序列，不接真实模型，不扮演恋人/闺蜜/导师，不承诺陪伴，不做主动夜间推送、长期记忆或无限追问。
- 新增独立 `venting` 开关并默认 `false`；开关关闭时不公开 `VENT` 入口且创建会话返回 `503`，但安全资源不受影响。
- 新增 Flyway V5 的 VentSession、加密 Turn、加密 Summary 和作用域幂等记录；原始回合与倾诉总结 TTL 不超过 24 小时，并由定时任务真实删除。
- 不实现真实 AI Provider、统一安全复核数据库/运营 API、人审 SLA、消息推送、小程序页面、支付或生产白名单；这些仍是公开 Alpha 硬闸。

#### 契约修正

- `CreateVentSessionRequest` 必须包含当前 `policy_version` 和 `confirmed=true`；服务端返回 AI 标识、硬截止时间、最大回复数和“随时结束并整理”能力。
- `VentTurnRequest` 保留 `expected_version` 与单轮文本；响应必须返回 state/version、S1 route/categories/resources、`ai_turns_used/remaining`、deadline、`can_finish`，只有 `ALLOW/CLARIFY` 才能返回短系统回复。
- `finish` 必须携带 `expected_version`，不能依赖无版本空命令；至少有一轮用户输入后才能生成 `summary_version`。
- `VentSummaryRequest` 不再接收自由 `summary` 字符串；必须携带 `expected_version`、`summary_version`、`confirmed=true` 和固定结构：`context`、`observed_fact`、`looping_thought`、`emotion[]`、`need_or_boundary[]`、`current_goal`、`clarity_pre`。
- 确认成功返回 `task_id`、`task_state=FIELDS_SAVED`、`task_version=2` 和当前 `content_version`；客户端不得再单独拼装或绕过该映射。

#### 状态机

```text
create(enabled + consented) -> ACTIVE(version=1, deadline=+10m, ai_turns=0)
ACTIVE --ALLOW/CLARIFY turn, before deadline, ai_turns<8--> ACTIVE(version+1, ai_turns+1)
ACTIVE --BLOCK turn--> SAFETY_BLOCKED(version+1, no ordinary reply)
ACTIVE --finish, user_turns>=1--> SUMMARY_READY(version+1, draft summary encrypted)
SUMMARY_READY --confirm current summary + S1 ALLOW--> CONFIRMED(version+1) + Clarity FIELDS_SAVED(v2)
ACTIVE after deadline or 8 replies --new turn--> 429, zero writes, can_finish=true
any non-blocked state --finish/replay--> same scoped idempotent result
```

#### 不变量

- WI-06-INV-01：所有命令校验 subject 所有权、expected version、作用域幂等键和当前 state；重放返回相同 session/turn/summary/task，旧版本和同键异请求零写入。
- WI-06-INV-02：服务端 Clock 决定 10 分钟和 8 回复边界；客户端时间、页面计数或重试不能延长会话。
- WI-06-INV-03：用户文本先 PII 遮蔽和 S1，再以独立 AES-256-GCM Envelope Encryption 保存；数据库、错误、日志、命令表和安全元数据无原文。
- WI-06-INV-04：`BLOCK` 在同一事务把会话置为 `SAFETY_BLOCKED`，返回免费资源并停止普通回复、总结、映射和后续商业路径。
- WI-06-INV-05：`CLARIFY` 只返回固定边界澄清语并计入 8 回复上限，不调用生成模型、不输出诊断/读心/法律/财务结论。
- WI-06-INV-06：Summary 只是待确认草稿；只有本人编辑并确认当前版本、且整份结构化字段再次 S1 `ALLOW`，才能写入 Clarity。
- WI-06-INV-07：确认映射与 VentSession 状态、Clarity task/content/safety 及幂等记录同事务；任何失败全部回滚，不能产生孤儿任务或重复任务。
- WI-06-INV-08：Turn/Summary `expires_at<=now` 的密文和 wrapped DEK 被定时物理删除；清理日志只记录计数。

#### 本地证据

- `VentingWebMvcTest` 6/6 通过：所有权与作用域幂等、PII 遮蔽和密文落库、8 回复/10 分钟零写入边界、到期后仍可结束、`BLOCK` 免费资源分流、`CLARIFY` 固定边界回复、当前总结确认、`VENT -> FIELDS_SAVED(v2)` 原子映射以及到期 Turn/Summary 物理删除。
- `SessionConsentWebMvcTest` 验证 `venting` 默认关闭时不公开 `VENT` 入口且创建返回 `503`；启用测试验证 Public 配置只追加 `VENT`，不改变其他入口语义。
- 服务端完整回归 47/47 通过；Flyway 在空 H2 MySQL 模式数据库中真实执行 V1→V5。该工作单当时只有本地兼容路径；当前整体 V1→V6 的单机真实 MySQL 8.0.45 迁移与 Safety Review 并发证据见 G4-07，跨实例竞争和故障恢复仍未验证。
- OpenAPI 3.1 重新 bundle 后由中央规则覆盖 63/63 个 operation，鉴权规则测试 5/5、Redocly lint、生成后小程序 TypeScript 编译全部通过；重复生成的契约、Venting Controller/Delegate 与 TypeScript Client hash 一致。
- 静态边界扫描确认 Venting 只依赖 `clarity.port.VentTaskEntryPort`，不反向依赖 Clarity application/infrastructure；Turn/Summary 业务正文只进入 AES-256-GCM Envelope Encryption 字段，日志和安全元数据不记录原文；`git diff --check` 通过。

#### 尚未通过的闸门

- 当前回复和草稿来自 `deterministic-vent-stub-v1`，没有真实模型、供应商数据处理/地域/删除保障、超时 Fail-Closed、流式中断或模型输出 S3 证据。
- 原型 S1 规则不能替代独立 200+ 安全金样、方言/隐喻/否定语境和长文本对抗验证；G4-07 的本地无原文复核队列也不能替代真实 Operator 身份、受限材料审批、人工 SLA、生产告警和危机演练。
- 尚未实现小程序页面、封闭白名单管理、用户主动删除全部派生数据、生产 KMS/密钥轮换、性能/无障碍/真机验收或微信审核。功能保持默认关闭，不能进入公开 Alpha。

### 6.9 Work Item G4-07：不可变安全证据与最小运营复核闭环

状态：`EVIDENCE_COMPLETE`（仅限本地无原文元数据闭环；G4 总目标仍为 `IN_PROGRESS/HUMAN_GATED`）。

#### 一句话定义

Clarity、Report 与 Venting 的每次 S1/S2/S3 判定都追加一条不含原文的统一安全证据；任一 `CLARIFY/BLOCK` 自动创建受限复核案例，具备 Safety Reviewer + MFA 的 Operator 才能列出、读取并以版本和幂等约束提交结论。

#### 实施前缺口与方案

- 当前 S1 分散在 `ct_safety_assessment`/Venting Turn 元数据中，S2/S3 只进入 Report 版本字符串；无法回答“哪个入口、哪个对象、哪个检查点、哪版规则做出了什么路由”。
- 现有 Operator 契约只有按 `caseId` 读取/更新，没有队列列表，运营无法发现待处理案例；生产 Operator 身份适配器也尚未接入，必须继续默认拒绝。
- 采用模块化单体内 append-only Safety Evidence + Review Case；拒绝继续拼接各业务表，也不在没有独立 owner/SLA/负载证据时引入事件总线或 Safety 微服务。

#### 范围与非目标

- Flyway V6 新增应用层不可变的 `sf_safety_evidence`、可版本推进的 `sf_safety_review_case` 和复核命令幂等表；只保存 subject/resource 引用、checkpoint、route、categories、mask codes、规则版本、免费资源 ID 和时间，不保存用户/模型原文、密文或内部风险分数。
- 新增 `GET /ops/v1/safety-review-cases` 队列入口；详情默认仅返回证据元数据，明确 `material_access=NONE`。PATCH 使用专用结构化结论，不复用含糊的通用操作命令。
- `BLOCK` 与 `CLARIFY` 自动建案；`ALLOW` 只留证据不建案。复核结论只能在 `OPEN -> RESOLVED` 推进，不能修改或删除原始证据。
- 生产环境不添加后门 Operator Token；现有数据库 Subject Resolver 对 Operator 继续 Fail-Closed。HTTP 正路径只用测试上下文注入的隔离 Operator 身份验证。
- 不实现原文查看、解密材料授权、案例分派、二次复核、SLA/告警、批量导出、真实 IdP/MFA、危机外呼或规则发布审批；这些仍是公开 Alpha 硬闸。

#### 不变量

- WI-07-INV-01：Evidence 在应用层 append-only；Mapper 和业务代码不提供 UPDATE/DELETE，业务正文永不进入 evidence/case/command/log/error。数据库级防篡改和独立最小权限角色仍属于生产闸，不得用本地 schema 级开发授权替代。
- WI-07-INV-02：同一 `source_type + source_id + checkpoint` 最多一条证据；判定证据先以独立短事务追加，因此即使普通业务因非 `ALLOW` 回滚，拒绝尝试及自动建案仍必须保留。`source_id` 可指向已提交资源或本次判定的 attempt ULID。
- WI-07-INV-03：只有非 `ALLOW` 创建案例；Case 只能引用一条存在的 evidence，响应只返回白名单元数据和 `material_access=NONE`。
- WI-07-INV-04：队列、详情和结论必须通过中央 Operator 分类、`safety-reviewer` 角色与 MFA；路径 ID 不授予权限。
- WI-07-INV-05：结论命令校验 expected version、当前 state 和作用域幂等；同键异请求、旧版本、已结案再次修改均零写入。
- WI-07-INV-06：人工结论只表示复核意见，不能回写篡改原路由、自动恢复被阻断商业路径或伪造“安全已解决”。

#### 本地证据

- `SafetyReviewWebMvcTest` 4/4 通过：`ALLOW` 只留 Evidence、`CLARIFY/BLOCK` 自动建案；队列分页、详情 `material_access=NONE`、MFA/角色拒绝、结论版本推进、同键重放、同键异请求冲突、过期命令清理和 reason/ticket 仅存 SHA-256 均有 API/DB 断言；另验证调用方事务拒绝回滚后，独立事务写入的 Evidence 与 Review Case 仍保留。
- `FailClosedWebMvcTest` 在生产默认 Spring 上下文验证伪造 Operator Bearer Token 返回 `401 AUTHENTICATION_REQUIRED`；Safety Reviewer 正路径只存在于测试配置，不向生产注册测试 Token 或后门 SubjectResolver。
- Clarity 六字段、确认镜像、两轮反思、Report S2/S3 和 Venting Turn/Summary 均接入统一 Evidence；跨模块测试按 source/checkpoint 校验，Venting `BLOCK` 同时生成 `OPEN` Review Case。
- 服务端完整回归 53/53 通过；Flyway 在空 H2 MySQL 模式数据库中真实执行 V1→V6。该 H2 证据本身不代替下述真实 MySQL 8、跨实例并发和数据库角色权限验证。
- `RealMySqlV1ToV6IT` 2/2 通过：Docker MySQL 8.0.45、`REPEATABLE-READ` 下从全新空库真实执行 V1→V6，并验证 Evidence 唯一约束、route CHECK 和 Review Case 外键。8 个线程同时提交同一 Case、同一 Operator、同一幂等键和相同请求，全部重放为 version 2；数据库最终只有 1 条 Review Command、1 个 Case，Case 只推进一次。
- 最终复跑使用原 aiinstock 本地基础设施的 `aiinstock-mysql:3306`，复用同一 MySQL 容器和持久化命名卷，但使用独立 `aichat_it` schema 与 `aichat_local@%` 最小权限账号；`aiin_dev_db01` 未被迁移、写入或授权给 AIChat。AIChat 密码只从 macOS Keychain 加载，未写入仓库或测试输出。
- GLM 修复本地 Docker 后于 2026-07-19 23:25（UTC+08:00）重新执行同一生产闸证据：`aiinstock-mysql`（当次容器 ID `5575364a23aa...`）为 `healthy`，实际挂载 `aiinstock-mysql-data:/var/lib/mysql`；仅删除并重建专用 `aichat_it` 空 schema 后，Flyway 日志明确显示 `<< Empty Schema >>` 并依次成功应用 V1→V6。`RealMySqlV1ToV6IT` 再次 2/2 通过；落库复核为 MySQL 8.0.45、`REPEATABLE-READ`、迁移历史 `1→2→3→4→5→6`、2 条 Evidence、1 条 `RESOLVED/version 2` Case 和 1 条 Command。`aichat_local` 与 `aiin_dev_db01` 均未执行 DROP 或 migration。
- 同日 23:28（UTC+08:00）在允许 JVM attach 的本机执行边界完成最后一次 Fail-Closed 收口：`FailClosedWebMvcTest,SafetyReviewWebMvcTest` 6/6 通过，随后服务端完整回归 50/50 通过。Codex 文件沙箱内的同命令曾因 Mockito/Byte Buddy 无法创建 JVM attach socket 而在测试方法前失败；同一源码、JDK 和命令移出该进程隔离后全绿，因此该失败归类为执行环境限制，不作为业务回归失败，也未通过跳过测试或弱化断言处理。
- 2026-07-20 按用户原始本地约定纠偏：管理员在同一 `aiinstock-mysql:3306` 上创建独立 `aichat` 空 schema，只给现有 `aiin_dev_dbuser1@%` 增加 `aichat.*` 权限；随后通过该业务账号的真实 Spring Boot/Flyway 路径从 `<< Empty Schema >>` 成功执行 V1→V6。落库复核为 MySQL 8.0.45、`REPEATABLE-READ`、23 张表、迁移历史 `1→2→3→4→5→6`；除 6 条 Flyway 历史和 V3 migration 自带的 1 条题库定义外，Visitor、Clarity、Report、Safety 与 Venting 业务表均为 0。确认误建 `aichat_local` 为 0 表且无活动连接后已删除该 schema 并撤销对应授权；`aichat_it` 及其隔离测试账号保留。`aiin_dev_db01` 变更前后均为同口径 380 个表/视图、估算 125015 行，未执行 AIChat migration。该本地复用账号当前实际为 `ALL PRIVILEGES ON aichat.*` 的 schema 级开发授权，不构成生产最小权限或 Evidence 数据库级不可变证据。
- 同日 00:35（UTC+08:00）进一步以正式 `mvn spring-boot:run` 主应用路径验证首次启动，而非用 SQL 或测试上下文替代：在临时隔离的 0 表 `aichat_bootstrap_verify` schema 上，启动日志明确显示读取 `AICHAT_DB_*`、连接 MySQL 8、发现 `<< Empty Schema >>` 并自动依次应用 V1→V6，随后 Tomcat 启动且 `/api/v1/app-config` 返回成功。落库为 23 张表、6 条 Flyway 历史、1 条 migration 题库定义，其余关键业务表均为 0；优雅停机后已删除临时 schema 并撤销临时授权。随后同一启动命令切回正式 `aichat`，日志显示 schema v6 已最新，MySQL 进程列表实测连接身份为 `aiin_dev_dbuser1@%`、数据库为 `aichat`，HTTP smoke 再次通过并优雅停机。
- 真实并发首轮曾暴露“先更新 Case、后写幂等记录”会让竞争失败者收到 `VERSION_CONFLICT`；现已改为同事务先抢占命令唯一键、再做乐观锁更新，赢家提交后竞争者进入重放路径。修复后聚焦 Fail-Closed/Safety Review 回归和服务端完整回归 50/50 均通过。
- 2026-07-21 提交前 Standards + Spec 双轴审查额外发现并修复四个阻断项：Clarity/Venting 的拒绝证据曾随调用方事务回滚、空输入错误丢失实际 S2/S3 checkpoint、Venting 幂等重放曾被后续会话/任务状态污染、Report/Venting/Safety Review 过期幂等键曾因异常回滚而无法释放。现改为判定证据独立短事务、保留请求 checkpoint、按首次结果重建稳定快照，并以 `REQUIRES_NEW` 定向清理加定时任务兜底。聚焦回归 17/17、服务端完整回归 53/53 通过。
- OpenAPI 3.1 重新 bundle 后由中央规则覆盖 64/64 个操作（Operator 21），鉴权编译器 5/5、Redocly lint 和小程序 TypeScript 5.9.3 检查通过；重复生成的契约、Operations Controller/Delegate 和 Client hash 一致。
- 静态扫描确认 `sf_safety_evidence` 没有应用 UPDATE/DELETE 路径、Safety 域没有正文/密文列或内容日志、生产源码没有测试 Operator 凭证；`git diff --check` 通过。

#### 尚未通过的生产与人类闸

- 未接企业 SSO/真实短期 Operator Token、真实 MFA、受限材料审批/解密、案例分派、二次复核、告警、SLA、值班和危机演练；因此不能声称生产人工复核已完成。
- 独立 200+ 安全金样、方言/隐喻/否定语境、长文本对抗、模型越狱和真实危机路由仍未评测；本地 286 次确定性原型回归不能代替独立裁判。
- 已验证共用 aiinstock 本地 MySQL 8.0.45 实例上的隔离 schema、空库迁移、数据库约束和单 JVM/多连接并发幂等；仍未验证 JDK 25 CI、多实例/跨进程竞争、生产独立最小权限角色、Evidence 数据库级防篡改、备份恢复、生产 KMS、审计留存/删除政策和规则发布回滚。
- G1–G4 因以上生产与人类闸保持 `IN_PROGRESS/HUMAN_GATED`；本工作单的 `EVIDENCE_COMPLETE` 只表示本地代码与自动化证据收口。

## 7. 目标完成判定

只有 G0～G8 全部达到 `DONE`，且逐项证据证明 P0-01～P0-19、FR-031～050、AC-11～25 和 NFR-019～035 均完成，持续目标才可标记完成。代码完成但真实支付、平台、隐私、安全或发布人类闸未通过时，目标保持 active，并明确标为 `HUMAN_GATED`，不能缩小定义后提前收口。
