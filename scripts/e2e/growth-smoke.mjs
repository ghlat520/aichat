// growth-smoke.mjs — 自我探索 V1.2 新增页面真实编译 + 渲染冒烟
// 启动 DevTools（automator.launch 自带编译），逐页 reLaunch 并断言关键元素。
// growth 页不调用 API；页面直达，无需播种身份或同意态。
// 跑法：node scripts/e2e/growth-smoke.mjs
import { Launcher } from '@weapp-vite/miniprogram-automator';

const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = new URL('../../miniprogram/', import.meta.url).pathname;
const TIMEOUT = 20000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// [url, 关键选择器, 说明]
const CHECKS = [
  ['/pages/assessment/assessment', '#growth-voices-teaser', '自测首页目录'],
  ['/pages/assessment/assessment', '.growth-hero-mascot', '自测首页 hero 插画'],
  ['/pages/assessment/assessment', '#growth-continue-card', '继续作答卡（演示态）'],
  ['/pages/assessment/assessment', '.growth-test-card', '三张测评卡'],
  ['/pages/assessment/assessment', '#growth-celebrity-teaser', '名人观察入口卡'],
  ['/pages/assessment/assessment', '#growth-relationship-entry', '关系自测入口'],
  ['/pages/voices/voices', '.voices-welcome', '借一点力量'],
  ['/pages/voice/voice', '.voice-quote-sheet', '他们走过的路'],
  ['/pages/celebrity/celebrity', '.celebrity-cover', '猜名人偏好'],
  ['/pages/celebrity-insight/celebrity-insight', '.insight-bridge', '公开线索与自测'],
  ['/pages/invite/invite?entry=traits&kind=challenge&pick=INTJ', '.invite-start', '接收方直达·测评'],
  ['/pages/invite/invite?entry=voices&kind=comfort&voice=federer', '.invite-hero--comfort', '接收方直达·力量'],
  ['/pages/growth-intro/growth-intro?tool=mbti', '.intro-meta', '测评介绍·MBTI'],
  ['/pages/growth-intro/growth-intro?tool=traits', '.gk-soft-note', '测评介绍·经典题'],
  ['/pages/growth-question/growth-question?tool=traits', '.question-options', '答题页'],
  ['/pages/growth-result/growth-result?tool=mbti', '.result-cover', '基础结果·MBTI'],
  ['/pages/growth-result/growth-result?tool=traits', '.result-cover', '基础结果·特质'],
  ['/pages/growth-import/growth-import?tool=mbti', '.gk-field', '使用已有结果'],
  ['/pages/experiences/experiences', '.exp-tabs', '个人经历'],
  ['/pages/experiences-confirm/experiences-confirm', '.confirm-copy', '经历确认'],
  ['/pages/portrait/portrait', '.portrait-title', '综合画像'],
  ['/pages/report-preview/report-preview', '.report-book', '个人报告预览'],
  ['/pages/checkout/checkout', '.checkout-mini-book', '购买确认'],
  ['/pages/payment/payment', '.gk-payment-state', '支付状态'],
  ['/pages/growth-report/growth-report?sample=1', '.report-header', '完整报告样例'],
  ['/pages/calibrate/calibrate', '.calibrate-picker', '结果校准'],
  ['/pages/growth-reflection/growth-reflection', '.reflection-days', '7 天行动复盘'],
  ['/pages/career/career', '.career-title', '职业探索输入'],
  ['/pages/career-report/career-report', '.career-book', '职业报告'],
  ['/pages/reports/reports', '.reports-filters', '我的报告'],
  ['/pages/growth-share/growth-share', '.growth-poster', '分享预览与海报'],
  ['/pages/order/order', '.order-head-row', '订单与售后·已购视图']
];

async function main() {
  console.log('启动 DevTools 编译项目…');
  const mini = await new Launcher().launch({
    cliPath: CLI_PATH,
    projectPath: PROJECT_PATH,
    timeout: TIMEOUT
  });
  const results = [];
  let originalGrowth;
  try {
    // DevTools 冷启动 + 首次编译需要预热；evaluate 失败时退避重试
    const evaluateWithRetry = async (fn, attempts = 4) => {
      let lastError;
      for (let i = 0; i < attempts; i += 1) {
        try {
          return await mini.evaluate(fn);
        } catch (error) {
          lastError = error;
          await sleep(5000);
        }
      }
      throw lastError;
    };

    console.log('预热等待模拟器…');
    await sleep(8000);
    originalGrowth = await evaluateWithRetry(() => JSON.stringify(getApp().globalData.growth.get()));
    // 恢复原型演示初始态（清除历史运行残留），并播种 payment 页所需状态
    await evaluateWithRetry(() => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.patch({ payment: 'pending', order: { product: 'base', amount: 29.9, upgrade: false, baseCredit: 0, id: '1026', date: '2026-10-26' } });
    });

    let lastUrl = '';
    for (const [url, selector, label] of CHECKS) {
      try {
        if (url !== lastUrl) {
          await mini.reLaunch(url);
          lastUrl = url;
          await sleep(600);
        }
        const current = await mini.currentPage();
        const element = await (async (p) => {
          const deadline = Date.now() + 8000;
          while (Date.now() < deadline) {
            const el = await p.$(selector).catch(() => null);
            if (el) return el;
            await sleep(300);
          }
          return null;
        })(current);
        if (!element) throw new Error(`选择器未出现：${selector}`);
        results.push({ url, label, ok: true });
        console.log(`✓ ${label} :: ${url}`);
      } catch (error) {
        results.push({ url, label, ok: false, error: error.message });
        console.log(`✗ ${label} :: ${url} :: ${error.message}`);
      }
    }

    // —— 关键交互链路 ——
    const waitForPath = async (expected, timeout = 10000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const page = await mini.currentPage().catch(() => null);
        if (page && page.path === expected) return page;
        await sleep(400);
      }
      throw new Error(`未到达 ${expected}`);
    };
    const interaction = async (label, fn) => {
      try {
        await fn();
        results.push({ url: label, label, ok: true });
        console.log(`✓ ${label}`);
      } catch (error) {
        results.push({ url: label, label, ok: false, error: error.message });
        console.log(`✗ ${label} :: ${error.message}`);
      }
    };

    // 注：本机 DevTools 对 Element.tap 协议无响应，交互统一用 callMethod 等价触发
    const callWithRetry = async (page, method, args, attempts = 3) => {
      let lastError;
      for (let i = 0; i < attempts; i += 1) {
        try {
          return await page.callMethod(method, args);
        } catch (error) {
          lastError = error;
          await sleep(3000);
        }
      }
      throw lastError;
    };

    await interaction('交互·答题闭环：6 题自动前进并落到结果页', async () => {
      await mini.evaluate(() => { getApp().globalData.growth.resetTool('mbti'); });
      await mini.reLaunch('/pages/growth-question/growth-question?tool=mbti');
      await sleep(900);
      for (let i = 0; i < 6; i += 1) {
        const page = await mini.currentPage();
        if (page.path !== 'pages/growth-question/growth-question') break;
        await callWithRetry(page, 'choose', { currentTarget: { dataset: { value: '3' } } });
        await sleep(1000);
      }
      await waitForPath('pages/growth-result/growth-result');
    });

    await interaction('交互·名人猜想 → 线索页', async () => {
      await mini.reLaunch('/pages/celebrity/celebrity');
      await sleep(900);
      const page = await mini.currentPage();
      await callWithRetry(page, 'choose', { currentTarget: { dataset: { id: 'INTJ' } } });
      await waitForPath('pages/celebrity-insight/celebrity-insight');
    });

    await interaction('交互·力量海报接收方直达故事页', async () => {
      await mini.reLaunch('/pages/invite/invite?entry=voices&kind=comfort&voice=federer');
      await sleep(900);
      const page = await mini.currentPage();
      await callWithRetry(page, 'startInvited');
      await waitForPath('pages/voice/voice');
    });
  } finally {
    if (originalGrowth) await mini.evaluate(value => getApp().globalData.growth.patch(JSON.parse(value)), originalGrowth);
    await mini.close().catch(() => {});
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n冒烟结果：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log(failed.map((item) => `  ✗ ${item.label}：${item.error}`).join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('冒烟启动失败：', error.message);
  process.exit(1);
});
