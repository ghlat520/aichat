import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('./store-core.js');
const source = readFileSync(new URL('./app-store.js', import.meta.url), 'utf8');

function app({ expired = true, refreshRejected = false, refreshUnavailable = false, fresh = false, noConfig = false } = {}) {
  const calls = [];
  const session = { sessionId: 'visitor-old', accessToken: 'old-access', refreshToken: 'old-refresh', level: 'Visitor', expiresAt: expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z' };
  const consent = { policyVersion: 'policy-current', adultConfirmed: true, acceptedAt: 1 };
  const storage = new Map(fresh ? [] : [[core.STORAGE_KEY, JSON.stringify({ session, consent })]]);
  const wx = { getStorageSync: k => storage.get(k), setStorageSync: (k, v) => storage.set(k, v), removeStorageSync: k => storage.delete(k) };
  class ApiClientError extends Error {
    constructor(status, code) { super('需要有效身份凭证'); this.status = status; this.apiError = { code, message: this.message }; }
  }
  class Client {
    constructor(options) { this.provider = options.tokenProvider; }
    async getAppConfig() { calls.push('config'); return { data: { policy_version: 'policy-current', feature_flags: { venting: true, assessment: true } } }; }
    async refreshSessionToken() {
      calls.push('refresh');
      if (refreshRejected) throw new ApiClientError(401);
      if (refreshUnavailable) throw new ApiClientError(501, 'API_NOT_IMPLEMENTED');
      return { data: { session_id: 'visitor-old', access_token: 'fresh-access', refresh_token: 'fresh-refresh', auth_level: 'Visitor', expires_at: '2099-01-01T00:00:00Z' } };
    }
    async createVisitorSession() {
      calls.push('create');
      return { data: { session_id: 'visitor-new', access_token: 'fresh-access', refresh_token: 'fresh-refresh', auth_level: 'Visitor', expires_at: '2099-01-01T00:00:00Z' } };
    }
    async createVentSession(request) {
      assert.equal(request.policy_version, 'policy-current');
      calls.push('vent');
      return { data: { vent_session_id: 'vent-new', version: 1, ai_turns_used: 0, ai_turns_remaining: 8, max_ai_turns: 8 } };
    }
    async recordConsent(id, request) {
      const identity = await this.provider.getIdentity();
      assert.equal(identity.accessToken, 'fresh-access');
      assert.equal(request.policy_version, 'policy-current');
      calls.push('consent');
      return { data: { session_id: id } };
    }
    async getCurrentAssessment() {
      const identity = await this.provider.getIdentity();
      if (expired && identity.accessToken === 'old-access') throw new ApiClientError(401);
      return { data: { items: [1, 2, 3, 4, 5, 6, 7, 8] } };
    }
  }
  const context = { wx, module: { exports: {} }, setTimeout, require(name) {
    if (name === './store-core') return core;
    if (name === './services/api/generated/client') return { AiChatApiClient: Client, ApiClientError };
    if (name === './services/api/wx-transport') return { WxTransport: class {} };
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(source, context);
  const api = context.module.exports;
  api.store.hydrate();
  if (!noConfig) api.store.setAppConfig({ policy_version: 'policy-current', feature_flags: { assessment: true } });
  const client = api.initApiClient('http://127.0.0.1:8080', wx);
  function ventingPage() {
    let page;
    vm.runInNewContext(readFileSync(new URL('./pages/venting/venting.js', import.meta.url), 'utf8'), {
      require: () => api,
      Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
    });
    return page;
  }
  return { api, client, calls, ventingPage };
}

test('有效游客会话直接使用，不要求用户提供凭证', async () => {
  const { client, calls } = app({ expired: false });
  assert.equal((await client.getCurrentAssessment()).data.items.length, 8);
  assert.deepEqual(calls, []);
});

test('过期游客会话先续期，自测仍可直接进入', async () => {
  const { client, calls } = app();
  assert.equal((await client.getCurrentAssessment()).data.items.length, 8);
  assert.deepEqual(calls, ['refresh']);
});

test('旧刷新凭证失效时自动恢复匿名会话，沿用已确认的当前政策', async () => {
  const { api, client, calls } = app({ refreshRejected: true });
  assert.equal((await client.getCurrentAssessment()).data.items.length, 8);
  assert.deepEqual(calls, ['refresh', 'create', 'consent']);
  assert.equal(api.store.getState().session.sessionId, 'visitor-new');
  assert.equal(api.store.isFeatureEnabled('assessment'), true);
});

test('并行入口共享同一次匿名会话恢复', async () => {
  const { client, calls } = app({ refreshRejected: true });
  await Promise.all([client.getCurrentAssessment(), client.getCurrentAssessment()]);
  assert.deepEqual(calls, ['refresh', 'create', 'consent']);
});


test('首次直接进入功能无需首页初始化，也不要求用户提供身份凭证', async () => {
  const { api, client, calls } = app({ fresh: true, noConfig: true });
  assert.equal((await client.getCurrentAssessment()).data.items.length, 8);
  assert.deepEqual(calls, ['config', 'create', 'consent']);
  assert.equal(api.store.getState().session.sessionId, 'visitor-new');
});

for (const expired of [false, true]) {
  test(`${expired ? '过期' : '有效'}缓存会话冷启动可直接进入说一说`, async () => {
    const { calls, ventingPage } = app({ expired, noConfig: true });
    const page = ventingPage();
    await page.start();
    assert.equal(page.data.error, '');
    assert.equal(page.data.ventSessionId, 'vent-new');
    assert.deepEqual(calls, expired ? ['config', 'refresh', 'vent'] : ['config', 'vent']);
  });
}

test('当前后端续期接口未实现时，直接进入说一说自动建立新匿名会话', async () => {
  const { api, calls, ventingPage } = app({ refreshUnavailable: true, noConfig: true });
  const page = ventingPage();
  await page.start();
  assert.equal(page.data.error, '');
  assert.equal(page.data.ventSessionId, 'vent-new');
  assert.equal(api.store.getState().session.sessionId, 'visitor-new');
  assert.deepEqual(calls, ['config', 'refresh', 'create', 'consent', 'vent']);
});
