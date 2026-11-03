// pages/growth-result/growth-result.js — 免费基础结果
// MBTI 分支：2026-11-02 原型 resultPage——固定 ENTP 排版样例（不计分），
// 十二章节 + 可折叠目录；traits / strengths 保持 V1.2 通用结果。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function buildCover(toolId) {
  if (toolId === 'traits') {
    return {
      headingFirst: '你的性格，',
      headingSecond: '不止一个刻度。',
      sub: '用连续维度，看见程度差异。'
    };
  }
  if (toolId === 'strengths') {
    return {
      headingFirst: '值得发展的优势，',
      headingSecond: '藏在你做过的事里。',
      sub: '从测评倾向出发，再回到真实经历。'
    };
  }
  return {}; // MBTI 分支使用固定 ENTP 封面，不渲染通用封面
}

Page({
  data: {
    toolId: 'mbti',
    toolShort: CONTENT.TOOLS.mbti.short,
    isMbti: true,
    cover: {},
    statement: '',
    sourceLabel: '',
    sourceName: '',
    sourceDate: '',
    sourceNote: '',
    dimensions: [],
    strengths: [],
    sectionTitle: '',
    mbtiNotice: CONTENT.MBTI_RESULT_NOTICE,
    mbtiCover: CONTENT.MBTI_RESULT_COVER,
    mbtiBoundary: CONTENT.MBTI_RESULT_BOUNDARY,
    radar: CONTENT.MBTI_RESULT_RADAR,
    brief: CONTENT.MBTI_REPORT_SECTIONS[0].paragraphs[0],
    sections: CONTENT.MBTI_REPORT_SECTIONS,
    directoryOpen: false
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    const growth = getGrowth();
    const state = growth.get();
    const tool = CONTENT.TOOLS[toolId];
    const source = state.sources[toolId] || {};
    const isMbti = toolId === 'mbti';
    const sourceLabel = source.kind === 'import' ? '本人录入 · 已确认' : '原型作答 · 演示结果';

    let dimensions = [];
    let strengths = [];
    let sectionTitle = '';
    if (isMbti) {
      // MBTI 结果按原型固定 ENTP 样例展示，不再渲染四维样例条
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
      cover: buildCover(toolId),
      statement: tool.summary,
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

  toggleDirectory() {
    this.setData({ directoryOpen: !this.data.directoryOpen });
  },

  jumpSection(event) {
    const id = event.currentTarget.dataset.id;
    wx.pageScrollTo({
      selector: '#mbti-sec-' + id,
      offsetTop: -20,
      duration: 300,
      fail: () => {}
    });
  },

  backToQuestion() {
    // redirectTo 替换当前层：答题→结果反复往返不叠加页面栈（避免 10 层上限）
    wx.redirectTo({ url: '/pages/growth-question/growth-question?tool=mbti' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
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
