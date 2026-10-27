// pages/order/order.js — 订单与售后（V1.2 原型 order 屏升级）
// 原关系订单仍为 G6 stub；自我探索订单为本地模拟，申请与到账分开展示。
const { store, syncTabBar, goHome } = require('../../app-store');
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function money(n) {
  return Number(n).toFixed(2);
}

Page({
  data: {
    hasGrowthOrder: false,
    productLabel: '个人优势说明书',
    upgradeLabel: '订单实付',
    amount: '29.90',
    statusLabel: '已完成',
    refund: 'none',
    statusTone: 'aqua',
    deliveryText: '报告可查看',
    linkedBase: '',
    reasons: CONTENT.SUPPORT_REASONS,
    reason: '内容纠错',
    scopes: [{ id: 'upgrade', label: '仅处理升级部分' }, { id: 'all', label: '处理整套购买' }],
    scope: 'upgrade',
    scopeNote: '仅处理升级时，原基础报告与对应权益保留。',
    supportText: '',
    isCareerUpgrade: false,
    refundAmount: '0.00'
  },

  onShow() {
    syncTabBar(this, 3);
    this.refresh();
  },

  refresh() {
    const growth = getGrowth();
    const state = growth.get();
    const hasGrowthOrder = !!(state.order || state.paid || state.careerPaid || state.refund !== 'none');
    const refund = state.refund;
    const statusLabel = refund === 'refunded' ? '已退款'
      : refund === 'processing' ? '退款处理中'
      : refund === 'requested' ? '售后已提交'
      : state.payment === 'pending' ? '支付待确认'
      : state.payment === 'delivery' ? '已付款 · 交付处理中'
      : (state.paid || state.careerPaid) ? '已完成' : '未完成购买';
    const isCareerUpgrade = state.product === 'career' && state.paid;
    const amount = state.order ? state.order.amount : growth.reportPrice();
    this.setData({
      hasGrowthOrder,
      productLabel: state.product === 'career' ? '职业探索报告' : '个人优势说明书',
      upgradeLabel: isCareerUpgrade ? '升级实付' : '订单实付',
      amount: money(amount),
      statusLabel,
      statusTone: refund === 'refunded' ? 'gray' : 'aqua',
      refund,
      deliveryText: refund === 'refunded' ? '对应付费内容已撤销'
        : state.payment === 'pending' ? '付款确认后解锁'
        : state.payment === 'delivery' ? '正在恢复交付'
        : '报告可查看',
      linkedBase: isCareerUpgrade ? `¥${money(state.baseNet)} · 独立保留` : '',
      reason: state.supportReason || this.data.reason,
      scope: state.refundScope,
      scopeNote: state.refundScope === 'all'
        ? `涉及两笔实际交易：基础 ¥${money(state.baseNet)} + 升级 ¥${money(amount)}`
        : '仅处理升级时，原基础报告与对应权益保留。',
      supportText: state.supportText,
      isCareerUpgrade,
      refundAmount: money(state.refundAmount || amount)
    });
  },

  goHome,

  goReports() {
    wx.navigateTo({ url: '/pages/reports/reports' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  queryOrder() {
    getGrowth().settlePayment('success');
    wx.showToast({ title: '演示查单已确认，报告已解锁', icon: 'none' });
    this.refresh();
  },

  setReason(event) {
    getGrowth().patch({ supportReason: event.currentTarget.dataset.reason });
    this.setData({ reason: event.currentTarget.dataset.reason });
  },

  setScope(event) {
    getGrowth().patch({ refundScope: event.currentTarget.dataset.scope });
    this.refresh();
  },

  onSupportInput(event) {
    getGrowth().patch({ supportText: event.detail.value });
    this.setData({ supportText: event.detail.value });
  },

  submitSupport() {
    if (!this.data.supportText.trim()) {
      wx.showToast({ title: '请简单写下遇到的问题', icon: 'none' });
      return;
    }
    getGrowth().submitSupport(this.data.reason, this.data.supportText);
    this.refresh();
    wx.showToast({ title: '售后申请已提交，可在这里查看进度', icon: 'none' });
  },

  advanceRefund() {
    getGrowth().advanceRefund();
    this.refresh();
  }
});
