// pages/portrait/portrait.js — 综合画像（V1.2 原型 portrait 屏）
// 区分测评结果、本人陈述和待验证的优势候选；MBTI 可选，未完成明确显示未纳入。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    missing: true,
    missingText: '',
    inputs: [],
    hasMbti: false,
    goalsText: '',
    strengths: [],
    canReadBase: false
  },

  onShow() {
    const growth = getGrowth();
    const state = growth.get();
    const ready = growth.ready();
    const missingText = !state.results.traits
      ? '还缺性格特质结果。'
      : !state.results.strengths
        ? '还缺优势测评结果。'
        : !state.confirmed
          ? '再补充并确认两段经历，报告才有足够的个人依据。'
          : '请先选择一个当前应用目标。';
    this.setData({
      missing: !ready,
      missingText,
      hasMbti: !!state.results.mbti,
      goalsText: state.goals.length ? state.goals.join('、') : '待选择',
      inputs: [
        { id: 'traits', name: '性格特质结果', done: !!state.results.traits, desc: '查看连续维度与基础解释' },
        { id: 'strengths', name: '优势测评结果', done: !!state.results.strengths, desc: '查看测评提供的优势主题' },
        { id: 'experiences', name: '两段本人确认的经历', done: !!state.confirmed, desc: `${state.confirmed ? '已确认' : '待补充或确认'} · 由你亲自陈述` }
      ],
      strengths: CONTENT.STRENGTH_DATA.map(([name, desc, basis], index) => ({
        index: index + 1,
        name,
        desc,
        basis: state.confirmed ? basis : '来自示例测评倾向，补充并确认经历后可进一步核对。',
        tagColor: index === 0 ? 'gk-tag--aqua' : index === 1 ? '' : 'gk-tag--pink'
      })),
      canReadBase: growth.canReadBase()
    });
  },

  goBack() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  openInput(event) {
    const id = event.currentTarget.dataset.id;
    const done = event.currentTarget.dataset.done === 'true' || event.currentTarget.dataset.done === true;
    if (id === 'experiences') {
      wx.navigateTo({ url: '/pages/experiences/experiences' });
      return;
    }
    wx.navigateTo({
      url: done ? '/pages/growth-result/growth-result?tool=' + id : '/pages/growth-intro/growth-intro?tool=' + id
    });
  },

  freePractice() {
    wx.showToast({ title: '已记下：下次协作前，用一句话确认共同目标。', icon: 'none' });
  },

  completeInput() {
    const state = getGrowth().get();
    if (!state.results.traits) {
      wx.redirectTo({ url: '/pages/growth-intro/growth-intro?tool=traits' });
      return;
    }
    if (!state.results.strengths) {
      wx.redirectTo({ url: '/pages/growth-intro/growth-intro?tool=strengths' });
      return;
    }
    wx.redirectTo({ url: '/pages/experiences/experiences' });
  },

  generatePreview() {
    const growth = getGrowth();
    if (!growth.ready()) {
      this.completeInput();
      return;
    }
    growth.patch({ previewState: 'preparing' });
    wx.navigateTo({ url: '/pages/report-preview/report-preview' });
  },

  openReport() {
    wx.navigateTo({ url: '/pages/growth-report/growth-report' });
  },

  goCareer() {
    wx.navigateTo({ url: '/pages/career/career' });
  }
});
