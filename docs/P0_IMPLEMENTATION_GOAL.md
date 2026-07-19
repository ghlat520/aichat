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
| 合同 | 63 个 operationId、路径、鉴权、幂等和生成物与 OpenAPI 一致 |
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
| G1 共同进入 | Public 配置/安全资源、匿名会话、18+ 同意、Opaque Token、所有权 | P0-01/02/18 | 会话幂等、同意前拒绝、同意后放行、Token 不落日志 | IN_PROGRESS |
| G2 人格自测 | 8 题版本题库、运行、答案 TTL、确定性计分、分享预览、映射 | P0-03/04 | 计分金样；100 个分享隐私样例；可进入共同核心 | IN_PROGRESS |
| G3 关系核心 | 六字段、PII 遮蔽、镜像确认、两轮反思、免费摘要、Stub 密封报告 | P0-06/08/09/10 | 六字段和事实归属 100%；报告 Schema 与状态机通过 | IN_PROGRESS |
| G4 安全与倾诉 | S1/S2/S3、风险队列、8 回合/10 分钟、五字段确认总结 | P0-05/07 | 200+ 金样；限轮限时；高风险全程绕过支付 | NOT_STARTED |
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
- 尚未证明：真实 MySQL 8 migration、JDK 25 远端 CI、并发多实例幂等和生产密钥轮换。

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
- 尚未证明：真实 MySQL 8 migration、JDK 25 CI、跨实例并发幂等、生产 KMS/旧密钥轮换和 200+ S1 金样。当前 S1 仅为受约束 prototype，不可据此批准公开上线。

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
- 尚未证明：真实 MySQL 8 migration、JDK 25 CI、多实例并发、生产 KMS/旧密钥轮换、小程序预览与发送前确认 UX、题库原创/发布权人类签字，以及根级 LICENSE/NOTICE/SBOM。公开发布前不得据本地代码证据跳过这些闸门。

## 7. 目标完成判定

只有 G0～G8 全部达到 `DONE`，且逐项证据证明 P0-01～P0-19、FR-031～050、AC-11～25 和 NFR-019～035 均完成，持续目标才可标记完成。代码完成但真实支付、平台、隐私、安全或发布人类闸未通过时，目标保持 active，并明确标为 `HUMAN_GATED`，不能缩小定义后提前收口。
