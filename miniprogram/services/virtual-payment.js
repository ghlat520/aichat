// Personal virtual payment. Platform UI results are hints; only server receipts grant access.
function createVirtualPayment({ wxApi, api, apiForOwner = () => api, state, loadEntitlement, ensureSession, getSession, setSession }) {
  const data = response => {
    if (!response || !response.data) throw new Error('支付服务响应不完整，请查询原订单');
    return response.data;
  };
  const native = (method, options) => new Promise((resolve, reject) => {
    wxApi[method]({ ...options, success: resolve, fail: reject });
  });
  const requireSession = id => {
    const current = getSession();
    if (!id || !current || current.sessionId !== id) throw new Error('登录状态已变化，请重试');
    return current;
  };
  const ensureOwner = async () => {
    const id = await ensureSession();
    requireSession(id);
    return id;
  };
  const selectedOrder = () => typeof state.selectedOrderId === 'function' ? state.selectedOrderId() : null;
  const requireSelection = selected => {
    if (selected !== null && state.selectedOrderId() !== selected) throw new Error('订单已变化，请重新选择订单');
  };

  async function bind(purpose = 'payment') {
    const sessionId = await ensureOwner();
    const login = await native('login', {});
    if (!login.code) throw new Error('微信登录未完成，请重试');
    requireSession(sessionId);
    data(await apiForOwner(sessionId).bindWechatIdentity({ login_code: login.code, purpose }));
    setSession({ ...requireSession(sessionId), level: 'Principal' });
    state.bound();
  }

  async function quote(product, snapshot) {
    const owner = await ensureOwner();
    const result = data(await apiForOwner(owner).quoteVirtualPurchase({ product, snapshot }));
    requireSession(owner);
    return result;
  }

  async function getOrder(id) {
    const owner = await ensureOwner();
    const selected = selectedOrder();
    const order = data(await apiForOwner(owner).getVirtualOrder(id));
    requireSession(owner);
    requireSelection(selected);
    state.accept(order);
    return order;
  }

  async function query(id, expectedOwner) {
    const owner = await ensureOwner();
    if (expectedOwner && owner !== expectedOwner) throw new Error('登录状态已变化，请重试');
    const selected = selectedOrder();
    const order = data(await apiForOwner(owner).queryVirtualPayment(id));
    requireSession(owner);
    requireSelection(selected);
    state.accept(order);
    return order;
  }

  function assertSupported() {
    if (typeof wxApi.requestVirtualPayment !== 'function') throw new Error('当前微信版本不支持虚拟支付，请升级微信后再试');
    const system = wxApi.getSystemInfoSync();
    if (system.platform === 'ios') {
      const current = String(system.version || '').split('.').map(Number);
      const minimum = [8, 0, 68];
      let supported = current.length >= 3 && current.every(Number.isFinite);
      if (supported) for (let i = 0; i < 3; i++) {
        if (current[i] > minimum[i]) break;
        if (current[i] < minimum[i]) { supported = false; break; }
      }
      if (!supported) throw new Error('iOS 端需微信 8.0.68 及以上版本，请先更新微信');
    }
  }

  async function purchase({ product, snapshot, quote: approved }) {
    assertSupported();
    const owner = await ensureOwner();
    // The caller binds explicitly for payment; skip the second wx.login when the session already carries the identity.
    if (requireSession(owner).level !== 'Principal') await bind();
    requireSession(owner);
    const current = await quote(product, snapshot);
    requireSession(owner);
    if (!approved || approved.price_version !== current.price_version) throw new Error('报价已变化，请重新核对金额并确认');
    const order = current.existing_order || data(await apiForOwner(owner).createVirtualOrder({ product, snapshot, price_version: current.price_version,
      purchase_disclosure_version: current.purchase_disclosure_version, accepted: true }));
    requireSession(owner);
    state.accept(order);
    if (order.sku !== current.sku) return order;
    if (order.payment_state !== 'PENDING' || order.payment_started) return order;
    try {
      const options = { idempotencyKey: state.preparationKey(order.order_id) };
      let params;
      try { params = data(await apiForOwner(owner).prepareVirtualPayment(order.order_id, options)); }
      catch (error) {
        if (typeof error.status === 'number') throw error;
        requireSession(owner);
        // Native has not been invoked. Recover a lost HTTP response with the exact same command once.
        params = data(await apiForOwner(owner).prepareVirtualPayment(order.order_id, options));
      }
      requireSession(owner);
      try {
        await native('requestVirtualPayment', params);
      } catch (result) {
        requireSession(owner);
        // Cancellation and timeouts do not prove the platform order is unpaid or closed.
        state.notice(result.errMsg || '支付界面已返回，请查询原订单确认结果');
      }
      requireSession(owner);
      return await query(order.order_id, owner);
    } catch (error) {
      requireSession(owner);
      // The order already exists. Keep it visible so a network failure cannot cause a replacement charge.
      state.pending(error.message || error.errMsg || '支付状态暂时无法确认，请查询原订单');
      return order;
    }
  }

  async function readEntitlement(id) {
    const owner = await ensureOwner();
    const report = data(await loadEntitlement(id, owner));
    requireSession(owner);
    if (report.order.entitlement_state !== 'ACTIVE' || report.order.payment_state !== 'PAID' || report.order.refund_state !== 'NONE') throw new Error('购买权益尚未确认');
    state.accept(report.order);
    return report;
  }

  async function list(before) {
    const owner = await ensureOwner();
    const result = data(await apiForOwner(owner).listVirtualOrders(before ? { before } : {}));
    requireSession(owner);
    return result;
  }
  async function support(id, reason, detail) {
    const owner = await ensureOwner();
    const result = data(await apiForOwner(owner).requestVirtualPaymentSupport(id, { reason, detail }));
    requireSession(owner);
    return result;
  }
  return { assertSupported, bind, quote, purchase, query, getOrder, readEntitlement, list, support };
}

let singleton;
function getVirtualPayment() {
  if (!singleton) {
    const app = require('../app-store');
    const { getGrowth } = require('../growth-store');
    const growth = getGrowth();
    const api = app.getApiClient();
    const core = createVirtualPayment({ wxApi: wx, api, apiForOwner: app.getSessionBoundClient,
      state: { accept: growth.applyServerOrder, selectedOrderId: () => (growth.get().order || {}).id || '',
        bound: () => growth.patch({ bound: true }),
        notice: message => growth.patch({ paymentNotice: message }),
        pending: message => growth.patch({ payment: 'pending', paymentNotice: message }), preparationKey: growth.paymentPreparationKey },
      loadEntitlement: (id, owner) => app.getSessionBoundClient(owner).getPurchasedGrowthSnapshot(id),
      ensureSession: app.ensureGuestSession, getSession: () => app.store.getState().session,
      setSession: session => app.store.setSession(session) });
    singleton = { ...core, readReport: core.readEntitlement };
  }
  return singleton;
}
module.exports = { createVirtualPayment, getVirtualPayment };
