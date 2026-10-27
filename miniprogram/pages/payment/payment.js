const { getGrowth } = require('../../growth-store');
const { getVirtualPayment } = require('../../services/virtual-payment');
const { friendlyError } = require('../../app-store');
const CONTENT = require('../../growth-content');

Page({
  data: { payment: 'pending', view: CONTENT.PAYMENT_STATES.pending, descLines: [], productLabel: '',
    upgradeLabel: '本次金额', amount: '--', orderId: '', deliveryText: '付款确认后解锁', notice: '', busy: false, canResume: false },
  async onShow() {
    const order = getGrowth().get().order;
    if (!order || !order.id) { wx.redirectTo({ url: '/pages/reports/reports' }); return; }
    this.setData({ payment: 'pending', view: CONTENT.PAYMENT_STATES.pending, canResume: false });
    try { await getVirtualPayment().getOrder(order.id); this.refresh(); }
    catch (error) { this.setData({ notice: friendlyError(error), descLines: CONTENT.PAYMENT_STATES.pending.desc.split('\n') }); }
  },
  refresh() {
    const state = getGrowth().get();
    const order = state.order;
    const view = CONTENT.PAYMENT_STATES[state.payment] || CONTENT.PAYMENT_STATES.pending;
    this.setData({ payment: state.payment, view, descLines: view.desc.split('\n'), notice: state.paymentNotice || '',
      canResume: order.payment_state === 'PENDING' && order.payment_started === false && order.refund_state === 'NONE',
      productLabel: order.product === 'career' ? '职业探索报告' : '个人优势说明书',
      upgradeLabel: order.upgrade ? '本次补差' : '本次金额', amount: (order.price_fen / 100).toFixed(2),
      orderId: order.id, deliveryText: state.payment === 'success' ? '有效权益已确认'
        : order.entitlement_state === 'SUSPENDED' || order.entitlement_state === 'REVOKED' ? '权益暂停或已撤销，请查看售后' : '付款确认后解锁' });
  },
  async queryOrder() {
    if (this.data.busy) return;
    this.setData({ busy: true, notice: '' });
    try { await getVirtualPayment().query(getGrowth().get().order.id); this.refresh(); }
    catch (error) { this.setData({ notice: friendlyError(error) }); }
    finally { this.setData({ busy: false }); }
  },
  viewReport() {
    const order = getGrowth().get().order;
    wx.redirectTo({ url: (order.product === 'career' ? '/pages/career-report/career-report' : '/pages/growth-report/growth-report')
      + '?orderId=' + encodeURIComponent(order.id) });
  },
  goBack() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/reports/reports' }) }); },
  goOrder() { wx.navigateTo({ url: '/pages/order/order' }); },
  backToCheckout() { wx.redirectTo({ url: '/pages/checkout/checkout' }); },
  goReports() { wx.redirectTo({ url: '/pages/reports/reports' }); }
});
