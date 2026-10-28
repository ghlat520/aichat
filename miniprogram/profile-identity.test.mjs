// profile-identity.test.mjs — T3 微信身份区单测（node --test，mock store）
// 身份展示两态、微信登录（cross_device_recovery）成功刷新、退出登录回访客态。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function profileFixture({ level = 'Visitor', bindError = null, modalConfirm = true } = {}) {
  const calls = [];
  const initialSession = level === 'Principal'
    ? { sessionId: 's-principal', accessToken: 'a', refreshToken: 'r', level: 'Principal', expiresAt: '2099-01-01T00:00:00Z', status: 'ACTIVE' }
    : { sessionId: 's-visitor', accessToken: 'a', refreshToken: 'r', level: 'Visitor', expiresAt: '2099-01-01T00:00:00Z', status: 'ACTIVE' };
  const state = { session: initialSession, consent: null, appConfig: null, assessment: null, activeTask: null, venting: null };
  const store = {
    getState: () => state,
    setSession: value => { state.session = value; },
    clearSession: () => { state.session = null; },
    getPersonalAssets: () => ({ assessment: null, task: null, moodCheckin: null })
  };
  const growthState = { answers: {}, results: {}, sources: {}, paid: false, careerPaid: false, reflected: false, savedVoices: [], version: '1.0' };
  const growth = { get: () => growthState, patch: part => Object.assign(growthState, part) };
  // 与真实 virtual-payment.bind 行为一致：成功后把会话升为 Principal（setSession）。
  const payment = {
    async bind(purpose) {
      calls.push(['bind', purpose]);
      if (bindError) throw bindError;
      store.setSession({ ...state.session, level: 'Principal' });
    }
  };
  const dependencies = { store, syncTabBar() {}, goHome() {}, friendlyError: error => (error && error.message) || '请求失败',
    resetIdentityDisplay: () => growth.patch({ bound: false, paid: false, careerPaid: false, payment: growthState.order ? 'pending' : 'none', paymentNotice: '' }) };
  const require = (path) => {
    if (path.endsWith('growth-store')) return { getGrowth: () => growth };
    if (path.endsWith('virtual-payment')) return { getVirtualPayment: () => payment };
    return dependencies;
  };
  const wx = {
    showModal: options => { calls.push(['modal', options.content]); options.success({ confirm: modalConfirm }); },
    showToast() {}, navigateTo() {}, switchTab() {}
  };
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/profile/profile.js', import.meta.url), 'utf8'), {
    require, wx,
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  return { page, calls, store };
}

test('访客会话展示「访客模式」并提供微信登录入口', () => {
  const { page } = profileFixture({ level: 'Visitor' });
  page.onShow();
  assert.equal(page.data.identityLevel, 'Visitor');
  assert.equal(page.data.identityLabel, '访客模式');
  assert.equal(page.data.identityBound, false);
});

test('已绑定会话展示「已绑定微信」与退出登录入口', () => {
  const { page } = profileFixture({ level: 'Principal' });
  page.onShow();
  assert.equal(page.data.identityLevel, 'Principal');
  assert.equal(page.data.identityLabel, '已绑定微信');
  assert.equal(page.data.identityBound, true);
});

test('微信登录以 cross_device_recovery 目的绑定并刷新身份区块', async () => {
  const { page, calls } = profileFixture({ level: 'Visitor' });
  page.onShow();
  await page.bindWechat();
  assert.deepEqual(calls.filter(c => c[0] === 'bind'), [['bind', 'cross_device_recovery']]);
  assert.equal(page.data.identityBound, true);
  assert.equal(page.data.identityLabel, '已绑定微信');
  assert.equal(page.data.identityBusy, false);
});

test('绑定失败保留访客展示并给出可读错误', async () => {
  const { page } = profileFixture({ level: 'Visitor', bindError: new Error('微信登录未完成，请重试') });
  page.onShow();
  await page.bindWechat();
  assert.equal(page.data.identityBound, false);
  assert.equal(page.data.identityLabel, '访客模式');
  assert.match(page.data.identityNotice, /微信登录未完成/);
  assert.equal(page.data.identityBusy, false);
});

test('退出登录清空本地会话并回到访客展示，文案注明服务器会话到期自动失效', () => {
  const { page, calls, store } = profileFixture({ level: 'Principal' });
  page.onShow();
  page.logoutWechat();
  assert.equal(store.getState().session, null);
  assert.equal(page.data.identityLevel, 'Visitor');
  assert.equal(page.data.identityLabel, '访客模式');
  assert.equal(page.data.identityBound, false);
  const copy = calls.find(c => c[0] === 'modal')[1] + page.data.identityNotice;
  assert.match(copy, /到期后自动失效/);
});

test('profile 页面模板包含身份区块与服务器会话到期说明文案', () => {
  const wxml = readFileSync(new URL('./pages/profile/profile.wxml', import.meta.url), 'utf8');
  assert.match(wxml, /微信身份/);
  assert.match(wxml, /微信登录/);
  assert.match(wxml, /退出登录/);
  assert.match(wxml, /到期后自动失效/);
});
