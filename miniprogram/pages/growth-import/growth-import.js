// pages/growth-import/growth-import.js — 使用已有结果（V1.2 原型 import 屏）
// 录入结果保留来源与日期，标记为"本人录入"，不伪装成平台作答。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    toolId: 'mbti',
    isMbti: false,
    types: CONTENT.MBTI_TYPES,
    typeIndex: 0,
    sourceName: '我的已有测评',
    version: '未知',
    date: '2026-10-26',
    confirmed: false,
    showError: false
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    this.setData({ toolId, isMbti: toolId === 'mbti' });
    wx.setNavigationBarTitle({ title: '使用已有结果' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/growth-intro/growth-intro?tool=' + this.data.toolId }) });
  },

  onTypeChange(event) {
    this.setData({ typeIndex: Number(event.detail.value) });
  },

  onSourceInput(event) {
    this.setData({ sourceName: event.detail.value });
  },

  onVersionInput(event) {
    this.setData({ version: event.detail.value });
  },

  onDateChange(event) {
    this.setData({ date: event.detail.value });
  },

  toggleConfirm(event) {
    this.setData({ confirmed: !!event.detail.value.length, showError: false });
  },

  confirmImport() {
    if (!this.data.confirmed) {
      this.setData({ showError: true });
      return;
    }
    const growth = getGrowth();
    growth.completeTool(this.data.toolId, 'import', {
      kind: 'import',
      name: this.data.sourceName + ' · ' + this.data.version,
      date: this.data.date,
      type: this.data.isMbti ? this.data.types[this.data.typeIndex] : undefined
    });
    wx.showToast({ title: '已按本人录入保留结果来源', icon: 'none' });
    wx.redirectTo({ url: '/pages/growth-result/growth-result?tool=' + this.data.toolId });
  }
});
