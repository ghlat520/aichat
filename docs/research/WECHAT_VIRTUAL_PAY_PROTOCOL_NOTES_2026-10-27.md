# 个人小程序虚拟支付：自建 Java 后端协议笔记

核查时间：2026-10-27，Asia/Singapore。仅访问微信官方公开文档和官方 Java 加解密示例；未使用账号凭据、获取真实 token、调用支付接口或发起真实交易。账号尚未开通虚拟支付，因此本文件能支持代码与离线测试，不能证明账号准入、线上签约或真实交易闭环。

最高层准入依据是《虚拟支付：个人》（2026-09-07）；其流程允许自建服务器接收消息推送，CloudBase 是可选承载方式。客户端、通用虚拟支付、服务端 API 和消息推送页分别补足协议。通用页标题虽为“企业、个体户”，但个人专项页直接引用该页作为完整功能文档；对主体准入仍以个人专项页为准。[个人专项页][person]

## 1. 道具直购与双签名

`wx.requestVirtualPayment` 的 `mode` 是顶层参数，直购取 `short_series_goods`；`signData` 必须传 JSON **字符串**。`goodsPrice` 是道具单价，单位分，需与后台已发布道具一致；`buyQuantity` 为数量，币种为 `CNY`。本期报告解锁若只售一份，可固定数量 1、不启用优惠价，避免多件价格口径扩张。[客户端 API][client]

请求 `env=0` 表示现网、`env=1` 表示沙箱，分别选择现网/沙箱 AppKey；正式发布版本不能用 `env=1`。未开通、未发布道具不是可通过填写沙箱参数绕过的状态。[客户端 API][client]、[签名章节][virtual]

```text
paySig    = hex_lower(HMAC_SHA256(AppKey, UTF8("requestVirtualPayment&" + signData)))
signature = hex_lower(HMAC_SHA256(session_key, UTF8(signData)))

server pay_sig = hex_lower(HMAC_SHA256(AppKey, UTF8(apiPath + "&" + rawPostBody)))
```

AppKey 和 `session_key` 在官方示例中均按其字符串的 UTF-8 字节作为 HMAC key，**不先 Base64 解码**。`apiPath` 不含协议、域名或 query，例如 `/xpay/query_order`。参与签名的字符串必须与最终传输的字符串逐字节一致，不能签名后重新序列化或改变空白。[通用页 2.5–2.6][virtual]

离线测试向量：以下常量均为假值，不能支付。令 `AppKey=example_app_key_not_real`、`session_key=example_session_key_not_real`，并使用下面这条无换行的 `signData` 字符串：

```json
{"offerId":"1234567890","buyQuantity":1,"env":1,"currencyType":"CNY","productId":"report_unlock_v1","goodsPrice":990,"outTradeNo":"TEST202610270001","attach":"report_demo_001"}
```

按官方算法本地计算得到：

```text
paySig    = 07afe44cac2533b6bedcbc215e099ae876c6dbd8f121c855b695e395ab719e58
signature = 4189eb09903ee9648a581c443be52eca7460a6c5e2df727783909b5c18ace31b
```

`outTradeNo` 需 8–32 字符，可用数字、大小写字母及 `_ - | * @`，不能以下划线开头；官方注明每次订单使用一次，但极端情况不保证唯一。应用仍应自行保证业务单号唯一和权益发放幂等，不能以客户端 `success` 回调作为支付证据。[客户端 API][client]、[个人专项页][person]

## 2. 登录与 access_token

| 用途 | 自建服务器调用 | 关键返回/规则 |
| --- | --- | --- |
| 换取用户身份及会话密钥 | `GET https://api.weixin.qq.com/sns/jscode2session?appid=FAKE_APPID&secret=FAKE_SECRET&js_code=FAKE_CODE&grant_type=authorization_code` | 前端 `wx.login` 提供 code，服务端获得 `openid`、`session_key`，以及条件满足时的 `unionid`。不能把前端提交的 openid 当作此接口的替代证据。[code2Session][code2session] |
| 推荐的稳定 token | `POST https://api.weixin.qq.com/cgi-bin/stable_token` | JSON 为 `{"grant_type":"client_credential","appid":"FAKE_APPID","secret":"FAKE_SECRET","force_refresh":false}`；返回 `access_token`、`expires_in`，按实际有效期缓存。普通模式不随重复调用刷新仍有效的 token；强制刷新会使上一个失效。[稳定 token][stable] |
| 旧版 token | `GET https://api.weixin.qq.com/cgi-bin/token?appid=FAKE_APPID&secret=FAKE_SECRET&grant_type=client_credential` | 返回同名 token 和有效期字段。官方推荐稳定版；两类 token 相互隔离。[旧版 token][token] |

AppSecret、session_key、AppKey、消息推送 Token 和 EncodingAESKey 是不同凭据。前两类支付 HMAC 不使用消息推送 Token；回调 SHA1/AES 也不使用支付 AppKey。[登录接口][code2session]、[支付签名][virtual]、[消息推送][push]

## 3. 查单 `/xpay/query_order`

服务器调用：

```http
POST https://api.weixin.qq.com/xpay/query_order?access_token=FAKE_TOKEN&pay_sig=FAKE_PAY_SIG
Content-Type: application/json

{"openid":"openid_demo","env":1,"order_id":"TEST202610270001"}
```

`openid`、`env` 必填；`order_id` 和 `wx_order_id` 二选一。前者是业务订单号，即客户端直购的 `outTradeNo`；后者是微信内部单号。当前参数表只列 `access_token` 和 `pay_sig`，支付签名原串路径为 `/xpay/query_order`。[query_order，2026-10-08][query]、[签名算法][virtual]

以下是按当前字段表构造的**假数据示例**，不是实际查询结果：

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "order": {
    "order_id": "TEST202610270001",
    "status": 2,
    "order_type": 0,
    "order_fee": 990,
    "paid_fee": 990,
    "left_fee": 990,
    "paid_time": 1793059200,
    "env_type": 2,
    "wx_order_id": "WX_INTERNAL_DEMO_001",
    "channel_order_id": "CHANNEL_DEMO_001",
    "wxpay_order_id": "WXPAY_TRANSACTION_DEMO_001"
  }
}
```

`order_fee` 是订单金额（分）；`paid_fee` 是用户支付金额，`left_fee` 是支付单剩余可退金额（分），不能拿可退余额代替最初实付。`order_type=0/1/7/8` 分别表示普通支付/普通退款/iOS 支付/iOS 退款。**响应 `env_type=1` 是现网、`2` 是沙箱，与请求 `env=0/1` 不同。**[query_order][query]

| `order.status` | 当前官方含义 | 本地可得结论 |
| --- | --- | --- |
| 0 / 1 | 初始化未创建成功 / 创建成功 | 均不证明支付。 |
| 2 | 已支付，待发货 | 可作为查单补发候选；还须核对业务订单、环境、金额及本地权益。 |
| 3 / 4 | 发货中 / 已发货 | 有支付后的发货状态；不能重复发权益。 |
| 5 | 退款：商户侧扣款完成 | 不能声称用户已收到退款。 |
| 6 | 已关闭，不可再用 | 不是支付成功。 |
| 7 | 退款失败 | 不得当作退款完成。 |
| 8 | 退款：用户侧收款完成 | 对匹配的退款单可确认退款到账状态。 |
| 9 / 10 | 回收广告金完成 / 分账回退完成 | 不属于本期报告直购的支付成功枚举。 |

状态枚举依据官方当前查询页；表中本地处理是由这些语义导出的项目实现约束。[query_order][query]

查单响应的 `order` **不包含 `openid`、商品 ID 或购买数量**。这些必须由服务端在签名前冻结的订单身份、商品和数量提供；回调包含商品时再交叉核对，不能编造“查单返回 productId”。`biz_meta` 只被描述为订单创建时传入的信息，未明确保证等同 `attach`，不要据此新增未证明的映射。[query_order][query]

## 4. 自建 HTTP 回调：消息认证、XML 与安全模式

### 4.1 URL 验证和认证原串

微信小程序当前消息推送页规定 GET URL 验证携带 `signature/timestamp/nonce/echostr`；验证 `SHA1(concat(sort(Token,timestamp,nonce)))`，成功后原样返回 `echostr`。明文 POST 同样验该三参数签名。[消息推送，2026-07-28][push]

安全模式 POST 必须验证 `msg_signature`：

```text
msg_signature = SHA1(concat(sort(Token, timestamp, nonce, Encrypt)))
```

此模式不能仅验证三参数的 `signature`。明文三参数签名没有把 HTTP body 纳入签名，因此它本身不提供正文防篡改绑定；安全模式的签名绑定 Encrypt，解密后还须验证 AppID。[消息推送][push]

### 4.2 AES 及 AppID

安全模式密钥是 `Base64Decode(EncodingAESKey + "=")`，应得 32 字节；AES-256-CBC 的 IV 取密钥前 16 字节。按微信 PKCS#7 规则处理填充（块大小 32），解密得到：

```text
16字节随机值 || 4字节大端消息长度 || 消息正文UTF8 || AppID
```

校验填充、长度边界和尾部 AppID 后再解析业务 XML/JSON；`ToUserName` 是 `gh_...` 小程序原始 ID，不能当作 `wx...` AppID。AES 参数及 AppID 校验在官方文档和其链接的 Java `WXBizMsgCrypt.java` 中均可确认；Java 示例使用 `AES/CBC/NoPadding` 后自行处理微信填充。[消息推送][push]、[微信官方 Java 示例压缩包][crypto]

### 4.3 发货通知字段

下列 XML 是按官方字段表构造的假数据，金额固定 990 分、数量 1：

```xml
<xml>
  <ToUserName><![CDATA[gh_demo_original_id]]></ToUserName>
  <FromUserName><![CDATA[wechat_official_event_sender]]></FromUserName>
  <CreateTime>1793059200</CreateTime>
  <MsgType><![CDATA[event]]></MsgType>
  <Event><![CDATA[xpay_goods_deliver_notify]]></Event>
  <OpenId><![CDATA[openid_demo]]></OpenId>
  <OutTradeNo><![CDATA[TEST202610270001]]></OutTradeNo>
  <Env>1</Env>
  <WeChatPayInfo>
    <MchOrderNo><![CDATA[MCH_NO_DEMO_001]]></MchOrderNo>
    <TransactionId><![CDATA[WXPAY_TRANSACTION_DEMO_001]]></TransactionId>
    <PaidTime>1793059200</PaidTime>
  </WeChatPayInfo>
  <GoodsInfo>
    <ProductId><![CDATA[report_unlock_v1]]></ProductId>
    <Quantity>1</Quantity>
    <OrigPrice>990</OrigPrice>
    <ActualPrice>990</ActualPrice>
    <Attach><![CDATA[report_demo_001]]></Attach>
  </GoodsInfo>
</xml>
```

付款用户是 `OpenId`；`FromUserName` 是事件发送方，发货场景固定为微信官方 openid。`Env=0/1` 对应现网/沙箱；`GoodsInfo` 有 `ProductId/Quantity/OrigPrice/ActualPrice/Attach`，价格单位分。`WeChatPayInfo` 在非微信支付渠道可能没有，不能把它设为所有 iOS 通知必填。[通用虚拟支付 2.4][virtual]

**标识映射缺口：**个人简化页将 `WeChatPayInfo.MchOrderNo` 称为平台 `wx_order_id`，通用字段表称其“微信支付商户单号”；查询页另区分内部 `wx_order_id`、渠道商户单号 `channel_order_id` 和交易号 `wxpay_order_id`。本期按本地 `OutTradeNo → order_id` 发起查询，将各外部 ID 按原名保留，未经真实回执核对不强行等同。通用字段表也没有说明数量大于 1 时 `OrigPrice/ActualPrice` 是单件价还是合计价；本期数量 1 可避免该歧义。[个人专项页][person]、[通用字段表][virtual]、[查询字段表][query]

### 4.4 应答

虚拟支付允许空 body 或纯文本 `success` 表示成功；也允许按配置格式返回 `{"ErrCode":0,"ErrMsg":"success"}` 或对应 XML。响应格式错误会触发重推，最多 15 次。仅 HTTP 成功状态不能替代正确应答正文与已完成的本地处理。[通用虚拟支付 2.4][virtual]

安全模式仍允许**未加密的空 body 或纯文本 `success`**；其他正文需加密。若选择结构化 ErrCode 应答，需把该 XML/JSON 作为明文加密，并按后台数据格式封装 `Encrypt/MsgSignature/TimeStamp/Nonce`。最小一致实现可在已验证并完成幂等处理后返回纯文本 `success`；处理失败不得抢先确认成功。[消息推送][push]、[虚拟支付应答][virtual]

## 5. 查单补发后的平台确认

`notify_provide_goods` 专用于异常推送不成功时，把平台现金单标为已发货；正常 `xpay_goods_deliver_notify` 已返回成功，无需额外调用。因此查单确认状态 2 并完成本地补发后，需保留并执行平台发货确认，不能只改本地状态。[notify_provide_goods，2026-03-30][provide]

```http
POST https://api.weixin.qq.com/xpay/notify_provide_goods?access_token=FAKE_TOKEN
Content-Type: application/json

{"order_id":"TEST202610270001","env":1}
```

该页当前 URL/查询参数**只列 `access_token`，未列 `pay_sig` 或 `signature`**；不要从其他 xpay API 复制附加鉴权要求。参数表将 `order_id`、`wx_order_id` 都标为必填，但说明又明确二选一，以上按二选一语义示例。该页无响应 body schema，无法把想象的 `errcode=0` 结构写成已核实字段；应按实际返回和后续查单状态记录确认结果。当前尚无账号实测证据。[notify_provide_goods][provide]

## 6. 退款：请求、通知与支付事实保留

Android 等终端可由开发者主动退款；iOS 由用户向 App Store 申请，开发者不能通过普通主动退款接口代为退款。iOS 审批成功后也通过 `xpay_refund_notify` 通知。[个人专项页退款章节][person]

```http
POST https://api.weixin.qq.com/xpay/refund_order?access_token=FAKE_TOKEN&pay_sig=FAKE_PAY_SIG
Content-Type: application/json

{"openid":"openid_demo","order_id":"TEST202610270001","refund_order_id":"REFUND202610270001","left_fee":990,"refund_fee":990,"biz_meta":"refund_demo","refund_reason":"3","req_from":"2","env":1}
```

`order_id/wx_order_id` 二选一；`refund_order_id` 为 8–32 字母、数字、下划线或连字符；`left_fee` 应来自最新查单，`refund_fee` 范围为 `(0,left_fee]`。成功响应含 `refund_order_id/refund_wx_order_id/pay_order_id/pay_wx_order_id`，**`errcode=0` 仅表示退款任务启动**，之后应查退款单状态。支付后 365 天以内可发起；手续费 180 天内退、超过不退。[refund_order，2026-07-22][refund]

**签名文档冲突：**该 API 的 URL 和 query 表只列 `access_token/pay_sig`，“注意事项”却写使用用户态签名与支付签名，没有列出额外 `signature` 的传入位置。本次未对真实接口验证，故不能声称这个额外要求已确定；代码若暂不开放主动退款，应将此缺口明确保留。[refund_order][refund]

退款事件核心字段如下，示例亦为假数据：

```json
{
  "ToUserName":"gh_demo_original_id",
  "MsgType":"event",
  "Event":"xpay_refund_notify",
  "OpenId":"openid_demo",
  "WxRefundId":"WX_REFUND_DEMO_001",
  "MchRefundId":"REFUND202610270001",
  "WxOrderId":"WX_PAYMENT_DEMO_001",
  "MchOrderId":"TEST202610270001",
  "RefundFee":990,
  "RetCode":0,
  "RefundStartTimestamp":1793059200,
  "RefundSuccTimestamp":1793059201
}
```

`RetCode=0` 表示退款成功，非 0 表示失败，不能只看事件名。原始字段表还列 `RetMsg/WxpayRefundTransactionId/RetryTimes`，iOS 可选 `Attach/WxTransactionId`；当前退款字段表**没有 `Env`**，不要因退款通知未带 Env 就伪造环境或丢失已验证事实。环境应来自已匹配的本地支付单，不能来自客户端任意输入。[退款通知字段表][virtual]

项目处理约束：保留支付成功证据和独立退款证据，以平台退款 ID 去重，按已确认金额回收对应权益；失败、受理中或未知退款不得写成退款完成。状态 5 是商户侧扣款，状态 8 才是用户侧收款；退款不能反向把历史支付事实改为“从未支付”。该约束由查询状态及通知结果字段导出。[query_order][query]、[退款通知][virtual]

## 7. 当前可验证项与上线证据边界

离线验证应覆盖：上述固定字节双签名、环境映射、假 openid/商品/数量/金额不匹配拒绝、客户端 success 不授予权益、重复发货一次生效、安全模式篡改/错误 AppID/错误填充拒绝、纯文本 success 应答、退款 RetCode 非 0 不完成退款、退款不抹除支付证据。查单模拟响应必须忠实于官方 schema，不能额外塞入不存在的商品字段来让校验“通过”。

待开通后仍需取得实际链路证据：对应主体和产品开通、道具发布、真实登录与支付签名、支付后回调或查单、一次权益发放、平台发货状态、后台账单，以及适用终端退款结果。任何官方拒绝、字段差异或标识映射不符，均应推翻对应未验证假设并修正实现；本文不把离线通过当真实支付验收。[个人专项页的部署检查清单][person]

[person]: https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person
[client]: https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html
[virtual]: https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html
[code2session]: https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session
[stable]: https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getstableaccesstoken
[token]: https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken
[query]: https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_query_order
[provide]: https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_notify_provide_goods
[refund]: https://developers.weixin.qq.com/miniprogram/dev/server/API/VirtualPayment/api_refund_order
[push]: https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html
[crypto]: https://wximg.gtimg.com/shake_tv/mpwiki/cryptoDemo.zip
