// pages/experiences-confirm/experiences-confirm.js — 经历确认（V1.2 原型 confirm 屏）
// 本人确认只表示转述准确，不表示外部核验。
const { getGrowth } = require('../../growth-store');

Page({
  data: {
    experiences: []
  },

  onShow() {
    this.setData({
      experiences: getGrowth().get().experiences.map((item) => Object.assign({}, item))
    });
  },

  goBack() {
    wx.redirectTo({ url: '/pages/experiences/experiences', fail: () => wx.navigateBack() });
  },

  backToEdit() {
    wx.redirectTo({ url: '/pages/experiences/experiences' });
  },

  confirmExperiences() {
    getGrowth().confirmExperiences();
    wx.redirectTo({ url: '/pages/portrait/portrait' });
  }
});
