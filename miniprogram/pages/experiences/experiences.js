// pages/experiences/experiences.js — 个人经历（V1.2 原型 experiences 屏）
// 两步填写：一次写一段；情境、行动、结果各一句话；能量感受选填。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    mode: 'guided',
    index: 0,
    prompt: '协作顺利的一次',
    prompts: CONTENT.EXPERIENCE_PROMPTS,
    energyWords: CONTENT.ENERGY_WORDS,
    goals: CONTENT.GOAL_OPTIONS,
    selectedGoals: [],
    experiences: [],
    formError: '',
    energyOpen: [false, false]
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const state = getGrowth().get();
    this.setData({
      mode: state.experienceMode,
      index: state.experienceIndex,
      prompt: state.experiencePrompt,
      selectedGoals: state.goals,
      experiences: state.experiences.map((item) => Object.assign({}, item, {
        energyList: item.energy ? item.energy.split('；').filter(Boolean) : []
      })),
      formError: ''
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/portrait/portrait' }) });
  },

  setMode(event) {
    getGrowth().patch({ experienceMode: event.currentTarget.dataset.mode });
    this.setData({ mode: event.currentTarget.dataset.mode, formError: '' });
  },

  setStep(event) {
    const index = Number(event.currentTarget.dataset.step);
    getGrowth().patch({ experienceIndex: index });
    this.setData({ index, formError: '' });
  },

  setPrompt(event) {
    const prompt = event.currentTarget.dataset.prompt;
    getGrowth().patch({ experiencePrompt: prompt });
    this.setData({ prompt });
  },

  onExpInput(event) {
    const index = Number(event.currentTarget.dataset.i);
    const field = event.currentTarget.dataset.f;
    getGrowth().setExperience(index, field, event.detail.value);
    const key = `experiences[${index}].${field}`;
    this.setData({ [key]: event.detail.value });
  },

  toggleEnergy(event) {
    const index = Number(event.currentTarget.dataset.i);
    const word = event.currentTarget.dataset.word;
    getGrowth().toggleExperienceEnergy(index, word);
    const energy = getGrowth().get().experiences[index].energy;
    this.setData({
      [`experiences[${index}].energy`]: energy,
      [`experiences[${index}].energyList`]: energy ? energy.split('；').filter(Boolean) : []
    });
  },

  toggleEnergyOpen(event) {
    const index = Number(event.currentTarget.dataset.i);
    const open = this.data.energyOpen.slice();
    open[index] = !open[index];
    this.setData({ energyOpen: open });
  },

  toggleGoal(event) {
    const goal = event.currentTarget.dataset.goal;
    const state = getGrowth().get();
    const goals = state.goals.slice();
    const pos = goals.indexOf(goal);
    if (pos < 0) goals.push(goal);
    else goals.splice(pos, 1);
    getGrowth().patch({ goals });
    this.setData({ selectedGoals: goals });
  },

  nextExperience() {
    const current = getGrowth().get().experiences[this.data.index];
    if (!current.event.trim() || !current.action.trim() || !current.result.trim()) {
      this.setData({ formError: '先补齐这一段的情境、行动和结果。每项一句话就可以。' });
      return;
    }
    getGrowth().patch({ experienceIndex: 1 });
    this.setData({ index: 1, formError: '' });
  },

  prepareExperiences() {
    const growth = getGrowth();
    if (!growth.hasExperiences()) {
      this.setData({ formError: '请补齐两段经历的情境、行动和结果。可以先用示例体验。' });
      return;
    }
    if (!growth.get().goals.length) {
      this.setData({ formError: '请至少选择一个当前应用目标。' });
      return;
    }
    wx.redirectTo({ url: '/pages/experiences-confirm/experiences-confirm' });
  },

  fillExamples() {
    getGrowth().fillExamples();
    this.refresh();
    wx.showToast({ title: '已填入两段示例经历，可继续编辑', icon: 'none' });
  }
});
