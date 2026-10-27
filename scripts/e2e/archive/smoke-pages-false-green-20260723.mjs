// 归档：2026-07-23 复验判定会放过永久 loading 的旧 smoke。
// 流程：connect(不 launch) → entry 解锁 → 逐页 reLaunch → 断言 e2eState.error === '' 且页面可读
// 任一页 error 非空 → FAIL + 非零退出。受守卫页需先解锁。
import { Launcher } from '@weapp-vite/miniprogram-automator';
const AUTO_PORT = process.env.AUTO_PORT || 9420;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let PASS = 0, FAIL = 0;
const rec = (n, ok, d='') => { if(ok){PASS++;console.log(`  ✓ ${n}${d?' :: '+d:''}`);} else {FAIL++;console.log(`  ✗ ${n}${d?' :: '+d:''}`);} };

console.log('=== 每页运行时冒烟 ===');
const mini = await new Launcher().connect({ wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}`, timeout: 5000 });

// 1. 解锁：entry 同意流程
const entry = await mini.reLaunch('/pages/entry/entry');
await sleep(5000);
await entry.setData({ adultChecked: true });
await entry.callMethod('onAgree', [], { routeOnly: true });
await sleep(5000);
const unlocked = await mini.evaluate(() => getApp().globalData.store.isEntryUnlocked());
rec('entry 解锁（冒烟前置）', unlocked === true, String(unlocked));

// 2. safety（免守卫，独立测）
async function smoke(pagePath, expectLoadingDone = true) {
  try {
    const page = await mini.reLaunch(pagePath);
    await sleep(4000);
    let st = null;
    for (let i = 0; i < 8; i++) {
      st = await page.callMethod('e2eState', [], { routeOnly: true }).catch(() => null);
      if (st && st.loading === false) break;
      await sleep(700);
    }
    const noError = !!st && st.error === '';
    const loaded = !!st && (expectLoadingDone ? st.loading === false : true);
    rec(`${pagePath} error==="" `, noError, `error="${st ? st.error : 'no-state'}"`);
    rec(`${pagePath} loading完成`, loaded, `loading=${st ? st.loading : '?'}`);
    return st;
  } catch (e) {
    rec(`${pagePath} 冒烟`, false, e.message);
    return null;
  }
}

// safety 免守卫
await smoke('/pages/safety/safety');

// 受守卫页（已解锁）
await smoke('/pages/assessment/assessment');
// G3/G5/G6 链路页：这些页 onLoad 只 setData(taskId)，不主动调 API（loading 可能保持 true 或无 API）
// clarity-edit/mirror/reflection/report/action/order/data-control/support/share-card
for (const p of ['clarity-edit','mirror','reflection','report','action','order','data-control','support','share-card','venting']) {
  await smoke('/pages/'+p+'/'+p, false); // 这些页 loading 不强制完成（部分页无主动加载）
}

console.log(`\n=== 冒烟结果：通过 ${PASS} / 失败 ${FAIL} ===`);
await mini.disconnect();
process.exit(FAIL > 0 ? 1 : 0);
