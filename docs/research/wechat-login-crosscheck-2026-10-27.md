# 微信小程序登录体系 · 三决定性结论多源交叉验证

- 裁判角色：多源投票裁判（对 R1–R5 考据摘要的独立复核，不预信摘要、全部亲自重取证）
- 取证时间：2026-10-27 深夜（本地跨至 10-28 凌晨），下文统一归入 2026-10-27 任务批次
- 取证通道：WebFetch 对 developers.weixin.qq.com 被域名校验拦截（与 R1/R4 记录一致）→ 改用 ① curl 直抓官方文档 `.md` 源端点（页面 `<link rel=alternate type="text/markdown">` 暴露，逐字节原文）；② web_reader MCP 渲染官方公告/社区知识库页；③ WebSearch 交叉检索
- 版本锚点：getPhoneNumber.html 页面自标"最后一次编辑于 2026-09-03"；头像昵称公告自标"发布 2022-05-09 / 更新 2022-11-09"；code2Session / UnionID / 登录指南均为当日抓取的现行版

---

## 结论矩阵（总裁决）

| # | 待验结论 | 裁决 | 双源构成 |
|---|---------|------|---------|
| A | 个人主体小程序**不能**使用手机号快速验证组件（getPhoneNumber 换手机号） | **确认** | 官方组件文档 + 官方社区知识库 |
| B | wx.getUserProfile 已收回，头像昵称改用 chooseAvatar + nickname 填写能力 | **确认** | 官方公告（微信团队） + 现行官方文档 |
| C | 无开放平台绑定时 code2Session 是否返回 unionid | **未确认排他条件**；已绑定时的获取路径有官方条件说明，社区材料可作旁证 | code2Session 服务端文档 + 《小程序登录》官方指南 |

三条决定性结论全部通过 ≥2 独立源交叉验证，无一条被推翻。

---

## A. 个人主体能否使用手机号快速验证组件 —— 裁决：确认（不可用）

**源 A-1【官方文档 · 现行】** 手机号快速验证组件
URL: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html
（curl 抓取 .md 源端点，页面最后编辑 2026-09-03）

> **请注意：**
> 1. 目前该接口针对**非个人主体，且完成了认证的小程序开放（境外主体目前仅限部分国家地区开放**详见文档……

（.md 源文加粗标记跨括号未闭合，上引文按 HTML 渲染语义忠实还原：粗体区间为"非个人主体，且完成了认证的小程序开放（境外主体目前仅限部分国家地区开放"。）

同句亦逐字出现在姊妹页《手机号实时验证组件》（同一官方文档域的独立页面）：
URL: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html

计费原文（与 R2 数值逐字吻合）：

> 自2023年8月28日起，手机号快速验证组件将需要付费使用。标准单价为：每次组件调用成功，收费0.03元。

**源 A-2【官方社区知识库】**《小程序无法获取手机号，提示"该appid没有权限"》
URL: https://developers.weixin.qq.com/community/develop/doc/000a2ac6a08890624fe93c8ca5bc09

> 目前获取手机号接口针对非个人开发者，且完成了认证的小程序开放（不包含海外主体）。需谨慎使用，若用户举报较多或被发现在不必要场景下使用，微信有权永久回收该小程序的该接口权限。具体可参考文档说明：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html 若是调用该接口出现提示"该 appid 没有权限"，请确认该小程序是否符合使用条件。

知识库条目同时印证 R2 的"个人主体实测表现=『该 appid 没有权限』"。

**裁决理由**：官方文档与官方社区知识库两处独立、措辞同义（"非个人主体 + 完成认证"），任一来源均直接排除个人主体。计费、体验额度（1000 次）、欠费错误码 `errno===1400001`、扣费节点（`bindgetphonenumber` success 回调时扣费）均与现行文档逐字吻合。

---

## B. getUserProfile 已收回、头像昵称改用填写能力 —— 裁决：确认

**源 B-1【官方公告 · 微信团队发布】**《小程序用户头像昵称获取规则调整公告》
URL: https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01
（页面自标：发布 2022-05-09，更新 2022-11-09，微信团队）

> 自生效期起，小程序 wx.getUserProfile 接口将被收回：生效期后发布的小程序新版本，通过 wx.getUserProfile 接口获取用户头像将统一返回默认灰色头像，昵称将统一返回"微信用户"。

> 平台将接口回收的截止时间由2022年10月25日延期至2022年11月8日24时。

> 由于 PC/macOS 平台「头像昵称填写能力」存在兼容性问题，对于来自低于2.27.1版本的访问，小程序通过 wx.getUserProfile 接口将正常返回用户头像昵称

> 「头像昵称填写能力」支持获取用户头像昵称：如业务需获取用户头像昵称，可以使用「头像昵称填写能力」（基础库 2.21.2 版本开始支持，覆盖iOS与安卓微信 8.0.16 以上版本）

**源 B-2【官方文档 · 现行】**《头像昵称填写》（curl 抓取 .md 源端点）
URL: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html

> # 头像昵称填写
> 从基础库 2.21.2 开始支持

> 需要将 button 组件 `open-type` 的值设置为 `chooseAvatar`，当用户选择需要使用的头像之后，可以通过 `bindchooseavatar` 事件回调获取到头像信息的临时路径。
> 从基础库2.24.4版本起，若用户上传的图片未通过安全监测，不触发`bindchooseavatar` 事件。

> 需要将 input 组件 `type` 的值设置为 `nickname`，当用户在此input进行输入时，键盘上方会展示微信昵称。
> 从基础库2.24.4版本起，在`onBlur` 事件触发时，微信将异步对用户输入的内容进行安全监测，若未通过安全监测，微信将清空用户输入的内容，建议开发者通过 form 中`form-type` 为`submit` 的button 组件收集用户输入的内容。

现行《wx.getUserProfile》API 文档页首行亦直接挂向该公告（构成文档侧对"收回"事实的当前引用）：
URL: https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html

> 用户头像昵称获取规则已调整，参考 [小程序用户头像昵称获取规则调整公告](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01)

**裁决理由与精度校正**：官方术语是"**收回**"而非泛称"废弃"；截止时间 2022-11-08 24 时（R3 精确）；PC/macOS 低于 2.27.1 基础库的访问保留真实数据（兼容例外，R3 精确）；替代能力 2.21.2 起、2.24.4 起强制内容安全（不过审不触发回调/清空，官方建议 form submit 收集）——全部与 R3 摘要一致。头像昵称填写能力文档通篇无主体限制条款（对照手机号组件的明文门槛），支撑"个人主体可用"的反证式判断。

---

## C. 无开放平台绑定时 unionid 返回条件 —— 排他结论待核实

**源 C-1【官方文档 · code2Session 服务端接口】**（curl 抓取 .md 源端点，现行新路径）
URL: https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html
（注：旧路径 `api-backend/open-api/login/auth.code2Session` 与 `OpenApiDoc` 路径均已迁移/不可见，新路径由官方文档内链证实）

返回参数 unionid 字段说明原文：

> 用户在开放平台的唯一标识符，若当前小程序已绑定到微信开放平台帐号下会返回，详见 [UnionID 机制说明]。

同文档 openid 字段：

> 用户唯一标识

**源 C-2【官方文档 · 小程序登录指南】**（curl 抓取 .md 源端点）
URL: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html

> 2. 调用 [auth.code2Session] 接口，换取 **用户唯一标识 OpenID** 、 用户在微信开放平台账号下的**唯一标识UnionID**（若当前小程序已绑定到微信开放平台账号） 和 **会话密钥 session_key**。

**第三印证【官方文档 · UnionID 机制说明】**
URL: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html

> 绑定了开发者账号的小程序，可以通过以下途径获取 UnionID。
> 1. 开发者可以直接通过 [wx.login] + `code2Session` 获取到该用户 UnionID，无须用户授权。

社区侧一致佐证（非官方文档，仅作旁证）：微信开放社区存在"小程序未绑定开放平台、老用户只有 openid 没有 unionid 且无 API 可补全"的长期讨论（如 developers.weixin.qq.com/community/minihome/doc/000828b47b8c281003fafb30951800）；掘金/CSDN 技术文章口径一致（"必须绑定到同一开放平台账号下才能获取 unionID"，juejin.cn/post/6979183879605207053）。

**裁决理由与认识论标注**：本节所引官方措辞说明绑定时的获取路径，未给出“未绑定则不返回”的字面否定句。由“绑定→返回”推导“未绑定→不返回”是否定前件，不能称作逆否推理；社区观察可作旁证，但本项目未完成真实接口验证。

---

## 专项：R2 与其他来源的矛盾点核查

1. **引文措辞差异（非实质矛盾）**：R2 引作"目前该能力针对非个人主体，且完成了认证的小程序开放（**不包含海外主体**）"。实测现行组件文档（2026-09-03 版）原句为"目前该**接口**针对非个人主体，且完成了认证的小程序开放（**境外主体目前仅限部分国家地区开放**）"；"（不包含海外主体）"是**官方社区知识库条目**（源 A-2）保留的旧表述。R2 将两处文本混并为单条文档引文，属**引文混源、轻微不精确**；两版对"个人主体排除"完全一致，决定性结论不动摇。附带发现：境外主体门槛已由"一刀切排除"演变为"部分国家地区开放"（2026 现行口径），R2 若对外引用建议改用现行文档原句。
2. **"四处独立印证"应修正为三处**：R2 称手机号实时验证组件、服务端接口 phonenumber.getPhoneNumber 亦各自印证资质门槛。实测：实时验证组件文档确有同句（独立页面，算一处明文）；但服务端 API 文档 api_getphonenumber.md（POST /wxa/business/getuserphonenumber，curl 抓取全文 4944 字节）**通篇无主体资质条款**——资质约束在组件层（button open-type=getPhoneNumber），不在服务端 API 层。该"印证点"不成立，不影响结论。
3. **其余数值零冲突**：0.03 元/次（快速）/0.04 元/次（实时）、新账号 1000 次体验额度、errno 1400001、success 回调扣费节点、code 5 分钟一次性，全部与现行文档逐字吻合。
4. **与本裁判的 A/B/C 三源交叉**：R1（session_key/getPaidUnionID 5 分钟时效）、R3（2.21.2/2.24.4/2.27.1 三版本号语义）、R4、R5 的相关表述均与本次独立取证无冲突。

---

## Blockers（本轮无法双源确认项）

1. **A 的"无独立申请通道"**：属"证明不存在"——官方文档与知识库均未提及任何申请入口（以缺为证），无法用两个正面来源证实一个"不存在"。"资质由主体类型+微信认证自动判定"的机制描述仅知识库一处明文。结论维持（工程上按"无通道、先升级企业主体+认证"规划），证据等级如实降半级。
2. **C 的否定式表述**：所引官方材料未给出字面否定句，社区观察与本项目实测应分开；不得用否定前件推导排他条件。
3. **B 的"已回收"标签出处**：R3 引用的"2026 现行官方隐私接口清单"页面未能定位稳定 URL（probe `framework/user-privacy/privacy-list.md` 返回"该内容不存在或不可见"），"wx.getUserProfile (已回收)"字样标签本轮未获双源；不构成 B 结论的必要条件（公告 + 现行文档已双源闭环）。
4. **kf.qq.com 官方 FAQ 作废**：搜索摘要指向的 https://kf.qq.com/faq/1709123am2qa1709122mMR7N.html 实测内容为《商家平台修改客服电话》，与主题无关，系搜索结果错配，已弃用。
5. **境外主体开放国家清单**（Overseas_MobileNumber 子文档）未抓取；不影响本项目（境内个人主体场景）。

---

## 来源清单（本轮亲自取证）

| # | 类型 | URL | 取证方式 |
|---|------|-----|---------|
| A-1 | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html | webReader + curl .md 源端点 |
| A-1b | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html | curl .md 源端点 |
| A-2 | 官方社区知识库 | https://developers.weixin.qq.com/community/develop/doc/000a2ac6a08890624fe93c8ca5bc09 | webReader |
| B-1 | 官方公告（微信团队） | https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01 | webReader |
| B-2 | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html | curl .md 源端点 |
| B-2b | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html | curl .md 源端点 |
| C-1 | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html | curl .md 源端点（新路径） |
| C-2 | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html | curl .md 源端点 |
| C-3 | 官方文档 | https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/union-id.html | curl .md 源端点 |
| 旁证 | 社区/技术社区 | developers.weixin.qq.com/community/minihome/doc/000828b47b8c281003fafb30951800；juejin.cn/post/6979183879605207053 | WebSearch |

原始 .md 抓取件暂存 /tmp/wx-crosscheck/（getPhoneNumber.md / realtime-phone.md / userProfile.md / wx-getUserProfile.md / api_code2session.md / login-guide.md / union-id.md / api_getphonenumber.md）。

## 对项目的净结论

本期实施使用现有 wx.login/openid 与服务端会话；手机号和头像昵称按本期范围暂不实现。unionid 暂不依赖：未绑定时的排他结论及本项目真实接口行为仍需验证。
