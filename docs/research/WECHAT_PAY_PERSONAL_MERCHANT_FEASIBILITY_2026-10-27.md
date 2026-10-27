# 个人主体小程序收款可行性核查

核查日期：2026-10-27，Asia/Singapore。范围：aichat 销售 AI 自我成长、人格或关系报告时的支付准入；本记录不代表账号审核通过，也未开通或启用任何真实支付。

## 结论

**个人可以在符合条件的微信小程序内，通过官方“个人主体虚拟支付”销售虚拟商品或解锁功能；不应再笼统地说“个人小程序不能收费”。** 官方《虚拟支付：个人》明确面向个人主体小程序，并非仅限小游戏。该页面最后编辑于 2026-09-07，当前要求个人主体、身份证、工具类目、认证和备案，并设全终端月支付限额 10 万元。[微信官方：虚拟支付：个人](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

这条路径是申请虚拟支付账号、审核和签约后，由小程序调用 `wx.requestVirtualPayment`；**个人微信收款码不能直接充当这个支付接口**。普通小程序微信支付另有商户号、权限和 APPID 绑定要求，不能把私人收款码、普通商户号与个人虚拟支付账号混为一谈。[个人虚拟支付接入流程](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)、[普通小程序支付开发接入准备](https://pay.wechatpay.cn/doc/v3/merchant/4015459512)

## 当前官方条件

以下均来自《虚拟支付：个人》；金额、费率及终端条件按本次核查时的页面记录，不承诺永久不变。[官方专项页](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

| 项目 | 已核实的条件或行为 |
| --- | --- |
| 主体 | 小程序主体为个人；开通条件写居民身份证，部署检查清单进一步明确中国大陆居民身份证。 |
| 类目 | 小程序服务类目含“工具”。 |
| 账号状态 | 已完成小程序认证、备案；提交个人身份信息、提现账户、支付管理员，经过审核和扫码签约。 |
| 限额 | 全终端合计月支付限额 10 万元。 |
| 不支持范围 | 需要电信业务相关资质的服务，包括页面列出的电子邮件、语音信箱、储存转发、信息发布平台、信息搜索查询等。 |
| 支付账号 | 开通后获得 OfferID 和 AppKey；商品以道具配置并发布，调用 `wx.requestVirtualPayment`。 |
| Android 等终端 | 页面列腾讯技术服务费 1%，结算周期 T+3。 |
| iOS | 页面列 Apple 佣金 12%，结算约 45–60 天；还需配置小程序简称、开通 Apple IAP，用户微信版本需 8.0.68 及以上。 |
| 提现 | 资金到账后，可在 MP 后台“虚拟支付”查看账户余额、每日账单并发起提现。 |

官方页面要求填写提现账户，但本次读取的专项页**没有写明提现账户的具体银行类型、户名匹配细则或是否支持微信零钱**，这些仍须以该账号开通页和签约条款核实；不能据此承诺钱直接进入私人微信零钱。[官方专项页的开通流程与结算说明](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

## 对 aichat 的适用边界

### 当前代码状态

当前源码尚未接入真实支付：购买页的`requestPayment()`创建本地演示订单后，弹出“演示支付流程”，并模拟待支付或取消；未调用微信实际支付接口。[购买页源码](../../miniprogram/pages/checkout/checkout.js#L97)

后端预支付和微信支付回调委托仍返回`notImplemented`，公开配置源码将`payment`置为`false`；在`miniprogram/`、`server/src/main/java/`与`contracts/`中也未检索到`wx.requestVirtualPayment`或虚拟支付实现。这是本次源码检查结果，不代表已经核对过该账号商户后台或生产部署。[支付委托源码](../../server/src/main/java/com/aichat/payment/api/PaymentApiDelegate.java#L14)、[公开配置源码](../../server/src/main/java/com/aichat/publicapi/application/PublicApplicationService.java#L22)

**推断：**把“一次报告解锁”或“一次 AI 分析功能”作为小程序内数字权益，值得优先核查个人虚拟支付准入。依据是专项页明确支持购买功能、道具，并在支付确认后开放权益；但它没有逐项列出“人格报告”“关系分析”或“自我成长报告”，因此不能仅凭“AI 工具”名称认定本项目已获准入。[官方专项页的业务串接与道具直购说明](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)

**仍未知：**本项目注册主体、实际已选服务类目、认证和备案状态、后台是否展示可开通入口，以及具体报告内容能否按该类目通过审核。本次没有读取该账号的微信公众平台后台，也没有取得微信对本业务的准入确认。支付路径存在，不等于报告内容审核、行业资质或账户审核已经通过。

## 其他“个人收款”路径的边界

| 说法 | 可确认的范围 |
| --- | --- |
| “用我的个人收款码接进小程序” | 官方个人虚拟支付要求独立申请、账号和签名参数；普通小程序支付要求商户号和 APPID 绑定。个人二维码本身不足以满足任一路径的接入条件。[个人虚拟支付](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)、[普通支付准备](https://pay.wechatpay.cn/doc/v3/merchant/4015459512) |
| “办个体工商户才能收钱” | 个体工商户确实支持普通小程序支付；普通直连新商户号申请名单不含自然人。但对符合条件的个人虚拟支付，不能再把营业执照当成一律必需条件。[普通支付准备](https://pay.wechatpay.cn/doc/v3/merchant/4015459512)、[个人虚拟支付](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person) |
| “小微商户支持小程序，所以线上 AI 报告都能做” | 基础权限表确实列小微商户支持小程序支付；旧 V2 小微通道又明确限线下行业、由服务商申请。权限存在不等于本业务获得行业准入，不能跨通道推广结论。[基础权限表](https://pay.wechatpay.cn/doc/v3/merchant/4015459054)、[V2 小微商户介绍](https://pay.wechatpay.cn/doc/v2/partner/4014115330) |

平台收付通的 2026-10-20 指引另支持平台为小微、个人卖家等二级商户进件，并要求平台先具备服务商及产品能力、完成平台资质审核。这证明无执照主体并非在所有微信支付渠道都被排除，但不能据此认定自然人已取得普通直连商户资格，或 aichat 已满足平台子商户条件；本项目当前更直接相关的已确认路径仍是上述个人虚拟支付。[平台收付通开发接入准备](https://pay.wechatpay.cn/doc/v3/partner/4012086921)

## 证据强度与推翻条件

- **高置信：**个人主体小程序的官方虚拟支付路径存在；上述主体、类目、认证备案、月限额和终端差异均已直接读取官方专项页，并以腾讯官方维护的接入参考交叉核对。[官方专项页](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)、[TencentCloudBase 官方参考](https://github.com/TencentCloudBase/CloudBase-AI-Toolkit/blob/main/plugins/experts/miniprogram-clouddev-expert/references/personal-virtual-pay-playbook.md)
- **未确认：**aichat 的具体业务与账号资格、提现账户细则、后台签约后的实际费率；本次没有用注册、签约或真实交易补足这些证据。
- **推翻条件：**若实际账号无法选择匹配的工具类目、报告业务被认定属于不支持范围、开通审核拒绝，或官方更新准入规则，则“本项目适用个人虚拟支付”的候选判断失效；不得用个人收款码或其他商户的资格代替该验证。

取证说明：本次直接读取微信官方原始页面；网页工具对个人专项页的抓取曾失败，随后经只读 HTTP 获取并正确解压成功，返回页面标题和 2026-09-07 编辑日期。最终结论依据成功读取的官方正文，不依据失败结果或第三方转载。
