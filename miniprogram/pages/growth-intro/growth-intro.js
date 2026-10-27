// pages/growth-intro/growth-intro.js — 测评介绍（V1.2 原型 intro 屏）
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    toolId: 'mbti',
    tool: CONTENT.TOOLS.mbti,
    answered: 0,
    total: 6,
    isClassic: false
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    const growth = getGrowth();
    const state = growth.get();
    const tool = CONTENT.TOOLS[toolId];
    const titleLines = tool.title.split('\n');
    const introLines = tool.intro.split('\n');
    this.setData({
      toolId,
      tool: Object.assign({}, tool, {
        titleFirst: titleLines[0] || '',
        titleSecond: titleLines[1] || '',
        introFirst: introLines[0] || '',
        introSecond: introLines[1] || ''
      }),
      answered: (state.answers[toolId] || []).length,
      total: CONTENT.QUESTIONS[toolId].length,
      isClassic: toolId === 'traits'
    });
    growth.patch({ currentTool: toolId });
    wx.setNavigationBarTitle({ title: CONTENT.TOOLS[toolId].short });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  startTest() {
    wx.navigateTo({ url: '/pages/growth-question/growth-question?tool=' + this.data.toolId });
  },

  openImport() {
    wx.navigateTo({ url: '/pages/growth-import/growth-import?tool=' + this.data.toolId });
  }
});
