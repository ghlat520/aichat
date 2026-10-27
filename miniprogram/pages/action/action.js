const { goHome: goPreviewHome } = require('../../app-store');
// action.js — 行动计划（G5）
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

  // G5：48h 行动 —— 本轮后端 501
  data: { stub: true, taskId: '', error: '' },
  onLoad(q) { if (!this.guard()) return; this.setData({ taskId: q.taskId || '' }); },

  onShow() {
    if (!store.isEntryUnlocked()) {
      wx.reLaunch({ url: '/pages/entry/entry' });
    }
  },
  async trySave() { try { await getApiClient().putTaskAction(this.data.taskId, {}); } catch (e) { if (e && e.status === 501) { this.setData({ error: '行动计划功能开发中（G5）' }); } else { this.setData({ error: friendly(e) }); } } }
});
