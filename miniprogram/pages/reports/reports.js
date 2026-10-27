// pages/reports/reports.js — 我的报告（V1.2 原型 reports 屏）
// 免费结果、已购报告、修订版本放回同一空间；新测评不覆盖旧报告。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'free', label: '免费结果' },
  { id: 'paid', label: '已购报告' }
];

Page({
  data: {
    filters: FILTERS,
    filter: 'all',
    freeItems: [],
    paidItems: [],
    hasPaid: false,
    version: '1.0',
    calibrated: false,
    expired: false
  },

  onShow() {
    const growth = getGrowth();
    const state = growth.get();
    const filter = state.reportFilter;
    const freeItems = CONTENT.TOOL_ORDER
      .filter((id) => state.results[id])
      .map((id) => ({
        id,
        name: CONTENT.TOOLS[id].short,
        source: state.sources[id] && state.sources[id].kind === 'import' ? '本人录入' : '原型样例版本 v1',
        color: CONTENT.TOOLS[id].color
      }));
    const paidItems = [];
    if (state.careerPaid) {
      paidItems.push({ id: 'career', name: '职业探索报告', aqua: true, version: '1.0' });
    }
    if (state.paid) {
      paidItems.push({ id: 'base', name: '个人优势说明书', version: state.version });
    }
    this.setData({
      filter,
      freeItems,
      paidItems,
      hasPaid: !!(state.paid || state.careerPaid),
      version: state.version,
      calibrated: state.calibrated,
      expired: state.expired
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/profile/profile' }) });
  },

  setFilter(event) {
    const filter = event.currentTarget.dataset.filter;
    getGrowth().patch({ reportFilter: filter });
    this.setData({ filter });
  },

  openFree(event) {
    wx.navigateTo({ url: '/pages/growth-result/growth-result?tool=' + event.currentTarget.dataset.id });
  },

  openPaid(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: id === 'career' ? '/pages/career-report/career-report' : '/pages/growth-report/growth-report' });
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order/order' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  exportReport() {
    const growth = getGrowth();
    const text = [
      '关系清晰卡｜个人优势说明书（UI 原型样例）',
      `版本 ${growth.get().version}`,
      '',
      ...CONTENT.CHAPTERS.map((chapter, index) => `${index + 1}. ${chapter}`),
      '',
      '优势候选：理解他人、梳理信息、持续学习',
      `行动：${CONTENT.ACTION_DATA[growth.get().selectedAction].join(' / ')}`,
      '',
      '本文件为原型样例，不是正式测评或真实购买交付。'
    ].join('\n');
    wx.setClipboardData({ data: text });
    wx.showToast({ title: '报告目录副本已复制', icon: 'none' });
  },

  deleteReport() {
    wx.showModal({
      title: '删除这份个人报告？',
      content: '将从本次演示中移除个人优势报告。免费测评结果和订单记录保留；删除报告不会自动退款。',
      confirmText: '确认删除',
      cancelText: '保留报告',
      success: (res) => {
        if (res.confirm) {
          getGrowth().deleteReport();
          this.onShow();
          wx.showToast({ title: '已移除本次演示中的个人报告', icon: 'none' });
        }
      }
    });
  }
});
