import { Launcher } from '@weapp-vite/miniprogram-automator';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CdpUi } from './cdp-ui.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOT_DIR = path.join(ROOT, 'docs/e2e-screenshots');
const AUTO_PORT = process.env.AUTO_PORT || 9420;
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const FAULT = process.env.E2E_FAULT || '';
const FAIL_FAST = process.env.E2E_FAIL_FAST === '1';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

fs.mkdirSync(SHOT_DIR, { recursive: true });

let mini;
let selectorFaultInjected = false;
let abortRemaining = false;
const results = [];
const screenshotHashes = new Map();
const ui = new CdpUi({ port: CDP_PORT });

function normalizedPath(value) {
  return String(value || '').replace(/^\/+/, '');
}

async function poll(check, timeout, label) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw new Error(`${label} 超时${lastError ? `：${lastError.message}` : ''}`);
}

async function currentPage(expectedPath) {
  const expected = normalizedPath(expectedPath);
  return poll(
    async () => (await ui.topRoute()) === expected ? { path: expected } : null,
    12000,
    `等待顶层路由 ${expected}`
  );
}

async function navigate(url, expectedPath = normalizedPath(url).split('?')[0], options = {}) {
  let protocolError;
  try {
    if (options.navigation === 'redirectTo') {
      await mini.redirectTo(url);
    } else {
      await mini.reLaunch(url);
    }
  } catch (error) {
    protocolError = error;
  }
  try {
    return await currentPage(expectedPath);
  } catch (routeError) {
    if (protocolError) {
      throw new Error(`wx.reLaunch 协议错误且目标路由未出现：${protocolError.message}; ${routeError.message}`);
    }
    throw routeError;
  }
}

async function reLaunch(url) {
  return navigate(url);
}

async function maybeElement(page, selector) {
  return ui.exists(page.path, selector).catch(() => false);
}

async function requiredElement(page, selector, timeout = 12000) {
  let effectiveSelector = selector;
  if (FAULT === 'selector' && !selectorFaultInjected) {
    selectorFaultInjected = true;
    effectiveSelector = '#__fault_missing_selector__';
  }
  return poll(
    async () => (await maybeElement(page, effectiveSelector)) ? effectiveSelector : null,
    timeout,
    `等待元素 ${effectiveSelector}`
  );
}

async function waitAny(page, selectors, timeout = 12000) {
  return poll(async () => {
    for (const selector of selectors) {
      const element = await maybeElement(page, selector);
      if (element) return { selector };
    }
    return null;
  }, timeout, `等待终态 ${selectors.join(' | ')}`);
}

async function input(page, selector, value) {
  await requiredElement(page, selector);
  await ui.input(page.path, selector, value);
  await poll(
    async () => (await ui.value(page.path, selector)) === String(value),
    5000,
    `输入 ${selector}`
  );
}

async function activate(page, selector) {
  await requiredElement(page, selector);
  await ui.click(page.path, selector);
  await sleep(200);
}

async function capturedRequests() {
  return mini.evaluate(() => wx.__aichatE2ERequests || []);
}

async function installRequestObserver() {
  await mini.evaluate(() => {
    if (!wx.__aichatE2EOriginalRequest) {
      wx.__aichatE2EOriginalRequest = wx.request;
      wx.request = function observedRequest(options) {
        let data = options && options.data;
        try {
          data = JSON.parse(JSON.stringify(data));
        } catch (_error) {
          data = '[unserializable]';
        }
        wx.__aichatE2ERequests.push({
          method: String((options && options.method) || 'GET').toUpperCase(),
          url: String((options && options.url) || ''),
          data
        });
        return wx.__aichatE2EOriginalRequest.call(wx, options);
      };
    }
    wx.__aichatE2ERequests = [];
    return true;
  });
}

async function capture(caseId, name, expectedPath, selector) {
  const page = await currentPage(expectedPath);
  await requiredElement(page, selector);
  if (FAULT === 'shot') {
    throw new Error('截图 canary：强制失败');
  }

  const finalPath = path.join(SHOT_DIR, `${name}.png`);
  const temporaryPath = path.join(SHOT_DIR, `.${name}.${process.pid}.png`);
  fs.writeFileSync(temporaryPath, await ui.screenshot(page.path));
  if (!fs.existsSync(temporaryPath) || fs.statSync(temporaryPath).size <= 0) {
    throw new Error(`${caseId} 截图文件缺失或为空`);
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(temporaryPath)).digest('hex');
  if (screenshotHashes.has(hash)) {
    throw new Error(`${caseId} 截图与 ${screenshotHashes.get(hash)} 完全相同`);
  }
  screenshotHashes.set(hash, caseId);
  fs.renameSync(temporaryPath, finalPath);
  return { file: path.relative(ROOT, finalPath), hash, bytes: fs.statSync(finalPath).size };
}

async function runCase(id, title, fn) {
  if (abortRemaining) {
    console.log(`↷ ${id} ${title}（fail-fast）`);
    return;
  }
  console.log(`→ ${id} ${title}`);
  try {
    const detail = await fn();
    results.push({ id, title, ok: true, detail });
    console.log(`✓ ${id} ${title}${detail ? ` :: ${detail}` : ''}`);
  } catch (error) {
    results.push({ id, title, ok: false, detail: error.message });
    console.error(`✗ ${id} ${title} :: ${error.message}`);
    if (FAIL_FAST) abortRemaining = true;
  }
}

async function main() {
  mini = await new Launcher().connect({
    wsEndpoint: `ws://127.0.0.1:${AUTO_PORT}`,
    timeout: 5000
  });
  await installRequestObserver();

  await runCase('E2E-01', '进入即首页，无需同意直达自测（V1.2 移除边界闸）', async () => {
    await mini.evaluate(() => getApp().globalData.store.clearAuth());
    const entry = await navigate('/pages/entry/entry', 'pages/entry/entry');
    await requiredElement(entry, '#home-page');
    await capture('E2E-01', 'E2E-01-entry', 'pages/entry/entry', '#entry-page');

    await requiredElement(entry, '#home-assessment');
    await activate(entry, '#home-assessment');
    await currentPage('pages/assessment/assessment');
    await requiredElement({ path: 'pages/assessment/assessment' }, '#growth-voices-teaser');
    return 'V1.2：边界闸移除，首页直达（严格对齐原型结构）；点击自测进入自测首页目录';
  });

  await runCase('E2E-02', '同意后完成自测并命中 task', async () => {
    let assessment = await currentPage('pages/assessment/assessment');
    // V1.2：自测 tab 落地为自测首页目录，先进入原有关系轻自测
    await requiredElement(assessment, '#growth-relationship-entry', 15000);
    await activate(assessment, '#growth-relationship-entry');
    await waitAny(assessment, ['#assessment-intro', '#assessment-ready', '#assessment-error', '#assessment-disabled'], 15000);
    if (await maybeElement(assessment, '#assessment-intro')) {
      await activate(assessment, '#assessment-start');
    }
    let answered = 0;
    while (answered < 8) {
      const complete = await maybeElement(assessment, '#assessment-complete');
      if (complete) break;
      await requiredElement(assessment, '#assessment-question');
      const before = await ui.text(assessment.path, '#assessment-question');
      await activate(assessment, '#assessment-option-0');
      answered += 1;
      await poll(async () => {
        const done = await maybeElement(assessment, '#assessment-complete');
        if (done) return true;
        const nextQuestion = await maybeElement(assessment, '#assessment-question');
        return nextQuestion && (await ui.text(assessment.path, '#assessment-question')) !== before;
      }, 12000, `提交第 ${answered} 题`);
    }
    if (answered < 6 || answered > 8) throw new Error(`实际答题数异常：${answered}`);
    await requiredElement(assessment, '#assessment-complete');
    for (const selector of [
      '#assessment-result-tendency',
      '#assessment-result-strength',
      '#assessment-result-reminder'
    ]) {
      await requiredElement(assessment, selector);
      if (!String(await ui.text(assessment.path, selector)).trim()) {
        throw new Error(`人格结果字段为空：${selector}`);
      }
    }
    await capture('E2E-02', 'E2E-02-assessment', 'pages/assessment/assessment', '#assessment-complete');

    await activate(assessment, '#assessment-share');
    const share = await currentPage('pages/share-card/share-card');
    const shareState = await waitAny(
      share,
      ['#share-card-preview', '#share-card-error'],
      12000
    );
    if (shareState.selector === '#share-card-error') {
      throw new Error(`分享预览失败：${await ui.text(share.path, '#share-card-error')}`);
    }
    await activate(share, '#share-card-cancel');
    assessment = await currentPage('pages/assessment/assessment');
    await activate(assessment, '#assessment-continue');
    await currentPage('pages/clarity-edit/clarity-edit');
    return `真实点击完成 ${answered} 题、分享预览可返回、继续校准可进入六字段`;
  });

  await runCase('E2E-03', '六字段提交后镜像内容回显', async () => {
    const clarity = await currentPage('pages/clarity-edit/clarity-edit');
    await requiredElement(clarity, '#clarity-form');
    await input(clarity, '#clarity-observed', '对方连续两次在已经确认的见面时间前取消，并且没有说明新的可选时间。');
    await input(clarity, '#clarity-interpretation', '我担心这意味着对方不重视约定，但目前仍缺少直接证据。');
    await activate(clarity, '#clarity-emotion-label-confused');
    await input(clarity, '#clarity-needs', '清晰，尊重');
    await input(clarity, '#clarity-goal', '未来48小时内整理一次只讨论可观察事实的沟通提纲。');
    await activate(clarity, '#clarity-submit');
    await requiredElement(clarity, '#clarity-saved', 12000);
    await activate(clarity, '#clarity-to-mirror');

    const mirror = await currentPage('pages/mirror/mirror');
    await requiredElement(mirror, '#mirror-sections', 15000);
    const sectionCount = await ui.count(mirror.path, '#mirror-sections .aichat-field');
    if (sectionCount !== 5) throw new Error(`镜像段落数应为 5，实际 ${sectionCount}`);
    for (let index = 0; index < sectionCount; index += 1) {
      const sectionText = await ui.text(mirror.path, `#mirror-sections .aichat-field:nth-child(${index + 1})`);
      if (!String(sectionText).trim()) throw new Error('镜像存在空段落');
    }
    await capture('E2E-03', 'E2E-03-mirror', 'pages/mirror/mirror', '#mirror-sections');
    await activate(mirror, '#mirror-confirm');
    await currentPage('pages/reflection/reflection');
    return '六字段由 UI 输入，五段镜像可见并确认';
  });

  await runCase('E2E-04', '两轮反思后生成免费摘要', async () => {
    const reflection = await currentPage('pages/reflection/reflection');
    await input(reflection, '#reflection-facts', '对方连续两次在约定前取消见面。');
    await input(reflection, '#reflection-unknowns', '还不知道取消的具体原因。');
    await activate(reflection, '#reflection-submit-1');
    await requiredElement(reflection, '#reflection-round-2', 12000);
    await input(reflection, '#reflection-priority', '我现在优先保护清晰和尊重的边界。');
    await input(reflection, '#reflection-goal', '未来48小时内整理一次只讨论可观察事实的沟通提纲。');
    await activate(reflection, '#reflection-submit-2');

    const report = await currentPage('pages/report/report');
    await requiredElement(report, '#report-summary', 15000);
    for (const selector of [
      '#report-confirmed-facts',
      '#report-unknowns',
      '#report-emotions',
      '#report-needs',
      '#report-goal',
      '#report-limits'
    ]) {
      await requiredElement(report, selector);
      if (!String(await ui.text(report.path, selector)).trim()) throw new Error(`免费摘要字段为空：${selector}`);
    }
    await capture('E2E-04', 'E2E-04-report', 'pages/report/report', '#report-summary');
    return '两轮真实输入完成，free_summary 六类内容可见';
  });

  await runCase('E2E-05', '倾诉第 8 回合停止', async () => {
    const venting = await reLaunch('/pages/venting/venting');
    const started = await waitAny(
      venting,
      ['#venting-chat', '#venting-error', '#venting-disabled'],
      15000
    );
    if (started.selector !== '#venting-chat') {
      throw new Error(`倾诉会话启动失败：${await ui.text(venting.path, started.selector)}`);
    }
    const beforeRequests = (await capturedRequests()).filter((request) => request.url.includes('/turns')).length;
    for (let index = 1; index <= 8; index += 1) {
      await input(venting, '#venting-input', `第${index}回合：对方取消了约定，我想先把可观察到的事实写清楚。`);
      await activate(venting, '#venting-send');
      await poll(async () => {
        const field = await maybeElement(venting, '#venting-input');
        return field && (await ui.value(venting.path, '#venting-input')) === '';
      }, 12000, `等待倾诉第 ${index} 回应`);
    }
    await requiredElement(venting, '#venting-limit');
    const afterEight = (await capturedRequests()).filter((request) => request.url.includes('/turns')).length;
    if (afterEight - beforeRequests !== 8) {
      throw new Error(`倾诉请求数应增加 8，实际增加 ${afterEight - beforeRequests}`);
    }
    await activate(venting, '#venting-send');
    await sleep(600);
    const afterNinthAttempt = (await capturedRequests()).filter((request) => request.url.includes('/turns')).length;
    if (afterNinthAttempt !== afterEight) throw new Error('第 9 次点击仍发出了网络请求');
    await capture('E2E-05', 'E2E-05-venting', 'pages/venting/venting', '#venting-limit');

    await activate(venting, '#venting-finish');
    await requiredElement(venting, '#venting-summary', 12000);
    for (const selector of [
      '#venting-summary-observed',
      '#venting-summary-thought',
      '#venting-summary-emotion',
      '#venting-summary-needs',
      '#venting-summary-goal'
    ]) {
      await requiredElement(venting, selector);
    }
    await activate(venting, '#venting-confirm');
    await requiredElement(venting, '#venting-to-mirror', 12000);
    return '8 次 turn 请求；第 9 次为 0 请求；五字段总结已确认';
  });

  await runCase('E2E-06', '高风险输入路由到安全页且不进入支付', async () => {
    const before = await capturedRequests();
    const venting = await reLaunch('/pages/venting/venting');
    const started = await waitAny(
      venting,
      ['#venting-chat', '#venting-error', '#venting-disabled'],
      15000
    );
    if (started.selector !== '#venting-chat') {
      throw new Error(`倾诉会话启动失败：${await ui.text(venting.path, started.selector)}`);
    }
    await input(venting, '#venting-input', '对方现在拿着刀堵住门，我马上会有危险。');
    await activate(venting, '#venting-send');
    const safety = await currentPage('pages/safety/safety');
    await requiredElement(safety, '#safety-resources', 12000);
    for (const code of ['110', '120', '12356']) {
      await requiredElement(safety, `#safety-resource-${code}`);
    }
    const after = await capturedRequests();
    const newRequests = after.slice(before.length);
    if (newRequests.some((request) => /\/orders|wechat-prepay/.test(request.url))) {
      throw new Error('高风险分支调用了订单或支付接口');
    }
    await capture('E2E-06', 'E2E-06-safety', 'pages/safety/safety', '#safety-resources');
    return '真实高风险 turn 命中 safety，显示 3 条资源，支付请求为 0';
  });

  await runCase('E2E-07', '订单页显示范围内 stub', async () => {
    const order = await navigate(
      '/pages/order/order',
      'pages/order/order',
      { navigation: 'redirectTo' }
    );
    await requiredElement(order, '#order-stub');
    const text = String(await ui.text(order.path, '#order-stub'));
    if (!text.includes('功能开发中') || !text.includes('不会发起支付')) {
      throw new Error(`stub 文案不完整：${text}`);
    }
    await capture('E2E-07', 'E2E-07-order', 'pages/order/order', '#order-stub');
    return 'Visitor UI 显式 STUB_BY_SCOPE；Principal 501 由后端契约测试覆盖';
  });

  await runCase('E2E-08', 'PII 不出现在最终网络请求体', async () => {
    const rawEmail = 'alice.e2e@example.com';
    const rawMobile = '13800138000';
    const before = await capturedRequests();
    const clarity = await reLaunch('/pages/clarity-edit/clarity-edit?entry=direct');
    await requiredElement(clarity, '#clarity-form');
    await input(
      clarity,
      '#clarity-observed',
      `对方让我联系 ${rawEmail} 或 ${rawMobile}，我只确认这是实际收到的信息。`
    );
    await input(clarity, '#clarity-interpretation', '我担心个人联系方式被带入沟通，但不会据此判断对方意图。');
    await activate(clarity, '#clarity-emotion-label-anxious');
    await input(clarity, '#clarity-needs', '隐私，清晰');
    await input(clarity, '#clarity-goal', '先用代称整理事实，不传播原始联系方式。');
    await activate(clarity, '#clarity-submit');
    await requiredElement(clarity, '#clarity-saved', 12000);

    const after = await capturedRequests();
    const fieldRequests = after.slice(before.length).filter(
      (request) => request.method === 'PUT' && /\/api\/v1\/tasks\/[^/]+\/fields$/.test(request.url)
    );
    if (fieldRequests.length !== 1) throw new Error(`六字段 PUT 请求应为 1，实际 ${fieldRequests.length}`);
    if (FAULT === 'pii') {
      fieldRequests[0].data.__fault_raw = rawMobile;
    }
    const requestBody = JSON.stringify(fieldRequests[0].data);
    if (requestBody.includes(rawEmail) || requestBody.includes(rawMobile)) {
      throw new Error('最终网络请求体仍包含原始邮箱或手机号');
    }
    if (!requestBody.includes('[EMAIL]') || !requestBody.includes('[MOBILE]')) {
      throw new Error('最终网络请求体未包含预期遮蔽标记');
    }
    await ui.scrollIntoView(clarity.path, '#clarity-saved');
    await capture('E2E-08', 'E2E-08-pii', 'pages/clarity-edit/clarity-edit', '#clarity-saved');
    return '实际 PUT /fields 请求体仅含 [EMAIL]/[MOBILE]';
  });

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  console.log(`\nE2E-01~08：${passed} PASS / ${failed} FAIL`);
  for (const result of results.filter((item) => !item.ok)) {
    console.error(`RED ${result.id}: ${result.detail}`);
  }
  if (!FAIL_FAST && results.length !== 8) {
    throw new Error(`runner 内部错误：应记录 8 条用例，实际 ${results.length}`);
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

try {
  await main();
} catch (error) {
  console.error(`FATAL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  if (mini) mini.disconnect();
}
