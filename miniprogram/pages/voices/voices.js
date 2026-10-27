// pages/voices/voices.js — 借一点力量（V1.2 原型 voices 屏）
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function buildStories(mood, savedVoices) {
  return Object.keys(CONTENT.VOICE_STORIES)
    .filter((id) => {
      if (mood === '全部') return true;
      if (mood === '留给自己的') return savedVoices.includes(id);
      return CONTENT.VOICE_STORIES[id].moods.includes(mood);
    })
    .map((id) => {
      const story = CONTENT.VOICE_STORIES[id];
      return {
        id,
        initial: story.initial,
        name: story.name,
        mood: story.moods[0],
        tagColor: id === 'federer' ? 'gk-tag--pink' : id === 'bezos' ? 'gk-tag--aqua' : '',
        title: story.title,
        quote: story.quote,
        source: story.sourceLabel + ' · ' + story.quoteLabel
      };
    });
}

Page({
  data: {
    moods: CONTENT.VOICE_MOODS,
    mood: '全部',
    stories: []
  },

  onShow() {
    const state = getGrowth().get();
    this.setData({
      mood: state.voiceMood,
      stories: buildStories(state.voiceMood, state.savedVoices)
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  setMood(event) {
    const mood = event.currentTarget.dataset.mood;
    getGrowth().patch({ voiceMood: mood });
    this.setData({ mood, stories: buildStories(mood, getGrowth().get().savedVoices) });
  },

  openStory(event) {
    const id = event.currentTarget.dataset.id;
    getGrowth().setVoice(id);
    wx.navigateTo({ url: '/pages/voice/voice' });
  },

  allVoices() {
    this.setMood({ currentTarget: { dataset: { mood: '全部' } } });
  }
});
