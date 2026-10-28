# 微信小程序手机号授权登录（手机号快速验证组件）考据报告

- **考据日期**: 2026-10-27
- **考据对象**: 个人主体小程序能否使用 `button open-type="getPhoneNumber"`（手机号快速验证组件）及配套 `phonenumber.getPhoneNumber` 服务端接口
- **业务背景**: 个人主体小程序（已接微信虚拟支付-个人版），现用匿名会话 + 支付时 `wx.login` 绑定，评估登录正规化方案
- **证据等级说明**: 🟢 官方明文（developers.weixin.qq.com / kf.qq.com / 官方社区知识库）｜🟡 社区经验（第三方，仅作线索）
- **结论时效**: 官方组件文档检索快照显示近期仍在更新（搜索引擎收录显示 2026-09-03 版本），本文所有 🟢 引文均为本次直接抓取的当前线上原文

---

## 一、总结论（决定性）

> **个人主体小程序不可使用手机号快速验证组件，也不可使用手机号实时验证组件。两条路均对个人主体关闭。**

这是**官方明文**，不是社区推断。三处独立官方来源交叉印证：

| # | 来源 | 性质 | 关键原句 |
|---|------|------|---------|
| 1 | 手机号快速验证组件官方文档（注意事项第 1 条） | 🟢 官方明文 | "目前该能力针对**非个人主体**，且完成了认证的小程序开放（不包含海外主体）" |
| 2 | 手机号实时验证组件官方文档（注意事项第 1 条） | 🟢 官方明文 | "目前该接口仅针对**非个人主体**，且已完成认证的小程序开放（境外主体目前仅限部分国家和地区开放" |
| 3 | 微信开放社区知识库官方回复 | 🟢 官方社区 | "目前获取手机号接口针对非个人开发者，且完成了认证的小程序开放（不包含海外主体）" |

`button` 组件文档本身（`open-type="getPhoneNumber"` 表格行）只标注"*小程序插件中不能使用*"，**主体资质限制写在组件行内链接指向的 open-ability 专项文档里**——这是很多第三方教程漏引、导致误以为"人人可用"的原因。

**对本项目的直接含义**: 手机号授权登录这条路对个人主体小程序在 2026 年现状下**不可行**，无任何"申请/加白/付费解锁"通道。登录正规化只能在现有 `wx.login`（openid 体系）基础上做，手机号维度无法获取。

---

## 二、逐项考据

### ① `button open-type="getPhoneNumber"` 的主体资质要求 —— 个人主体被明文排除

**官方原文（手机号快速验证组件文档「注意事项」第 1 条）** 🟢:

> "注意事项：
> 1. 目前该能力针对**非个人主体**，且完成了认证的小程序开放（不包含海外主体）"

- source: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html

**官方原文（手机号实时验证组件文档「注意事项」第 1 条）** 🟢:

> "注意事项：
> 1. 目前该接口仅针对**非个人主体**，且已完成认证的小程序开放（境外主体目前仅限部分国家和地区开放"

- source: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html

**官方原文（服务端接口文档页顶「注」）** 🟢:

> "注：该接口针对非个人主体且已完成认证的小程序开放，具体可以查看公告：小程序手机号快速验证组件收费通知（具体以公告内容为准）。"

- source: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-number/getPhoneNumber.html

**官方原文（button 组件文档，两个 open-type 的表格行）** 🟢:

> "`getPhoneNumber`: 手机号快速验证，向用户申请，并在用户同意后，快速填写和验证手机，具体说明 （*小程序插件中不能使用*）｜最低版本 1.2.0"
>
> "`getRealtimePhoneNumber`: 手机号实时验证，向用户申请，并在用户同意后，快速填写和实时验证手机号。具体说明 （*小程序插件中不能使用*）｜最低版本 2.24.4"

- source: https://developers.weixin.qq.com/miniprogram/dev/component/button.html
- 注: 组件表格行本身不含主体限制字样，限制在链接指向的专项文档中（见上）。

**官方社区知识库（个人主体实测报错"该 appid 没有权限"的官方答复）** 🟢:

> "目前获取手机号接口针对非个人开发者，且完成了认证的小程序开放（不包含海外主体）。需谨慎使用，若用户举报较多或被发现在不必要场景下使用，微信有权永久回收该小程序的该接口权限。具体可参考文档说明：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html 若是调用该接口出现提示"该 appid 没有权限"，请确认该小程序是否符合使用条件。"

- source: https://developers.weixin.qq.com/community/develop/doc/000a2ac6a08890624fe93c8ca5bc09（微信开放社区知识库帖，官方支持答复）
- 注意: 该回复是官方社区口径，明确把"该 appid 没有权限"报错归因于主体/认证资质不符。

**⚠️ 一个容易踩的坑（🟡 社区经验，与官方文档语义一致）**: 开发者工具中用**测试号/开发态**有时能拉起手机号授权弹窗，让个人主体开发者误以为自己可用；真机+正式版会因资质被拦。多个第三方来源（腾讯云开发者文章、CSDN）均提示该接口"仅非个人主体+已认证可用"。仅作线索，定性以 §① 官方明文为准。

### ② 手机号快速验证 vs 手机号实时验证的区别

**官方原文（快速验证组件文档开篇）** 🟢:

> "该能力与手机号实时验证组件的区别为：
> 1. 手机号快速验证组件，平台会对号码进行验证，但**不保证是实时验证**；
> 2. 手机号实时验证组件，**在每次请求时，平台均会对用户选择的手机号进行实时验证**。"

- source: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html

两者差异速览（均出自官方文档）：

| 维度 | 手机号快速验证组件 | 手机号实时验证组件 |
|------|-------------------|-------------------|
| open-type | `getPhoneNumber`（基础库 ≥1.2.0） | `getRealtimePhoneNumber`（基础库 ≥2.24.0/2.24.4） |
| 验证语义 | 平台验证过，但**不保证实时**（可能是近期验证过的号） | **每次请求实时验证** |
| 服务端接口 | `phonenumber.getPhoneNumber`（`/wxa/business/getuserphonenumber`） | 同左（同一接口，`type="realtime"` 时校验实时验证码场景） |
| 单价 | 0.03 元/次 | 0.04 元/次 |
| 主体资质 | 非个人主体+已认证，不含海外主体 | 非个人主体+已认证，境外仅部分国家地区 |
| 插件内使用 | 均不可用（"小程序插件中不能使用"） | 同左 |

### ③ 服务端接口调用条件与计费

**接口端点与调用形式（官方 OpenApiDoc）** 🟢:

> "phonenumber.getPhoneNumber
> 本接口服务端调用，需配合小程序手机号快速验证组件 / 手机号实时验证组件使用……
> **调用方式、请求方式**：POST，URL: `https://api.weixin.qq.com/wxa/business/getuserphonenumber`"

- source: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-number/getPhoneNumber.html

**接口声明原文（服务端文档）** 🟢:

> "接口应在服务器端调用，不可在前端（小程序、网页、APP等）直接调用，具体可参考接口调用指南"

- source: https://developers.weixin.qq.com/miniprogram/dev/server/API/user-info/phone-number/api_getphonenumber.md
- 请求体: `{"code": "the code"}`（组件回调里的动态 `code`），返回 `phone_info`（phoneNumber / purePhoneNumber / countryCode / watermark）。接口域名权限需在 mp 后台配置 api.weixin.qq.com。

**计费规则（官方「计费说明」原文）** 🟢:

> "**计费单价**：每次组件调用成功，收费 0.03 元。价格说明：小程序手机号快速验证组件服务根据每次调用成功进行收费。
> **扣费节点**：开发者获得 bindgetphonenumber 事件的 success 回调信息时，进行扣费。"

> "**额度说明**：
> （1）新注册小程序每个账号享受 1000 次体验额度，更多次数，可以通过付费购买的方式获得。
> （2）a. 未绑定付费商户号且无可用额度，将以 50 次/天 为上限进行调用；b. 若绑定付费商户号但额度未够，可正常调用，但会在小程序管理页面收到欠费通知，需尽快登录小程序管理页面完成缴费。"

> "若查询额度不足，开发者将收到错误码 e.detail.errno === 1400001，同时用户侧将收到平台默认半屏提示"该功能使用次数已达当前小程序上限，暂时无法使用"。若不想弹出该提示，可通过 button 组件的 phone-number-no-quota-toast 属性关闭"

- source: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html

**实时验证组件计费（对照）** 🟢:

> "自 2023 年 8 月 28 日起，手机号实时验证组件将需要付费使用。标准单价为：每次组件调用成功，收费 0.04 元。"（同样有 1000 次体验额度）

- source: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html

**计费口径要点**（防止误解）:
- 收费发生在**组件侧**（`bindgetphonenumber` success 回调触发即扣费 0.03 元），不是服务端 `getuserphonenumber` 接口按次另收费——拿到 code 后服务端换取手机号本身不再单独计费（同一组件调用链只扣一次）。
- 快速验证 0.03 元/次、实时验证 0.04 元/次；两者体验额度规则相同（新账号 1000 次）。
- 历史公告: 收费调整于 2023-08-28 生效（实时验证组件文档明文引用该日期），快速验证组件同期收费（腾讯云开发者文章 🟡 佐证 0.03 元定价与 1000 次额度，与官方现文一致）。
- **但对本项目无意义**: 个人主体根本拿不到组件权限，计费细节仅在企业主体路径下才生效。

### ④ 申请入口与审核要求

**官方事实: 无独立"申请/审核"入口，资质=主体类型+微信认证，自动判定** 🟢:

- 组件文档与社区知识库均**未提供任何面向个人主体的申请通道**；社区官方答复对"该 appid 没有权限"的解法是"请确认该小程序是否符合使用条件"（即 换成非个人主体+完成认证），而非提交申请。
- 付费购买入口（仅对满足资质的小程序有意义）: 官方「付费管理」文档 🟢:
  > "付费管理模块，承载开发者在小程序里购买各项付费能力，管理订单和用量，开具发票的功能。"
  > 购买路径: 登录小程序 MP 平台（mp.weixin.qq.com）→ 左侧【付费管理】→ 手机号快速验证组件（新购/续费，含资源包档位与单价展示）→ 支付 → 发票管理。
  - source: https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/charge/README.md
- 使用规范（审核侧约束，官方原文）🟢: "该能力为敏感能力……需谨慎使用" / "若用户举报较多或被发现在不必要场景下使用，微信有权永久回收该小程序的该接口权限"（出处同 §① 各组件文档注意事项及社区知识库）。即: 即便企业主体，也存在滥用回收机制。

### ⑤ 个人主体不可用 —— 官方依据汇总

见 §① 三处引文。**不存在"个人主体可用"的任何官方表述**；相反，两份组件专项文档 + 服务端接口注 + 社区官方答复四处均一致使用"非个人主体（且已完成认证）"的排他表述。若未来需要此能力，唯一路径是把小程序主体变更为企业/个体工商户等非个人主体并完成微信认证（主体变更流程超出本考据范围，未在本报告引用范围内验证）。

---

## 三、来源清单（全部为本次实际抓取）

| # | 来源 | 性质 | URL |
|---|------|------|-----|
| 1 | 手机号快速验证组件（官方文档，含资质/计费/额度/错误码） | 🟢 官方明文 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html |
| 2 | 手机号实时验证组件（官方文档，含资质/0.04 元计费） | 🟢 官方明文 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html |
| 3 | button 组件（官方文档，open-type 表格行） | 🟢 官方明文 | https://developers.weixin.qq.com/miniprogram/dev/component/button.html |
| 4 | 服务端接口 phonenumber.getPhoneNumber（OpenApiDoc） | 🟢 官方明文 | https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-number/getPhoneNumber.html |
| 5 | 服务端接口声明（API 调用指南版） | 🟢 官方明文 | https://developers.weixin.qq.com/miniprogram/dev/server/API/user-info/phone-number/api_getphonenumber.md |
| 6 | 付费管理/购买操作指引 | 🟢 官方明文 | https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/charge/README.md |
| 7 | 社区知识库: "该 appid 没有权限"官方答复 | 🟢 官方社区 | https://developers.weixin.qq.com/community/develop/doc/000a2ac6a08890624fe93c8ca5bc09 |
| 8 | 腾讯云开发者: 手机号验证组件收费说明 | 🟡 第三方佐证 | https://cloud.tencent.cn/developer/article/2304298 |

## 四、Blockers / 未决项

- **无决定性 blocker**。核心问题（个人主体可用性）已有三处独立官方明文，结论闭环。
- 次要未验证项（不影响结论）:
  1. "个人主体小程序能否完成微信认证"未单独取证——因资质条件第一条即"非个人主体"，认证问题对结论无影响，故未深挖；
  2. 手机号实时验证组件在 OpenApiDoc 侧的独立计费条目页未单独抓取（其计费以组件文档 0.04 元/次为准）；
  3. 主体变更（个人→企业）流程与费用未在本考据范围内验证，如走该路径需另行考据。

## 五、对登录正规化方案的建议性结论（基于上述考据事实）

1. **手机号登录路线关闭**: 个人主体下 `getPhoneNumber` / `getRealtimePhoneNumber` 均不可用，不可作为登录正规化手段。
2. **可行基线仍是 wx.login**: 现有"匿名会话 + 支付时 wx.login 绑定 openid"即个人主体下能拿到的最强身份锚点，方向上把 openid/unionid 登录态做正规（token 化、绑定时点前移）而非追手机号。
3. **若未来强制需要手机号**: 前提是主体升级为企业/个体工商户并完成微信认证，之后按 0.03 元/次 + 1000 次体验额度纳入成本模型（对照: 实时验证 0.04 元/次）。
