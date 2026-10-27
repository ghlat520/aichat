// Personal virtual payment. Platform UI results are hints; only server receipts grant access.
function createVirtualPayment({ wxApi, api, state, loadEntitlement, ensureSession, getSession, setSession }) {
  const data = response => {
    if (!response || !response.data) throw new Error('支付服务响应不完整，请查询原订单');
    return response.data;
  };
  const native = (method, options) => new Promise((resolve, reject) => {
    wxApi[method]({ ...options, success: resolve, fail: reject });
  });

  async function bind() {
    await ensureSession();
    const login = await native('login', {});
    if (!login.code) throw new Error('微信登录未完成，请重试');
    data(await api.bindWechatIdentity({ login_code: login.code, purpose: 'payment' }));
    setSession({ ...getSession(), level: 'Principal' });
    state.bound();
  }

  async function quote(product, snapshot) {
    await ensureSession();
    return data(await api.quoteVirtualPurchase({ product, snapshot }));
  }

  async function getOrder(id) {
    const order = data(await api.getVirtualOrder(id));
    state.accept(order);
    return order;
  }

  async function query(id) {
    const order = data(await api.queryVirtualPayment(id));
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
    await bind();
    const current = await quote(product, snapshot);
    if (!approved || approved.price_version !== current.price_version) throw new Error('报价已变化，请重新核对金额并确认');
    const order = current.existing_order || data(await api.createVirtualOrder({ product, snapshot, price_version: current.price_version,
      purchase_disclosure_version: current.purchase_disclosure_version, accepted: true }));
    state.accept(order);
    if (order.sku !== current.sku) return order;
    if (order.payment_state !== 'PENDING' || order.payment_started) return order;
    try {
      const options = { idempotencyKey: state.preparationKey(order.order_id) };
      let params;
      try { params = data(await api.prepareVirtualPayment(order.order_id, options)); }
      catch (error) {
        if (typeof error.status === 'number') throw error;
        // Native has not been invoked. Recover a lost HTTP response with the exact same command once.
        params = data(await api.prepareVirtualPayment(order.order_id, options));
      }
      try {
        await native('requestVirtualPayment', params);
      } catch (result) {
        // Cancellation and timeouts do not prove the platform order is unpaid or closed.
        state.notice(result.errMsg || '支付界面已返回，请查询原订单确认结果');
      }
      return await query(order.order_id);
    } catch (error) {
      // The order already exists. Keep it visible so a network failure cannot cause a replacement charge.
      state.pending(error.message || error.errMsg || '支付状态暂时无法确认，请查询原订单');
      return order;
    }
  }

  async function readEntitlement(id) {
    const report = data(await loadEntitlement(id));
    if (report.order.entitlement_state !== 'ACTIVE' || report.order.payment_state !== 'PAID' || report.order.refund_state !== 'NONE') throw new Error('购买权益尚未确认');
    state.accept(report.order);
    return report;
  }

  async function list(before) { return data(await api.listVirtualOrders(before ? { before } : {})); }
  async function support(id, reason, detail) { return data(await api.requestVirtualPaymentSupport(id, { reason, detail })); }
  return { assertSupported, bind, quote, purchase, query, getOrder, readEntitlement, list, support };
}

let singleton;
function getVirtualPayment() {
  if (!singleton) {
    const app = require('../app-store');
    const { getGrowth } = require('../growth-store');
    const growth = getGrowth();
    const api = app.getApiClient();
    const core = createVirtualPayment({ wxApi: wx, api,
      state: { accept: growth.applyServerOrder, bound: () => growth.patch({ bound: true }),
        notice: message => growth.patch({ paymentNotice: message }),
        pending: message => growth.patch({ payment: 'pending', paymentNotice: message }), preparationKey: growth.paymentPreparationKey },
      loadEntitlement: id => api.getPurchasedGrowthSnapshot(id),
      ensureSession: app.ensureGuestSession, getSession: () => app.store.getState().session,
      setSession: session => app.store.setSession(session) });
    singleton = { ...core, readReport: core.readEntitlement };
  }
  return singleton;
}
module.exports = { createVirtualPayment, getVirtualPayment };
