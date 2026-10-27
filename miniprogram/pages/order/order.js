const { syncTabBar, friendlyError } = require('../../app-store');
const { getGrowth } = require('../../growth-store');
const { getVirtualPayment } = require('../../services/virtual-payment');
const CONTENT = require('../../growth-content');
Page({
  data: { hasGrowthOrder: false, orders: [], orderId: '', date: '', amount: '--', productLabel: '',
    statusLabel: '', deliveryText: '', refund: 'none', refundAmount: '0.00', reasons: CONTENT.SUPPORT_REASONS,
    reason: '内容纠错', supportText: '', notice: '', busy: false, linkedBase: '', nextCursor: null },
  onShow() { syncTabBar(this, 3); this.refresh(); },
  async refresh() {
    const order = getGrowth().get().order;
    if (order && order.id) {
      try { await getVirtualPayment().getOrder(order.id); this.render(); }
      catch (error) { this.setData({ notice: friendlyError(error) }); }
    }
    try { const result = await getVirtualPayment().list(); this.setData({ orders: this.rows(result.items), nextCursor: result.next_cursor }); }
    catch (error) { if (!order) this.setData({ notice: '微信登录后可恢复原订单。' }); }
  },
  rows(items) { return items.map(order => ({ ...order, label: order.sku === 'base' ? '个人优势说明书' : '职业探索报告', amount: (order.price_fen / 100).toFixed(2) })); },
  render() {
    const state = getGrowth().get(); const order = state.order;
    if (!order) return;
    this.setData({ hasGrowthOrder: true, orderId: order.id, date: order.created_at.slice(0, 10),
      productLabel: order.product === 'career' ? '职业探索报告' : '个人优势说明书', amount: (order.price_fen / 100).toFixed(2),
      statusLabel: order.refund_state === 'COMPLETED' ? '已退款' : order.refund_state === 'PARTIAL' ? '部分退款已确认'
        : order.refund_state === 'PROCESSING' ? '退款结果待确认' : order.payment_state === 'PAID' ? '付款已确认'
        : order.payment_state === 'CLOSED' ? '订单已关闭' : '支付待确认',
      deliveryText: order.entitlement_state === 'ACTIVE' && order.refund_state === 'NONE' ? '报告权益有效'
        : order.entitlement_state === 'REVOKED' ? '对应权益已撤销' : order.entitlement_state === 'SUSPENDED' ? '权益已暂停，请联系售后' : '付款确认后解锁',
      refund: state.refund, refundAmount: (order.refunded_fen / 100).toFixed(2), linkedBase: order.base_order_id || '',
      supportText: state.supportText, reason: state.supportReason, notice: '' });
  },
  async restoreOrders() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await getVirtualPayment().bind();
      const result = await getVirtualPayment().list();
      this.setData({ orders: this.rows(result.items), nextCursor: result.next_cursor, notice: '' });
      if (result.items.length) { getGrowth().applyServerOrder(result.items[0]); this.render(); }
    } catch (error) { this.setData({ notice: friendlyError(error) }); }
    finally { this.setData({ busy: false }); }
  },
  async moreOrders() {
    try { const result = await getVirtualPayment().list(this.data.nextCursor);
      this.setData({ orders: this.data.orders.concat(this.rows(result.items)), nextCursor: result.next_cursor }); }
    catch (error) { this.setData({ notice: friendlyError(error) }); }
  },
  async selectOrder(event) {
    try { await getVirtualPayment().getOrder(event.currentTarget.dataset.id); this.render(); }
    catch (error) { this.setData({ notice: friendlyError(error) }); }
  },
  async queryOrder() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try { await getVirtualPayment().query(getGrowth().get().order.id); this.render(); }
    catch (error) { this.setData({ notice: friendlyError(error) }); }
    finally { this.setData({ busy: false }); }
  },
  setReason(event) { getGrowth().patch({ supportReason: event.currentTarget.dataset.reason }); this.setData({ reason: event.currentTarget.dataset.reason }); },
  onSupportInput(event) { getGrowth().patch({ supportText: event.detail.value }); this.setData({ supportText: event.detail.value }); },
  async submitSupport() {
    if (!this.data.supportText.trim() || this.data.busy) return;
    this.setData({ busy: true });
    try {
      const result = await getVirtualPayment().support(getGrowth().get().order.id, this.data.reason, this.data.supportText);
      getGrowth().submitSupport(this.data.reason, this.data.supportText);
      this.setData({ notice: result.message });
    } catch (error) { this.setData({ notice: friendlyError(error) }); }
    finally { this.setData({ busy: false }); }
  },
  openReport() {
    const order = getGrowth().get().order;
    wx.navigateTo({ url: (order.product === 'career' ? '/pages/career-report/career-report' : '/pages/growth-report/growth-report') + '?orderId=' + encodeURIComponent(order.id) });
  },
  goReports() { wx.navigateTo({ url: '/pages/reports/reports' }); },
  goDiscover() { wx.switchTab({ url: '/pages/assessment/assessment' }); }
});
