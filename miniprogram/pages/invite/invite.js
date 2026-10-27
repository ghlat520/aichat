// pages/invite/invite.js — 朋友点开后的页面（V1.2 原型 invite 屏）
// 接收方按分享参数或小程序码 scene 短标识定向进入：不继承分享者的私有经历或报告。
const { getGrowth, resolveInviteConfig } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    incoming: null,
    isComfort: false,
    isTopic: false,
    tool: CONTENT.TOOLS.mbti,
    comfort: null,
    pickLine: '',
    entryTag: ''
  },

  onLoad(query) {
    const incoming = resolveInviteConfig(query);
    const isComfort = incoming.kind === 'comfort' || incoming.entry === 'voices';
    const isTopic = !isComfort && incoming.kind === 'challenge';
    const tool = CONTENT.TOOLS[incoming.entry] || CONTENT.TOOLS.mbti;
    const comfort = isComfort ? (CONTENT.VOICE_STORIES[incoming.voice] || CONTENT.VOICE_STORIES.jobs) : null;
    this.setData({
      incoming,
      isComfort,
      isTopic,
      tool,
      comfort,
      pickLine: isTopic && incoming.pick ? `朋友选了${incoming.pick === 'uncertain' ? '"还不能确定"' : incoming.pick}，想听听你的想法。` : '',
      entryTag: incoming.entry === 'traits' ? '经典条目交互体验' : '6 题交互演示'
    });
    if (isComfort) getGrowth().patch({ voiceId: incoming.voice });
    wx.setNavigationBarTitle({ title: isComfort ? '朋友送来的一点力量' : '朋友分享' });
  },

  goBack() {
    wx.switchTab({ url: '/pages/entry/entry' });
  },

  startInvited() {
    const incoming = this.data.incoming;
    if (incoming.entry === 'voices') {
      getGrowth().patch({ voiceId: incoming.voice });
      wx.navigateTo({ url: '/pages/voice/voice?voice=' + incoming.voice });
      return;
    }
    getGrowth().patch({ currentTool: incoming.entry });
    wx.navigateTo({ url: '/pages/growth-question/growth-question?tool=' + incoming.entry });
  },

  invitedIntro() {
    const incoming = this.data.incoming;
    if (incoming.entry === 'voices') {
      wx.navigateTo({ url: '/pages/voices/voices' });
      return;
    }
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=' + incoming.entry });
  },

  goCelebrity() {
    wx.redirectTo({ url: '/pages/celebrity/celebrity' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  }
});
