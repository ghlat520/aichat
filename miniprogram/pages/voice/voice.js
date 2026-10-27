// pages/voice/voice.js — 他们走过的路（V1.2 原型 voice 屏）
// 原话、经历概述和编辑提示分开表达；笔记默认不进入海报。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    voice: CONTENT.VOICE_STORIES.jobs,
    saved: false,
    note: '',
    decision: '',
    decisionNote: ''
  },

  onLoad(query) {
    const growth = getGrowth();
    if (query && query.voice && CONTENT.VOICE_STORIES[query.voice]) {
      growth.setVoice(query.voice);
    }
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const growth = getGrowth();
    const state = growth.get();
    const voice = growth.currentVoiceStory();
    this.setData({
      voice,
      saved: state.savedVoices.includes(state.voiceId),
      note: state.voiceNotes[state.voiceId] || '',
      decision: state.voiceDecision,
      decisionNote: state.voiceDecision === 'yes'
        ? '选一个小范围、可调整的尝试，再给自己一个回头看看它的时间。'
        : state.voiceDecision === 'unsure'
          ? '先写下最想弄清的一件事。找一个你信任的人聊聊，也可以让问题慢慢清楚一点。'
          : ''
    });
    wx.setNavigationBarTitle({ title: '他们走过的路' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.navigateTo({ url: '/pages/voices/voices' }) });
  },

  onNoteInput(event) {
    getGrowth().saveVoiceNote(getGrowth().get().voiceId, event.detail.value);
  },

  setDecision(event) {
    const decision = event.currentTarget.dataset.decision;
    getGrowth().patch({ voiceDecision: decision });
    this.setData({ decision, decisionNote: decision === 'yes'
      ? '选一个小范围、可调整的尝试，再给自己一个回头看看它的时间。'
      : '先写下最想弄清的一件事。找一个你信任的人聊聊，也可以让问题慢慢清楚一点。' });
  },

  saveVoice() {
    getGrowth().saveVoice(getGrowth().get().voiceId);
    this.setData({ saved: true });
    wx.showToast({ title: '这句话和你的笔记，已留在本次体验里', icon: 'none' });
  },

  voiceShare() {
    const growth = getGrowth();
    growth.patch({ posterKind: 'comfort', shareEntry: 'voices' });
    wx.navigateTo({ url: '/pages/growth-share/growth-share' });
  },

  voiceSource() {
    const voice = getGrowth().currentVoiceStory();
    wx.showModal({
      title: '原话与这段经历的出处',
      content: `${voice.name}\n${voice.sourceLabel}\n\n原文片段：\n"${voice.english}"\n\n页面中的中文引语已标明${voice.quoteLabel}；故事为概述。"给此刻的你"的内容是编辑整理的应用提示。\n\n原始来源：${voice.source}`,
      showCancel: false,
      confirmText: '复制原文链接',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: voice.source });
        }
      }
    });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  }
});
