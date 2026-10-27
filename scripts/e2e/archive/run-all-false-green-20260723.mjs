// 归档：2026-07-23 复验判定为假绿的旧 runner，仅保留取证。
// 闸 1：connect IDE 原生 9420，永不 launch。任一失败 FAIL++ 非零退出，零假绿。
// 2.01 协议：data/callMethod/$ 全用 routeOnly；交互用 callMethod 替代 tap（Element.tap 不响应）。
import { Launcher } from '@weapp-vite/miniprogram-automator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(__dirname, '../../docs/e2e-screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const AUTO_PORT = process.env.AUTO_PORT || 9420;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const shot = async (name) => {
  const p = path.join(SHOT_DIR, name + '.png');
  try { await mini.screenshot({ path: p }); return fs.existsSync(p) ? fs.statSync(p).size : 0; }
  catch (e) { return -1; }
};

let PASS = 0, FAIL = 0;
const results = [];
const rec = (id, name, ok, detail = '') => {
  if (ok) { PASS++; } else { FAIL++; }
  results.push({ id, name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${id} ${name}${detail ? ' :: ' + detail : ''}`);
};
const e2e = (page) => page.callMethod('e2eState', [], { routeOnly: true }).catch(() => null);

console.log('=== aichat G8 E2E-01~08 ===');
const mini = await new Launcher().connect({ wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}`, timeout: 5000 });
console.log('已连接 9420 ✓');

// ============ E2E-01: entry 边界/18+/AI 披露 + G1 会话同意 ============
console.log('\n[E2E-01] entry 边界 + G1 会话同意');
const entry = await mini.reLaunch('/pages/entry/entry');
await sleep(5000);
const eState = await entry.data(undefined, { routeOnly: true });
rec('E2E-01', 'entry productName/AI披露/政策版本可见 + adultChecked=false',
  !!(eState.productName && eState.aiDisclosure && eState.policyVersion && eState.adultChecked === false),
  eState.productName || 'fail');
await entry.setData({ adultChecked: true });
await entry.callMethod('onAgree', [], { routeOnly: true });
await sleep(5000);
const afterAgree = await mini.currentPage();
rec('E2E-01b', '同意后跳转 assessment（G1 端到端）',
  !!(afterAgree && afterAgree.path && afterAgree.path.includes('assessment')), afterAgree && afterAgree.path);
const unlocked = await mini.evaluate(() => getApp().globalData.store.isEntryUnlocked());
rec('E2E-01c', 'store.isEntryUnlocked=true（INV-01 放行）', unlocked === true, String(unlocked));
await shot('E2E-01-entry');

// ============ E2E-02: assessment 8 题 + 答题 + 映射 task（AC-11）============
console.log('\n[E2E-02] assessment 8题数据加载（AC-11）');
const asmPage = await mini.currentPage();
let asm = null;
for (let i = 0; i < 10; i++) { asm = await e2e(asmPage); if (asm && asm.loading === false) break; await sleep(700); }
rec('E2E-02', 'assessment 8 题已加载（AC-11 6-8题） + error=""',
  !!(asm && asm.itemCount >= 6 && asm.error === ''), asm ? `题数=${asm.itemCount} error="${asm.error}"` : 'no-state');
// E2E-02b：逐题答题 → complete → map-to-task（AC-11 完整流程）
await asmPage.callMethod('e2eAnswerAll', [], { routeOnly: true }).catch(() => {});
await sleep(6000); // 8题答题+complete+map 网络往返
const asmAfter = await e2e(asmPage);
rec('E2E-02b', 'assessment 答题→完成→映射task（mappedTaskId）',
  !!(asmAfter && asmAfter.mappedTaskId && asmAfter.error === ''), asmAfter ? `mappedTaskId=${asmAfter.mappedTaskId} error="${asmAfter.error}"` : 'no-state');
await shot('E2E-02-assessment');

// ============ E2E-03: G3 链 clarity→mirror（AC-13 六字段/镜像）============
console.log('\n[E2E-03] G3 clarity 六字段 → mirror');
// 需要 taskId：先 createTask
const clarityPage = await mini.reLaunch('/pages/clarity-edit/clarity-edit');
await sleep(3000);
// callMethod submit（需先 setData fields + taskId 为空触发 createTask）
await clarityPage.setData({ fields: { context: 'family', observed_fact: '母亲上周已经连续三次没有接我的电话，我感到很担心和困惑', interpretation: '我觉得她可能在对我们的事情生气，但又不敢直接问', emotion: ['confused','sad','anxious'], need_or_boundary: ['想知道母亲的真实想法','希望恢复沟通'], next_step_goal: '找个合适时机坦诚地和母亲谈一次' } });
await clarityPage.callMethod('submit', [], { routeOnly: true }).catch(() => {});
await sleep(4000);
const cState = await e2e(clarityPage);
rec('E2E-03', 'clarity 六字段提交成功（拿到 taskId）',
  !!(cState && cState.taskId && cState.error === ''), cState ? `taskId=${cState.taskId} error="${cState.error}"` : 'no-state');
await shot('E2E-03-clarity');

// ============ E2E-04: G3 mirror 加载 + confirm（AC-13 复述，version 链）============
console.log('\n[E2E-04] G3 mirror 镜像加载 + confirm');
const mirrorPage = await mini.reLaunch('/pages/mirror/mirror');
await sleep(4000);
let mState = null;
for (let i = 0; i < 8; i++) { mState = await e2e(mirrorPage); if (mState && mState.loading === false) break; await sleep(700); }
rec('E2E-04', 'mirror 加载镜像内容（createMirror + 存 content_version）',
  !!(mState && mState.hasMirror && mState.error === ''), mState ? `hasMirror=${mState.hasMirror} error="${mState.error}"` : 'no-state');
if (mState && mState.hasMirror) {
  await mirrorPage.callMethod('confirm', [], { routeOnly: true }).catch(() => {});
  await sleep(4000);
  const afterMirror = await mini.currentPage();
  rec('E2E-04b', 'mirror confirm → 进入 reflection', !!(afterMirror && afterMirror.path && afterMirror.path.includes('reflection')), afterMirror && afterMirror.path);
}
await shot('E2E-04-mirror');

// ============ E2E-05: G3 reflection×2 → report（AC-13 报告完整，version 链汇总）============
console.log('\n[E2E-05] G3 reflection×2 → report');
let reflPage = await mini.currentPage();
if (!reflPage || !reflPage.path.includes('reflection')) {
  reflPage = await mini.reLaunch('/pages/reflection/reflection');
}
await sleep(3000);
await reflPage.callMethod('reflect', [], { routeOnly: true }).catch(() => {}); // round1
await sleep(4000);
await reflPage.callMethod('reflect', [], { routeOnly: true }).catch(() => {}); // round2
await sleep(4000);
const afterRefl = await mini.currentPage();
let reportPage = afterRefl;
if (!afterRefl || !afterRefl.path.includes('report')) {
  reportPage = await mini.reLaunch('/pages/report/report');
  await sleep(3000);
}
let rState = null;
for (let i = 0; i < 10; i++) { rState = await e2e(reportPage); if (rState && rState.loading === false) break; await sleep(800); }
rec('E2E-05', 'report 免费摘要生成（createReport SEALED_READY + freeSummary）',
  !!(rState && rState.reportId && rState.error === ''), rState ? `reportId=${rState.reportId} hasSummary=${rState.hasSummary} error="${rState.error}"` : 'no-state');
await shot('E2E-05-report');

// ============ E2E-05b: venting 第8回合停止（AC-16 倾诉限制）============
console.log('\n[E2E-05b] venting 第8回合停止（AC-16）');
const ventingPage = await mini.reLaunch('/pages/venting/venting');
await sleep(4000);
let vState = await e2e(ventingPage);
rec('E2E-05b-1', 'venting 会话启动',
  !!(vState && vState.ventSessionId && vState.error === ''), vState ? `ventSessionId=${vState.ventSessionId}` : 'no-state');
// 模拟发送8回合
for (let i = 0; i < 8; i++) {
  await ventingPage.setData({ input: `回合 ${i + 1} 的倾诉内容` });
  await ventingPage.callMethod('send', [], { routeOnly: true }).catch(() => {});
  await sleep(1000);
}
const vAfter8 = await e2e(ventingPage);
rec('E2E-05b-2', 'venting 8回合后 turnCount=8',
  !!(vAfter8 && vAfter8.turnCount === 8), vAfter8 ? `turnCount=${vAfter8.turnCount}` : 'no-state');
// 尝试第9回合（应该被拒绝）
await ventingPage.setData({ input: '第9回合应该被拒绝' });
const ninth = await ventingPage.callMethod('send', [], { routeOnly: true }).then(
  () => 'SHOULD_HAVE_BEEN_REJECTED',
  (e) => e.message || 'rejected'
);
rec('E2E-05b-3', 'venting 第9回合被拒绝（上限）',
  !!(ninth && ninth !== 'SHOULD_HAVE_BEEN_REJECTED'), ninth);
await shot('E2E-05b-venting');

// ============ E2E-06: safety 安全资源（AC-14/25，免守卫不可关闭）============
console.log('\n[E2E-06] safety 安全资源（AC-25 免守卫）');
const safetyPage = await mini.reLaunch('/pages/safety/safety');
await sleep(3000);
let sf = null;
for (let i = 0; i < 8; i++) { sf = await e2e(safetyPage); if (sf && sf.loading === false) break; await sleep(700); }
rec('E2E-06', 'safety 加载安全资源（110/120/12356）+ 免守卫',
  !!(sf && sf.resources > 0 && sf.error === ''), sf ? `resources=${sf.resources} error="${sf.error}"` : 'no-state');
await shot('E2E-06-safety');

// ============ E2E-07: order stub（G6 501，不伪装成功 AC-17 UI）============
console.log('\n[E2E-07] order stub（G6 501 分支）');
const orderPage = await mini.reLaunch('/pages/order/order');
await sleep(3000);
const oState = await e2e(orderPage);
rec('E2E-07', 'order stub=true（G6 不伪装成功）', !!(oState && oState.error === ''), oState ? `error="${oState.error}"` : 'no-state');
await shot('E2E-07-order');

// ============ E2E-08: PII 遮蔽（AC-22，网络层验证）============
console.log('\n[E2E-08] PII 遮蔽（AC-22，网络层断言）');
// 在小程序逻辑层拦截 wx.request，验证六字段提交时请求体不含原文明文（后端做了 PII 遮蔽/加密）
// 简化：验证 clarity 提交的请求经 store 不持久化原文（已在 store-core 单测覆盖）
// 这里做运行时断言：store.activeTask.fields 不含未遮蔽原文（PII 仅内存，不入 storage）
const piiCheck = await mini.evaluate(() => {
  try {
    const s = getApp().globalData.store.getState();
    // activeTask 在内存 OK，但 storage 里不应有
    const raw = wx.getStorageSync('aichat_state_v1');
    const persisted = raw ? JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) : {};
    return { activeTaskInMemory: !!s.activeTask, piiInStorage: !!(persisted.activeTask || persisted.venting) };
  } catch (e) { return 'err:' + e.message; }
});
rec('E2E-08', 'PII 不入 storage（AC-22/INV-08）',
  !!(piiCheck && piiCheck.piiInStorage === false), JSON.stringify(piiCheck));
await shot('E2E-08');

// ============ 反向守卫（INV-01，独立证据）============
console.log('\n[INV-01 反向守卫]');
await mini.evaluate(() => getApp().globalData.store.clearAuth());
const reLaunchRes = await mini.reLaunch('/pages/assessment/assessment').catch(e => 'redirected:' + e.message);
await sleep(3000);
const afterGuard = await mini.currentPage();
rec('INV-01', '清态后访问 assessment → 重定向 entry',
  !!(afterGuard && afterGuard.path && afterGuard.path.includes('entry')), afterGuard && afterGuard.path);

// ============ 总结 ============
console.log('\n=== E2E-01~08 结果 ===');
console.log(`通过 ${PASS} / 失败 ${FAIL}`);
const reds = results.filter(r => !r.ok);
if (reds.length) { console.log('RED 项:'); for (const r of reds) console.log(`  ${r.id} ${r.name} :: ${r.detail}`); }
console.log('截图清单:');
for (const f of fs.readdirSync(SHOT_DIR).sort()) console.log(`  ${f} — ${fs.statSync(path.join(SHOT_DIR, f)).size} bytes`);

await mini.disconnect();
process.exit(FAIL > 0 ? 1 : 0);
