# 微信小程序登录核心链路考据（wx.login / code2Session / checkSession）· 2026-10 现状

> 考据日期：2026-10-27
> 考据人：文档考据工作流（subagent）
> 方法：官方文档直抓（developers.weixin.qq.com 的 `.md` 原文版本）+ 官方社区/公告检索 + 第三方仅作线索。
> 背景：个人主体小程序（已接微信虚拟支付-个人版），现有匿名会话 + 支付时 wx.login 绑定，评估登录正规化方案。
> 证据分级：🟢 官方明文（文档/公告原文）｜🟡 社区经验（官方社区/第三方，非规范性）｜🔴 未查到（blocker）

---

## 0. 一句话结论（TL;DR）

1. **wx.login + code2Session 静默登录链路 2026 年依然是最核心、无废弃迹象的官方登录方案**：code 5 分钟有效、一次性；code2Session 明文要求服务端调用；openid 静默可得，无需用户授权。
2. **2026 年文档新变化**：服务端新增 `checkSessionKey`（/wxa/checksession）与 `ResetUserSessionKey`（/wxa/resetusersessionkey）两个登录态校验/重置接口，`wx.checkSession` 客户端文档已显式把"校验指定 session_key"的职责引向服务端接口。
3. **session_key 绝不下发客户端**是官方红线（两处官方文档明文）；其有效期官方刻意不公布（"具体时效逻辑由微信维护，对开发者透明"）。
4. **对个人主体的关键约束**：手机号快速验证组件**仅对非个人主体且已认证小程序开放**（官方明文）→ 手机号登录路线对个人主体不可用；头像昵称 wx.getUserProfile 已收回，替代为"头像昵称填写能力"。**UnionID 依赖绑定微信开放平台账号，个人主体能否绑定官方无明文**（blocker，需后台人工验证）。

---

## 1. 登录核心链路官方时序（2026 现行版）

来源：小程序登录指南（官方，页面标注更新于 2026-06-16）

> "1. 调用 wx.login() 获取 **临时登录凭证code**，并回传到开发者服务器。
> 2. 调用 auth.code2Session 接口，换取 **用户唯一标识 OpenID**、用户在微信开放平台账号下的**唯一标识UnionID**（若当前小程序已绑定到微信开放平台账号）和 **会话密钥 session_key**。
> 之后开发者服务器可以根据用户标识来生成自定义登录态，用于后续业务逻辑中前后端交互时识别用户身份。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html 🟢

要点：官方设计的终态是"开发者服务器生成**自定义登录态**（自建 token/session）"，微信侧登录态（session_key）只是中间凭证。这与"补用户登录体系"的目标完全吻合：openid 落库 → 自发 token → 前端持有自发 token 而非 session_key。

---

## 2. 必查项逐条考据

### ① wx.login 返回 code 的有效期与使用规则 🟢

**有效期：5 分钟。** 官方 API 文档 wx.login 的 success 回调参数表：

> "code | string | 用户登录凭证（**有效期五分钟**）。开发者需要在开发者服务器后台调用 code2Session，使用 code 换取 openid、unionid、session_key 等信息"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html 🟢

**使用规则：一次性。** 登录指南"注意事项"第 2 条：

> "2. 临时登录凭证 code **只能使用一次**"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html 🟢

**失效错误码**（code2Session 错误码表）：`40029 = "code 无效（js_code无效）"`；`40226 = "code blocked（高风险等级用户，小程序登录拦截）"`。
- 来源：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2session.html 🟢

**易踩坑（官方明文）**：每次 wx.login 可能使旧 session_key 被顶替：

> "除了过期失效外，触发获取临时登录凭证 code 的操作（小程序登录 和 数据预拉取）可能会生成新的登录态session_key，从而使旧的 session_key 被顶替而失效。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html 🟢
- 实务含义：**不要在前端"顺手"重复调 wx.login**（如支付前每次都调），会把自己服务端存的 session_key 顶掉。现状"支付时才 wx.login 绑定"的模式恰好有此风险——支付前新调 wx.login 会顶替注册时保存的 session_key。

### ② code2Session 必须服务端调用 🟢

服务端 API 文档（页面顶部声明，2026 现行）：

> "**接口应在服务器端调用，不可在前端（小程序、网页、APP等）直接调用**，具体可参考接口调用指南。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2session.html 🟢

调用方式（官方原文）：

```
GET https://api.weixin.qq.com/sns/jscode2session?appid=APPID&secret=SECRET&js_code=JS_CODE&grant_type=GRANT_TYPE
```

- 参数：`appid`（小程序 appId，必填）、`secret`（小程序 appSecret，必填）、`js_code`（wx.login 获取，必填）、`grant_type`（固定填 `authorization_code`，必填）。
- 返回：`openid`（用户唯一标识）、`session_key`（会话密钥）、`unionid`（**"若当前小程序已绑定到微信开放平台帐号下会返回"**）、`errcode`/`errmsg`。
- 边界：**不支持云调用、不支持第三方平台调用**（官方适用范围明文）。
- 来源：同上 🟢

客户端文档同样呼应：

> "开发者需要在**开发者服务器后台**调用 code2Session，使用 code 换取 openid、unionid、session_key 等信息"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html 🟢

⚠️ 接口地址迁移提示（考据时发现）：旧路径 `/miniprogram/dev/OpenApiDoc/user-login/code2session.md` 已 301 到 `/miniprogram/dev/server/API/user-login/api_code2session`，文档结构 2026 年已重组为"服务端 API - 用户登录"目录，接口本身（/sns/jscode2session）未变。

### ③ session_key 保管规则与有效期

**保管规则（不下发客户端）——两处官方明文：**

登录指南注意事项第 1 条：

> "1. 会话密钥 session_key 是对用户数据进行加密签名的密钥。为了应用自身的数据安全，开发者服务器**不应该把会话密钥下发到小程序，也不应该对外提供这个密钥**。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html 🟢

服务端获取开放数据指南：

> "开发者应该事先通过 wx.login 登录流程获取会话密钥 session_key **并保存在服务器**。为了数据不被篡改，开发者不应该把 session_key 传到小程序客户端等服务器外的环境。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html 🟢

**有效期——官方刻意不公布固定数值：**

> "通过 wx.login 接口获得的用户登录态拥有一定的时效性。**用户越久未使用小程序，用户登录态越有可能过期。反之如果用户一直在使用小程序，则用户登录态一直保持有效。具体时效逻辑由微信维护，对开发者透明**。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html 🟢

补充规则（官方）：

> "session_key 具有唯一性，在使用小程序时，**同一用户在同一时刻仅有一个有效的 session_key**。"（同上来源 🟢）

重置接口注意事项（新增的服务端重置接口也再次确认有效期语义）：

> "重置后的session_key会继承原有的session_key的过期时间，**重置操作不能为session_key续期**。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_resetusersessionkey.html 🟢

🟡 社区经验（非官方承诺）：社区普遍实践按"不固定时长、活跃即有效、数天不活跃大概率失效"处理，工程上不应依赖任何具体天数。官方从未公布确切数值。

### ④ checkSession 的作用与失效语义 🟢

客户端接口 wx.checkSession 功能描述：

> "检查登录态 session_key 是否过期。……开发者可以调用 wx.checkSession 接口检测用户登录态是否过期。**注意，wx.checkSession 的校验对象是最后一次获取 code 操作对应的登录态 session_key**，调用成功说明该 session_key 未过期，调用失败说明 session_key 已过期。**如果要校验指定的 session_key 是否有效，可以在开发者服务器后台调用 checkSessionKey**。"

> "登录态失效后开发者可以再调用 wx.login 获取新的用户登录态。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html 🟢

**2026 年结构性变化：服务端登录态校验/重置接口族已成型**（官方文档"小程序登录 接口列表"）：

| 接口 | 路径 | 用途 |
|---|---|---|
| code2Session | /sns/jscode2session | 登录凭证校验 |
| checkSessionKey | /wxa/checksession | "校验服务器所保存的登录态 sessionkey 是否有效" |
| ResetUserSessionKey | /wxa/resetusersessionkey | "重置指定的登录态 sessionkey" |

- 来源：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/index.html 🟢

checkSessionKey 关键设计（不明文传 session_key）：

> "校验服务器所保存的登录态 session_key 是否有效。为了保持 session_key 私密性，**接口不明文传输 session_key，而是通过校验登录态签名完成**。"（签名算法：`signature = hmac_sha256(session_key, "")`，`sig_method` 目前只支持 `hmac_sha256`；错误码 87009 = invalid signature）

- 来源：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_checksessionkey.html 🟢

实务含义：服务端可在**不依赖客户端配合**的情况下校验自己存的 session_key 是否仍有效（例如收到"签名对不上"的异常时主动探测），这比只靠客户端 wx.checkSession 的旧模式更可控。checkSessionKey 与 resetusersessionkey 均需 access_token，支持第三方平台代调用（权限集 id 18）。

### ⑤ openid / unionid 的获取条件 🟢

**openid**：code2Session 直接返回（"openid | string | 用户唯一标识"），**无需任何用户授权动作，纯静默**。个人主体小程序无差别可用。
- 来源：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2session.html 🟢

**unionid**：官方条件为"小程序已绑定到微信开放平台账号"：

> "unionid | string | 用户在开放平台的唯一标识符，**若当前小程序已绑定到微信开放平台帐号下会返回**，详见 UnionID 机制说明。"
> （同 code2session 返回参数表）🟢

UnionID 机制说明：

> "如果开发者拥有多个移动应用、网站应用、小程序、小游戏、公众号、服务号、微信小店、小店联盟带货机构、小店带货助手等，可通过平台开放的 API 获取 UnionID 来区分用户的唯一性，因为只要是同一个微信开放平台账号下的……用户的 UnionID 是唯一的。"
> "绑定了开发者账号的小程序，可以通过以下途径获取 UnionID。1. 开发者可以直接通过 wx.login + code2Session 获取到该用户 UnionID，**无须用户授权**。"
> 绑定路径："登录微信开发者平台，进入控制台首页，然后前往「我的业务 - 开放平台 - 绑定关系 - 小程序」**注意不是前往「我的业务 - 小程序 - 绑定关系 - 开放平台」**"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html 🟢

特殊通道（支付后 5 分钟）：

> "用户在小程序（暂不支持小游戏）中支付完成后，开发者可以直接通过 getPaidUnionID 接口获取该用户的 UnionID，无需用户授权。**注意：本接口仅在用户支付完成后的5分钟内有效**。"
> （同 union-id.md）🟢

🔴 **个人主体能否绑定开放平台账号（进而拿到 unionid）：官方文档未写主体限制，也未写允许**。社区检索无权威定论（见 §4 blockers）。对单一小程序、无跨账号身份打通需求的个人主体，openid 已足够做用户体系主键，unionid 非必需。

### ⑥ 频率限制与安全规范

**限频接口与配额（官方"接口调用频率规范"）**：

> "目前，「限频接口」包括以下接口：1. wx.login 2. wx.checkSession 3. wx.getSetting 4. wx.getUserInfo 5. wx.getUserProfile"
> 频率规范表：wx.login / wx.checkSession：**"一天的调用总次数不多于该小程序 PV 的两倍, 单用户一秒钟不能大于4次"**
> "微信后台会延迟一天统计上一天的小程序 PV 总数和 API 调用总数，超过规范总数的会提醒尽快调整。"
> 优化方法（官方建议）："把上一次调用接口的返回结果缓存下来以供后续逻辑复用"；"避免在定时循环的逻辑内重复调用「限频接口」"；"避免在页面初始化事件 onLoad、onShow、onReady 中调用限频接口，应该在小程序初始化事件 onLaunch 中调用"。

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html 🟢

**code2Session 服务端配额**：官方未公布具体每分钟数值，仅错误码明示存在分钟级配额：

> "45011 | api minute-quota reach limit mustslower retry next minute | API 调用太频繁，请稍候再试"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2session.html 🟢（具体数值 = blocker）

**resetusersessionkey 配额（官方明文，可作服务端配额量级参考）**：

> "单个小程序appid请求量频率限制为 60000 次 / 分钟。不允许频繁重置同一个用户的登录态。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_resetusersessionkey.html 🟢

**AppSecret 安全规范（官方"安全指引"）**：

> "敏感信息是指一旦泄露可能会对开发者的业务、合作伙伴和用户带来利益损害的数据，**包括但不限于账号 AppSecret**、特权账号信息、后台加密密钥、登录账户密码、用户身份证号、手机号、银行卡号等。"
> "敏感信息不应以明文、注释、可逆的编码方式（如 base64）、不安全散列函数（如 MD5、SHA1）等形式出现在小程序文件内。"
> "**如果小程序存在敏感信息泄露的问题，微信开放平台将有可能下架该小程序，并暂停该小程序的相关服务。**"
> 开发原则第 4 条："小程序代码（不包括云函数代码）跟传统 Web 应用的前端代码类似，**可被外部获取及进行反混淆**，重要业务逻辑应放在后台代码或云函数中进行。"
> 接口鉴权建议："敏感数据、能力相关接口需要在后台进行鉴权。通常可校验 openid、IP 地址、自定义登陆态等信息。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/security.html 🟢

**secret 泄露处理（重置入口）**🟡：
- 官方社区置顶帖（公众号/小程序 AppSecret 重置问题集合）：https://developers.weixin.qq.com/community/minihome/doc/000c4644ba43d8e51851e858261000 🟡
- 开放平台侧重置需管理员扫码验证（社区帖）：https://developers.weixin.qq.com/community/minihome/doc/000800d068c3e80938bfdf5a956c00 🟡
- 社区通行做法：泄露后在「微信公众平台 → 开发管理 → 开发设置」立即重置 AppSecret（重置后旧 secret 立即失效，需同步更新服务端配置）。此操作入口属管理后台功能，文档中心无单独规范页（🟡 社区经验 + 后台功能，未找到官方文档明文页 = 部分 blocker）。

---

## 3. 登录正规化直接相关的周边事实（个人主体视角）

### 3.1 wx.getUserProfile 已收回 → 头像昵称填写能力 🟢

官方 API 文档现状（2026-10-27 抓取）在页首即标注：

> "用户头像昵称获取规则已调整，参考 小程序用户头像昵称获取规则调整公告"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html 🟢
- 公告（官方社区，JS 渲染页未能直接抓原文，URL 由官方 API 文档给出）：https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01
- 替代方案（官方指南）："头像昵称填写能力"：`<button open-type="chooseAvatar">` 取头像 + `<input type="nickname">` 填昵称，从基础库 2.21.2 支持，2.24.4 起接入内容安全检测。
  - 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html 🟢
- 🟡 社区时间线（非官方规范）：2022-10-25 起 getUserProfile 返回匿名数据（灰头像 + "微信用户"）。

### 3.2 手机号快速验证组件：个人主体不可用 🟢（对本项目最硬的约束）

> "**目前该接口针对非个人主体，且完成了认证的小程序开放**（境外主体目前仅限部分国家地区开放……"
> 收费："自2023年8月28日起，手机号快速验证组件将需要付费使用。标准单价为：每次组件调用成功，收费0.03元。"（每个小程序 1000 次体验额度）
> code 语义："每个 code 有效期为5分钟，且只能消费一次。注：getPhoneNumber 返回的 code 与 wx.login 返回的 code 作用是不一样的，不能混用。"
> "新方式不再需要提前调用 wx.login 进行登录。"

- 来源：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html 🟢

→ **结论：个人主体小程序"用手机号做账号主键"的登录正规化路线在 2026 年依然被官方主体门槛封死**（该限制为长期稳定条款，2026-10 现行文档原文仍在）。登录主键只能也应该是 openid。

### 3.3 getRealtimePhoneNumber（手机号实时验证组件）

与快速验证同页说明，同样"非个人主体且认证"门槛（页面同源，实时验证组件条款见同目录 getRealtimePhoneNumber 文档）。个人主体同样不可用。🟢（同上来源页面交叉引用）

---

## 4. Blockers（查不到/官方无明文，禁止编造的部分）

| # | 事项 | 现状 | 影响 |
|---|---|---|---|
| B1 | session_key 的确切有效期时长 | 官方明文"具体时效逻辑由微信维护，对开发者透明"，无固定数值 | 工程上只能按"随时可能失效"设计（checkSession/服务端 checkSessionKey 探测），不能写死天数 |
| B2 | code2Session（/sns/jscode2session）具体每分钟配额数值 | 官方未公布，仅 45011 错误码提示分钟级配额存在 | 高并发登录需自做重试与错峰；参考 resetusersessionkey 的 60000 次/分钟量级做容量预估（非承诺值） |
| B3 | 个人主体小程序能否绑定微信开放平台账号（获取 unionid 的前提） | 官方文档未写主体限制条款；社区无权威定论（开放平台"认证"历来要求企业资质，但"绑定小程序"是否需要认证未明文） | 若需要 unionid（如后续接公众号/APP 打通），需管理员在 open.weixin.qq.com 后台人工实测绑定入口 |
| B4 | checkSessionKey / resetusersessionkey 的上线公告与时间 | 未检索到独立上线公告；2026-10-27 官方文档已收录且 wx.checkSession 文档显式引用 | 接口可用性以文档为准即可；如需精确上线时间需翻官方公告归档 |
| B5 | AppSecret 重置操作的官方文档页 | 重置入口在管理后台（社区置顶帖佐证其存在与管理员扫码要求），文档中心无单独规范页 | 泄露应急流程按"后台立即重置 + 服务端同步换新"执行（社区通行实践 🟡） |
| B6 | 头像昵称规则调整公告原帖正文 | 公告为官方社区 JS 渲染页，未能抓取正文；官方 API 文档已引用其 URL 并标注"已调整" | 结论以官方 API 文档标注为准，公告 URL 已留档 |

---

## 5. 对本项目（个人主体 + 虚拟支付-个人版）的落地含义

> 以下为基于上述官方证据的工程推演（非官方文档原文），每条均可回溯到上文引文。

1. **登录正规化的正确终态 = openid 主键 + 自发 token**。官方时序图本身就把终态设计为"开发者服务器根据用户标识来生成自定义登录态"。个人主体拿不到手机号（3.2 🟢），unionid 又存疑（B3），所以 **openid 是唯一可靠的合法用户主键**，现有"匿名会话"应升级为"openid 关联会话"。
2. **静默升级现有匿名用户**：wx.login 无需任何用户授权（① 🟢），可在用户无感的情况下把存量匿名会话与 openid 绑定——这正是现有"支付时 wx.login 绑定"模式的推广：不必等支付，启动时静默完成。
3. **session_key 服务端保管是硬性要求**（③ 🟢 两处明文）。现状若曾把 session_key 下发前端或存于前端 storage，属违规点，需在正规化中一并清理。
4. **避免重复 wx.login 顶替 session_key**（① 🟢 顶替语义）：正规化后应"一次登录、token 复用"，wx.login 仅在登录态失效时触发，同时满足限频规范（⑥ 🟢：日调用量 ≤ 2×PV，单用户 ≤ 4 次/秒）。
5. **登录态校验可全链路服务端化**（④ 🟢 新接口）：服务端可定期/事件驱动地用 hmac_sha256(session_key, "") 签名调 /wxa/checksession 自检，把"用户是否仍有效"的判断权收到自己手里，客户端 wx.checkSession 只做体验层兜底。
6. **支付场景注意**：getPhoneNumber 的 code 与 wx.login 的 code 不能混用（3.2 🟢）；虚拟支付回调/下单侧的用户身份应统一走 openid 对账。

---

## 6. 引用来源清单

**官方文档（🟢 证据主体，均为 2026-10-27 直抓原文）**

1. 小程序登录指南：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html
2. wx.login API：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html
3. wx.checkSession API：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html
4. code2Session 服务端接口：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2session.html （现址 https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html ）
5. 小程序登录接口列表（含 checkSessionKey / resetusersessionkey）：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/index.html
6. checkSessionKey：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_checksessionkey.html
7. ResetUserSessionKey：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_resetusersessionkey.html
8. 接口调用频率规范：https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html
9. 安全指引：https://developers.weixin.qq.com/miniprogram/dev/framework/security.html
10. UnionID 机制说明：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html
11. 服务端获取开放数据（signature）：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html
12. 手机号快速验证组件：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html
13. 头像昵称填写：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html
14. wx.getUserProfile API（已标注调整）：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html
15. 接口调用指南（服务端调用总则）：https://developers.weixin.qq.com/doc/oplatform/developers/dev/guide.html

**官方社区/公告（🟡 线索）**

16. 用户头像昵称获取规则调整公告：https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01
17. AppSecret 重置置顶帖：https://developers.weixin.qq.com/community/minihome/doc/000c4644ba43d8e51851e858261000
18. 开放平台重置 AppSecret 需管理员扫码：https://developers.weixin.qq.com/community/minihome/doc/000800d068c3e80938bfdf5a956c00

**第三方（仅线索，未作为结论依据）**

19. 掘金-微信开发彻底搞懂 unionid：https://juejin.cn/post/6875521030337757192
20. cnblogs-小程序登录（45011/40226 错误码实践）：https://www.cnblogs.com/AtlasLapetos/p/18640899
