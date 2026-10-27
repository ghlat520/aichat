// scripts/e2e/archive/diag.mjs
// ⚠️ 重建自对话历史（非逐字原版）。原始文件曾被误删（违反 AGENTS.md:21），此为归档恢复。
// ⚠️ 归档脚本：诊断用途，含 automator.launch（会重建会话，勿与活跃 E2E 并行跑）。
// 原始用途：第一个诊断脚本，测 automator.connect + page.waitFor（用了 document，错误）。
import automator from 'miniprogram-automator'; // 旧包（已迁移到 @weapp-vite，此 import 仅保留历史）

const AUTO_PORT = process.env.AUTO_PORT || 9420;
const log = (m) => console.log(`[diag] ${m}`);

log('连接 ...');
const mini = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}` });
log('已连接');
log('reLaunch entry ...');
const page = await mini.reLaunch('/pages/entry/entry');
await page.waitFor(1500);
log(`path=${page.path}`);
log('读 data ...');
try {
  const data = await page.data();
  log(`productName=${data.productName} adultChecked=${data.adultChecked}`);
} catch (e) {
  log('data 失败: ' + e.message);
}
await mini.close();
