// pages/via-mbti/via-mbti.js — VIA × MBTI 对照表（2026-11-03 原型 V2 via-mbti 屏）
// 16 型 × 5 项优势参考；探索性映射非官方交叉验证；“责任/适应”标为补充描述不计分。
const CONTENT = require('../../growth-content');

const STRENGTH_NAMES = new Set(CONTENT.VIA_GROUPS.reduce((all, group) => all.concat(group.items.map((item) => item.zh)), []));

Page({
  data: {
    filter: 'all',
    filterOptions: [],
    cards: [],
    visibleCount: 16
  },

  onLoad(query) {
    const code = query && query.code;
    this.applyFilter(CONTENT.VIA_CROSS.some((row) => row.code === code) ? code : 'all');
  },

  applyFilter(filter) {
    const rows = CONTENT.VIA_CROSS.filter((row) => filter === 'all' || row.code === filter);
    this.setData({
      filter,
      filterOptions: [{ value: 'all', label: '全部 16 型' }].concat(
        CONTENT.VIA_CROSS.map((row) => ({ value: row.code, label: row.code + ' · ' + row.name }))
      ),
      visibleCount: rows.length,
      cards: rows.map((row) => ({
        code: row.code,
        name: row.name,
        description: row.description,
        celebrity: CONTENT.MBTI_CELEBRITY_REFERENCES[row.code],
        strengths: row.strengths.map((name) => ({
          name,
          supplement: !STRENGTH_NAMES.has(name)
        }))
      }))
    });
  },

  changeFilter(event) {
    this.applyFilter(event.detail.value);
  },

  goTypes(event) {
    const code = event.currentTarget.dataset.code;
    wx.redirectTo({ url: '/pages/mbti-types/mbti-types?code=' + code });
  },

  goIntro() {
    wx.redirectTo({ url: '/pages/via-intro/via-intro' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  }
});
