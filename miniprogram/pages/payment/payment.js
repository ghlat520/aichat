// pages/payment/payment.js — 支付与交付状态（V1.2 原型 payment 屏）
// 待确认、成功、取消、失败、交付中分别展示；状态未知时不诱导重复支付。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function money(n) {
  return Number(n).toFixed(2);
}

Page({
  data: {
    payment: 'pending',
    view: CONTENT.PAYMENT_STATES.pending,
    descLines: [],
    productLabel: '个人优势说明书',
    upgradeLabel: '本次金额',
    amount: '29.90',
    orderId: '1026',
    deliveryText: '付款确认后解锁'
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const growth = getGrowth();
    const state = growth.get();
    const payment = state.payment;
    if (!CONTENT.PAYMENT_STATES[payment]) {
      wx.redirectTo({ url: '/pages/portrait/portrait' });
      return;
    }
    const view = CONTENT.PAYMENT_STATES[payment];
    this.setData({
      payment,
      view,
      descLines: view.desc.split('\n'),
      productLabel: state.product === 'career' ? '职业探索报告' : '个人优势说明书',
      upgradeLabel: state.product === 'career' && state.paid ? '本次补差' : '本次金额',
      amount: money(state.order ? state.order.amount : growth.reportPrice()),
      orderId: state.order ? state.order.id : '1026',
      deliveryText: payment === 'success' ? '已就绪' : payment === 'delivery' ? '处理中' : '付款确认后解锁'
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/reports/reports' }) });
  },

  queryOrder() {
    getGrowth().settlePayment('success');
    wx.showToast({ title: '演示查单已确认，报告已解锁', icon: 'none' });
    this.refresh();
  },

  viewReport() {
    wx.redirectTo({
      url: getGrowth().get().product === 'career' ? '/pages/career-report/career-report' : '/pages/growth-report/growth-report'
    });
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order/order' });
  },

  backToCheckout() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/checkout/checkout' }) });
  },

  goReports() {
    wx.redirectTo({ url: '/pages/reports/reports' });
  }
});
