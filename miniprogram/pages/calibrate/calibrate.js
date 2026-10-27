// pages/calibrate/calibrate.js — 结果校准（V1.2 原型 calibrate 屏）
// 校准解释与个人经历，不静默改变测评得分；修订保留旧版。
const { getGrowth } = require('../../growth-store');

const TARGETS = ['优势的解释与适用条件', '对我经历的理解', '场景建议或行动', '使用我确认的新测评结果'];

Page({
  data: {
    targets: TARGETS,
    targetIndex: 0,
    text: '',
    calibrated: false,
    calibrationText: '',
    version: '1.0',
    expired: false
  },

  onShow() {
    const state = getGrowth().get();
    this.setData({
      calibrated: state.calibrated,
      calibrationText: state.calibrationText,
      version: state.version,
      expired: state.expired,
      text: state.calibrationText
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/growth-report/growth-report' }) });
  },

  onTargetChange(event) {
    this.setData({ targetIndex: Number(event.detail.value) });
  },

  onTextinput(event) {
    this.setData({ text: event.detail.value });
  },

  submit() {
    if (this.data.expired) return;
    if (!this.data.text.trim()) {
      wx.showToast({ title: '请先写下不符合的内容与实际情况', icon: 'none' });
      return;
    }
    getGrowth().submitCalibration(this.data.text);
    this.onShow();
    wx.showToast({ title: '修订版 v1.1 已保存，原版仍可查看', icon: 'none' });
  },

  openReport() {
    wx.redirectTo({ url: '/pages/growth-report/growth-report' });
  }
});
