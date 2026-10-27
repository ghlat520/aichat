// Native page compilation and fail-closed UI. Network is explicitly replaced with a disabled-payment fixture.
// This does not call wx.login, wx.requestVirtualPayment, real WeChat servers or an existing application database.
import { Launcher } from '@weapp-vite/miniprogram-automator';
import fs from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve('docs/e2e-screenshots/virtual-pay-20261027');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [
  ['checkout', '/pages/checkout/checkout', '.checkout-mini-book', d => !d.quoteReady && /尚未开通/.test(d.error)],
  ['pending', '/pages/payment/payment', '.gk-payment-state', d => d.payment === 'pending' && /尚未开通/.test(d.notice)],
  ['locked-report', '/pages/growth-report/growth-report', '.gk-empty', d => d.locked === true],
  ['public-sample', '/pages/growth-report/growth-report?sample=1', '.report-header', d => d.sample === true && d.locked === false],
  ['reports', '/pages/reports/reports', '.reports-filters', d => d.hasPaid === false && d.paidItems.length === 0],
  ['orders', '/pages/order/order', '#order-page', d => d.hasGrowthOrder === false]
];

const mini = await new Launcher().launch({ cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  projectPath: path.resolve('miniprogram'), port: 9420, timeout: 20000 });
let original;
const results = [];
try {
  await wait(8000);
  original = await mini.evaluate(() => {
    const app = getApp().globalData;
    const state = app.store.getState();
    return JSON.stringify({ growth: app.growth.get(), session: state.session, consent: state.consent, appConfig: state.appConfig });
  });
  await mini.mockWxMethod('request', { statusCode: 503, data: { request_id: 'native-disabled-fixture', data: null,
    error: { code: 'VIRTUAL_PAY_NOT_CONFIGURED', message: '个人虚拟支付尚未开通或配置，请稍后再试', retryable: false, details: {} }, meta: { api_version: 'v1' } } });
  await mini.evaluate(() => {
    const app = getApp().globalData;
    app.store.setAppConfig({ policy_version: 'native-test' });
    app.store.setSession({ sessionId: 'native-test', accessToken: 'fake-native-token', refreshToken: 'fake-native-refresh',
      level: 'Principal', status: 'ACTIVE', expiresAt: '2099-01-01T00:00:00Z' });
    app.growth.resetAll(); app.growth.fillExamples(); app.growth.confirmExperiences();
    app.growth.patch({ goals: ['探索优势'], paid: true, careerPaid: true, payment: 'pending',
      order: { id: '01M00000000000000000000000', product: 'base', price_fen: 2990, payment_state: 'PENDING' } });
  });
  await fs.mkdir(directory, { recursive: true });
  for (const [name, url, selector, accept] of checks) {
    await mini.reLaunch(url);
    await wait(2000);
    const page = await mini.currentPage();
    const data = await page.data();
    if (!(await page.$(selector)) || !accept(data)) throw new Error(`${name}: native page acceptance failed`);
    await mini.screenshot({ path: path.join(directory, name + '.png') });
    results.push({ name, url, passed: true });
    console.log(`PASS native disabled fixture: ${name}`);
  }
  await fs.writeFile(path.join(directory, 'verification.json'), JSON.stringify({ at: new Date().toISOString(),
    source: 'WeChat DevTools native renderer', network: 'explicit disabled-payment mock; no real transaction', results }, null, 2));
} finally {
  await mini.restoreWxMethod('request');
  if (original) await mini.evaluate(serialized => {
    const saved = JSON.parse(serialized); const app = getApp().globalData;
    app.growth.resetAll(); app.growth.patch(saved.growth);
    app.store.setSession(saved.session); app.store.setConsent(saved.consent); app.store.setAppConfig(saved.appConfig);
  }, original);
  mini.disconnect();
}
console.log(`Native acceptance ${results.length}/${checks.length}; evidence: ${directory}`);
