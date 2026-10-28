# 微信小程序登录态本地持久化 — 官方文档考据报告

- 考据日期：2026-10-27
- 考据对象：小程序登录态本地持久化（storage）的官方最佳实践
- 业务背景：个人主体小程序，已接入微信虚拟支付（个人版），当前为匿名会话 + 支付时 `wx.login` 绑定；正在评估登录规范化方案
- 取证方式：直接抓取 developers.weixin.qq.com 官方文档 `.md` 源端点（逐字节原文），辅以官方开放社区与第三方文章线索
- 标注约定：【官方明文】= developers.weixin.qq.com 文档原文；【社区经验】= 官方社区/第三方文章（仅作佐证线索）

> 取证环境说明：本机 WebFetch 对 developers.weixin.qq.com 域名校验失败，改用 curl 直抓官方 `.md` 端点取证，所有引述均为官方文档源文件原文，非转述。

---

## 结论速览（TL;DR）

1. storage 单 key 上限 1MB、总量上限 10MB，按「用户 × 小程序」隔离；除用户主动删除或系统因空间清理外一直可用【官方明文】。
2. 官方登录态维护链路：`wx.login` 取 code（5 分钟有效、一次性）→ 服务端 `code2Session` 换 openid/session_key → 服务端生成**自定义登录态**下发前端；前端用 `wx.checkSession` 检测过期，失败则重新 `wx.login`【官方明文】。
3. 官方安全边界：session_key **不得下发到小程序**；前端代码可被反混淆、敏感数据禁止明文保存。官方**没有**「自定义 token 禁止存 storage」的明文条款；「自定义 token 可存 storage、应设较短过期时间」属社区通行实践【社区经验】。
4. 小程序销毁/冷启动**不会**清理本地缓存；只有代码包被清理（用户删除小程序、存储空间不足）时本地缓存才被清理【官方明文】。
5. `wx.getStorageInfo(Sync)` 返回 keys/currentSize/limitSize（单位 KB）；storage 无自动过期机制，清理靠 `wx.removeStorage` / `wx.clearStorage` 自理【官方明文】。
6. 2026-10-27 现状：storage 与登录族 API 均为现行有效接口（文档含微信鸿蒙 OS 版支持行），未发现废弃/替换公告。

---

## ① wx.setStorageSync 的容量上限与持久化条件

### 结论【官方明文】

| 项目 | 数值/规则 |
|---|---|
| 单个 key 最大数据长度 | 1MB |
| 所有数据存储总上限 | 10MB |
| 持久性 | 除非用户主动删除或因存储空间原因被系统清理，否则一直可用 |
| 可存储类型 | 原生类型、Date、及能通过 `JSON.stringify` 序列化的对象 |
| 隔离 | 以「用户 × 小程序」为维度隔离 |

### 官方原文

> 「将数据存储在本地缓存中指定的 key 中。会覆盖掉原来该 key 对应的内容。除非用户主动删除或因存储空间原因被系统清理，否则数据都一直可用。单个 key 允许存储的最大数据长度为 1MB，所有数据存储上限为 10MB。」
>
> 「storage 应只用来进行数据的持久化存储，不应用于运行时的数据传递或全局状态管理。启动过程中过多的同步读写存储，会显著影响启动耗时。」

来源：wx.setStorageSync 官方 API 文档
https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html

> 「同一个微信用户，同一个小程序 storage 上限为 10MB。storage 以用户维度隔离，同一台设备上，A 用户无法读取到 B 用户的数据；不同小程序之间也无法互相读写数据。」

来源：基础能力/存储 官方指南
https://developers.weixin.qq.com/miniprogram/dev/framework/ability/storage.html

### 工程含义（登录场景）

- 登录态 token、用户偏好等 JSON 序列化对象完全在限额内（token 通常 < 1KB）。
- 官方明确警示：storage 只做持久化，不做运行时全局状态管理；启动期大量同步读写会拖慢启动——登录态应在 `onLaunch` 读一次，内存中使用。
- 同一设备换微信号登录，storage 天然隔离，无需自行做账号维度隔离。

---

## ② 官方登录态维护指引：wx.login → code2Session → checkSession 重登流程

### 官方登录三步流程【官方明文】

> 「1. 调用 wx.login() 获取 **临时登录凭证code**，并回传到开发者服务器。
> 2. 调用 auth.code2Session 接口，换取 **用户唯一标识 OpenID**、用户在微信开放平台账号下的**唯一标识UnionID**（若当前小程序已绑定到微信开放平台账号）和 **会话密钥 session_key**。
> 之后开发者服务器可以根据用户标识来生成自定义登录态，用于后续业务逻辑中前后端交互时识别用户身份。」

来源：小程序登录 官方指南
https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html

关键细节（均【官方明文】）：

- code 有效期与用途：「code | string | 用户登录凭证（有效期五分钟）。开发者需要在开发者服务器后台调用 code2Session，使用 code 换取 openid、unionid、session_key 等信息」（wx.login 文档，https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html）
- code 一次性：「临时登录凭证 code 只能使用一次」（小程序登录指南）
- code2Session 必须服务端调用：「接口应在服务器端调用，不可在前端（小程序、网页、APP等）直接调用」（code2Session 服务端文档，https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.md）

### checkSession 检测与重登【官方明文】

> 「检查登录态 session_key 是否过期。
> 通过 wx.login 接口获得的用户登录态拥有一定的时效性。用户越久未使用小程序，用户登录态越有可能过期。反之如果用户一直在使用小程序，则用户登录态一直保持有效。具体时效逻辑由微信维护，对开发者透明。
> 开发者可以调用 wx.checkSession 接口检测用户登录态是否过期。**注意，wx.checkSession 的校验对象是最后一次获取 code 操作对应的登录态 session_key**，调用成功说明该 session_key 未过期，调用失败说明 session_key 已过期。
> 登录态失效后开发者可以再调用 wx.login 获取新的用户登录态。」

来源：wx.checkSession 官方 API 文档
https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html

官方示例代码（重登范式）：

> ```js
> wx.checkSession({
>   success () {
>     //session_key 未过期，并且在本生命周期一直有效
>   },
>   fail () {
>     // session_key 已经失效，需要重新执行登录流程
>     wx.login() //重新登录
>   }
> })
> ```

### 调用频率规范【官方明文】

> 「目前，『限频接口』包括以下接口：1. wx.login 2. wx.checkSession …
> wx.login：一天的调用总次数不多于该小程序 PV 的两倍，单用户一秒钟不能大于4次
> wx.checkSession：一天的调用总次数不多于该小程序 PV 的两倍，单用户一秒钟不能大于4次」
>
> 「避免在页面初始化事件`onLoad`、`onShow`、`onReady`中调用限频接口，应该在小程序初始化事件`onLaunch`中调用」

来源：接口调用频率规范
https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.md

### code2Session 关键错误码【官方明文】

| 错误码 | 描述 | 官方解决方案 |
|---|---|---|
| 40029 | code 无效 | js_code 无效（code 已用过/过期） |
| 40226 | code blocked | 高风险等级用户，小程序登录拦截 |
| 45011 | api minute-quota reach limit | API 调用太频繁，请稍候再试 |

来源：https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.md

### 推荐落地链路（官方指引拼装）

```
App.onLaunch:
  读 storage 中的自定义 token
  ├─ 无 token → wx.login → 后端 code2Session → 签发 token → setStorageSync
  └─ 有 token → checkSession
        ├─ success → 带 token 请求业务接口（后端校验 token）
        └─ fail    → wx.login 重新走登录 → 后端重新签发 token（覆盖 storage）
```

注意：`wx.checkSession` 校验的是**微信侧 session_key** 的有效性，与**自定义 token** 的有效性是两层状态。token 过期与否由开发者后端判定（接口返回 401 后静默重登），checkSession 只用于决定是否需要重新 `wx.login` 换新 code。

---

## ③ Token 存入 storage 的安全建议

### 官方安全边界【官方明文】

1. session_key 不得下发前端：

> 「会话密钥 session_key 是对用户数据进行加密签名的密钥。为了应用自身的数据安全，开发者服务器**不应该把会话密钥下发到小程序，也不应该对外提供这个密钥**。」

来源：小程序登录官方指南
https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html

2. 前端代码可被反混淆、敏感数据禁明文（安全指引开发原则）：

> 「3.禁止明文保存用户敏感数据。
> 4.小程序代码（不包括云函数代码）跟传统 Web 应用的前端代码类似，可被外部获取及进行反混淆，重要业务逻辑应放在后台代码或云函数中进行。」

来源：安全指引
https://developers.weixin.qq.com/miniprogram/dev/framework/security.html

3. 敏感信息定义与存放限制：

> 「敏感信息是指一旦泄露可能会对开发者的业务、合作伙伴和用户带来利益损害的数据，包括但不限于**账号 AppSecret、特权账号信息、后台加密密钥、登录账户密码、用户身份证号、手机号、银行卡号等**。」
> 「敏感信息不应以明文、注释、可逆的编码方式（如 base64）、不安全散列函数（如 MD5、SHA1）等形式出现在小程序文件内。」
> 「如果小程序存在敏感信息泄露的问题，微信开放平台将有可能下架该小程序，并暂停该小程序的相关服务。」

来源：安全指引（信息泄露节）
https://developers.weixin.qq.com/miniprogram/dev/framework/security.html

### 官方缺位部分【社区经验补位】

官方文档**没有**「自定义登录态 token 是否允许存入 storage」的明文条款。通行实践来自社区：

> 「对于开发者自己生成的 session，应该保证其安全性且不应该设置较长的过期时间。session 派发到小程序客户端之后，可将其存储在 storage，用于后续通信使用。」

来源（腾讯云开发者社区，2020，第三方仅作线索）：https://cloud.tencent.com/developer/article/1677389

### 落地建议（结合本项目：匿名会话 → 登录规范化）

- 自定义登录态 token 是敏感授权凭据。本项目使用小程序 storage 持久化，必须避免写入日志或暴露给其他用户；目标设备上的存储安全能力尚需验证。
- 禁存：session_key、AppSecret、虚拟支付密钥、用户手机号/身份证等敏感信息（官方明文红线）。
- 本项目设有 access/refresh 过期时间与 REVOKED 状态，但本期没有服务端主动吊销接口；确定性 access token 在正常续期后可再次有效，不能据此声称泄漏影响面已受控。
- 不要把 token 当权限依据本身——后端每个接口仍须校验 token 对应的身份与权限（官方安全指引「接口鉴权」节明文要求）。

---

## ④ 小程序销毁 / 冷启动后 storage 的保留规则

### 结论【官方明文】

本地缓存与页面内存状态是两回事：小程序被销毁、冷启动、用户杀掉微信再进，**本地缓存（storage）不受影响**；只有代码包被清理时，本地缓存才随之被清理。

### 官方原文

> 「本地缓存的清理时机跟代码包一样，只有在代码包被清理的时候本地缓存才会被清理。」

来源：基础能力/存储
https://developers.weixin.qq.com/miniprogram/dev/framework/ability/storage.html

> 「冷启动：如果用户首次打开，或小程序销毁后被用户再次打开，此时小程序需要重新加载启动，即冷启动。」
> 「当小程序进入后台并被『挂起』后，如果很长时间（目前是 30 分钟）都未再次进入前台，小程序会被销毁。」

来源：小程序运行机制
https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/operating-mechanism.html

配合 ① 中 wx.setStorageSync 文档的持久性表述「除非用户主动删除或因存储空间原因被系统清理，否则数据都一直可用」——销毁/冷启动不在清理条件之列。

### 工程含义

- 登录态 token 写入 storage 后可跨冷启动存活（用户下次打开仍免登录），直到 token 自然过期或被用户清理。
- 但**内存态**（globalData、页面 data）销毁即失——冷启动时必须从 storage 恢复登录态，不能依赖上次的内存状态。

---

## ⑤ getStorageInfo 与清理策略

### getStorageInfo 返回结构【官方明文】

> | 属性 | 类型 | 说明 |
> | ---- | ---- | ---- |
> | keys | Array.<string> | 当前 storage 中所有的 key |
> | currentSize | number | 当前占用的空间大小, 单位 KB |
> | limitSize | number | 限制的空间大小，单位 KB |

来源：wx.getStorageInfoSync 官方 API 文档
https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfoSync.html

### 清理 API【官方明文】

官方存储指南列明的读写与清理接口全集：`wx.setStorage/wx.setStorageSync`、`wx.getStorage/wx.getStorageSync`、`wx.clearStorage/wx.clearStorageSync`、`wx.removeStorage/wx.removeStorageSync`。

- `wx.clearStorage`：「清理本地数据缓存。」（https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorage.html）
- `wx.removeStorageSync(key)`：删除指定 key（https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorageSync.html）

### 清理策略要点

- storage **没有自动过期机制**（官方无 TTL 语义；对比页面级「退出状态」有 expireTimeStamp，storage 无）——过期控制必须由业务自己做：token 存储时带上 `expireAt` 字段，读取时自行判断。
- 推荐做法：
  - token 失效/用户登出时：`removeStorageSync('token')` 精准清理，而不是 `clearStorage` 全清（会误伤其他缓存）。
  - 版本升级换 key 结构时：读 `getStorageInfoSync().keys` 检测旧 key 前缀并批量迁移/删除。
  - 监控 `currentSize/limitSize`（KB）接近 10MB（约 10240KB）时降级写入。
  - 匿名会话 → 登录规范化切换时：旧匿名 session key 应显式 remove，避免双份登录态并存。

---

## 2026-10-27 现状与废弃检查

- `wx.setStorageSync / wx.getStorageInfo(Sync) / wx.clearStorage / wx.removeStorage`：现行有效，文档页均含「微信 鸿蒙 OS 版：支持」支持行，无废弃标记。
- `wx.login / wx.checkSession / code2Session`：现行有效，仍是官方唯一登录链路；`wx.checkSession` 与 `wx.login` 同列官方「限频接口」清单（现行规范页）。
- 本轮抓取的全部官方文档页均可访问且无「已废弃/即将下线」横幅；未检索到 storage 或登录族 API 的替换公告。
- 关联变动提醒（与登录态间接相关，非本次必查项）：`wx.getUserProfile` 等用户信息接口历史上经过多次能力调整，若登录规范化方案涉及获取昵称头像，需另行考据「头像昵称填写能力」现行规范（本次未展开，见 blockers）。

---

## 官方 vs 社区 来源汇总

| # | 结论 | 级别 | 来源 |
|---|---|---|---|
| 1 | 单 key 1MB / 总量 10MB | 官方明文 | wx.setStorageSync 文档 |
| 2 | 用户主动删除或系统空间清理外一直可用 | 官方明文 | wx.setStorageSync 文档 |
| 3 | storage 按用户×小程序隔离 | 官方明文 | 基础能力/存储 |
| 4 | storage 只做持久化、不做运行时状态，启动期同步 IO 拖慢启动 | 官方明文 | wx.setStorageSync 文档「注意」 |
| 5 | 登录三步流程 + 自定义登录态由服务端生成 | 官方明文 | 小程序登录指南 |
| 6 | code 5 分钟有效、一次性；code2Session 仅服务端 | 官方明文 | wx.login / 登录指南 / code2Session 文档 |
| 7 | checkSession 校验最后一次 code 的 session_key，失效后重新 wx.login | 官方明文 | wx.checkSession 文档 |
| 8 | session_key 不下发前端 | 官方明文 | 小程序登录指南注意事项 |
| 9 | 前端代码可反混淆；敏感数据禁明文；泄露可下架 | 官方明文 | 安全指引 |
| 10 | 自定义 token 可存 storage、设较短过期时间 | 社区经验 | 腾讯云开发者社区文章 |
| 11 | 销毁/冷启动不清理 storage，仅代码包清理时清理 | 官方明文 | 基础能力/存储 + 运行机制 |
| 12 | getStorageInfo 返回 keys/currentSize/limitSize（KB） | 官方明文 | wx.getStorageInfoSync 文档 |
| 13 | storage 无自动过期，清理靠 remove/clear 自理 | 官方明文（由文档无 TTL 语义+清理 API 推定） | 存储指南 + API 文档 |
| 14 | login/checkSession 限频：日调用 ≤ 2×PV、单用户 ≤4次/秒 | 官方明文 | 接口调用频率规范 |

---

## Blockers（查不到 / 官方无明文，如实标注）

1. **「自定义登录态 token 可否存 storage」无官方明文条款**——官方仅划定边界（session_key 禁下发、敏感数据禁明文、前端可反混淆）。「token 可存 storage + 短过期」是社区通行实践（腾讯云开发者社区文章佐证），非官方明文。落地按社区经验执行，风险自评。
2. **session_key 的具体有效期时长官方未公布**——官方原话「具体时效逻辑由微信维护，对开发者透明」，无法给出确定的过期时间窗，只能依赖 checkSession 动态检测。
3. **代码包被清理的完整触发清单官方未逐条列举**——storage 文档仅一句「只有在代码包被清理的时候本地缓存才会被清理」，具体触发（用户删除小程序、微信存储空间不足自动清理等）未在本次抓取的官方页面中逐条列明；wx.setStorageSync 文档的「用户主动删除或因存储空间原因被系统清理」是另一表述口径，两者一致但粒度有限。
4. 取证方式限制：本机 WebFetch 无法访问 developers.weixin.qq.com（域名校验失败），改用 curl 抓官方 `.md` 端点完成取证，结论不受影响，但未能核验页面上的动态公告横幅。

---

## 参考来源清单（全部于 2026-10-27 抓取验证）

1. wx.setStorageSync — https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html
2. wx.getStorageInfoSync — https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageInfoSync.html
3. 基础能力/存储（隔离与清理策略）— https://developers.weixin.qq.com/miniprogram/dev/framework/ability/storage.html
4. 小程序登录（登录流程时序与注意事项）— https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html
5. wx.login — https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html
6. wx.checkSession — https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html
7. code2Session 服务端接口 — https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.md
8. 接口调用频率规范 — https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.md
9. 小程序运行机制（冷启动/销毁）— https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/operating-mechanism.html
10. 安全指引 — https://developers.weixin.qq.com/miniprogram/dev/framework/security.html
11. wx.clearStorage — https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.clearStorage.html
12. wx.removeStorageSync — https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.removeStorageSync.html
13.【社区经验】微信小程序：授权登录+基于token的身份验证详解（腾讯云开发者社区）— https://cloud.tencent.com/developer/article/1677389
