// scripts/e2e/archive/diag5.mjs
// ⚠️ 重建自对话历史（非逐字原版，含用户/linter 改过的 launch 版本）。归档恢复。
// ⚠️ 含 automator.launch，勿与活跃 E2E 并行。此脚本的反复 launch 曾导致会话冲突。
// 原始用途：区分"RPC 挂起" vs "page 引用失效"，用 evaluate 轮询 page ready。
import { Launcher } from '@weapp-vite/miniprogram-automator';
const log = (m) => console.log(`[d5] ${m}`);
const race = (p, ms, l) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(l + ' 超时')), ms))]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const launcher = new Launcher();
const mini = await race(launcher.launch({
  platform: 'wechat',
  cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  projectPath: '/Applications/soft/CodeSpace/aichat/miniprogram',
  timeout: 60000
}), 70000, 'launch');
log('已连接');
await race(mini.reLaunch('/pages/entry/entry'), 40000, 'reLaunch');
log('reLaunch 返回，用 evaluate 轮询确认 page ready...');
let ready = false;
for (let i = 0; i < 20; i++) {
  await sleep(800);
  try {
    const r = await race(mini.evaluate(() => {
      const pages = getCurrentPages();
      const cur = pages[pages.length - 1];
      return cur ? { route: cur.route, hasProduct: !!(cur.data && cur.data.productName) } : null;
    }), 4000, 'eval-ready');
    log(`  轮询 ${i}: ${JSON.stringify(r)}`);
    if (r && r.route === 'pages/entry/entry' && r.hasProduct) { ready = true; break; }
  } catch (e) { log(`  轮询 ${i} 失败: ${e.message}`); }
}
log(`page ready=${ready}`);
if (!ready) { log('page 未就绪，跳过'); await mini.close(); process.exit(2); }

log('--- currentPage() ---');
const page2 = await race(mini.currentPage(), 12000, 'currentPage');
log(`path=${page2 && page2.path}`);
try { const d = await race(page2.data(), 12000, 'A.data()'); log(`A.data() ✓ productName="${d.productName}"`); }
catch (e) { log(`A.data() ✗ ${e.message}`); }
try { const v = await race(page2.data('loading'), 8000, 'B.data'); log(`B.data("loading") ✓ = ${JSON.stringify(v)}`); }
catch (e) { log(`B.data ✗ ${e.message}`); }
try { const r = await race(page2.callMethod('e2eState'), 12000, 'C.callMethod'); log(`C.callMethod ✓ ${JSON.stringify(r).slice(0, 120)}`); }
catch (e) { log(`C.callMethod ✗ ${e.message}`); }
try { const el = await race(page2.$('.aichat-btn'), 6000, 'E.$'); log(`E.$ ✓ 找到按钮`); }
catch (e) { log(`E.$ ✗ ${e.message}`); }

await mini.close();
log('完成');
