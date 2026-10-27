// pages/celebrity/celebrity.js — 猜名人偏好（V1.2 原型 celebrity 屏）
// 类型选择为讨论假设，没有已确认的名人 MBTI 答案；猜想不进入本人测评计分。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    options: CONTENT.CELEBRITY.options,
    vote: null
  },

  onShow() {
    this.setData({ vote: getGrowth().get().socialVote });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  choose(event) {
    const vote = event.currentTarget.dataset.id;
    getGrowth().patch({ socialVote: vote });
    wx.redirectTo({ url: '/pages/celebrity-insight/celebrity-insight' });
  },

  goIntro() {
    getGrowth().patch({ currentTool: 'mbti' });
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=mbti' });
  }
});
