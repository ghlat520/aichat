// pages/growth-reflection/growth-reflection.js — 7 天行动复盘（V1.2 原型 reflection 屏）
// 提交实际行动与结果，而非强制打卡；过期后仍保留报告与历史。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    action: CONTENT.ACTION_DATA[0],
    reflected: false,
    expired: false,
    actionStarted: false,
    reviewText: '',
    reviewOutcome: '',
    reviewNext: ''
  },

  onShow() {
    const state = getGrowth().get();
    this.setData({
      action: CONTENT.ACTION_DATA[state.selectedAction] || CONTENT.ACTION_DATA[0],
      reflected: state.reflected,
      expired: state.expired,
      actionStarted: state.actionStarted,
      reviewText: state.reviewText,
      reviewOutcome: state.reviewOutcome,
      reviewNext: state.reviewNext
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/growth-report/growth-report' }) });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.f;
    this.setData({ [field]: event.detail.value });
  },

  submit() {
    if (this.data.expired) return;
    if (!this.data.reviewText.trim() || !this.data.reviewOutcome.trim()) {
      wx.showToast({ title: '请写下实际尝试和发生的变化', icon: 'none' });
      return;
    }
    getGrowth().submitReflection({
      reviewText: this.data.reviewText,
      reviewOutcome: this.data.reviewOutcome,
      reviewNext: this.data.reviewNext
    });
    this.setData({ reflected: true });
    wx.showToast({ title: '这次行动复盘已保存', icon: 'none' });
  },

  backToReport() {
    wx.redirectTo({ url: '/pages/growth-report/growth-report' });
  }
});
