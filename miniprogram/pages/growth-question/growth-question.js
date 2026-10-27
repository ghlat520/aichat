// pages/growth-question/growth-question.js — 答题与续答（V1.2 原型 question 屏）
// 一屏一题、整行选项、可关自动前进、上一题与暂停保留；本地保存，进度持久化。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

const AUTO_NEXT_DELAY = 220;

Page({
  data: {
    toolId: 'mbti',
    toolShort: '16 型人格',
    isClassic: false,
    question: '',
    options: [],
    index: 0,
    total: 6,
    selected: 0,
    autoNext: true,
    sheet: '',
    savedCount: 0
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    this.toolId = toolId;
    this.applyState();
    wx.setNavigationBarTitle({ title: CONTENT.TOOLS[toolId].short });
  },

  onShow() {
    this.applyState();
  },

  onHide() {
    this.cancelAutoNext();
  },

  onUnload() {
    this.cancelAutoNext();
  },

  cancelAutoNext() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
  },

  applyState(nextIndex) {
    const growth = getGrowth();
    const state = growth.get();
    const index = typeof nextIndex === 'number' ? nextIndex : growth.resumeIndex(this.toolId);
    const labels = this.toolId === 'traits' ? CONTENT.ANSWER_LABELS_CLASSIC : CONTENT.ANSWER_LABELS_AGREE;
    this.setData({
      toolId: this.toolId,
      toolShort: CONTENT.TOOLS[this.toolId].short,
      isClassic: this.toolId === 'traits',
      question: CONTENT.QUESTIONS[this.toolId][index],
      options: labels.map((label, i) => ({ value: i + 1, label })),
      index,
      total: CONTENT.QUESTIONS[this.toolId].length,
      selected: growth.savedChoice(this.toolId, index),
      autoNext: state.autoNext
    });
  },

  goBack() {
    this.cancelAutoNext();
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  choose(event) {
    const value = Number(event.currentTarget.dataset.value);
    this.setData({ selected: value });
    if (this.data.autoNext) {
      if (this.autoTimer) clearTimeout(this.autoTimer);
      const snapshot = { index: this.data.index };
      this.autoTimer = setTimeout(() => {
        if (this.data.index === snapshot.index) this.save();
      }, AUTO_NEXT_DELAY);
    }
  },

  save() {
    this.cancelAutoNext();
    if (!this.data.selected) return;
    const growth = getGrowth();
    const { finished } = growth.saveAnswer(this.toolId, this.data.index, this.data.selected);
    if (finished) {
      growth.completeTool(this.toolId, 'native');
      wx.redirectTo({ url: '/pages/growth-result/growth-result?tool=' + this.toolId });
      return;
    }
    this.applyState(this.data.index + 1);
  },

  previous() {
    this.cancelAutoNext();
    if (this.data.index === 0) return;
    const growth = getGrowth();
    const index = this.data.index - 1;
    this.setData({
      index,
      question: CONTENT.QUESTIONS[this.toolId][index],
      selected: growth.savedChoice(this.toolId, index)
    });
  },

  toggleAutoNext(event) {
    this.cancelAutoNext();
    getGrowth().setAutoNext(!!event.detail.value.length);
    this.setData({ autoNext: !!event.detail.value.length });
  },

  pause() {
    this.cancelAutoNext();
    this.setData({ sheet: 'pause', savedCount: (getGrowth().get().answers[this.toolId] || []).length });
  },

  closeSheet() {
    this.setData({ sheet: '' });
  },

  keepProgress() {
    this.closeSheet();
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  classicSource() {
    this.cancelAutoNext();
    this.setData({ sheet: 'source' });
  },

  copyClassicSource() {
    wx.setClipboardData({ data: CONTENT.CLASSIC_SOURCE });
  },

  preventScroll() {}
});
