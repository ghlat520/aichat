// pages/entry/entry.js — 首页（V1.2 严格对齐原型 home 屏）
// 首页只加载展示配置；临时会话由 API 层按需建立。
const { store, getApiClient, ApiClientError, syncTabBar } = require('../../app-store');

Page({
  data: {
    loading: true,
    error: '',
    productName: ''
  },

  onLoad() {
    this.loadAppConfig();
  },

  onShow() {
    syncTabBar(this, 0);
  },

  async loadAppConfig() {
    const client = getApiClient();
    try {
      const resp = await client.getAppConfig();
      const cfg = resp.data;
      store.setAppConfig(cfg);
      this.setData({ loading: false, productName: cfg.product_name });
    } catch (e) {
      this.setData({ loading: false, error: this.friendlyError(e) });
    }
  },

  goAssessment() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  goClarity() {
    wx.navigateTo({ url: '/pages/clarity-edit/clarity-edit?entry=direct' });
  },

  goVenting() {
    wx.switchTab({ url: '/pages/venting/venting' });
  },

  goReports() {
    wx.navigateTo({ url: '/pages/reports/reports' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  friendlyError(e) {
    if (e instanceof ApiClientError) {
      return e.apiError.message || '请求失败';
    }
    return (e && e.message) || '网络异常，请稍后重试';
  }
});
