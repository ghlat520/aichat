# 微信小程序「头像昵称获取能力」2026 现状考据

> 考据日期：2026-10-27
> 考据范围：`wx.getUserProfile` / `wx.getUserInfo` 回收状态、头像昵称填写能力（`button open-type="chooseAvatar"` + `input type="nickname"`）官方用法与限制、匿名数据（"微信用户"/灰色头像）官方说明、个人主体小程序可用性
> 资料权威等级：【官方明文】= developers.weixin.qq.com 文档/官方公告原文；【社区经验】= 第三方教程/开发者实测，仅作线索与佐证
> 项目背景：个人主体小程序，已接入微信虚拟支付（个人版），当前匿名会话 + 支付时 `wx.login` 绑定，正在评估登录规范化方案

---

## 结论速览（TL;DR）

| 必查项 | 结论 | 证据等级 |
|---|---|---|
| ① `wx.getUserProfile` 是否废弃 | **已回收（官方标注"已回收"）**，2022-11-08 24 时后发布的新版本调用只返回灰色头像 + "微信用户"；2026 年现行官方隐私接口清单明确标注 `wx.getUserProfile (已回收)` | 官方明文 |
| ② 头像昵称填写能力官方用法与限制 | `button open-type="chooseAvatar"`（基础库 2.21.2+）+ `input type="nickname"`（2.21.2+）；必须用户主动触发；2.24.4+ 强制内容安全检测；**不在官方限频接口清单**，无平台频控，但受 2023-10-17 起强制的隐私协议声明约束（未声明则组件直接禁用） | 官方明文 |
| ③ "微信用户"/灰色头像官方解释 | 官方公告原文：生效期后新版本通过 `wx.getUserProfile` 获取头像"将统一返回默认灰色头像"，昵称"将统一返回'微信用户'"——是**平台主动设计的匿名化行为，非 bug** | 官方明文 |
| ④ 个人主体是否可用 | 头像昵称填写能力文档、组件文档、调整公告**均无任何主体限制条款**（对比手机号等认证类能力），公告定位为所有小程序的通用替代方案；社区大量个人主体小程序在用 | 官方明文（无限制）+ 社区佐证 |

---

## 一、时间线与关键事件

| 时间 | 事件 | 来源 |
|---|---|---|
| 2021-04-13 | `wx.getUserInfo` 不再弹授权窗，直接返回匿名用户信息 | 官方示例代码注释【官方明文】 |
| 2022-05-09 | 微信团队发布《小程序用户头像昵称获取规则调整公告》 | 微信开放社区【官方明文】 |
| 2022-09-28（公告更新） | 回收截止时间由 2022-10-25 **延期至 2022-11-08 24 时** | 公告原文【官方明文】 |
| 2022-11-08 24:00 | 接口回收生效：生效期后发布的小程序新版本，`wx.getUserProfile` 返回匿名数据 | 公告原文【官方明文】 |
| 2022-11-09（公告更新） | 因 PC/macOS 兼容问题：来自**低于 2.27.1 基础库**的访问，`wx.getUserProfile` 仍返回真实头像昵称 | 公告原文【官方明文】 |
| 2023-10-17 起 | 隐私协议功能全面强制启用（不论是否配置 `__usePrivacyCheck__`） | 隐私协议开发指南【官方明文】 |
| 2026-10（现状） | 官方隐私接口清单将 `wx.getUserProfile` / `wx.getUserInfo` / `<button open-type="userInfo">` 全部标注"**已回收**"；现行有效能力为 `chooseAvatar` + `nickname` | 官方文档现行版【官方明文】 |

---

## 二、必查项 ①：`wx.getUserProfile` 废弃/回收状态

### 2.1 官方公告原文（回收规则）

来源：微信团队《小程序用户头像昵称获取规则调整公告》
https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01

**调整背景（官方原文）：**

> "在小程序内，开发者可以通过 wx.login、wx.getUserInfo 获取用户信息……但实践中发现有部分小程序，在用户刚打开小程序时就要求收集用户的微信昵称头像，或者在支付前等不合理路径上要求授权，若用户拒绝则无法使用小程序。为减少此类不合理的强迫授权情况，作出如下调整。"

**回收规则（官方原文，含匿名行为精确描述）：**

> "自生效期起，小程序 wx.getUserProfile 接口将被收回：生效期后发布的小程序新版本，通过 wx.getUserProfile 接口获取用户头像将统一返回默认灰色头像，昵称将统一返回 '微信用户'。"

**生效期（官方原文，延期后的最终时间）：**

> "考虑到近期开发者对小程序用户头像昵称获取规则调整的相关反馈，平台将接口回收的截止时间由2022年10月25日延期至2022年11月8日24时。"

**PC/macOS 兼容例外（2022-11-09 更新，官方原文）：**

> "由于 PC/macOS 平台「头像昵称填写能力」存在兼容性问题，对于来自低于2.27.1版本的访问，小程序通过 wx.getUserProfile 接口将正常返回用户头像昵称，插件通过 wx.getUserInfo 接口将正常返回用户头像昵称。"

> 考据注：这条同时解释了社区中 "2.21.2 与 2.27.1 两个版本号" 的混淆——**2.21.2 是头像昵称填写能力的基础库起点；2.27.1 是 getUserProfile 匿名化的基础库分界**（≥2.27.1 一律匿名，<2.27.1 因 PC 兼容保留真实数据）。二者语义不同，不冲突。

**wx.login 不受影响（官方原文）：**

> "通过 wx.login 与 wx.getUserInfo 接口获取 openId、unionId 能力不受影响。"

**小游戏不受影响（官方原文）：**

> "本次调整对小游戏不影响。"

### 2.2 2026 年现行官方文档状态【官方明文】

**隐私接口清单（现行有效版）明确标注"已回收"**，来源：官方《小程序用户隐私保护指引内容介绍》
https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html

> "| 收集你的昵称、头像 | `<button open-type="chooseAvatar">`、`<input type="nickname">`、wx.getUserInfo (已回收)、wx.getUserProfile (已回收)、`<button open-type="userInfo">`(已回收) |"

**API 参考页现状**（页面仍在线、未删除，但顶部挂调整提示），来源：官方 `wx.getUserProfile` API 文档
https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html

> "用户头像昵称获取规则已调整，参考 [小程序用户头像昵称获取规则调整公告](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01)"

> "限制：仅在点击行为时调用"

> "获取用户信息。页面产生点击事件（例如 `button` 上 `bindtap` 的回调中）后才可调用，每次请求都会弹出授权窗口，用户同意后返回 `userInfo`。该接口用于替换 `wx.getUserInfo`"

**限频接口**（即使可用也受频率约束），来源：官方《接口调用频率规范》
https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html

> "目前，「限频接口」包括以下接口：1. wx.login 2. wx.checkSession 3. wx.getSetting 4. wx.getUserInfo 5. wx.getUserProfile"

> "| wx.getUserProfile | 一天的调用总次数不多于该小程序 PV 的两倍,单用户一秒钟不能大于4次 |"

### 2.3 匿名数据返回的精确行为

【官方明文】公告原文（见 2.1）：头像 = **默认灰色头像**（一张固定的灰色人形占位图），昵称 = **字符串"微信用户"**。生效判定按"**生效期后发布的小程序新版本**"——生效期前已发布的存量版本短期内仍可拿到真实数据，任何一次新版本发布后即永久匿名化。

【社区经验】开发者实测佐证（与官方规则一致）：
- 调用 `wx.getUserProfile` 不再弹出授权窗，直接返回灰色头像与"微信用户"昵称（CSDN，2023-12：https://blog.csdn.net/xiaoxiangzi520/article/details/135197076 ；掘金：https://juejin.cn/post/7436361280586366987 ）
- 新注册用户/新发布版本一律匿名；这不是 bug，是平台刻意行为（CRMEB 问答：https://www.crmeb.com/ask/thread/21677 ）

---

## 三、必查项 ②：头像昵称填写能力——官方用法与限制

### 3.1 能力定义与版本【官方明文】

来源：官方《头像昵称填写》能力文档
https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html

> "# 头像昵称填写
> 从基础库 [2.21.2] 开始支持
> 当小程序需要让用户完善个人资料时，可以通过微信提供的头像昵称填写能力快速完善。
> 根据相关法律法规，为确保信息安全，由用户上传的图片、昵称等信息微信侧将进行安全检测，组件从基础库2.24.4版本起，已接入内容安全服务端接口（mediaCheckAsync、msgSecCheck），以减少内容安全风险对开发者的影响。"

### 3.2 头像选择（`button open-type="chooseAvatar"`）【官方明文】

官方文档原文：

> "需要将 button 组件 open-type 的值设置为 chooseAvatar，当用户选择需要使用的头像之后，可以通过 bindchooseavatar 事件回调获取到头像信息的临时路径。"

组件属性（来源：官方 button 组件文档 https://developers.weixin.qq.com/miniprogram/dev/component/button.html ）：

> "chooseAvatar | 获取用户头像，可以从bind:chooseavatar回调中获取到头像信息 | 最低版本 2.21.2"

> "bind:chooseavatar | 获取用户头像回调，open-type=chooseAvatar时有效"

官方代码示例（原文摘录）：

```html
<button class="avatar-wrapper" open-type="chooseAvatar" bind:chooseavatar="onChooseAvatar">
  <image class="avatar" src="{{avatarUrl}}"></image>
</button>
<input type="nickname" class="weui-input" placeholder="请输入昵称"/>
```

```js
onChooseAvatar(e) {
  const { avatarUrl } = e.detail   // 临时路径
  this.setData({ avatarUrl })
}
```

**限制 1——内容安全检测不通过则无回调**（官方原文）：

> "从基础库2.24.4版本起，若用户上传的图片未通过安全监测，不触发`bindchooseavatar` 事件。"

**限制 2——返回的是临时路径，需自行持久化**（官方原文语义 + 公告建议）：官方明确 `e.detail.avatarUrl` 为"头像信息的临时路径"；官方公告同时给出最佳实践：

> "小程序可在个人中心或设置等页面使用头像昵称填写能力让用户完善个人资料"（公告《最佳实践》节）

> 考据注：官方文档**未明文给出临时路径的有效时长数字**（社区经验普遍称约 1 天，见 https://www.cnblogs.com/bk1234/p/17400974.html ）。落地必须当次上传到自己服务器/存储持久化，不能只存临时路径。

### 3.3 昵称填写（`input type="nickname"`）【官方明文】

官方文档原文：

> "需要将 input 组件 type 的值设置为 nickname，当用户在此input进行输入时，键盘上方会展示微信昵称。"

组件属性（来源：官方 input 组件文档 https://developers.weixin.qq.com/miniprogram/dev/component/input.html ）：

> "nickname | 昵称输入键盘。 | 最低版本 2.21.2"

> "bind:nicknamereview | 用户昵称审核完毕后触发，仅在 type 为 \"nickname\" 时有效，event.detail = { pass: boolean, timeout: boolean } | 最低版本 2.29.1"

**限制 1——异步安全检测 + 建议用 form submit 收集**（官方原文）：

> "从基础库2.24.4版本起，在`onBlur` 事件触发时，微信将异步对用户输入的内容进行安全监测，若未通过安全监测，微信将清空用户输入的内容，建议开发者通过 form 中`form-type` 为`submit` 的button 组件收集用户输入的内容。"

**限制 2——真机与工具差异**（官方原文）：

> "在开发者工具上，input 组件是用 web 组件模拟的，因此部分情况下并不能很好的还原真机的表现，建议开发者在使用到原生组件时尽量在真机上进行调试。"

【社区经验】补充陷阱（未见官方正式回复页，属开发者普遍经验）：
- 用户点键盘上方的"微信昵称"快捷填入时，部分场景 `bindinput` 不触发或 value 为空，**可靠取值方式是 form `bindsubmit` 或 `bindblur`**（掘金 2025-04：https://juejin.cn/post/7196924295309312056 相关系列；Taro issue：https://github.com/NervJS/taro/issues/11007 ）
- 官方 input 文档的 `blur` 事件返回结构 `{ value, encryptedValue?, encryptError? }` 也印证失焦才是可靠采集时机。

### 3.4 频控问题【官方明文——不在限频清单】

官方《接口调用频率规范》列出的限频接口仅 5 个（wx.login / wx.checkSession / wx.getSetting / wx.getUserInfo / wx.getUserProfile），**`chooseAvatar` 按钮与 `nickname` 输入框均不在其中**——即官方层面无独立频控配额。真实约束是：

1. **必须用户主动触发**：`open-type="chooseAvatar"` 是 button 点击行为，昵称是用户键盘输入行为，无法程序化静默调用（与被回收的 getUserProfile 的设计差异正在于此）；
2. **内容安全检测**（2.24.4+，见 3.2/3.3 引文）；
3. **隐私协议声明**（见第五节）。

> 考据注：与本关联的 `wx.login` 是限频接口："一天的调用总次数不多于该小程序 PV 的两倍,单用户一秒钟不能大于4次"（官方原文）。本项目"支付时才 wx.login 绑定"的模式天然满足该规范。

### 3.5 2022 官方公告对替代能力的定位【官方明文】

> "如业务需获取用户头像昵称，可以使用「头像昵称填写能力」（基础库 2.21.2 版本开始支持，覆盖iOS与安卓微信 8.0.16 以上版本）"（公告《替代方案》节）

> "开发者可以添加「头像昵称填写能力」，用户主动点击并选择微信头像、填写微信昵称"（公告原文）

---

## 四、必查项 ③：匿名头像/昵称（"微信用户"）的官方解释

【官方明文】最权威定义即 2.1 节公告原文：

> "通过 wx.getUserProfile 接口获取用户头像将统一返回默认灰色头像，昵称将统一返回 '微信用户'。"

补充官方脉络：

1. **匿名化是渐进过程，不是一次事件**：
   - 2021-04-13 起 `wx.getUserInfo` 匿名化。官方 `wx.getUserProfile` 文档示例代码注释原文：
     > "不推荐使用getUserInfo获取用户信息，预计自2021年4月13日起，getUserInfo将不再弹出弹窗，并直接返回匿名的用户个人信息"
   - 2022-11-08 24 时起 `wx.getUserProfile` 回收（新版本匿名）。
2. **"灰色头像"具体形态**：官方示例代码中给出默认头像 URL（`https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0`），即公告所述"默认灰色头像"，开发者可在 UI 上将其作为占位图。
3. **官方动机（原文）**："为减少此类不合理的强迫授权情况"（用户刚打开小程序/支付前强制索权）。本项目场景恰好命中公告批评的反模式——**切勿在支付前强制弹头像昵称授权**。
4. **身份标识不受影响（原文）**："通过 wx.login 与 wx.getUserInfo 接口获取 openId、unionId 能力不受影响。" 即登录识别体系（openid/unionid）与头像昵称展示体系完全解耦——这正是"匿名会话 + 支付时 wx.login 绑定"方案能够成立的官方依据。

---

## 五、2026 年附加约束：隐私协议声明（影响头像昵称填写能力）

【官方明文】来源：官方《小程序隐私协议开发指南》
https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html

**强制启用时间：**

> "2023.09.14 更新：1）隐私相关功能启用时间延期至 2023年10月17日。……在 2023年10月17日之后，不论 app.json 中是否有配置 `__usePrivacyCheck__`，隐私相关功能都会启用。"

**未声明则组件直接禁用：**

> "仅有在指引中声明所处理的用户信息，才可以调用平台提供的对应接口或组件。若未声明，对应接口或组件将直接禁用。"

**chooseAvatar/nickname 属于需声明的隐私范围**（miniprogram-intro 清单将二者归入"收集你的昵称、头像"条目，见 2.2 引文）。

**nickname input 的隐私降级行为：**

> "需要注意的是，对于 `<input type="nickname">` 组件，由于 `<input>` 的特殊性，如果用户未同意隐私协议，则`<input type="nickname">` 聚焦时不会触发 onNeedPrivacyAuthorization 事件，而是降级为 `<input type="text">`。"

落地要点（据上述官方明文推导）：
- 使用头像昵称填写能力前，必须在小程序管理后台《用户隐私保护指引》勾选"收集你的昵称、头像"，否则按钮/输入框被禁用；
- 需处理用户隐私授权弹窗（`wx.getPrivacySetting` / `button open-type="agreePrivacyAuthorization"`，基础库 2.32.3 起支持主动查询）。

---

## 六、必查项 ④：个人主体小程序是否可用

**结论：可用。** 证据链如下：

1. 【官方明文·无限制条款】以下三处官方现行文档均未出现任何账号主体（个人/企业）、认证状态、类目限制：
   - 《头像昵称填写》能力文档（userProfile.html）：仅要求基础库 2.21.2+；
   - button / input 组件文档：chooseAvatar、nickname 属性行仅标注基础库版本；
   - 《小程序用户头像昵称获取规则调整公告》：面向全体小程序开发者发布，替代方案未设主体门槛。
   对比参照：手机号获取（`getPhoneNumber`）等敏感能力在官方文档中明文要求企业认证类主体——头像昵称填写能力**没有**同类条款。
2. 【官方明文·定位】公告将头像昵称填写能力定位为所有"业务需获取用户头像昵称"的小程序的通用替代方案（见 3.5 引文），未区分主体。
3. 【社区经验·佐证】大量个人主体小程序（含个人开发者教程）正常使用该能力，未见任何"个人主体不可用"的官方公告或社区反馈（CSDN 2026-03 实战教程：https://blog.csdn.net/weixin_29006187/article/details/159228131 ；博客园 2023-05：https://www.cnblogs.com/bk1234/p/17400974.html ）。

> 考据注：官方没有一句"个人主体可以使用头像昵称填写能力"的直接正面声明——这是"无限制条款 + 通用定位 + 社区普遍可用"的反证式结论，确定性很高但证据等级标注为【官方明文（无限制）+ 社区佐证】。

---

## 七、对本项目（个人主体 + 虚拟支付个人版）的落地建议

基于以上官方明文（非猜测）：

1. **登录识别与资料展示分离**：身份识别只用 `wx.login` → code2session 换 openid/unionid（官方明文"不受影响"）；头像昵称仅作为可选资料完善项，走 chooseAvatar + nickname input。
2. **入口位置合规**：官方最佳实践是"个人中心或设置等页面"完善资料；公告明文批评"支付前等不合理路径上要求授权"——当前"支付时 wx.login 绑定"可保留（login 不弹窗、不属头像昵称授权范畴），但**不要**在支付前加头像昵称强制填写步骤。
3. **发布节奏注意**：一旦在生效期后发布新版本，getUserProfile 即永久匿名（本项目尚在评估期，直接采用填写能力即可，勿引入 getUserProfile 兼容逻辑）。
4. **头像持久化**：`e.detail.avatarUrl` 是临时路径，当次会话内上传到自建存储；勿长期依赖该路径。
5. **昵称取值**：用 form submit / blur 收集（官方建议 + 社区经验 bindinput 不可靠）。
6. **隐私协议**：后台指引勾选"收集你的昵称、头像"；前端处理 `wx.getPrivacySetting` 授权弹窗，否则组件被禁用、nickname input 降级为 text。
7. **基础库门槛**：2.21.2 起可用；若要规避 2.24.4 内容安全清空/不回调的交互突兀感，需在 UI 上做好失败兜底（未触发回调、输入被清空时的提示）。

---

## 八、来源清单

### 官方明文（developers.weixin.qq.com）

| # | 来源 | URL | 用途 |
|---|---|---|---|
| 1 | 《小程序用户头像昵称获取规则调整公告》（微信团队，2022-05-09 发布，09-28/11-09 更新） | https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01 | 回收时间线、匿名行为、替代方案、最佳实践 |
| 2 | 官方《头像昵称填写》能力文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html | 能力定义、用法、内容安全、示例代码 |
| 3 | 官方 button 组件文档 | https://developers.weixin.qq.com/miniprogram/dev/component/button.html | chooseAvatar / bind:chooseavatar 属性与版本 |
| 4 | 官方 input 组件文档 | https://developers.weixin.qq.com/miniprogram/dev/component/input.html | type=nickname / nicknamereview 属性与版本 |
| 5 | 官方 wx.getUserProfile API 文档 | https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html | 现行状态提示、"仅在点击行为时调用" |
| 6 | 官方 wx.getUserInfo API 文档 | https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserInfo.html | 调整提示链接、scope.userInfo |
| 7 | 官方《小程序用户隐私保护指引内容介绍》（隐私接口清单） | https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html | "wx.getUserProfile (已回收)" 2026 现行标注；chooseAvatar/nickname 归属隐私条目 |
| 8 | 官方《小程序隐私协议开发指南》 | https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html | 2023-10-17 强制启用、未声明即禁用、nickname 隐私降级 |
| 9 | 官方《接口调用频率规范》 | https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html | 限频接口清单（chooseAvatar 不在列）、wx.login 频次 |

### 社区经验（仅线索/佐证）

- CSDN：getUserInfo/getUserProfile 被废弃实测（2023-12）https://blog.csdn.net/xiaoxiangzi520/article/details/135197076
- 掘金：小程序头像昵称"一刀切"调整复盘 https://juejin.cn/post/7436361280586366987
- 博客园：头像昵称填写能力实战（2023-05）https://www.cnblogs.com/bk1234/p/17400974.html
- CSDN：一键获取用户昵称与头像实战（2026-03）https://blog.csdn.net/weixin_29006187/article/details/159228131
- CRMEB 问答：getUserProfile 被收回后的替代 https://www.crmeb.com/ask/thread/21677
- Taro issue #11007：头像昵称填写能力框架适配 https://github.com/NervJS/taro/issues/11007

---

## 九、Blockers（未能完全证实项，禁止编造故如实记录）

1. **头像临时路径精确有效期**：官方文档仅表述为"临时路径"，未给出具体时长数字；"约 1 天"为社区经验说法，未获官方明文证实。落地按"当次即传"处理即可规避。
2. **"选择微信昵称时 bindinput 不触发"的官方正式回复**：未检索到微信官方团队对该行为的正式答复页；官方仅以"建议通过 form submit 收集"间接回应（input 文档 + 能力文档原文），具体事件触发差异属社区经验。
3. **"个人主体可用"的正面官方声明**：不存在"个人主体可使用头像昵称填写能力"的直接官方语句；结论基于官方文档无任何主体限制条款（反证）+ 社区普遍可用，确定性高但非正面明文。
4. **公告页面的 meta 更新时间显示异常**（显示 2026-10-27 21:14，与正文最后更新 2022-11-09 不符）：疑为页面系统 meta 噪音，不影响正文效力判断；2026 年 10 月现行官方文档仍链接并引用该公告，证明其仍为现行有效依据。

---

*考据方法：官方文档(.md 源)逐页抓取原文引用 + 官方公告全文核对 + 社区来源仅作佐证；所有引号内文字均为来源页面原文。*
