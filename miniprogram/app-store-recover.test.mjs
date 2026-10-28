// app-store-recover.test.mjs — recoverGuestSession 收敛行为（T2，node --test）
// 三分支：refresh 成功采纳响应 / 401 降级重建 / 非 401 原样上抛。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('./store-core.js');
const { createGrowthStore } = require('./growth-store.js');
const { createVirtualPayment } = require('./services/virtual-payment.js');
const source = readFileSync(new URL('./app-store.js', import.meta.url), 'utf8');

// refreshError：null=成功；{status, code}=构造 ApiClientError；Error 实例=网络等原始异常
function app({ refreshError = null, refreshedLevel = 'Principal', refreshGate = null,
  initialStatus = 'ACTIVE', refreshedStatus = 'ACTIVE', expired = true, confirmedConsent = true,
  configGate = null, confirmConsent = false, modalGate = null } = {}) {
  const calls = [];
  const modals = [];
  // 已过期的持久会话：带 refreshToken（含已绑微信的 Principal 场景）
  const session = {
    sessionId: 'session-bound',
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    level: 'Principal',
    expiresAt: expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
    status: initialStatus
  };
  const consent = confirmedConsent ? { policyVersion: 'policy-current', adultConfirmed: true, acceptedAt: 1 } : null;
  const storage = new Map([[core.STORAGE_KEY, JSON.stringify({ session, consent })]]);
  let writeBlocked = false;
  const wx = {
    getStorageSync: k => storage.get(k),
    setStorageSync: (k, v) => { if (writeBlocked) throw new Error('storage unavailable'); storage.set(k, v); },
    removeStorageSync: k => storage.delete(k),
    showModal: async options => { calls.push('consent-dialog'); modals.push(options); if (modalGate) await modalGate(); options.success({ confirm: confirmConsent }); }
  };
  const growth = createGrowthStore(wx);
  class ApiClientError extends Error {
    constructor(status, code) {
      super('需要有效身份凭证');
      this.status = status;
      this.apiError = { code, message: this.message };
    }
  }
  class Client {
    constructor(options) { this.provider = options.tokenProvider; }
    async getAppConfig() {
      calls.push('config');
      if (configGate) await configGate();
      return { data: { policy_version: 'policy-current' } };
    }
    async refreshSessionToken() {
      calls.push('refresh');
      if (refreshGate) await refreshGate();
      if (refreshError) {
        throw refreshError instanceof Error ? refreshError : new ApiClientError(refreshError.status, refreshError.code);
      }
      // 服务端 T1 实装后：同一 sessionId 续期，auth_level 重新推导（绑定会话 → Principal）
      return {
        data: {
          session_id: 'session-bound',
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          auth_level: refreshedLevel,
          expires_at: '2099-01-01T00:00:00Z',
          status: refreshedStatus
        }
      };
    }
    async createVisitorSession() {
      calls.push('create');
      return {
        data: {
          session_id: 'visitor-new',
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          auth_level: 'Visitor',
          expires_at: '2099-01-01T00:00:00Z'
        }
      };
    }
    async recordConsent(id, request) {
      const identity = await this.provider.getIdentity();
      assert.equal(identity.accessToken, expired || id === 'visitor-new' ? 'fresh-access' : 'old-access');
      assert.equal(request.policy_version, 'policy-current');
      calls.push('consent');
      return { data: { session_id: id } };
    }
    async bindWechatIdentity() {
      const identity = await this.provider.getIdentity();
      calls.push('bind:' + identity.accessToken);
      return { data: { bound: true } };
    }
  }
  const context = {
    wx, module: { exports: {} }, setTimeout, require(name) {
      if (name === './store-core') return core;
      if (name === './growth-store') return { getGrowth: () => growth };
      if (name === './services/api/generated/client') return { AiChatApiClient: Client, ApiClientError };
      if (name === './services/api/wx-transport') return { WxTransport: class {} };
      throw new Error('Unexpected dependency: ' + name);
    }
  };
  vm.runInNewContext(source, context);
  const api = context.module.exports;
  api.store.hydrate();
  api.initApiClient('http://127.0.0.1:8080', wx);
  return { api, calls, storage, wx, growth, modals, blockWrites: () => { writeBlocked = true; } };
}

function profilePage(api, wx, growth = { get: () => ({ results: {}, savedVoices: [] }), patch() {} }) {
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/profile/profile.js', import.meta.url), 'utf8'), {
    wx: { ...wx, showModal: options => options.success({ confirm: true }) },
    require(path) {
      if (path.endsWith('growth-store')) return { getGrowth: () => growth };
      if (path.endsWith('virtual-payment')) return { getVirtualPayment: () => ({}) };
      return api;
    },
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  return page;
}

function reportPage(api, client) {
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/report/report.js', import.meta.url), 'utf8'), {
    wx: {}, require: () => ({ ...api, getSessionBoundClient: () => client }),
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  return page;
}

test('退出期间到达的旧续期响应不能恢复已退出的身份', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { api, storage, wx } = app({ refreshGate: async () => { markStarted(); await pending; } });
  const recovery = api.ensureGuestSession();
  await started;
  profilePage(api, wx).logoutWechat();
  assert.equal(api.store.getState().session, null);
  release();
  await assert.rejects(recovery, /登录状态已变化/);
  assert.equal(api.store.getState().session, null);
  assert.equal(JSON.parse(storage.get(core.STORAGE_KEY)).session, null);
});

test('退出后报告页隐藏原会话内容，迟到的报告响应不能再次展示', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { api, wx } = app({ expired: false });
  const original = api.store.getState().session;
  api.store.setActiveTask({ taskId: 'old-task', reportId: 'old-report', fields: { observed_fact: '保留的草稿' } });
  const report = reportPage(api, { getFreeReportSummary: async () => {
    markStarted(); await pending;
    return { data: { free_summary: { confirmed_facts: ['旧会话私人内容'] } } };
  } });
  report.setData({ taskId: 'old-task', reportId: 'old-report', loading: true, demo: false, summary: { confirmed_facts: ['旧内容'] } });
  const reading = report.genReport();
  await started;
  profilePage(api, wx).logoutWechat();
  report.onShow();
  assert.equal(report.data.summary, null);
  release();
  await reading;
  assert.equal(report.data.summary, null);
  api.store.setSession(original);
  assert.equal(api.store.getState().activeTask.fields.observed_fact, '保留的草稿');
});

test('绑定等待应用配置时退出，不会为旧操作新建并绑定会话', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { api, wx, calls } = app({ configGate: async () => { markStarted(); await pending; } });
  let loginCalls = 0;
  const payment = createVirtualPayment({ wxApi: { ...wx, login: options => { loginCalls++; options.success({ code: 'mock' }); } },
    api: { bindWechatIdentity: async () => ({ data: { bound: true } }) }, state: { bound() {} },
    ensureSession: api.ensureGuestSession, getSession: () => api.store.getState().session,
    setSession: session => api.store.setSession(session) });
  const binding = payment.bind();
  await started;
  profilePage(api, wx).logoutWechat();
  release();
  await assert.rejects(binding, /登录状态已变化/);
  assert.equal(api.store.getState().session, null);
  assert.equal(loginCalls, 0);
  assert.equal(calls.includes('create'), false);
});

test('绑定等待微信登录时会话失效，不会把旧操作发送到新访客会话', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { api, wx, calls } = app({ expired: false, refreshError: { status: 401, code: 'AUTHENTICATION_REQUIRED' } });
  const payment = createVirtualPayment({ wxApi: { ...wx, login: async options => { markStarted(); await pending; options.success({ code: 'mock' }); } },
    api: api.getApiClient(), apiForOwner: id => api.getSessionBoundClient(id), state: { bound() {} },
    ensureSession: api.ensureGuestSession, getSession: () => api.store.getState().session,
    setSession: session => api.store.setSession(session) });
  const binding = payment.bind();
  await started;
  api.store.setSession({ ...api.store.getState().session, expiresAt: '2000-01-01T00:00:00Z' });
  release();
  await assert.rejects(binding, /登录状态已变化/);
  assert.equal(calls.some(call => String(call).startsWith('bind:')), false);
  assert.equal(api.store.getState().session.sessionId, 'visitor-new');
});

for (const expired of [false, true]) {
  test(`${expired ? '过期' : '有效'}待同意会话使用已确认的当前政策恢复后可继续使用`, async () => {
    const { api, calls } = app({ initialStatus: 'PENDING_CONSENT', refreshedStatus: 'PENDING_CONSENT', expired });
    assert.equal(await api.ensureGuestSession(), 'session-bound');
    assert.equal(api.store.getState().session.status, 'ACTIVE');
    assert.deepEqual(calls, expired ? ['config', 'refresh', 'consent'] : ['config', 'consent']);
  });
}

test('没有已确认的当前政策时，不伪造同意来恢复待同意会话', async () => {
  const { api, calls } = app({ initialStatus: 'PENDING_CONSENT', refreshedStatus: 'PENDING_CONSENT', confirmedConsent: false });
  await assert.rejects(api.ensureGuestSession(), /尚未确认当前政策/);
  assert.equal(api.store.getState().session.status, 'PENDING_CONSENT');
  assert.equal(calls.includes('consent'), false);
});

test('仅异常待同意且无记录时，用户确认后才能完成会话恢复', async () => {
  const { api, calls, storage, modals } = app({ initialStatus: 'PENDING_CONSENT', refreshedStatus: 'PENDING_CONSENT',
    confirmedConsent: false, confirmConsent: true });
  assert.equal(await api.ensureGuestSession(), 'session-bound');
  assert.deepEqual(calls, ['config', 'refresh', 'consent-dialog', 'consent']);
  assert.ok([...modals[0].confirmText].length <= 4);
  assert.equal(api.store.getState().session.status, 'ACTIVE');
  const saved = JSON.parse(storage.get(core.STORAGE_KEY));
  assert.equal(saved.consent.policyVersion, 'policy-current');
  assert.equal(saved.consent.adultConfirmed, true);
  assert.ok(saved.consent.acceptedAt > 0);
});

test('确认窗口等待期间退出，不能把确认结果写回旧会话', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { api, calls, storage, wx } = app({ initialStatus: 'PENDING_CONSENT', refreshedStatus: 'PENDING_CONSENT',
    confirmedConsent: false, confirmConsent: true, modalGate: async () => { markStarted(); await pending; } });
  const recovery = api.ensureGuestSession();
  await started;
  profilePage(api, wx).logoutWechat();
  release();
  await assert.rejects(recovery, /登录状态已变化/);
  assert.equal(calls.includes('consent'), false);
  assert.equal(api.store.getState().session, null);
  assert.equal(JSON.parse(storage.get(core.STORAGE_KEY)).session, null);
});

test('退出无法持久化时提示失败，不宣称已退出', () => {
  const { api, storage, wx, blockWrites } = app();
  const page = profilePage(api, wx);
  page.onShow();
  blockWrites();
  page.logoutWechat();
  assert.match(page.data.identityNotice, /退出失败/);
  assert.equal(api.store.getState().session.level, 'Principal');
  assert.equal(JSON.parse(storage.get(core.STORAGE_KEY)).session.level, 'Principal');
});

test('续期响应无法持久化时不报告身份已经恢复', async () => {
  const { api, storage, blockWrites } = app();
  blockWrites();
  await assert.rejects(api.ensureGuestSession(), /本机存储/);
  assert.equal(api.store.getState().session.accessToken, 'old-access');
  assert.equal(JSON.parse(storage.get(core.STORAGE_KEY)).session.accessToken, 'old-access');
});

test('退出清除身份派生的支付展示，但保留原订单线索', () => {
  const { api, wx, growth } = app();
  growth.get();
  growth.patch({ bound: true, paid: true, careerPaid: true, payment: 'success', order: { id: 'original-order' } });
  const page = profilePage(api, wx, growth);
  page.onShow();
  page.logoutWechat();
  assert.equal(api.store.getState().session, null);
  assert.equal(growth.get().bound, false);
  assert.equal(growth.get().paid, false);
  assert.equal(growth.get().careerPaid, false);
  assert.equal(growth.get().payment, 'pending');
  assert.equal(growth.get().order.id, 'original-order');
  assert.equal(page.data.growthStats.reports, 0);
});

test('原身份失效后切换访客，不沿用旧身份支付状态或丢失原订单线索', async () => {
  const { api, growth } = app({ refreshError: { status: 401, code: 'AUTHENTICATION_REQUIRED' } });
  growth.get();
  growth.patch({ bound: true, paid: true, careerPaid: true, payment: 'success', order: { id: 'original-order' } });
  await api.ensureGuestSession();
  assert.equal(api.store.getState().session.sessionId, 'visitor-new');
  assert.equal(growth.get().bound, false);
  assert.equal(growth.get().paid, false);
  assert.equal(growth.get().careerPaid, false);
  assert.equal(growth.get().order.id, 'original-order');
});

test('refresh 成功：直接采纳响应，不改绑身份、不新建会话', async () => {
  const { api, calls } = app();
  const sessionId = await api.ensureGuestSession();
  assert.equal(sessionId, 'session-bound');
  const session = api.store.getState().session;
  assert.equal(session.sessionId, 'session-bound');
  assert.equal(session.accessToken, 'fresh-access');
  assert.equal(session.refreshToken, 'fresh-refresh');
  assert.equal(session.level, 'Principal');
  assert.deepEqual(calls, ['config', 'refresh']);
});

test('refresh 收到 401（REVOKED/未知 token）：降级重建匿名会话', async () => {
  const { api, calls } = app({ refreshError: { status: 401, code: 'AUTHENTICATION_REQUIRED' } });
  const sessionId = await api.ensureGuestSession();
  assert.equal(sessionId, 'visitor-new');
  assert.deepEqual(calls, ['config', 'refresh', 'create', 'consent']);
  const session = api.store.getState().session;
  assert.equal(session.sessionId, 'visitor-new');
  assert.equal(session.level, 'Visitor');
  assert.equal(session.status, 'ACTIVE');
});

// 非 401 一律上抛：501 占位（历史静默分支）、5xx、网络异常
for (const scenario of [
  { name: '501 API_NOT_IMPLEMENTED（历史静默分支，必须上抛）', error: { status: 501, code: 'API_NOT_IMPLEMENTED' } },
  { name: '500 服务端故障', error: { status: 500, code: 'INTERNAL_ERROR' } },
  { name: '网络异常（非 ApiClientError）', error: new Error('request:fail timeout') }
]) {
  test(`refresh 非 401 失败原样上抛，不静默新建会话：${scenario.name}`, async () => {
    const { api, calls } = app({ refreshError: scenario.error });
    await assert.rejects(
      api.ensureGuestSession(),
      (error) => {
        assert.ok(error instanceof Error);
        if (scenario.error instanceof Error) return error.message === 'request:fail timeout';
        assert.equal(error.status, scenario.error.status);
        assert.equal(error.apiError.code, scenario.error.code);
        return true;
      }
    );
    assert.deepEqual(calls, ['config', 'refresh']);
    // 旧会话保持原样，未被新建会话覆盖
    const session = api.store.getState().session;
    assert.equal(session.sessionId, 'session-bound');
    assert.equal(session.accessToken, 'old-access');
    assert.equal(session.refreshToken, 'old-refresh');
  });
}
