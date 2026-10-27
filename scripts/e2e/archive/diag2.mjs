// scripts/e2e/archive/diag2.mjs
// ⚠️ 重建自对话历史（非逐字原版）。归档恢复。
// ⚠️ 含 automator.launch，勿与活跃 E2E 并行。
// 原始用途：绕开 page.data() 挂起，测 mini.$ / mini.evaluate（发现 mini.$ 不是函数）。
import automator from '@weapp-vite/miniprogram-automator';
const AUTO_PORT = process.env.AUTO_PORT || 9420;
const log = (m) => console.log(`[diag2] ${m}`);
const race = (p, ms, l) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(l + ' 超时')), ms))]);

log('连接');
const mini = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}` });
log('已连接');
log('reLaunch entry');
await race(mini.reLaunch('/pages/entry/entry'), 15000, 'reLaunch');
await new Promise(r => setTimeout(r, 2500));

log('方式A: 读元素文本');
try {
  const titleEl = await race(mini.$('.entry-title'), 8000, '.$').catch(() => null);
  if (titleEl) {
    const txt = await race(titleEl.text(), 5000, 'text()');
    log(`.entry-title: "${txt}"`);
  } else {
    log('.entry-title 未找到');
  }
} catch (e) { log('A 失败: ' + e.message); }

log('方式B: evaluate');
try {
  const data = await race(mini.evaluate(() => {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    return JSON.stringify({ path: cur && cur.route, productName: cur && cur.data && cur.data.productName });
  }), 8000, 'evaluate');
  log('evaluate: ' + data);
} catch (e) { log('B 失败: ' + e.message); }

await mini.close();
