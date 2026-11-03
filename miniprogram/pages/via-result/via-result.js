// pages/via-result/via-result.js — VIA 免费基础结果（2026-11-03 原型 V2 via-result 屏）
// 三题均分排序：Top 5 + 完整 24 项；样例（preview）与实际作答独立，浏览样例不写入完成记录。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

Page({
  data: {
    demo: true,
    modeNote: '',
    topFive: [],
    ranking: [],
    complete: false,
    secondaryLabel: ''
  },

  onLoad() {
    const growth = getGrowth();
    const complete = growth.viaComplete();
    const via = growth.get().via || {};
    const demo = !!via.preview || !complete;
    const scores = growth.viaRanked(demo);
    const fmt = (score) => (Math.round(score * 100) / 100).toFixed(2);
    this.setData({
      demo,
      complete,
      modeNote: demo
        ? '结果排版样例 · 非你的作答结果，未写入个人进度。'
        : '根据本轮 72 个答案计算：每项 3 题取均分，按高到低排列。',
      topFive: scores.slice(0, 5).map((item, n) => ({
        rank: n + 1,
        zh: item.zh,
        en: item.en,
        d: item.d,
        score: fmt(item.score)
      })),
      ranking: scores.map((item, n) => ({
        no: (n + 1 < 10 ? '0' + (n + 1) : '' + (n + 1)),
        zh: item.zh,
        en: item.en,
        score: fmt(item.score),
        percent: Math.round((item.score - 1) / 4 * 100)
      })),
      secondaryLabel: demo ? (complete ? '回到我的本轮结果' : '开始我的 72 题自评') : '回看我的作答'
    });
    wx.setNavigationBarTitle({ title: 'VIA 性格优势结果' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  goCross() {
    wx.navigateTo({ url: '/pages/via-mbti/via-mbti' });
  },

  goTypes() {
    wx.navigateTo({ url: '/pages/mbti-types/mbti-types' });
  },

  secondaryAction() {
    if (this.data.demo && this.data.complete) {
      getGrowth().viaPatch({ preview: false });
      wx.redirectTo({ url: '/pages/via-result/via-result' });
      return;
    }
    if (this.data.demo) {
      wx.redirectTo({ url: '/pages/via-question/via-question' });
      return;
    }
    wx.redirectTo({ url: '/pages/via-question/via-question?q=1' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  }
});
