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
let apiOptions = null;

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

function requireCurrentSession(session) {
  if (store.getState().session !== session) throw new Error('登录状态已变化，请重试');
}

function resetIdentityDisplay() {
  const growth = require('./growth-store').getGrowth();
  growth.patch({ bound: false, paid: false, careerPaid: false,
    payment: growth.get().order ? 'pending' : 'none', paymentNotice: '' });
}

async function finishPendingConsent(session) {
  const config = await ensureAppConfig();
  requireCurrentSession(session);
  let consent = store.getState().consent;
  if (!consent || !consent.adultConfirmed || !consent.acceptedAt || consent.policyVersion !== config.policy_version) {
    const confirmed = await new Promise((resolve, reject) => wx.showModal({
      title: '确认后继续',
      content: '当前会话尚未完成确认。请确认已年满 18 周岁，并同意当前版本的隐私政策（' + config.policy_version + '）。',
      confirmText: '同意继续',
      cancelText: '暂不',
      success: result => resolve(!!result.confirm),
      fail: () => reject(new Error('无法打开确认窗口，请重试'))
    }));
    requireCurrentSession(session);
    if (!confirmed) throw new Error('尚未确认当前政策，无法恢复会话');
    consent = { policyVersion: config.policy_version, adultConfirmed: true, acceptedAt: Date.now() };
    store.setConsent(consent);
  }
  await sessionClient.recordConsent(session.sessionId, {
    policy_version: consent.policyVersion,
    adult_confirmed: true,
    accepted: true
  });
  requireCurrentSession(session);
  store.setSession({ ...session, status: 'ACTIVE' });
}

async function recoverGuestSession() {
  const previous = store.getState();
  if (previous.session && previous.session.status === 'PENDING_CONSENT'
      && Number.isFinite(Date.parse(previous.session.expiresAt)) && Date.parse(previous.session.expiresAt) > Date.now()) {
    await finishPendingConsent(previous.session);
    return;
  }
  if (previous.session && previous.session.refreshToken) {
    let refreshed;
    try {
      refreshed = await sessionClient.refreshSessionToken();
      requireCurrentSession(previous.session);
    } catch (error) {
      requireCurrentSession(previous.session);
      // 服务端 refresh 已实装：仅 401（REVOKED/未知 refresh token）降级新建匿名会话，
      // 其余失败（5xx/网络/未预期状态码）原样上抛，避免把真实故障误吞成身份降级。
      if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
    }
    if (refreshed) {
      const session = sessionFromResponse(refreshed.data);
      store.setSession(session);
      if (session.status === 'PENDING_CONSENT') await finishPendingConsent(session);
      return;
    }
  }
  const config = await ensureAppConfig();
  requireCurrentSession(previous.session);
  const created = await sessionClient.createVisitorSession({ client_instance_id: getClientInstanceId() });
  requireCurrentSession(previous.session);
  const session = sessionFromResponse(created.data);
  store.setSession(session);
  resetIdentityDisplay();
  try {
    await sessionClient.recordConsent(session.sessionId, {
      policy_version: config.policy_version,
      adult_confirmed: true,
      accepted: true
    });
    requireCurrentSession(session);
  } catch (error) {
    if (store.getState().session === session) store.setSession(previous.session);
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
    if (!session || !session.accessToken || session.status === 'PENDING_CONSENT'
        || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) {
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
  apiOptions = options;
  // 会话恢复自身使用原始 provider，避免确认匿名会话时等待自己。
  sessionClient = new AiChatApiClient({ ...options, tokenProvider: storedTokenProvider });
  apiClient = new AiChatApiClient({ ...options, tokenProvider });
  return apiClient;
}

function getApiClient() {
  return apiClient;
}

function getSessionBoundClient(sessionId) {
  const requireOwner = () => {
    if (!sessionId || (store.getState().session || {}).sessionId !== sessionId) {
      throw new Error('登录状态已变化，请重试');
    }
  };
  if (!apiOptions) throw new Error('服务尚未初始化');
  return new AiChatApiClient({ ...apiOptions, tokenProvider: {
    async getIdentity() {
      requireOwner();
      const identity = await tokenProvider.getIdentity();
      requireOwner();
      return identity;
    },
    async getRefreshToken() {
      requireOwner();
      return storedTokenProvider.getRefreshToken();
    }
  } });
}

async function ensureGuestSession() {
  const logoutVersion = store.getLogoutVersion();
  await ensureAppConfig();
  if (store.getLogoutVersion() !== logoutVersion) throw new Error('登录状态已变化，请重试');
  await tokenProvider.getIdentity();
  if (store.getLogoutVersion() !== logoutVersion) throw new Error('登录状态已变化，请重试');
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
  getSessionBoundClient,
  ensureGuestSession,
  getClientInstanceId,
  sessionFromResponse,
  resetIdentityDisplay,
  syncTabBar,
  goHome,
  ApiClientError,
  friendlyError,
  ensureEntryUnlocked,
  routeToSafetyIfBlocked
};
