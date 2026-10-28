# 用户身份与登录正规化规格（身份持久化 / 微信授权登录 / 手机号授权评估）

日期：2026-10-27，Asia/Singapore。用户指令：按 ask-matt 流程形成 agent 可执行规格，先考据微信官方文档再开发，最终以 goal 长跑收口。考据文件见 `docs/research/wechat-*` 与 `wechat-login-crosscheck`（多源投票）。

> 2026-10-28 复审状态：下方 T5 是当时的历史门禁记录，不代表审查发现的问题已完成真实微信或真机验收。回修已覆盖身份切换、退出、订单恢复和页面迟到响应；异常同意恢复按用户选择仅在缺少有效记录时弹窗，详见文末记录。

## 目标与事实基线

现状盘点（2026-10-27 全仓 5 路审计 + 批判员交叉验证）结论：

- 本产品无传统用户模块是 PRD 决策（ACC-01「默认不建资料档案」、ACC-02 P0 Approved「免费路径不登录；不取昵称、头像或手机号」），非遗漏。26 张表无 user 表；`getPhoneNumber`/`getUserProfile`/unionid 全仓 0 命中。
- 微信登录只有"绑定"形态：`wx.login → 服务端 code2Session → openid（信封加密存 pay_virtual_buyer）→ 会话 Visitor 升 Principal`，能力归属 payment 模块；4 处页面级触发（checkout×2、order 恢复、reports 恢复）。
- **最要紧缺陷**：`POST /api/v1/tokens/refresh` 是 501 占位（IdentityApiDelegate.java:39-43），前端 `app-store.js:66-70` 过期后静默**新建匿名会话**——微信 Principal 绑定挂在旧 session 上被孤立，付费用户每次超 2 小时回访必掉回 Visitor，须手点"微信登录并恢复…"。身份是次抛的。
- 已知小债：购买链路一次触发两次 bind（checkout.js:47 显式 + virtual-payment.js:54 内部，服务端幂等兜底）；契约 purpose 枚举含 `cross_device_recovery|reminder|refund` 但前端全部硬编码 `payment`；payment.js 结果页无任何恢复入口。

## 范围与非目标

- **做**：P0 身份持久化（服务端 refresh 实现 + 前端回退收敛）、P1 登录正规化（我的页身份区、purpose 修正、双 bind 消除、payment 页恢复入口）、P2 手机号授权登录（考据门槛判定，见下）、P3 头像昵称（同门槛）。
- **不做**：不改支付域任何行为；不建 user/member 表；不引入账号密码；不做服务端令牌吊销（契约无 revocation 语义，列为已知边界：登出=清本地，服务端会话至 TTL 自然过期）；真实凭据/发布/真钱仍走既有授权边界。
- **PRD 冲突显式声明**：P2/P3 与 ACC-01/02 冲突。本规格将其置于 feature flag（默认关）且 P2 受平台主体资质硬约束（【R2 回填：个人主体能否用手机号快速验证组件——多源投票结论】）。PRD 修订属用户决策，代码只预留开关与契约设计。

## P0 · 身份持久化（最高优先，无契约变更）

服务端（`server/`）：

1. `SessionApplicationService.refreshSessionToken(context, idempotencyKey)` 实装，替换 `IdentityApiDelegate` 默认 501：
   - 凭 `X-Refresh-Token` 头解析（走既有 refreshToken security scheme 与 resolver 路径）；校验 refresh_token_hash 命中且会话状态 ≠ REVOKED（PENDING_CONSENT 允许续期，与建会话后录同意的时序兼容）。
   - 响应复用既有会话响应结构：`SessionTokenService` 为 sessionId 确定性派生（at1./rt1. 前缀），本轮**不引入令牌轮换**（派生确定性下轮换无增益）；`expires_at` 按既有 access TTL 重算；`auth_level` 必须重推导（`payments.binding(session.id)==null ? VISITOR : PRINCIPAL`）——这是 Principal 随 refresh 持久的关键。
   - 未知/REVOKED refresh token → 401 AUTHENTICATION_REQUIRED；幂等键沿用 id_command_dedup。
2. 测试（纵向切片，先红后绿）：有效 refresh 续期且绑定会话返回 Principal；REVOKED 拒绝；未知 token 拒绝；PENDING_CONSENT 可续期。

前端（`miniprogram/`）：

3. `app-store.js recoverGuestSession()` 收敛：refresh 成功路径直接采纳（已有）；**删除 501 API_NOT_IMPLEMENTED 容错分支**（服务端已实装，保留该分支会把真实故障误吞成新建会话）；仅 401（REVOKED/未知）才降级新建匿名会话；其他错误原样上抛。`store-core.js` 持久化的会话随 storage 跨冷启动保留，配合 refresh 保持已绑定身份。
4. `node --test` 单测：refresh 成功不改绑、401 才重建、非 401 异常上抛三分支。

验收（P0）：`mvn test` 绿 + 上述新用例存在且过 + `npm run test:store` 绿 + 手工 curl 序列（建会话→同意→绑微信模拟→过期后 refresh 返回 Principal）……绑微信模拟需凭据，隔离测试以桩替身覆盖，真机绑定列入既有"平台开通后"待验项。

## P1 · 登录正规化（纯前端 + purpose 语义对齐）

1. `pages/profile/` 新增"微信身份"区：展示当前等级（访客/已绑定微信，取 session.level 持久值）、绑定按钮（未绑定时调 `getVirtualPayment().bind()`，purpose 用 `cross_device_recovery`——"登录"语义对用户呈现为身份绑定）、"退出登录"（仅清本地会话 storage 并回匿名，文案注明服务器会话至期自动失效）。
2. purpose 修正：`order.js restoreOrders`、`reports.js restorePaid` 改发 `purpose:'cross_device_recovery'`（服务端与契约已支持该枚举，无需后端变更）；`virtual-payment.js` 的 `bind(product?)` 增加目的参数，默认 `payment` 保持兼容。
3. 双 bind 消除：`checkout.js confirmPurchase` 已显式 `bind()` 后调 `purchase()`，`purchase()` 内部第 54 行的 `bind()` 改为"会话已 Principal 则跳过"（读 session.level），避免一次购买两次 wx.login。
4. `payment.js` 结果页补恢复入口：getOrder 失败且本地无单时，提供与 reports 页一致的"微信登录并恢复"按钮（同 purpose 修正）。
5. 测试：store/页面单测（node --test）覆盖 purpose 参数、双 bind 跳过逻辑、退出登录清储。

## P2 · 手机号授权登录 ——【已裁决：个人主体封死，本期不实现】

多源投票裁决（2026-10-27，见 `docs/research/wechat-phone-login-eligibility-2026-10-27.md` 与 `wechat-login-crosscheck-2026-10-27.md`）：

- **裁决 A【确认·双源】**：手机号快速/实时验证组件"针对非个人主体且完成了认证的小程序开放"——官方组件文档注意事项第 1 条 + 官方社区知识库两处独立明文；个人主体实测报"该 appid 没有权限"，无申请通道（资质由主体类型自动判定）。
- 计费仅对合格主体有意义：快速验证 0.03 元/次、实时验证 0.04 元/次（新账号赠 1000 次）；`getPhoneNumber` 的 code 与 `wx.login` 的 code 不能混用，新方式无需先 wx.login。
- **处置**：不写任何服务端/前端实现，不进契约主干。解锁条件=小程序升级企业/非个人主体并完成微信认证（届时按"契约新增 bind-phone + 加密 phone 列迁移 + 服务端 getuserphonenumber 适配 + 前端按钮，feature flag 默认关"另立规格）。

## P3 · 头像昵称填写能力 ——【可用性与 PRD 冲突并存，默认关，仅设计位】

多源投票裁决（同上 crosscheck 文件）：

- **裁决 B【确认·双源】**：`wx.getUserProfile` 已被官方收回（2022-11-08 24 时后新版本只返回灰色头像+"微信用户"）；官方替代=头像昵称填写能力 `button open-type="chooseAvatar"` + `input type="nickname"`（基础库 2.21.2 起，2.24.4 起强制内容安全检测），**文档无主体限制条款，个人主体可用**。
- 硬约束：2023-10-17 起隐私协议必须声明"收集你的昵称、头像"，未声明则组件直接禁用（nickname input 降级为普通 text）。
- **处置**：与 PRD ACC-01"默认不建资料档案"冲突且 PRD 未修订——本期零实现、零字段采集，仅在此留设计位记录。用户修订 PRD 后按"chooseAvatar+nickname form 收集 + 隐私协议声明 + flag 默认关"另立规格。

## 附：考据对 P0/P1 的两条工程修正依据

- **session_key 顶替风险**（`wechat-login-core` 考据）：同一用户同一时刻仅一个有效 session_key，再次 `wx.login` 会生成新 key 顶替旧值——T4 消除双 bind 不止去冗余，还消除一次购买中两次 wx.login 顶替 `id_wechat_payment_session.encrypted_session_key` 的风险。
- **限频约束**：`wx.login`/`wx.checkSession` 日调用总量 ≤ 2×PV、单用户 ≤4 次/秒——绑定应保持"按需触发"，禁止定时循环与 onLoad/onShow 无条件调用（T3/T4 的按钮触发式设计即依据此条）。
- unionid 裁决 C：所引官方材料说明绑定后的获取路径；未绑定时的排他结论不能由条件句反推，且本项目未实测。本期跨设备恢复仍沿用 openid+订单表，不依赖 unionid（`wechat-unionid-2026-10-27.md`）。

## 契约与代码变更清单

- P0/P1：**零契约变更、零迁移**（refresh 已在契约；purpose 枚举已在契约；身份展示用前端持久 session）。
- P2（若解锁）：`contracts/openapi.yaml` + `auth-rules.yaml` 新增 bind-phone；V8 迁移；regenerate 全链。
- 代码再生命令沿用 README 权威清单（redocly bundle → compile-auth-rules → check-auth-contract → node --test → generate-api-skeleton → mvn test → tsc）。

## 测试边界与总验收

- 每张票：TDD 纵向切片（先红后绿），完成后跑 README 全套验证命令，退出码全 0。
- 总验收（goal 条件素材）：`mvn --file server/pom.xml test` exit 0 ｜ `npm run test:store` exit 0 ｜ `npx tsc -p miniprogram/services/api/tsconfig.json` exit 0 ｜ contracts 三件套命令 exit 0 ｜ 本规格执行清单全勾。

## 执行预算（goal-loop-token-budget 记录）

- 基线：主会话 Opus 级 + Workflow 子代理；固定输入=本规格+票据+AGENTS.md，实现票各自独立上下文。
- 估计：考据(进行中) ≈ 中；实现 T1-T5 ≈ 中；验证 ≈ 低。决策 **FIT**（分票隔离上下文，无单窗超限风险）。
- goal 形态：外层验收闸（上述总验收命令组），`or stop after 30 turns`；引擎=分票 Workflow/独立上下文实现；spec 即本文件，不依赖对话记忆。

## 执行清单

- [x] R: 微信官方文档考据 5 路 + 交叉验证（进行中，落 docs/research/）
  - 证据：`docs/research/` 下五路考据与交叉验证文档已落档。2026-10-28 复审发现 C 的否定式结论不能由所引条件句反推，已更正为待核实；本项目未做真实 unionid 接口验证。
- [x] T1 服务端 refresh 实装 + 纵向测试
  - 证据：`SessionApplicationService.java:117` 实装 `refreshSessionToken`（幂等键校验 + 事务内 refreshOrReplay + auth_level 重推导）；`SessionRefreshWebMvcTest` 4 用例（含 PENDING_CONSENT 可续期、幂等键跨会话复用 409）随 2026-10-28 `mvn test` 78/78 绿。
- [x] T2 前端 recoverGuestSession 收敛 + 单测
  - 证据：`miniprogram/app-store.js` 中 `API_NOT_IMPLEMENTED`/501 引用 0 命中（容错分支已删）；`app-store-recover.test.mjs` 覆盖三分支（成功采纳 / 401 降级重建 / 非 401 上抛——含"501 历史静默分支必须上抛"显式用例），随 `npm run test:store` 84/84 绿。
- [x] T3 profile 微信身份区 + 退出登录
  - 证据：`pages/profile/profile.js:5-8` 身份等级展示（Visitor/Principal 标签），`:53` 绑定按钮 `bind('cross_device_recovery')`，`:64-66` 退出登录确认；`profile-identity.test.mjs` 在 test:store 套件内。
- [x] T4 purpose 修正 + 双 bind 消除 + payment 页恢复入口
  - 证据：`pages/order/order.js:37`、`pages/reports/reports.js:67`、`pages/payment/payment.js:36` 均改发 `cross_device_recovery`；`services/virtual-payment.js:11` `bind(purpose='payment')` 带参默认兼容、`:54-55` 会话已 Principal 则跳过内部 bind（一次购买不再双 wx.login，同时消除 session_key 顶替风险）。
- [x] T5 README 全套验证命令全绿 + 记录证据
  - 证据（2026-10-28 00:08–00:16 +08，逐条真实退出码，详见下方 §T5 验证证据记录）：8 条命令全部 exit 0；generate-api-skeleton 产物 37 文件前后 md5 零 diff（P0/P1 零契约变更达成）；curl 冒烟 201/201/200、auth_level=Visitor、refresh 不再 501。
- [x] P2/P3 门槛判定落档（按 R2/R3 结论，默认只写决策记录不写实现）
  - 证据：决策记录已落本规格 §P2（裁决 A：手机号组件明文"针对非个人主体且完成了认证的小程序开放"，个人主体封死，本期零实现零契约）与 §P3（裁决 B：`wx.getUserProfile` 已于 2022-11-08 收回，替代的头像昵称填写能力无主体限制条款，但与 PRD ACC-01 冲突，仅留设计位、flag 默认关）；`docs/research/wechat-login-crosscheck-2026-10-27.md` 复核两裁决均双源确认且与正文一致；全仓未新增任何 P2/P3 实现代码。

### T5 验证证据记录（2026-10-28 00:08–00:16 +08 · 验证工程师执行）

README「本地验证」全套，逐条退出码与输出尾部：

| # | 命令 | exit | 输出尾部要点 |
|---|------|------|--------------|
| 1 | `npx --yes @redocly/cli@2.39.0 bundle contracts/openapi.yaml --output /tmp/aichat-openapi-source.json --ext json` | 0 | `Created a bundle for aichat at /tmp/aichat-openapi-source.json` |
| 2 | `node contracts/compile-auth-rules.mjs /tmp/aichat-openapi-source.json contracts/auth-rules.yaml contracts/openapi.generated.json` | 0 | `Compiled auth rules for 74 operations.`（Public 3 / Visitor 33 / Principal 14 / Internal 3 / Operator 21） |
| 3 | `node contracts/check-auth-contract.mjs contracts/openapi.generated.json` | 0 | `Auth contract verification passed: 74 operations.` |
| 4 | `node --test contracts/compile-auth-rules.test.mjs` | 0 | tests 5 / pass 5 / fail 0 |
| 5 | `node contracts/generate-api-skeleton.mjs contracts/openapi.generated.json` | 0 | `Generated 74 Spring operations and 50 mini-program operations.`；产物 37 文件（`*ApiController/Delegate.java` + openapi.generated.json + miniprogram/services/api）前后 md5 对比零 diff |
| 6 | `mvn --file server/pom.xml --batch-mode --no-transfer-progress test` | 0 | `Tests run: 78, Failures: 0, Errors: 0, Skipped: 0` / `BUILD SUCCESS`；含 `SessionRefreshWebMvcTest` 4/4、`SessionConsentWebMvcTest` 4/4 |
| 7 | `npx --yes -p typescript@5.9.3 tsc -p miniprogram/services/api/tsconfig.json` | 0 | 无输出（干净通过） |
| 8 | `npm run test:store`（= `node --test miniprogram/*.test.mjs`） | 0 | tests 84 / pass 84 / fail 0 |

curl 冒烟（对 127.0.0.1:8080 运行实例，Idempotency-Key 均按契约格式）：

1. `POST /api/v1/sessions` → **201**，`status=PENDING_CONSENT`、`auth_level=Visitor`、签发 access/refresh token（`rt1.` 前缀）。
2. `POST /api/v1/sessions/{id}/consents`（Bearer access，policy_version=p0-alpha-2026-07-19）→ **201**，`status=ACTIVE`。
3. `POST /api/v1/tokens/refresh`（`X-Refresh-Token`）→ **200**，同 session_id 续期、`status=ACTIVE`、**`auth_level=Visitor`**（未绑微信，等级重推导正确）、`expires_at` = 当前 +2h（与 access TTL 一致）。**断言通过：不再 501。**

环境事件记录（如实）：首轮冒烟时 8080 进程（PID 3860，10-27 22:12 由 `mvn spring-boot:run` 启动）对 refresh 返回 501 `API_NOT_IMPLEMENTED`——该 JVM 启动早于 T1 实装，加载的是旧类；属验证环境进程过期而非代码缺陷（同代码 mvn 测试已全绿）。按 local-service-startup 门禁完成拓扑/风险清单后，于 10-28 00:14 以原命令、原环境变量重启（新 PID 58821），冒烟即过。旧进程 501 响应体已存档（`operation_id: refreshSessionToken`）。

### goal 验收证据汇总（对应 §测试边界与总验收）

| 验收项 | 结果 | 证据 |
|--------|------|------|
| `mvn --file server/pom.xml test` exit 0 | 达成 | 78/78 绿，BUILD SUCCESS（上表 #6） |
| `npm run test:store` exit 0 | 达成 | 84/84 绿（上表 #8） |
| `npx tsc -p miniprogram/services/api/tsconfig.json` exit 0 | 达成 | 干净通过（上表 #7） |
| contracts 三件套命令 exit 0 | 达成 | bundle/compile/check + node --test + skeleton 再生全 0，产物零 diff（上表 #1-#5） |
| 本规格执行清单全勾 | 达成 | 本节 7/7 项均勾选并附证据行 |

### 2026-10-28 审查回修记录

- 退出和会话切换按发起身份校验续期、微信绑定及订单请求；本机存储失败会显式报错，旧响应不能恢复已退出身份或覆盖后来选择的订单。
- `PENDING_CONSENT` 会话如有已确认且版本匹配的本地记录，则补录同意；缺少该证据时按用户选择弹窗，只有用户明确确认后才录入。取消和弹窗期间退出均不伪造同意。
- 支付结果和订单页不再把其他订单的状态当作原单；没有原单且有多笔记录时进入订单列表选择。
- 会话临时内容按 sessionId 在进程内隔离；报告、自测、关系编辑、镜像、复盘和倾诉页面在会话改变后隐藏旧展示，并丢弃跨会话迟到响应。旧临时草稿不写入 storage；普通退出后重新登录通常产生新 sessionId，当前 UI 尚无恢复旧草稿的入口。
- 2026-10-28 09:43 +08 本地回归：`npm run test:store` 120/120；服务端 Maven 78/78、契约测试 5/5、TypeScript 5.9.3 检查通过。契约生成的 31 个文件与工作区一致；8 个受影响 WXML 文件通过结构检查。各数字仅对应运行时的工作区版本；后续代码编辑须重新验证。
- 当前微信开发者工具连接返回 `timeoutReached`；真实微信绑定、真机跨启动和真实支付仍未验证。确定性 access token 在正常 refresh 后可重新有效的设计边界未改变。
- 异常确认弹窗展示政策版本并要求确认，但当前仓库的“隐私与数据”页面仍是 G5 占位，尚未证明用户可在确认前阅读本产品政策正文；真实发布前须补齐或核实该阅读入口，不把测试弹窗等同正式政策验收。
- 本次未能在线重新读取微信官方 unionid 页面；该文档的历史来源仍需可访问的一手页面或本项目接口实测复核，不将社区观察视为目标环境事实。
