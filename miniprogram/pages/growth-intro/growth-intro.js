// pages/growth-intro/growth-intro.js — 测评介绍（V1.2 原型 intro 屏；MBTI 分支按 2026-11-02 原型）
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    toolId: 'mbti',
    tool: CONTENT.TOOLS.mbti,
    answered: 0,
    total: CONTENT.QUESTIONS.mbti.length,
    isClassic: false,
    isMbti: true,
    startLabel: '开始 MBTI 性格测试',
    mbti: {
      description: CONTENT.MBTI_INTRO_DESCRIPTION,
      facts: [
        { value: '40 题', note: '每个维度 10 题' },
        { value: '一题一页', note: '选择后自动切换' },
        { value: '可暂停', note: '返回后继续作答' }
      ],
      dimensions: CONTENT.MBTI_GROUPS.map((group, index) => ({
        index: index + 1,
        title: group.title,
        note: group.note,
        code: group.code
      })),
      simpleNote: '按平时的自己选择即可。选中圆圈后会着色、打勾，再自动进入下一题；可以返回修改。'
    }
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    const growth = getGrowth();
    const state = growth.get();
    const tool = CONTENT.TOOLS[toolId];
    const titleLines = tool.title.split('\n');
    const introLines = tool.intro.split('\n');
    const answered = toolId === 'mbti' ? growth.answeredCount(toolId) : (state.answers[toolId] || []).length;
    this.setData({
      toolId,
      tool: Object.assign({}, tool, {
        titleFirst: titleLines[0] || '',
        titleSecond: titleLines[1] || '',
        introFirst: introLines[0] || '',
        introSecond: introLines[1] || ''
      }),
      answered,
      total: CONTENT.QUESTIONS[toolId].length,
      isClassic: toolId === 'traits',
      isMbti: toolId === 'mbti',
      startLabel: answered > 0 ? '继续 MBTI 性格测试' : '开始 MBTI 性格测试'
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

  openSample() {
    wx.navigateTo({ url: '/pages/growth-result/growth-result?tool=mbti&sample=1' });
  },

  openImport() {
    wx.navigateTo({ url: '/pages/growth-import/growth-import?tool=' + this.data.toolId });
  }
});
