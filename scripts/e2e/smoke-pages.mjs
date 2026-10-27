import { Launcher } from '@weapp-vite/miniprogram-automator';
import { CdpUi } from './cdp-ui.mjs';

const AUTO_PORT = process.env.AUTO_PORT || 9420;
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const ui = new CdpUi({ port: CDP_PORT });
let mini;

async function poll(check, timeout, label) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check().catch(() => null);
    if (result) return result;
    await sleep(200);
  }
  throw new Error(`${label} 超时`);
}

async function element(page, selector) {
  return ui.exists(page.path, selector).catch(() => false);
}

async function terminal(page, selectors) {
  return poll(async () => {
    for (const selector of selectors) {
      if (await element(page, selector)) return selector;
    }
    return null;
  }, 15000, `等待 ${selectors.join(' | ')}`);
}

async function route(path, selectors, loadingSelector, options = {}) {
  let protocolError;
  try {
    if (options.reLaunch !== false) {
      try {
        if (options.navigation === 'redirectTo') {
          await mini.redirectTo(path);
        } else {
          await mini.reLaunch(path);
        }
      } catch (error) {
        protocolError = error;
      }
    }
    const expectedPath = String(path).split('?')[0].replace(/^\/+/, '');
    const page = await poll(
      async () => (await ui.topRoute()) === expectedPath ? { path: expectedPath } : null,
      12000,
      `等待顶层路由 ${expectedPath}`
    );
    const selector = await terminal(page, selectors);
    if (loadingSelector && await element(page, loadingSelector)) {
      throw new Error(`终态出现时仍存在 loading：${loadingSelector}`);
    }
    results.push({ path, ok: true, detail: selector });
    console.log(`✓ ${path} :: ${selector}`);
    await sleep(300);
    return page;
  } catch (error) {
    const detail = protocolError
      ? `reLaunch 协议异常：${protocolError.message}; UI 终态失败：${error.message}`
      : error.message;
    results.push({ path, ok: false, detail });
    console.error(`✗ ${path} :: ${detail}`);
    return null;
  }
}

try {
  mini = await new Launcher().connect({
    wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}`,
    timeout: 5000
  });

  await mini.evaluate(() => getApp().globalData.store.clearAuth());
  // V1.2：边界闸移除，entry 直接渲染首页
  const entry = await route(
    '/pages/entry/entry',
    ['#home-page'],
    '#entry-loading'
  );
  if (!entry) throw new Error('entry 冒烟失败，无法执行受守卫页面');
  await ui.click(entry.path, '#home-assessment');
  // V1.2：自测 tab 落地为自测首页目录，先进入原有关系轻自测再校验原有冒烟链路
  await poll(
    () => element({ path: '/pages/assessment/assessment' }, '#growth-relationship-entry'),
    12000,
    '等待自测首页目录'
  );
  await ui.click('/pages/assessment/assessment', '#growth-relationship-entry');
  await route(
    '/pages/assessment/assessment',
    ['#assessment-intro', '#assessment-ready', '#assessment-error', '#assessment-disabled'],
    '#assessment-loading',
    { reLaunch: false }
  );
  await route(
    '/pages/share-card/share-card',
    ['#share-card-error'],
    '#share-card-loading',
    { navigation: 'redirectTo' }
  );
  await route('/pages/clarity-edit/clarity-edit?entry=direct', ['#clarity-form', '#clarity-error'], '#clarity-loading');
  await route('/pages/mirror/mirror', ['#mirror-sections', '#mirror-error'], '#mirror-loading');
  await route('/pages/reflection/reflection', ['#reflection-round-1', '#reflection-error'], '#reflection-loading');
  await route('/pages/report/report', ['#report-summary', '#report-error'], '#report-loading');
  await route('/pages/venting/venting', ['#venting-chat', '#venting-error', '#venting-disabled'], '#venting-loading');
  await route('/pages/safety/safety', ['#safety-resources', '#safety-error'], '#safety-loading');
  await route('/pages/order/order', ['#order-stub']);
  await route('/pages/action/action', ['#action-stub']);
  await route('/pages/data-control/data-control', ['#data-control-stub']);
  await route('/pages/support/support', ['#support-stub']);
  await route('/pages/profile/profile', ['#profile-page']);

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  console.log(`\n14 页面 smoke：${passed} PASS / ${failed} FAIL`);
  if (results.length !== 14) throw new Error(`应验证 14 页，实际 ${results.length}`);
  process.exitCode = failed === 0 ? 0 : 1;
} catch (error) {
  console.error(`FATAL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  if (mini) mini.disconnect();
}
