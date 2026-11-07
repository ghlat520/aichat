# 本地服务风险清单（G8 起服务前 Hard Gate · Phase 2）

> 依据：用户私有铁律 `local-service-startup`——连续 2 次重启失败必须停下回到拓扑分析，禁止第三次试。
> 本文是**分析与预案**，不含启动命令。

## 风险清单

| # | 风险 | 触发条件 | 影响 | 预案 | 红线 |
|---|------|---------|------|------|------|
| R1 | MySQL 未起或无 `aichat` 库 | `AICHAT_DB_URL` 连不上 | server 启动即失败 | 先 `docker ps`/本地 MySQL 确认；建库 + 跑 Flyway | 不连生产库 |
| R2 | Flyway 迁移失败 | V1-V7 有未应用/命名违规 | server 启动失败 | `spring.flyway.clean-disabled=true` 不能 clean；手动排查迁移文件 | 不 `--force` 跳过 |
| R3 | 必填环境变量缺失 | 密钥/DB 凭据未设 | 启动报错 | 按 dotenv 格式加载原有本地密钥，避免替换后旧密文不可读 | 不硬编码进 git |
| R4 | 功能开关默认关 | Assessment/Generation/Venting = false | E2E 拿不到数据 | 本地显式设三个 `=true` | 不改 application.properties 默认值 |
| R5 | 小程序连不上后端 | 域名校验/端口/证书 | 页面空白 | 微信工具勾"不校验合法域名"+ 指向 127.0.0.1:18088 | — |
| R6 | E2E 工具协议差异 | Stable 的 Element.tap / Input CDP 在部分 pageframe 会阻塞 | runner 假挂或假绿 | 可见元素走微信渲染 tap；文本走聚焦后的浏览器编辑事件；独立 computer-use 复验 | 不调用页面业务方法 |
| R7 | 501 接口被当成功 | G5/G6 stub 未捕获 | 假通过 | Client 层统一捕获 501 → UI"功能开发中" | 不伪装 200 |
| R8 | PII 泄漏到日志/网络 | 六字段/倾诉原文未遮蔽 | 违反 AC-22/INV-08 | 网络层遮蔽 + 不写 storage + 单测断言 | 零容忍 |
| R9 | 连续重启失败 | ≥2 次启动失败 | 盲试浪费时间 | **立即停下**，回 `LOCAL_TOPOLOGY.md` 重新分析 | 禁止第 3 次 |
| R10 | 契约漂移 | 手改生成 Controller/Client | 后续重新生成覆盖业务 | 只改 yaml 源 + 重新生成 | 不手改生成物 |

## 启动前自检闸（全部 ✅ 才进 Phase 2 出启动命令）

- [x] R1：MySQL 已起，`aichat` 库存在，Flyway 已迁移到 V7
- [x] R3：现有 .env.local 配置完整；原主密钥已认证 123/123 行 wrapped DEK
- [x] R4：三个 `AICHAT_FEATURE_*_ENABLED=true` 已设（仅本地 E2E）
- [x] R5：微信开发者工具 / E2E 工具链已确认可用
- [x] R6：E2E 工具已定为微信工具自动化 + CDP
- [x] 拓扑文档第 6 节已由实际监听、Flyway、API 与模拟器验证落实

## 失败熔断

- 第 1 次启动失败 → 读日志，定位 R1-R5 哪一条，修复。
- 第 2 次启动失败 → **强制停下**，回到 `LOCAL_TOPOLOGY.md` 重新画依赖，禁止第 3 次试。
- 任一 workaround 信号（`--force`/`--skip`/catch 吞错/重试同命令）→ 立即停，查根因。

2026-11-05：新端口 18088 已确认空闲，8080 现有容器保留；local 启动参数固定 loopback 监听并关闭真实虚拟支付。API 与模拟器验收见 .artifacts/local-backend-20261105。

修正记录：显式 Flyway URL 会使用独立连接，因此启动入口同时通过环境映射原数据库账号/密码；初次补强时的认证失败在迁移前发生，修正后启动成功。禁止 URL authority/query 携带凭据，密码不进入 CLI。
