const { goHome: goPreviewHome } = require('../../app-store');
// support.js — 售后工单（G5）
// 本轮为 stub：G5 后端接口未实现，Client 层捕获 501 显示"功能开发中"
const { store, getApiClient, ApiClientError } = require('../../app-store');
const friendly = (e) => (e instanceof ApiClientError ? (e.apiError.message || '请求失败') : ((e && e.message) || '网络异常'));

Page({
  goHome: goPreviewHome,
  // INV-01 路由守卫：未完成 18+ 同意拒绝进入（safety 页除外）
  guard() {
    if (!store.isEntryUnlocked()) {
      wx.reLaunch({ url: '/pages/entry/entry' });
      return false;
    }
    return true;
  },

  // G5：售后工单 —— 本轮后端 501
  data: { stub: true, error: '' },
  onLoad() { if (!this.guard()) return; },

  onShow() {
    // INV-01 兜底守卫：onLoad 的 reLaunch 有竞态，onShow 阶段再次确认
    if (!store.isEntryUnlocked()) {
      wx.reLaunch({ url: '/pages/entry/entry' });
    }
  },
  async tryCreate() { try { await getApiClient().createSupportTicket({}); } catch (e) { if (e && e.status === 501) { this.setData({ error: '售后工单功能开发中（G5）' }); } else { this.setData({ error: friendly(e) }); } } }
});
