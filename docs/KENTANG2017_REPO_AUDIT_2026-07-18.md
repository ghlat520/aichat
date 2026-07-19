# kentang2017 GitHub 公开仓库审计（2026-07-18）

> 所属工程：`aichat`；用途：候选传统文化工具的许可与工程风险输入，不代表 P0 已采用。

> 审计时点：2026-07-18，Asia/Shanghai（UTC+8）
>
> 审计对象：[`github.com/kentang2017`](https://github.com/kentang2017) 的当日公开仓库
>
> 证据边界：GitHub 用户/仓库 API、仓库默认分支文件树、README、源码、测试路径、依赖清单、LICENSE、PyPI 项目页及关键依赖的上游许可。未下载、安装或执行任何第三方代码。
>
> 结论标签：`[事实]`、`[推断]`、`[待核]`、`[反证或限制]`、`[建议]`。

## 1. 结论先行

1. **[事实] 当日公开仓库总数为 29。** GitHub 用户 API 的 `public_repos` 为 29，仓库 API 返回 29 条；其中 **28 个为 GitHub 元数据意义上的非 Fork，1 个为 Fork 且同时是 Template，0 个 archived**。非 Fork 只能说明不是 GitHub 标记的派生仓库，不能证明其中全部代码、数据或文字均由仓库所有者原创。[用户 API](https://api.github.com/users/kentang2017) · [仓库 API](https://api.github.com/users/kentang2017/repos?per_page=100&type=owner&sort=full_name&direction=asc)
2. **[反证或限制] GitHub HTML 抓取页显示 27 个仓库，但同一审计时点的一手 API 显示 29。** HTML 页未列出 API 中可见的 `bintang_duabelas` 和 `kin-privacy`，属于页面快照/缓存差异；本报告以可枚举、可复核的 API 结果为准，并保留该差异。[HTML 仓库页](https://github.com/kentang2017?tab=repositories)
3. **[结论] A 级“可直接作为商业小程序生产依赖”的仓库为 0。** 最接近可改造的是 `ichingshifa`、`kinliuren`、`kintaiyi`，但分别存在无测试、依赖/版本漂移、算法与内容数据未建立黄金样例等问题，均只能评为 **B（许可证允许，但需明显改造和再验证）**。
4. **[结论] `ichingshifa` 是与低风险“周易文化反思卡”最贴近的候选；`luiting` 是与择日最贴近的候选；`kinastro` 覆盖八字、紫微、星座和择日最广。** 但后两者都没有仓库根目录 LICENSE：`luiting` 只能 C 级研究参考；`kinastro` 还依赖 AGPL/商业双许可的 Swiss Ephemeris，不能直接充当闭源商业小程序底座。[`ichingshifa`](https://github.com/kentang2017/ichingshifa) · [`luiting`](https://github.com/kentang2017/luiting) · [`kinastro`](https://github.com/kentang2017/kinastro)
5. **[事实] `kinqimen` 不满足“明确开源许可”硬门槛。** README 和 PyPI 自报 MIT，但默认分支文件树没有 `LICENSE`，GitHub API 为 `NOASSERTION`，PyPI 也明确把 License/Author 列为“Unverified details”；因此不得按可商用 MIT 代码直接复用。[仓库树](https://api.github.com/repos/kentang2017/kinqimen/git/trees/f4c6118665253f897889290d8630f9b4cb3a4404?recursive=1) · [PyPI 0.0.6.6](https://pypi.org/project/kinqimen/)
6. **[事实] `kinastro` 的静态工程化证据最强，但法律与安全门槛也最高。** 固定提交中有 990 个树条目、673 个 Python 文件、64 个 `test*.py` 文件和 1 个测试工作流；同时没有完整 LICENSE 文件，依赖 `pyswisseph`（AGPL v3；Swiss Ephemeris 要求在 AGPL 与专业商业许可之间二选一），FastAPI 接口直接接收出生年月时、时区、经纬度、地点和性别。[固定提交树](https://api.github.com/repos/kentang2017/kinastro/git/trees/9128a7b10dca68738e24d68039724d92abcdc812?recursive=1) · [`pyproject.toml`](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/pyproject.toml) · [`api_server.py`](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/api_server.py) · [Pyswisseph License](https://github.com/astrorigin/pyswisseph/blob/master/LICENSE.txt) · [Swiss Ephemeris 官方许可说明](https://www.astro.com/swisseph-download/doc/swisseph.htm)
7. **[结论] 这些工具最多能提高“历法/排盘计算的一致性、可追溯性和可复现性”，不能证明婚姻、事业、财运、吉凶或人生结果的预测准确率。** 对外产品应把确定性计算和文化解释分层，禁止把静态规则实现包装为科学预测。

## 2. 分级口径

| 级别 | 本报告中的含义 |
|---|---|
| A | 许可证与依赖清晰、接口适配、测试和黄金样例足够，可作为 MVP 生产候选直接复用。 |
| B | 本仓库许可证允许，但仍需明显改造、补测试、解耦依赖、核验内容权利或封装服务。 |
| C | 只能借鉴算法、规则、数据结构或 UI 思路；许可证缺失/冲突、依赖许可阻断或可验证性不足。 |
| D | 与 MVP 不匹配，或数据/版权/合规/赌博等风险过高，不建议产品复用。 |

**[反证或限制]** “仓库有 MIT 文件”只解决本仓库代码授权的一部分问题；不自动覆盖古籍整理文本、图片、字体、训练/提示语料、第三方数据文件和依赖许可证。测试文件存在也不等于测试已通过；本次按安全约束没有运行任何代码。

## 3. 全部 29 个公开仓库清单

下表的 Fork/Archived/License/last push 来自 [GitHub 仓库 API](https://api.github.com/users/kentang2017/repos?per_page=100&type=owner&sort=full_name&direction=asc)。日期为 GitHub API 的 UTC 日期；“非 Fork”不等于已证明原创。

| # | 仓库 | GitHub 类型 | API License | Last push (UTC) | 初筛结论 |
|---:|---|---|---|---|---|
| 1 | [`aastock_selenium_bs4_web-scraping`](https://github.com/kentang2017/aastock_selenium_bs4_web-scraping) | 非 Fork / 抓取脚本 | NOASSERTION | 2020-06-17 | 股票指标抓取，与本产品无关。 |
| 2 | [`astrology_gambling_books`](https://github.com/kentang2017/astrology_gambling_books) | 非 Fork / 书目 | NOASSERTION | 2026-05-02 | 占星与博彩书目；D，赌博场景不纳入产品。 |
| 3 | [`Best-README-Template`](https://github.com/kentang2017/Best-README-Template) | **Fork + Template**，上游 [`othneildrew/Best-README-Template`](https://github.com/othneildrew/Best-README-Template) | MIT | 2024-01-17 | README 模板，与产品算法无关。 |
| 4 | [`bingshu`](https://github.com/kentang2017/bingshu) | 非 Fork / 书目 | NOASSERTION | 2026-03-25 | 兵书书目，与 MVP 无直接关系。 |
| 5 | [`bintang_duabelas`](https://github.com/kentang2017/bintang_duabelas) | 非 Fork / Python 库+CLI+App | NOASSERTION | 2026-04-08 | 马来传统伊斯兰占星；C，非通用十二星座且无 LICENSE 文件。 |
| 6 | [`getncl`](https://github.com/kentang2017/getncl) | 非 Fork / 下载工具 | NOASSERTION | 2022-08-11 | 台湾国家图书馆古籍图片下载；不属于产品引擎，另有站点条款/内容权利风险。 |
| 7 | [`hkjc_horserace_scraping`](https://github.com/kentang2017/hkjc_horserace_scraping) | 非 Fork / 抓取脚本 | NOASSERTION | 2022-05-16 | 赛马结果抓取；D，赌博且与产品无关。 |
| 8 | [`ichingshifa`](https://github.com/kentang2017/ichingshifa) | 非 Fork / Python 库+Streamlit | MIT | 2026-06-22 | 周易筮法、六爻、纳甲、农历干支；**B，最相关可改造候选**。 |
| 9 | [`iching_databases`](https://github.com/kentang2017/iching_databases) | 非 Fork / 抓取脚本 | NOASSERTION | 2019-09-15 | 易经原始资料抓取；D，无 README/LICENSE/来源权利说明。 |
| 10 | [`jingjue`](https://github.com/kentang2017/jingjue) | 非 Fork / Python App | NOASSERTION | 2026-04-16 | 荆诀古占；C，仅文化研究参考。 |
| 11 | [`kentang2017`](https://github.com/kentang2017/kentang2017) | 非 Fork / Profile | NOASSERTION | 2026-07-04 | GitHub 个人主页仓库。 |
| 12 | [`kentang2017.github.io`](https://github.com/kentang2017/kentang2017.github.io) | 非 Fork / HTML 站点 | NOASSERTION | 2026-04-23 | 静态站点，不是计算引擎。 |
| 13 | [`kin-privacy`](https://github.com/kentang2017/kin-privacy) | 非 Fork / HTML 隐私页 | NOASSERTION | 2026-07-04 | 隐私政策页面，不是计算引擎；不能替代本产品的真实数据治理。 |
| 14 | [`kinastro`](https://github.com/kentang2017/kinastro) | 非 Fork / 大型库+FastAPI+Streamlit | NOASSERTION | 2026-06-24 | 88 类占星/命理体系；**C，能力最广但许可和 AGPL 依赖阻断**。 |
| 15 | [`kinifa`](https://github.com/kentang2017/kinifa) | 非 Fork / Python App | NOASSERTION | 2026-04-14 | 西非约鲁巴 Ifá；D，非首版目标且无许可/测试。 |
| 16 | [`kinjinkou`](https://github.com/kentang2017/kinjinkou) | 非 Fork / Python 库+App | NOASSERTION | 2026-03-26 | 六壬金口诀及万年历模块；C，无许可和测试。 |
| 17 | [`kinketika`](https://github.com/kentang2017/kinketika) | 非 Fork / Python App | NOASSERTION | 2026-04-07 | 马来群岛占卜择吉；C，无许可和测试。 |
| 18 | [`kinliuren`](https://github.com/kentang2017/kinliuren) | 非 Fork / Python 库+Streamlit | MIT | 2026-06-09 | 大六壬；**B，需解耦无许可依赖并补测试**。 |
| 19 | [`kinqimen`](https://github.com/kentang2017/kinqimen) | 非 Fork / Python 库+Streamlit | NOASSERTION | 2026-06-10 | 奇门遁甲；**C，README/PyPI 自报 MIT 但仓库无 LICENSE**。 |
| 20 | [`kintaiyi`](https://github.com/kentang2017/kintaiyi) | 非 Fork / Python 库+CLI+Streamlit | MIT | 2026-07-07 | 太乙年/月/日/时/分计和命法；**B，工程化较好但不适合作为首版楔子**。 |
| 21 | [`kinvastu`](https://github.com/kentang2017/kinvastu) | 非 Fork / Python 库+App | NOASSERTION | 2026-04-08 | 印度 Vastu/吠陀占星；D，非首版目标且无 LICENSE 文件。 |
| 22 | [`kinwangji`](https://github.com/kentang2017/kinwangji) | 非 Fork / Python 库+测试+App | NOASSERTION | 2026-05-19 | 皇极经世/节气；C，`pyproject` 自报 MIT 但无 LICENSE 文件。 |
| 23 | [`kinwuzhao`](https://github.com/kentang2017/kinwuzhao) | 非 Fork / Python 库+测试+App | MIT | 2026-04-10 | 五兆；C，LICENSE 与 README 的“尚未指定开源许可”互相冲突。 |
| 24 | [`liangtouqian`](https://github.com/kentang2017/liangtouqian) | 非 Fork / 单文件 App | NOASSERTION | 2026-04-16 | 鬼谷子两头钳；C，无许可和测试。 |
| 25 | [`luiting`](https://github.com/kentang2017/luiting) | 非 Fork / Python 库+App | NOASSERTION | 2026-06-11 | 雷霆曜气择日；**C，最贴近择日但无 LICENSE 文件**。 |
| 26 | [`shenyishu`](https://github.com/kentang2017/shenyishu) | 非 Fork / Python App | NOASSERTION | 2026-03-26 | 神易数兵占；C，无许可和测试，非 MVP。 |
| 27 | [`shushubook`](https://github.com/kentang2017/shushubook) | 非 Fork / 纯文字电子书 | NOASSERTION | 2026-03-25 | 201 个文本类文件；D，无 LICENSE 和逐项来源/版权清单。 |
| 28 | [`taixuanshifa`](https://github.com/kentang2017/taixuanshifa) | 非 Fork / Python App | NOASSERTION | 2026-05-01 | 太玄筮法；C，无许可和测试。 |
| 29 | [`yanqin_studies`](https://github.com/kentang2017/yanqin_studies) | 非 Fork / 书目 | NOASSERTION | 2026-05-01 | 演禽术书目；C，仅研究线索，不是软件能力。 |

## 4. 相关候选 A/B/C/D 总表

| 仓库 | 能力与输入/输出 | 源码/测试/发布静态证据 | 许可与依赖 | 小程序判断 | 级别 |
|---|---|---|---|---|---|
| [`ichingshifa`](https://github.com/kentang2017/ichingshifa/tree/ac1a3f8d89708acc8d547868fc9634c8e2c61d67) | 随机、手工六爻值或年月日时输入；输出六十四卦、变爻、纳甲、干支五行、六亲六兽等字典/排盘 | 6 个 `.py`；无测试目录/测试文件；Streamlit；PyPI 3.1.9 | 有 MIT 文件，但版权行为“2018 The Python Packaging Authority”；依赖历法库和外部 AI SDK | 可封装为后端文化反思模块；先补黄金测试、内容权利审计并去除默认 AI | **B** |
| [`kinliuren`](https://github.com/kentang2017/kinliuren/tree/3ba45a9540f08269b56d81508a061c7d46938785) | 输入节气、日干支、时干支；输出四课、三传、天地盘等结构化字典 | 9 个 `.py`；无测试；Streamlit；PyPI 0.1.2.9 | 仓库 MIT；requirements 反向依赖无 LICENSE 的 `kinqimen`，并含 Cerebras/OpenAI | 只有解耦依赖、补历法转换与规则测试后才可用 | **B** |
| [`kintaiyi`](https://github.com/kentang2017/kintaiyi/tree/9842d8f35e895ea6f09e9787edf6da5c16fab91b) | 输入年月日时分和年/月/日/时/分计模式；输出太乙局、干支、农历及规则结果字典 | 53 个 `.py`；3 个测试文件；`pyproject` 暴露 `kintaiyi` CLI；PyPI 0.2.3 | 仓库 MIT；依赖 `sxtwl`、`ephem`、`astropy` 等 | 工程参考价值高，但场景重、解释风险高，不宜首版 | **B** |
| [`kinqimen`](https://github.com/kentang2017/kinqimen/tree/f4c6118665253f897889290d8630f9b4cb3a4404) | 年月日时分+拆补/置闰/金函模式；输出奇门盘字典/表 | 6 个 `.py`；无测试；Streamlit；PyPI 0.0.6.6 | **无 LICENSE 文件**；PyPI/README 自报 MIT；依赖 `sxtwl`、`kinliuren`、Cerebras | 只可借鉴接口和规则拆分，不能复制代码 | **C** |
| [`kinastro`](https://github.com/kentang2017/kinastro/tree/9128a7b10dca68738e24d68039724d92abcdc812) | 出生日期时间、时区、经纬度、地点、性别等；FastAPI 返回多体系 JSON | 673 个 `.py`；64 个测试文件+1 CI；FastAPI/Streamlit；八字、紫微、择日等均有真实模块路径 | **无 LICENSE 文件**；`pyproject` 自报 MIT；依赖 AGPL/商业双许可 `pyswisseph`、无 LICENSE 的 `kinqimen`、未固定 commit 的 Git 依赖、外部 AI | 仅借鉴领域模块边界和统一数据模型；不可直接做闭源底座 | **C** |
| [`luiting`](https://github.com/kentang2017/luiting/tree/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb) | 年月日时分；输出雷霆曜气年/月/日/时/旬、方位和神煞盘 | 5 个 `.py`；1 个根目录测试文件；Streamlit | **无 LICENSE 文件**；README 仅链接外部 MIT 文本；依赖 `sxtwl`/`ephem` | 与婚丧/造葬择日接近，但规则范围窄且许可阻断 | **C** |
| [`kinwuzhao`](https://github.com/kentang2017/kinwuzhao/tree/b5c8d35348f0e02818ecea3649742dc0adfcad80) | 干支、节气等输入；输出五兆/五行/六兽/孤虚结构 | 6 个 `.py`；1 个测试文件，静态检出 30 个测试函数 | 有 MIT 文件和 MIT 包元数据，但 README 明说“尚未指定开源授权协议” | 授权冲突解决前不复制；且不匹配 MVP | **C** |
| [`kinwangji`](https://github.com/kentang2017/kinwangji/tree/6c8f6320c667d47f592ba8923c701386bded3b92) | 皇极经世周期和节气计算 | 17 个 `.py`；5 个测试文件；Python 包+App | 无 LICENSE 文件；`pyproject` 自报 MIT | 可借鉴测试组织和节气边界，不能复制 | **C** |
| [`bintang_duabelas`](https://github.com/kentang2017/bintang_duabelas/tree/497522c2c69ef2250f564b507f8eac584fe78bd5) | 马来传统 Bintang Duabelas；CLI+Streamlit | 12 个 `.py`；1 个测试文件；`pyproject` 有 CLI | 无 LICENSE 文件；`pyproject` 自报 MIT | 非用户所说的通用星座，且许可不完整 | **C** |
| [`kinjinkou`](https://github.com/kentang2017/kinjinkou/tree/f16586baabe05bec8f33c1ef3ff1ac0f64cd1049) | 金口诀排盘；含 `wannianli` 日历 API 模块 | 15 个 `.py`；无可识别测试；App | 无 LICENSE；依赖 `sxtwl`/`ephem` | 仅借鉴日历/排盘接口分层 | **C** |
| [`kinketika`](https://github.com/kentang2017/kinketika/tree/e1d880672a48909a5ba61a33f11f5684fa57a480) | 马来群岛七星占卜择吉 | 3 个 `.py`；无测试；App | 无 LICENSE | 仅研究参考 | **C** |
| [`jingjue`](https://github.com/kentang2017/jingjue/tree/0508825819a437150981054984a87206054e7c78) | 荆诀占卜 | 3 个 `.py`；无测试；App | 无 LICENSE | 仅历史文化参考 | **C** |
| [`liangtouqian`](https://github.com/kentang2017/liangtouqian/tree/a9817b06bcb5562ea970f6875587bdb646d8811c) | 两头钳命理 | 1 个 `.py`；无测试；App | 无 LICENSE | 不复制 | **C** |
| [`shenyishu`](https://github.com/kentang2017/shenyishu/tree/e40b719485b00d0511b4eb041e9d983c619409ff) | 神易数兵占 | 2 个 `.py`；无测试；App | 无 LICENSE | 不复制 | **C** |
| [`taixuanshifa`](https://github.com/kentang2017/taixuanshifa/tree/6d972e9020a71d846da7e55e37dc759010c24f18) | 太玄筮法 | 3 个 `.py`；无测试；App | 无 LICENSE | 不复制 | **C** |
| [`yanqin_studies`](https://github.com/kentang2017/yanqin_studies/tree/cbf3a22252f7de64b138c4d9ad528a56ebc75efc) | 演禽术书目 | 无 Python 源码 | 无 LICENSE | 可作为人工研究线索，不能当算法 | **C** |
| [`astrology_gambling_books`](https://github.com/kentang2017/astrology_gambling_books/tree/90c52cc5213ba2c078ef6b2a3905279228981335) | 占星/数字命理用于体育与赛马博彩的书目 | 无 Python 源码 | 无 LICENSE | 赌博/投机内容与安全定位冲突 | **D** |
| [`iching_databases`](https://github.com/kentang2017/iching_databases/tree/884e66ccda67b7741896cd49637047af98ece139) | 抓取易经原始资料 | 3 个 `.py`；无 README/测试 | 无 LICENSE，数据来源权利未说明 | 不复用代码或数据 | **D** |
| [`kinifa`](https://github.com/kentang2017/kinifa/tree/f253632b00afc90b27cf0d9642ac1b8c1c163034) | 西非 Ifá | 8 个 `.py`；无测试 | 无 LICENSE | 非首版目标 | **D** |
| [`kinvastu`](https://github.com/kentang2017/kinvastu/tree/e3769cbed1c61951019eec4f7acec1a0cf626e86) | 印度建筑风水/吠陀占星 | 20 个 `.py`；未见测试 | 无 LICENSE；`pyproject` 自报 MIT | 非首版目标 | **D** |
| [`shushubook`](https://github.com/kentang2017/shushubook/tree/53516cbc9152c10c0b828b42c92abb6f6b211bdb) | 术数纯文字电子书 | 201 个文本类文件；无代码测试 | 无 LICENSE/逐项版权和来源清单 | 不导入产品语料库 | **D** |

## 5. 重点候选深审

### 5.1 `ichingshifa`：最接近可改造的周易/六爻核心（B）

- **[事实] 固定版本：** [`ac1a3f8d89708acc8d547868fc9634c8e2c61d67`](https://github.com/kentang2017/ichingshifa/commit/ac1a3f8d89708acc8d547868fc9634c8e2c61d67)，提交时间 2026-06-22T12:18:03Z。
- **[事实] 能力与 API：** README 给出 `bookgua_details()`（随机）、`mget_bookgua_details(lines)`（六位 6/7/8/9 手工值）、`datetime_bookgua(y,m,d,h)`、`current_bookgua()`、`decode_gua(lines,rizhi)`、`qigua_now()` 和 `display_pan(...)`；结果包含日期干支、本卦/之卦、卦辞爻辞、纳甲、五行、六亲、六兽等。[固定 README](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/README.md) · [核心源码](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/src/ichingshifa/ichingshifa.py)
- **[事实] 可调用形态：** Python API + Streamlit；没有独立 REST API 或 CLI 入口。PyPI 当前页为 3.1.9，发布时间 2023-05-27，而仓库 2026 年仍有代码变化，不能默认 PyPI 包与仓库 HEAD 同构。[PyPI](https://pypi.org/project/ichingshifa/) · [App](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/app.py)
- **[事实] 静态测试证据：** 固定树中没有 `tests/` 或 `test*.py`。[固定树 API](https://api.github.com/repos/kentang2017/ichingshifa/git/trees/ac1a3f8d89708acc8d547868fc9634c8e2c61d67?recursive=1)
- **[事实] 许可：** 存在完整 MIT 文本，但版权行写的是 `Copyright (c) 2018 The Python Packaging Authority`，与仓库作者/项目名称不一致；MIT 仍明确给出许可文本，但版权主体和代码/数据来源需要作者确认。[LICENSE](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/LICENSE)
- **[事实] 依赖：** Streamlit、Pendulum、`lunar_python`、Ephem、cn2an、pytz、eacal、bidict、可选 Cerebras SDK；README 仍出现早期 `sxtwl` 安装说明，依赖文档存在漂移。[requirements](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/requirements.txt)
- **[风险]** `data.pkl` 的生成来源/格式和卦辞文本权利未提供清单；代码还包含可把消息发往 Cerebras/OpenAI-compatible 服务的客户端，若把用户问题或出生信息放入消息，构成第三方数据传输。[`data.pkl`](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/src/ichingshifa/data.pkl) · [`cerebras_client.py`](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/src/ichingshifa/cerebras_client.py)
- **[建议]** 只复用固定提交中的确定性排盘核心；随机起卦必须明确标为随机文化体验；先做独立黄金样例、移除默认 AI 路径、替换/审计 pickle 数据、补时区/节气/闰月边界测试，再封装为无状态后端 JSON API。

### 5.2 `kinqimen`：功能相关但许可硬门槛不通过（C）

- **[事实] 固定版本：** [`f4c6118665253f897889290d8630f9b4cb3a4404`](https://github.com/kentang2017/kinqimen/commit/f4c6118665253f897889290d8630f9b4cb3a4404)，提交时间 2026-06-10T15:14:21Z。
- **[事实] 功能：** 时家奇门（拆补/置闰）、刻家奇门、金函玉镜日家奇门；Python 调用以年月日时分和模式为输入，返回盘数据。[README](https://github.com/kentang2017/kinqimen/blob/f4c6118665253f897889290d8630f9b4cb3a4404/README.md) · [核心源码](https://github.com/kentang2017/kinqimen/blob/f4c6118665253f897889290d8630f9b4cb3a4404/kinqimen.py)
- **[事实] 工程证据：** 19 个树条目、6 个 Python 文件、无测试文件；Python API + Streamlit，无 CLI/REST。[固定树 API](https://api.github.com/repos/kentang2017/kinqimen/git/trees/f4c6118665253f897889290d8630f9b4cb3a4404?recursive=1)
- **[事实] 发布漂移：** PyPI 最新 0.0.6.6 发布于 2024-05-30，晚于该版本的仓库改动未进入同一 PyPI 版本，必须区分“安装包版本”和“仓库 HEAD”。[PyPI](https://pypi.org/project/kinqimen/)
- **[事实] 许可冲突：** README 和 PyPI 元数据自报 MIT，但仓库没有 LICENSE，GitHub API 为 `NOASSERTION`；PyPI 将 License/Author 标为未验证信息。按本项目的许可硬门槛只能研究参考。
- **[事实] 依赖：** `sxtwl==2.0.6`、Ephem、Streamlit、`kinliuren==0.1.2.9`、Cerebras SDK 等；与此同时 `kinliuren` requirements 又依赖 `kinqimen>=0.0.6.4`，形成双向耦合。[requirements](https://github.com/kentang2017/kinqimen/blob/f4c6118665253f897889290d8630f9b4cb3a4404/requirements.txt) · [`kinliuren` requirements](https://github.com/kentang2017/kinliuren/blob/3ba45a9540f08269b56d81508a061c7d46938785/requirements.txt)
- **[风险]** 无测试意味着拆补/置闰、节气交接、日界和分钟边界没有仓库级回归证据；AI 客户端会把消息提交给 Cerebras。[AI 客户端](https://github.com/kentang2017/kinqimen/blob/f4c6118665253f897889290d8630f9b4cb3a4404/cerebras_client.py)
- **[建议]** 向作者取得明确 LICENSE/商业授权并固定 commit；未完成前不要复制代码。即使授权完成，也要先拆出纯计算层、去掉 `kinliuren` 循环依赖并补规则黄金样例。

### 5.3 `kinastro`：覆盖最广，但不适合直接做闭源底座（C）

- **[事实] 固定版本：** [`9128a7b10dca68738e24d68039724d92abcdc812`](https://github.com/kentang2017/kinastro/commit/9128a7b10dca68738e24d68039724d92abcdc812)，提交时间 2026-06-24T13:53:33Z。
- **[事实] 能力不是只写在 README：** 文件树中存在 `astro/bazi/`、`astro/ziwei.py`、`astro/electional/`、`astro/annual/scoring/bazi_scorer.py`、`astro/annual/scoring/ziwei_scorer.py`、六壬/奇门 adapter 以及紫微固定样例与准确性测试。[八字计算器](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/astro/bazi/calculator.py) · [紫微模块](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/astro/ziwei.py) · [择日模块](https://github.com/kentang2017/kinastro/tree/9128a7b10dca68738e24d68039724d92abcdc812/astro/electional) · [紫微测试](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/tests/test_ziwei_accuracy.py)
- **[事实] 工程证据：** 990 个树条目、673 个 `.py`、64 个测试文件、1 个 GitHub 测试工作流；有 Streamlit 和 FastAPI。[固定树 API](https://api.github.com/repos/kentang2017/kinastro/git/trees/9128a7b10dca68738e24d68039724d92abcdc812?recursive=1) · [测试工作流](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/.github/workflows/test.yml)
- **[事实] API 输入/输出：** FastAPI `BirthParams` 接收出生年月日时分、UTC offset、纬度、经度、地点名；其他模型还收性别等，接口返回 JSON chart envelope。[`api_server.py`](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/api_server.py)
- **[安全静态审查]** 同一文件对出生输入使用 `lru_cache(maxsize=256)`；未检出常见 `Depends/Security/OAuth/APIKey/Authorization/CORS/slowapi/Limiter` 控制，多个异常路径把 `str(exc)` 返回客户端。此结论只覆盖该 API 文件，不等同于部署环境一定无网关保护。
- **[事实] 许可：** 仓库无 LICENSE；`pyproject.toml` 和 README 自报 MIT，但缺少完整许可文本和版权声明。按硬门槛只能 C。[`pyproject.toml`](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/pyproject.toml) · [固定树](https://api.github.com/repos/kentang2017/kinastro/git/trees/9128a7b10dca68738e24d68039724d92abcdc812?recursive=1)
- **[关键依赖许可]** `pyswisseph` 明确采用 AGPL v3；Astrodienst 官方说明公共网络服务启用前，开发者必须选择 AGPL 或购买 Swiss Ephemeris Professional License。闭源商业小程序不能把 `kinastro` 的 MIT 自报视为覆盖该义务。[Pyswisseph README](https://github.com/astrorigin/pyswisseph) · [Pyswisseph LICENSE](https://github.com/astrorigin/pyswisseph/blob/master/LICENSE.txt) · [Astrodienst 官方说明](https://www.astro.com/swisseph-download/doc/swisseph.htm)
- **[供应链风险]** requirements/pyproject 还直接依赖无 LICENSE 的 `kinqimen`、PyPI 旧版 `ichingshifa`，并通过未固定 commit 的 Git URL 依赖 `kintaiyi`；另外带 Cerebras/OpenAI、金融数据包、PDF/图片处理等远超 MVP 的攻击面。[requirements](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/requirements.txt)
- **[建议]** 只借鉴其“统一出生参数模型 → 独立计算 adapter → 统一 chart schema → 渲染层”的架构；不要复制代码或把整个仓库部署为公开 API。若未来使用，必须先解决作者许可、Swiss Ephemeris 许可、依赖锁定、API 鉴权/限流、敏感字段最小化和缓存清理。

### 5.4 `luiting`：与黄道/择日最接近，但不能直接复用（C）

- **[事实] 固定版本：** [`a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb`](https://github.com/kentang2017/luiting/commit/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb)，提交时间 2026-06-11T07:51:20Z。
- **[事实] 功能：** 输入年月日时分，`Luiting(...).pan()` 生成雷霆曜气年/月/日/时/旬、合炁、昇玄、金虎煞、流火等盘；README 明确主要用于造葬择吉，而不是覆盖婚礼、开业、搬家等通用老黄历事项。[README](https://github.com/kentang2017/luiting/blob/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb/README.md) · [核心源码](https://github.com/kentang2017/luiting/blob/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb/luiting.py)
- **[事实] 工程证据：** 12 个树条目、5 个 Python 文件、1 个根目录 `test_luiting.py`；没有包元数据、CLI 或 REST API。[固定树](https://api.github.com/repos/kentang2017/luiting/git/trees/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb?recursive=1) · [测试文件](https://github.com/kentang2017/luiting/blob/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb/test_luiting.py)
- **[事实] 许可：** README 说 MIT 并链接 `opensource.org`，但仓库无 LICENSE、API 为 `NOASSERTION`。按硬门槛不能直接复制。[固定树](https://api.github.com/repos/kentang2017/luiting/git/trees/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb?recursive=1)
- **[建议]** 将其视为“择日规则候选目录”，由领域专家逐条标注出处、流派和适用事项；取得作者许可前不复制实现。即使取得许可，也不能把该单一造葬体系包装成普适“黄道吉日”。

### 5.5 `kinliuren`：MIT，但依赖和验证不足（B）

- **[事实] 固定版本：** [`3ba45a9540f08269b56d81508a061c7d46938785`](https://github.com/kentang2017/kinliuren/commit/3ba45a9540f08269b56d81508a061c7d46938785)。
- **[事实] 输入/输出：** `Liuren(节气, 日干支, 时干支).result(0)`，输出节气、日期、格局、三传、四课、天地盘等字典。[README](https://github.com/kentang2017/kinliuren/blob/3ba45a9540f08269b56d81508a061c7d46938785/README.md) · [核心源码](https://github.com/kentang2017/kinliuren/blob/3ba45a9540f08269b56d81508a061c7d46938785/src/kinliuren/kinliuren.py)
- **[事实] 许可/测试：** 完整 MIT（Copyright 2019 Ken Tang），但没有测试文件。[LICENSE](https://github.com/kentang2017/kinliuren/blob/3ba45a9540f08269b56d81508a061c7d46938785/LICENSE) · [固定树](https://api.github.com/repos/kentang2017/kinliuren/git/trees/3ba45a9540f08269b56d81508a061c7d46938785?recursive=1)
- **[事实] 发布/依赖：** PyPI 0.1.2.9 发布于 2025-08-20；仓库后续变化尚需比对。requirements 依赖无 LICENSE 的 `kinqimen`，并含 Cerebras/OpenAI。[PyPI](https://pypi.org/project/kinliuren/) · [requirements](https://github.com/kentang2017/kinliuren/blob/3ba45a9540f08269b56d81508a061c7d46938785/requirements.txt)
- **[建议]** 若研究使用，先确认核心是否真的需要 `kinqimen`，以纯接口输入节气/干支的方式剥离；补输入校验和黄金盘，不直接向普通用户输出确定性人生判断。

### 5.6 `kintaiyi`：工程结构较好，但场景不适合作为首版（B）

- **[事实] 固定版本：** [`9842d8f35e895ea6f09e9787edf6da5c16fab91b`](https://github.com/kentang2017/kintaiyi/commit/9842d8f35e895ea6f09e9787edf6da5c16fab91b)。
- **[事实] API/CLI：** `Taiyi(year,month,day,hour,minute).pan(mode)`，mode 覆盖年/月/日/时/分计；`pyproject.toml` 注册 `kintaiyi = kintaiyi.cli:main`。[README](https://github.com/kentang2017/kintaiyi/blob/9842d8f35e895ea6f09e9787edf6da5c16fab91b/README.md) · [`pyproject.toml`](https://github.com/kentang2017/kintaiyi/blob/9842d8f35e895ea6f09e9787edf6da5c16fab91b/pyproject.toml) · [CLI](https://github.com/kentang2017/kintaiyi/blob/9842d8f35e895ea6f09e9787edf6da5c16fab91b/src/kintaiyi/cli.py)
- **[事实] 工程证据：** 53 个 Python 文件、3 个测试文件、完整 MIT；PyPI 最新仍是 0.2.3（2023-05-13），仓库 `pyproject` 已是 0.2.4，存在发布漂移。[测试目录](https://github.com/kentang2017/kintaiyi/tree/9842d8f35e895ea6f09e9787edf6da5c16fab91b/tests) · [LICENSE](https://github.com/kentang2017/kintaiyi/blob/9842d8f35e895ea6f09e9787edf6da5c16fab91b/LICENSE) · [PyPI](https://pypi.org/project/kintaiyi/)
- **[建议]** 可借鉴其 src-layout、CLI、可选依赖和测试组织；不建议把太乙国运/兵事预测作为利他型小程序首版入口。

### 5.7 `kinwuzhao`：授权声明自相矛盾（C）

- **[事实]** 仓库根目录存在完整 MIT 文件，`pyproject.toml` 也声明 MIT；但最新 README 的 License 章节明确写“本项目目前尚未指定开源授权协议。如需使用或二次开发，请先联系作者”。[LICENSE](https://github.com/kentang2017/kinwuzhao/blob/b5c8d35348f0e02818ecea3649742dc0adfcad80/LICENSE) · [README](https://github.com/kentang2017/kinwuzhao/blob/b5c8d35348f0e02818ecea3649742dc0adfcad80/README.md) · [`pyproject.toml`](https://github.com/kentang2017/kinwuzhao/blob/b5c8d35348f0e02818ecea3649742dc0adfcad80/pyproject.toml)
- **[事实]** LICENSE 于 2026-04-08 加入；README 在 2026-04-10 后仍保留“未授权”表述，因此不是简单的“README 尚未更新到 LICENSE 之后”即可解释。[LICENSE 提交](https://github.com/kentang2017/kinwuzhao/commit/a351cdd31c3cc2a5cfd5508dc12b2355f4f5db08) · [README 后续提交](https://github.com/kentang2017/kinwuzhao/commit/b5c8d35348f0e02818ecea3649742dc0adfcad80)
- **[事实]** 一个测试文件，静态检出 30 个测试函数；本次未执行。[测试文件](https://github.com/kentang2017/kinwuzhao/blob/b5c8d35348f0e02818ecea3649742dc0adfcad80/tests/test_kinwuzhao.py)
- **[建议]** 先向作者取得书面澄清，明确以哪个声明为准，再谈复用。

## 6. 用户场景覆盖与真实缺口

| 用户想要的能力 | 仓库中可见能力 | 审计结论 |
|---|---|---|
| 老黄历、农历、节气、干支 | `ichingshifa` 的历法整合、`kinjinkou/wannianli`、多仓库依赖 `sxtwl` | **部分有底层计算，没有一个经过验证的“通用老黄历事项宜忌引擎”**。 |
| 黄道吉日、婚嫁/乔迁/搬家/开业择日 | `luiting`、`kinqimen` 日家、`kinastro/electional`、`kinketika` | 直接相关实现均为 C；许可、流派、事项适用范围和黄金样例不满足生产门槛。 |
| 周易、六爻、求签式反思 | `ichingshifa` | 最接近可改造；只能称文化/民俗参考，不能声称预测真实结果。 |
| 奇门 | `kinqimen`；`kinastro` adapter | 有源码，但许可未通过。 |
| 六壬 | `kinliuren`、`kinjinkou` | `kinliuren` 可 B 级改造；不是首版必要能力。 |
| 太乙 | `kintaiyi` | 可 B 级研究/改造；产品理解成本和风险高。 |
| 八字 | 只在 `kinastro/astro/bazi/` 发现明确模块 | 有代码和部分测试，但整个仓库许可/依赖阻断。 |
| 紫微 | `kinastro/astro/ziwei.py`、测试 fixture 和 accuracy test | 同上，只能借鉴模型与测试思路。 |
| 星座/西洋占星 | `kinastro/western`；`bintang_duabelas` 是另一种马来传统体系 | `kinastro` 受许可和 Swiss Ephemeris 约束；不能把 `bintang_duabelas` 当普通十二星座替代品。 |
| 取名、测字 | 未发现专门的取名/测字引擎；`kinastro` 仅有一个 `qizheng/financial/name_wuxing.py` 路径 | **能力缺失**，不可从文件名推导出可用取名产品。 |
| 塔罗、MBTI、解梦 | 全仓文件树关键词审计未发现专门实现 | **能力缺失**。 |
| 事业、爱情、婚姻、财运“解惑” | 仓库提供排盘与规则文本，不提供经验证的现实决策支持 | 需要另建低风险“问题澄清→现实行动→自主决定”层；不能由占卜代码代替。 |

全仓能力路径可在 [29 仓库 API 清单](https://api.github.com/users/kentang2017/repos?per_page=100&type=owner&sort=full_name&direction=asc) 与各固定提交树中复核。**[反证或限制]** 文件路径搜索可以证明已找到的代码存在，但对“完全不存在”的结论仍受动态分支、压缩/二进制文件和未公开仓库限制；本结论只覆盖审计时点的公开默认分支。

## 7. 关键依赖与安全风险

### 7.1 小程序运行时不兼容

- **[事实]** 大多数候选是 Python + Streamlit，不是微信小程序 JavaScript/TypeScript 库；`sxtwl`、Ephem、`pyswisseph` 等含原生/天文计算依赖，不能直接放进微信小程序客户端。
- **[建议]** 若使用，只能在自有后端容器中封装确定性 JSON API；小程序端只做输入、结果展示和隐私友好的分享卡。

### 7.2 `sxtwl`：可商用但需保留许可，仍是原生依赖

- **[事实]** 多个仓库依赖 [`skydancep/sxtwl`](https://github.com/skydancep/sxtwl)。GitHub API未在根目录识别 SPDX，但仓库的 [`doc/LICENSE`](https://github.com/skydancep/sxtwl/blob/master/doc/LICENSE) 是 zlib 风格许可：允许包括商业应用在内的使用、修改和再分发，要求不冒充原作者、标明修改且不移除通知。
- **[限制]** 许可允许不等于可在小程序客户端运行；它是 C++/SWIG 为主，仍应后端部署、固定版本并保留 NOTICE。

### 7.3 Swiss Ephemeris：对闭源产品是硬门槛

- **[事实]** `kinastro` 依赖 [`pyswisseph`](https://github.com/astrorigin/pyswisseph)，其仓库采用 AGPL v3。[LICENSE](https://github.com/astrorigin/pyswisseph/blob/master/LICENSE.txt)
- **[事实]** Astrodienst 官方要求，在分发软件或开启公共服务前选择 AGPL 或购买 Professional License；选择 AGPL 时需满足其对整个项目的相应义务。[官方许可说明](https://www.astro.com/swisseph-download/doc/swisseph.htm)
- **[结论]** 未决定开源策略或购买专业许可前，`kinastro` 不得进入闭源商业 MVP 依赖图。

### 7.4 出生和问题数据

- 出生年月日时、性别、地点和经纬度可形成高度个性化画像；姓名、关系/梦境/咨询文本进一步提高敏感度。
- **[事实]** `kinastro` API 模型直接收集上述字段并在进程内使用 LRU cache；`ichingshifa`、`kinqimen`、`kinliuren`、`kintaiyi` 含可调用外部 AI 的客户端或依赖。
- **[建议]** MVP 默认不收真实姓名和精确经纬度；能本地派生的字段不上传；计算服务无日志或最小化日志、短 TTL、显式删除；AI 解释层只接收去标识化的结构化盘结果，不接收原始身份和精确地点。

### 7.5 供应链与数据文件

- `kinastro` 有未固定 commit 的 Git 依赖；多个仓库的 PyPI 发布明显落后于 GitHub 默认分支。
- `ichingshifa`、`kintaiyi`、`kinastro/kinwangji` 包含 `.pkl` 数据。**[风险]** pickle 可在反序列化时执行任意代码；只有在文件 SHA 固定、来源可追溯且由可信构建流程生成时才能使用，生产上优先改成 JSON/SQLite 等不可执行格式。
- 大量古籍文字、图片、二维码和数据表没有逐项权利清单；代码 MIT 不等于内容 MIT。

## 8. 对安全 MVP 的可复用结论

### 8.1 可以立即借鉴，但不要原样部署

1. **`ichingshifa` 的输入/输出结构：** `manual lines/date-time → deterministic chart dict → cultural explanation`；用于设计“文化反思卡”的数据模型。[API 说明](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/README.md)
2. **`kinastro` 的架构边界：** 统一出生参数、独立体系 adapter、统一 chart schema、渲染层和测试 fixture；只借鉴设计，不复制实现。[模型/API](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/api_server.py) · [fixture](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/tests/fixtures/verified_ziwei_charts.json)
3. **`kintaiyi` 的工程组织：** src-layout、CLI、可选 app/dev 依赖和测试目录，可作为自研确定性引擎的工程模板。[`pyproject.toml`](https://github.com/kentang2017/kintaiyi/blob/9842d8f35e895ea6f09e9787edf6da5c16fab91b/pyproject.toml)

### 8.2 当前不得直接复制/商用

- `kinqimen`、`luiting`、`kinastro` 以及其他无 LICENSE 仓库。
- `kinwuzhao`，直到作者书面澄清 README 与 MIT 文件冲突。
- `shushubook`、`iching_databases` 的文本/抓取数据。
- 任何依赖 Swiss Ephemeris、但尚未选择 AGPL 路线或取得商业许可的闭源服务。

### 8.3 最小技术路径

```text
微信小程序 UI
  → 匿名/最小输入校验
  → 自有后端 Deterministic Engine（固定规则版本、固定依赖 SHA）
  → 结构化结果 JSON
  → 安全文案模板 / 可选去标识化 AI 解释
  → 不含出生信息和问题原文的分享卡
```

- **[建议]** 第一阶段不要把 `kinastro` 的 88 体系搬进产品。若做“问一问”，选择一个可验证闭环，例如 `日期/手工爻值 → 周易文化卡 → 三个现实行动问题`；若做择日，则应先自建“事项分类+历法黄金样例+流派版本”规范，`luiting` 只能作为待授权的规则线索。
- **[建议]** 不在客户端或服务端用 AI 重新计算农历、干支、节气或排盘；AI 只能解释已经由确定性引擎生成的结构化结果。

## 9. “更加准确”的验证门槛

在任一仓库进入 MVP 前，至少完成以下门槛：

1. **许可证门槛：** 根 LICENSE/SPDX、作者/贡献者、依赖、数据、图片/字体逐项有结论；无 LICENSE 或冲突即停止。
2. **版本门槛：** 固定 commit SHA、Python 和所有依赖版本；不得使用未固定 Git HEAD。
3. **历法黄金样例：** 至少覆盖普通日、闰月、春节前后、24 节气交接前后 1 分钟、23:00/00:00 日界、时区输入、极端年份；与至少两个独立权威实现或数据源交叉核对。
4. **流派门槛：** 拆补/置闰、换日、真太阳时、起盘方式、择日事项规则必须显式版本化；不同流派不能混成“唯一正确答案”。
5. **可复现门槛：** 相同输入+规则版本必须得到相同排盘；随机起卦需要记录随机机制并明确其娱乐/仪式属性。
6. **内容门槛：** 卦辞/古籍/解释的出处和权利可追溯；不输出宿命、灾祸、医疗、法律、投资、生育或不可逆行动指令。
7. **安全门槛：** API 鉴权、限流、输入大小限制、超时、依赖扫描、无敏感日志、缓存清理、用户删除；AI 出站数据有明确告知与最小化。
8. **用户帮助度门槛：** 验证“问题是否更清楚、是否获得现实行动、是否减少焦虑”，不能用分享率或用户主观“好准”代替预测真实性。

## 10. 最终判断、置信度与推翻条件

- **最终判断：** `kentang2017` 的公开仓库对“传统文化计算引擎调研”很有价值，但不存在可不经改造直接支撑安全、闭源、商业微信小程序的 A 级底座。当前最合理路径是：以 `ichingshifa` 作为 B 级周易模块候选；把 `kinastro` 当架构/测试样例；把 `luiting`、`kinqimen` 当待授权规则参考；其余能力不进入 MVP。
- **已验证事实：** 29 仓库总量、Fork/archive/template 状态、默认分支树、许可文件存在性、重点 README/源码/测试路径、PyPI 版本、关键依赖许可。
- **推断：** 微信小程序必须通过自有后端适配；没有 A 级候选；当前许可/安全缺口会阻止直接商业部署。
- **反证或限制：** 未执行测试，不能断言算法正确或仓库可运行；未逐文件进行版权归属和全量 SCA/CVE 扫描；私有仓库、非默认分支和审计后更新不在范围内；本报告不是正式法律意见。
- **置信度：** 仓库盘点与许可文件存在性 **高**；静态工程成熟度 **中高**；算法正确性 **低/待核**；中国大陆产品合规由另一份专项审计决定。
- **推翻条件：** 作者补齐或澄清 LICENSE；关键依赖取得可接受的商业许可；独立黄金样例通过；公开 API 完成隐私、安全与限流整改；或仓库默认分支/发布版本发生实质变化。任一条件变化后应重新审计固定 commit，而不是沿用本报告的动态结论。

## 11. 主要一手证据索引

- [GitHub 用户 API](https://api.github.com/users/kentang2017)
- [GitHub 29 仓库 API](https://api.github.com/users/kentang2017/repos?per_page=100&type=owner&sort=full_name&direction=asc)
- [`ichingshifa` 固定提交](https://github.com/kentang2017/ichingshifa/tree/ac1a3f8d89708acc8d547868fc9634c8e2c61d67) · [LICENSE](https://github.com/kentang2017/ichingshifa/blob/ac1a3f8d89708acc8d547868fc9634c8e2c61d67/LICENSE) · [PyPI](https://pypi.org/project/ichingshifa/)
- [`kinqimen` 固定提交](https://github.com/kentang2017/kinqimen/tree/f4c6118665253f897889290d8630f9b4cb3a4404) · [树 API](https://api.github.com/repos/kentang2017/kinqimen/git/trees/f4c6118665253f897889290d8630f9b4cb3a4404?recursive=1) · [PyPI](https://pypi.org/project/kinqimen/)
- [`kinastro` 固定提交](https://github.com/kentang2017/kinastro/tree/9128a7b10dca68738e24d68039724d92abcdc812) · [`api_server.py`](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/api_server.py) · [`pyproject.toml`](https://github.com/kentang2017/kinastro/blob/9128a7b10dca68738e24d68039724d92abcdc812/pyproject.toml)
- [`luiting` 固定提交](https://github.com/kentang2017/luiting/tree/a3b80b8c964e8c3ff98a82d96de9dd14919b2ebb)
- [`kinliuren` 固定提交](https://github.com/kentang2017/kinliuren/tree/3ba45a9540f08269b56d81508a061c7d46938785) · [LICENSE](https://github.com/kentang2017/kinliuren/blob/3ba45a9540f08269b56d81508a061c7d46938785/LICENSE) · [PyPI](https://pypi.org/project/kinliuren/)
- [`kintaiyi` 固定提交](https://github.com/kentang2017/kintaiyi/tree/9842d8f35e895ea6f09e9787edf6da5c16fab91b) · [LICENSE](https://github.com/kentang2017/kintaiyi/blob/9842d8f35e895ea6f09e9787edf6da5c16fab91b/LICENSE) · [PyPI](https://pypi.org/project/kintaiyi/)
- [`kinwuzhao` 许可冲突](https://github.com/kentang2017/kinwuzhao/tree/b5c8d35348f0e02818ecea3649742dc0adfcad80)
- [`sxtwl` 上游许可](https://github.com/skydancep/sxtwl/blob/master/doc/LICENSE)
- [`pyswisseph` AGPL](https://github.com/astrorigin/pyswisseph/blob/master/LICENSE.txt) · [Swiss Ephemeris 官方双许可说明](https://www.astro.com/swisseph-download/doc/swisseph.htm)
