// pages/mbti-types/mbti-types.js — MBTI 16 型优缺点（2026-11-03 原型 V2 mbti-types 屏）
// 参考阅读不产生测评记录；支持看自己/看 TA 视角、分组筛选与带类型互跳。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

const GROUP_CHIPS = [{ code: 'all', label: '全部' }].concat(
  Object.keys(CONTENT.MBTI_TYPE_GROUPS).map((code) => ({
    code,
    label: CONTENT.MBTI_TYPE_GROUPS[code] + ' ' + code
  }))
);

Page({
  data: {
    mode: 'self',
    group: 'all',
    filter: 'all',
    filterOptions: [],
    groupChips: GROUP_CHIPS,
    cards: [],
    visibleCount: 16,
    guidance: ''
  },

  onLoad(query) {
    const code = query && query.code;
    const filter = CONTENT.MBTI_TYPE_CONTENT.some((type) => type.code === code) ? code : 'all';
    this.setData({
      filterOptions: [{ value: 'all', label: '全部 16 型' }].concat(
        CONTENT.MBTI_TYPE_CONTENT.map((type) => ({ value: type.code, label: type.code + ' · ' + type.name }))
      )
    });
    this.applyFilter({ filter, group: 'all' });
  },

  applyFilter(part) {
    const v = {
      mode: part.mode !== undefined ? part.mode : this.data.mode,
      group: part.group !== undefined ? part.group : this.data.group,
      filter: part.filter !== undefined ? part.filter : this.data.filter
    };
    const visible = CONTENT.MBTI_TYPE_CONTENT.filter((type) =>
      (v.group === 'all' || type.group === v.group) && (v.filter === 'all' || type.code === v.filter));
    this.setData({
      mode: v.mode,
      group: v.group,
      filter: v.filter,
      guidance: v.mode === 'self'
        ? '哪段描述让你觉得熟悉？可以先记住一个想多了解的类型。'
        : '把类型当作一个交流话题，也给真实的人留下不同的空间。',
      visibleCount: visible.length,
      cards: visible.map((type) => ({
        code: type.code,
        name: type.name,
        alias: type.alias,
        group: type.group,
        groupLabel: CONTENT.MBTI_TYPE_GROUPS[type.group] + ' ' + type.group,
        up: type.up,
        dn: type.dn
      }))
    });
  },

  setMode(event) {
    this.applyFilter({ mode: event.currentTarget.dataset.mode });
  },

  setGroup(event) {
    this.applyFilter({ group: event.currentTarget.dataset.group, filter: 'all' });
  },

  changeFilter(event) {
    this.applyFilter({ filter: event.detail.value, group: 'all' });
  },

  goTest() {
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=mbti' });
  },

  goCross(event) {
    const code = event.currentTarget.dataset.code;
    wx.redirectTo({ url: '/pages/via-mbti/via-mbti?code=' + code });
  },

  goViaIntro() {
    wx.navigateTo({ url: '/pages/via-intro/via-intro' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  }
});
