// scripts/e2e/archive/diag4.mjs
// ⚠️ 重建自对话历史（非逐字原版）。归档恢复。
// ⚠️ 含 automator.launch，勿与活跃 E2E 并行。
// 原始用途：用 @weapp-vite Launcher API 测 page.data()（发现 data() 返回 __webviewId__ 壳）。
import { Launcher } from '@weapp-vite/miniprogram-automator';
const log = (m) => console.log(`[d4] ${m}`);
const race = (p, ms, l) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(l + ' 超时')), ms))]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

log('Launcher.launch wechat');
const launcher = new Launcher();
const mini = await race(launcher.launch({
  platform: 'wechat',
  cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  projectPath: '/Applications/soft/CodeSpace/aichat/miniprogram',
  timeout: 60000
}), 70000, 'launch');
log('已连接');
const page = await race(mini.reLaunch('/pages/entry/entry'), 40000, 'reLaunch');
log(`reLaunch ok path=${page.path}`);
log('测 page.data() ...');
const data = await race(page.data(), 8000, 'page.data()');
log(`data() loading=${data.loading} productName="${data.productName}" adultChecked=${data.adultChecked}`);
log(`AI 披露: "${(data.aiDisclosure || '').slice(0, 40)}"`);
log('setData + tap');
await race(page.setData({ adultChecked: true }), 6000, 'setData');
const btn = await race(page.$('.aichat-btn'), 6000, '.$');
log(`按钮: ${!!btn}`);
await race(btn.tap(), 8000, 'tap');
await sleep(4000);
const cur = await race(mini.currentPage(), 6000, 'currentPage');
log(`tap 后: ${cur && cur.path}`);
await mini.close();
