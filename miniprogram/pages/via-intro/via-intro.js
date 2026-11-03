// pages/via-intro/via-intro.js — VIA 性格优势介绍（2026-11-03 原型 V2 via-intro 屏）
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    note: CONTENT.VIA_NOTE,
    answered: 0,
    total: 72,
    complete: false,
    startLabel: '开始 VIA 性格优势自评',
    virtues: CONTENT.VIA_GROUPS.map((group) => ({
      name: group.v,
      count: group.items.length
    }))
  },

  onLoad() {
    const growth = getGrowth();
    const answered = growth.viaAnsweredCount();
    this.setData({
      answered,
      total: growth.viaTotal(),
      complete: growth.viaComplete(),
      startLabel: answered > 0 ? '继续作答 · ' + answered + ' / 72 题' : '开始 VIA 性格优势自评'
    });
  },

  onShow() {
    this.onLoad();
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  start() {
    const growth = getGrowth();
    growth.viaPatch({ preview: false });
    const missing = growth.viaFirstMissing();
    if (missing >= 0) growth.viaPatch({ index: missing });
    wx.navigateTo({ url: '/pages/via-question/via-question' });
  },

  viewPersonal() {
    getGrowth().viaPatch({ preview: false });
    wx.navigateTo({ url: '/pages/via-result/via-result' });
  },

  viewSample() {
    getGrowth().viaPatch({ preview: true });
    wx.navigateTo({ url: '/pages/via-result/via-result' });
  }
});
