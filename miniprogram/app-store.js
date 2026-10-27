// app-store.js — 组合 store-core（纯逻辑）+ API client + tokenProvider
// store-core 零依赖可单测；本文件注入微信运行时和生成的 client。
const { createStore } = require('./store-core');
const { AiChatApiClient, ApiClientError } = require('./services/api/generated/client');
const { WxTransport } = require('./services/api/wx-transport');

// 创建 store 实例（注入 wx storage）
const store = createStore(wx);

// tokenProvider：给 AiChatApiClient 注入 Opaque Token
const storedTokenProvider = {
  async getIdentity() {
    const s = store.getState().session;
    if (!s || !s.accessToken) {
      return undefined;
    }
    return { accessToken: s.accessToken, level: s.level || 'Visitor' };
  },
  async getRefreshToken() {
    const s = store.getState().session;
    return s ? s.refreshToken : undefined;
  }
};

let apiClient = null;
let sessionClient = null;
let sessionRecovery = null;

function sessionFromResponse(data) {
  return {
    sessionId: String(data.session_id || ''),
    accessToken: String(data.access_token || ''),
    refreshToken: String(data.refresh_token || ''),
    level: data.auth_level || 'Visitor',
    expiresAt: data.expires_at || null,
    tokenType: data.token_type || 'Bearer',
    status: data.status || 'PENDING_CONSENT'
  };
}

function getClientInstanceId() {
  let id = wx.getStorageSync('aichat_client_instance_id');
  if (!id || id.length < 16) {
    id = 'ci-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    wx.setStorageSync('aichat_client_instance_id', id);
  }
  return id;
}

async function ensureAppConfig() {
  let config = store.getState().appConfig;
  if (!config || !config.policy_version) {
    config = (await sessionClient.getAppConfig()).data;
    store.setAppConfig(config);
  }
  return config;
}

async function recoverGuestSession() {
  const previous = store.getState();
  if (previous.session && previous.session.refreshToken) {
    try {
      const refreshed = await sessionClient.refreshSessionToken();
      store.setSession(sessionFromResponse(refreshed.data));
      return;
    } catch (error) {
      // 当前服务的续期端点仍是契约占位；使用已接入的匿名会话创建路径。
      const unsupported = error instanceof ApiClientError && error.status === 501 && error.apiError.code === 'API_NOT_IMPLEMENTED';
      if (!(error instanceof ApiClientError) || (error.status !== 401 && !unsupported)) throw error;
    }
  }
  const config = await ensureAppConfig();
  const created = await sessionClient.createVisitorSession({ client_instance_id: getClientInstanceId() });
  const session = sessionFromResponse(created.data);
  store.setSession(session);
  try {
    await sessionClient.recordConsent(session.sessionId, {
      policy_version: config.policy_version,
      adult_confirmed: true,
      accepted: true
    });
  } catch (error) {
    store.setSession(previous.session);
    throw error;
  }
  store.setSession({ ...session, status: 'ACTIVE' });
  store.setConsent({ policyVersion: config.policy_version, adultConfirmed: true, acceptedAt: Date.now() });
  store.setAssessment(null);
  store.setActiveTask(null);
  store.setVenting(null);
}

const tokenProvider = {
  async getIdentity() {
    if (sessionRecovery) await sessionRecovery;
    const session = store.getState().session;
    if (!session || !session.accessToken || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) {
      if (!sessionRecovery) {
        sessionRecovery = recoverGuestSession().finally(() => { sessionRecovery = null; });
      }
      await sessionRecovery;
    }
    return storedTokenProvider.getIdentity();
  },
  getRefreshToken: storedTokenProvider.getRefreshToken
};

function initApiClient(apiBaseUrl, wxApi) {
  const options = {
    apiBaseUrl,
    transport: new WxTransport(wxApi),
    idempotencyKeyFactory: () => 'mp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12)
  };
  // 会话恢复自身使用原始 provider，避免确认匿名会话时等待自己。
  sessionClient = new AiChatApiClient({ ...options, tokenProvider: storedTokenProvider });
  apiClient = new AiChatApiClient({ ...options, tokenProvider });
  return apiClient;
}

function getApiClient() {
  return apiClient;
}

async function ensureGuestSession() {
  await ensureAppConfig();
  await tokenProvider.getIdentity();
  return (store.getState().session || {}).sessionId;
}

function syncTabBar(page, selected) {
  const tabBar = typeof page.getTabBar === 'function' && page.getTabBar();
  if (tabBar) tabBar.setData({ selected });
}

function goHome() {
  wx.switchTab({ url: '/pages/entry/entry' });
}

function friendlyError(error) {
  if (error instanceof ApiClientError) {
    return (error.apiError && error.apiError.message) || '请求失败';
  }
  return (error && error.message) || '网络异常，请稍后重试';
}

function ensureEntryUnlocked() {
  // V1.2 起移除边界闸：页面直达；保留函数以兼容既有页面与 E2E 引用
  return true;
}

function routeToSafetyIfBlocked(data) {
  const safety = data && data.safety;
  if (!safety || safety.route !== 'BLOCK') {
    return false;
  }
  const ids = Array.isArray(safety.resource_ids) ? safety.resource_ids.join(',') : '';
  const suffix = ids ? '?resourceIds=' + encodeURIComponent(ids) : '';
  wx.reLaunch({ url: '/pages/safety/safety' + suffix });
  return true;
}

module.exports = {
  store,
  initApiClient,
  getApiClient,
  ensureGuestSession,
  getClientInstanceId,
  sessionFromResponse,
  syncTabBar,
  goHome,
  ApiClientError,
  friendlyError,
  ensureEntryUnlocked,
  routeToSafetyIfBlocked
};
