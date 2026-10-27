// growth-shots.mjs — 自我探索 V1.2 原生页面截图（与 v12-proto 原型截图一一对应，供逐页视觉比对）
// 跑法：node scripts/e2e/growth-shots.mjs  → docs/e2e-screenshots/v12-native/
import { Launcher } from '@weapp-vite/miniprogram-automator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../miniprogram');
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/e2e-screenshots/v12-native');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('启动 DevTools…');
  const mini = await new Launcher().launch({ cliPath: CLI_PATH, projectPath: PROJECT_PATH, timeout: 20000 });
  const shots = [];
  let originalGrowth;
  try {
    console.log('预热…');
    await sleep(8000);
    const ev = async (fn, attempts = 4) => {
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
    originalGrowth = await ev(() => JSON.stringify(getApp().globalData.growth.get()));
    // 恢复与原型一致的演示初始态（注意：evaluate 的函数会被序列化，必须自包含）
    const resetDemo = () => getApp().globalData.growth.resetAll();
    const readyState = () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.fillExamples();
      g.patch({ goals: ['协作'] });
      g.confirmExperiences();
    };
    const paidState = () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.fillExamples();
      g.patch({ goals: ['协作'] });
      g.confirmExperiences();
      g.createOrder();
      g.settlePayment('success');
    };
    const careerState = () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.fillExamples();
      g.patch({ goals: ['协作'] });
      g.confirmExperiences();
      g.createOrder();
      g.settlePayment('success');
      g.patch({ product: 'career', careerReady: true });
    };

    const snap = async (name, url, seed) => {
      try {
        await ev(seed || resetDemo);
        await mini.reLaunch(url);
        await sleep(900);
        await mini.screenshot({ path: path.join(OUT_DIR, name + '.png') });
        shots.push({ name, ok: true });
        console.log('✓ ' + name);
      } catch (error) {
        shots.push({ name, ok: false, error: error.message });
        console.log('✗ ' + name + ' :: ' + error.message);
      }
    };

    await snap('01-discover', '/pages/assessment/assessment');
    await snap('02-home', '/pages/entry/entry');
    await snap('03-voices', '/pages/voices/voices');
    await snap('04-voice', '/pages/voice/voice');
    await snap('05-celebrity', '/pages/celebrity/celebrity');
    await snap('06-celebrity-insight', '/pages/celebrity-insight/celebrity-insight', () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.patch({ socialVote: 'INTJ' });
    });
    await snap('07-invite-topic', '/pages/invite/invite?entry=traits&kind=challenge&pick=INTJ');
    await snap('08-invite-comfort', '/pages/invite/invite?entry=voices&kind=comfort&voice=federer');
    await snap('09-intro-mbti', '/pages/growth-intro/growth-intro?tool=mbti');
    await snap('10-intro-traits', '/pages/growth-intro/growth-intro?tool=traits');
    await snap('11-question', '/pages/growth-question/growth-question?tool=mbti');
    await snap('12-result-mbti', '/pages/growth-result/growth-result?tool=mbti');
    await snap('13-result-traits', '/pages/growth-result/growth-result?tool=traits');
    await snap('14-import', '/pages/growth-import/growth-import?tool=mbti');
    await snap('15-experiences', '/pages/experiences/experiences');
    await snap('16-confirm', '/pages/experiences-confirm/experiences-confirm', readyState);
    await snap('17-portrait', '/pages/portrait/portrait', readyState);
    await snap('18-preview', '/pages/report-preview/report-preview', () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.fillExamples();
      g.patch({ goals: ['协作'], previewState: 'ready' });
      g.confirmExperiences();
    });
    await snap('19-checkout', '/pages/checkout/checkout', () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.fillExamples();
      g.patch({ goals: ['协作'], product: 'base' });
      g.confirmExperiences();
    });
    await snap('20-career-report-preview', '/pages/career-report/career-report', careerState);
    await snap('21-report', '/pages/growth-report/growth-report', paidState);
    await snap('22-calibrate', '/pages/calibrate/calibrate', paidState);
    await snap('23-reflection', '/pages/growth-reflection/growth-reflection', paidState);
    await snap('24-career', '/pages/career/career', careerState);
    await snap('25-reports', '/pages/reports/reports', paidState);
    await snap('26-order', '/pages/order/order', paidState);
    await snap('27-order-refund', '/pages/order/order', () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.fillExamples();
      g.patch({ goals: ['协作'] });
      g.confirmExperiences();
      g.createOrder();
      g.settlePayment('success');
      g.submitSupport('内容纠错', '解释不符合');
      g.advanceRefund();
    });
    await snap('28-share-challenge', '/pages/growth-share/growth-share');
    await snap('29-share-result', '/pages/growth-share/growth-share', () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.patch({ posterKind: 'result', shareEntry: 'mbti' });
    });
    await snap('30-share-comfort', '/pages/growth-share/growth-share', () => {
      const g = getApp().globalData.growth;
      g.resetAll();
      g.patch({ posterKind: 'comfort', shareEntry: 'voices' });
    });
    await snap('31-profile', '/pages/profile/profile');
    await snap('32-chat', '/pages/venting/venting');
    await snap('33-relationship', '/pages/clarity-edit/clarity-edit?entry=direct');
  } finally {
    if (originalGrowth) await mini.evaluate(value => getApp().globalData.growth.patch(JSON.parse(value)), originalGrowth);
    await mini.close().catch(() => {});
  }
  const failed = shots.filter((item) => !item.ok);
  console.log(`截图结果：${shots.length - failed.length}/${shots.length}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error('截图失败：', error.message);
  process.exit(1);
});
