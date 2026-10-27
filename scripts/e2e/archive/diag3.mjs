// scripts/e2e/archive/diag3.mjs
// ⚠️ 重建自对话历史（非逐字原版）。归档恢复。
// ⚠️ 含 automator.launch，勿与活跃 E2E 并行。
// 原始用途：测 page.callMethod('e2eState') 绕开 data() 挂起（发现 callMethod 也挂）。
import automator from '@weapp-vite/miniprogram-automator';
const AUTO_PORT = process.env.AUTO_PORT || 9420;
const log = (m) => console.log(`[d3] ${m}`);
const race = (p, ms, l) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(l + ' 超时')), ms))]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

log('Launcher.launch wechat');
const launcher = new automator.Launcher();
const mini = await race(launcher.launch({
  platform: 'wechat',
  cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  projectPath: '/Applications/soft/CodeSpace/aichat/miniprogram',
  timeout: 60000
}), 70000, 'launch');
log('已连接');
const page = await race(mini.reLaunch('/pages/entry/entry'), 40000, 'reLaunch');
log(`reLaunch ok path=${page.path}`);

for (let i = 0; i < 15; i++) {
  await sleep(500);
  const st = await race(page.callMethod('e2eState'), 6000, 'callMethod').catch(e => ({ err: e.message }));
  if (st && !st.err && st.productName) { log(`e2eState ✓ productName="${st.productName}"`); break; }
  if (i === 14) log(`未拿到 productName: ${JSON.stringify(st)}`);
}

log('setData + tap');
await race(page.setData({ adultChecked: true }), 6000, 'setData');
const btn = await race(page.$('.aichat-btn'), 6000, '.$').catch(() => null);
log(`按钮: ${btn ? '找到' : '未找到'}`);
if (btn) {
  await race(btn.tap(), 8000, 'tap');
  await sleep(4000);
  const cur = await race(mini.currentPage(), 6000, 'currentPage');
  log(`tap 后: ${cur && cur.path}`);
}
await mini.close();
