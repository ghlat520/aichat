// pages/celebrity-insight/celebrity-insight.js — 公开线索与自测（V1.2 原型 celebrity-insight 屏）
// 公开事实、编辑解读与无法判断的部分分开展示；猜想后桥接到用户自己的免费测评。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    voteLabel: '',
    insight: CONTENT.CELEBRITY.insight
  },

  onShow() {
    const vote = getGrowth().get().socialVote;
    this.setData({
      voteLabel: vote ? `你的猜想：${vote === 'uncertain' ? '还不能确定' : vote}` : '先看看公开材料'
    });
  },

  goBack() {
    wx.redirectTo({ url: '/pages/celebrity/celebrity', fail: () => wx.navigateBack() });
  },

  startOwnPreferences() {
    getGrowth().patch({ currentTool: 'mbti' });
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=mbti' });
  },

  startClassicTraits() {
    getGrowth().patch({ currentTool: 'traits' });
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=traits' });
  },

  muskSource() {
    wx.showModal({
      title: '这条观察的公开来源',
      content: 'Elon Musk，2006 年 8 月 2 日，Tesla 署名文章。本文描述长期能源目标与分阶段车型规划，可作为讨论工作表达方式的材料。\n\n这篇材料没有提供他的 MBTI 测评结果。页面里的类型选择属于用户猜想。\n\n原文：' + CONTENT.MUSK_SOURCE,
      showCancel: false,
      confirmText: '复制原文链接',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: CONTENT.MUSK_SOURCE });
        }
      }
    });
  },

  topicShare() {
    getGrowth().patch({ posterKind: 'challenge', shareEntry: 'mbti' });
    wx.navigateTo({ url: '/pages/growth-share/growth-share' });
  }
});
