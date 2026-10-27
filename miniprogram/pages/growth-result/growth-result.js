// pages/growth-result/growth-result.js — 免费基础结果（V1.2 原型 result 屏）
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function buildCover(toolId, typeCode) {
  if (toolId === 'mbti') {
    return {
      heading: typeCode === 'INFP' ? '细腻地理解，认真地回应。' : '你的偏好，有自己的模样。',
      sub: '偏好不是边界，类型也不是能力结论。'
    };
  }
  if (toolId === 'traits') {
    return {
      headingFirst: '你的性格，',
      headingSecond: '不止一个刻度。',
      sub: '用连续维度，看见程度差异。'
    };
  }
  return {
    headingFirst: '值得发展的优势，',
    headingSecond: '藏在你做过的事里。',
    sub: '从测评倾向出发，再回到真实经历。'
  };
}

Page({
  data: {
    toolId: 'mbti',
    toolShort: '16 型人格',
    isMbti: false,
    typeCode: 'INFP',
    cover: {},
    statement: '',
    sourceLabel: '',
    sourceName: '',
    sourceDate: '',
    sourceNote: '',
    dimensions: [],
    strengths: [],
    sectionTitle: ''
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    const growth = getGrowth();
    const state = growth.get();
    const tool = CONTENT.TOOLS[toolId];
    const source = state.sources[toolId] || {};
    const typeCode = growth.typeCode();
    const isMbti = toolId === 'mbti';
    const sourceLabel = source.kind === 'import' ? '本人录入 · 已确认' : '原型作答 · 演示结果';

    let dimensions = [];
    let strengths = [];
    let sectionTitle = '';
    if (isMbti) {
      sectionTitle = '四个维度的倾向';
      dimensions = CONTENT.MBTI_DIMENSIONS.map(([left, right, percent, note]) => ({ left, right, percent, note }));
    } else if (toolId === 'traits') {
      sectionTitle = '五个连续维度';
      dimensions = CONTENT.TRAIT_DIMENSIONS.map(([label, score, note]) => ({ label, score, note }));
    } else {
      sectionTitle = '值得探索的三个主题';
      strengths = CONTENT.STRENGTH_DATA.map(([name, desc, basis], index) => ({ index: index + 1, name, desc, basis }));
    }

    this.setData({
      toolId,
      toolShort: tool.short,
      isMbti,
      typeCode,
      cover: buildCover(toolId, typeCode),
      statement: isMbti && typeCode !== 'INFP'
        ? '已保留你录入的类型；以下维度为原型样例，仅展示页面结构，不代表已导入实际分数。'
        : tool.summary,
      sourceLabel,
      sourceName: source.name || '原型样例版本 v1',
      sourceDate: source.date || '2026-10-26',
      sourceNote: toolId === 'traits' ? '样例量表分，非人群百分位' : '原型数值，不作实际测评结论',
      dimensions,
      strengths,
      sectionTitle
    });
    wx.setNavigationBarTitle({ title: tool.short + '结果' });
  },

  goBack() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  exploreExperiences() {
    const confirmed = getGrowth().get().confirmed;
    wx.redirectTo({ url: confirmed ? '/pages/portrait/portrait' : '/pages/experiences/experiences' });
  },

  otherTests() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  shareResult() {
    getGrowth().patch({ posterKind: 'result', shareEntry: this.data.toolId });
    wx.navigateTo({ url: '/pages/growth-share/growth-share' });
  },

  retest() {
    getGrowth().resetTool(this.data.toolId);
    wx.redirectTo({ url: '/pages/growth-intro/growth-intro?tool=' + this.data.toolId });
  }
});
