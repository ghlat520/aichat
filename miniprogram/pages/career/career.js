// pages/career/career.js — 职业探索输入（V1.2 原型 career 屏，第二期）
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function money(n) {
  return Number(n).toFixed(2);
}

Page({
  data: {
    interests: CONTENT.CAREER_INTERESTS,
    values: CONTENT.CAREER_VALUES,
    selectedInterests: [],
    selectedValues: [],
    skills: '',
    goal: '',
    time: '',
    constraints: '',
    paid: false,
    careerPaid: false,
    upgradeLabel: ''
  },

  onShow() {
    const state = getGrowth().get();
    this.setData({
      selectedInterests: state.careerInterest,
      selectedValues: state.careerValues,
      skills: state.skills,
      goal: state.careerGoal,
      time: state.careerTime,
      constraints: state.careerConstraints,
      paid: state.paid,
      careerPaid: state.careerPaid,
      upgradeLabel: state.paid
        ? `查看职业报告预览 · 预计补差 ¥${money(Math.max(0, 49.9 - state.baseNet))}`
        : '查看职业报告预览 · ¥49.90'
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/growth-report/growth-report' }) });
  },

  toggleInterest(event) {
    this.toggleList('careerInterest', 'selectedInterests', event.currentTarget.dataset.item);
  },

  toggleValue(event) {
    this.toggleList('careerValues', 'selectedValues', event.currentTarget.dataset.item);
  },

  toggleList(field, uiField, item) {
    const state = getGrowth().get();
    const list = state[field].slice();
    const pos = list.indexOf(item);
    if (pos < 0) list.push(item);
    else list.splice(pos, 1);
    getGrowth().patch({ [field]: list });
    this.setData({ [uiField]: list });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.f;
    const value = event.detail.value;
    getGrowth().patch({ [field]: value });
    this.setData({ [field]: value });
  },

  careerPreview() {
    const data = this.data;
    if (!data.skills.trim() || !data.goal.trim() || !data.selectedInterests.length || !data.selectedValues.length) {
      wx.showToast({ title: '再补充兴趣、价值观、技能和当前目标，就可以继续', icon: 'none' });
      return;
    }
    getGrowth().patch({ careerReady: true });
    wx.redirectTo({ url: '/pages/career-report/career-report' });
  }
});
