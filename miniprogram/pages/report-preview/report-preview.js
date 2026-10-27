// pages/report-preview/report-preview.js — 个人报告预览（V1.2 原型 preview 屏）
// 展示个性化片段、完整目录、一次性价格和服务范围；准备中不出现购买入口。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

const PREPARE_DELAY = 1500;

Page({
  data: {
    state: 'ready',
    chapters: CONTENT.CHAPTERS,
    goalsText: '协作',
    experienceAction: '',
    confirmed: false,
    canReadBase: false
  },

  onShow() {
    const growth = getGrowth();
    const state = growth.get();
    this.setData({
      state: state.previewState === 'preparing' ? 'preparing' : state.previewState === 'failed' ? 'failed' : 'ready',
      goalsText: state.goals.join('、') || '协作',
      confirmed: state.confirmed,
      experienceAction: growth.actualExperiences()[0].action,
      canReadBase: growth.canReadBase()
    });
    if (state.previewState === 'preparing') {
      if (this.prepareTimer) clearTimeout(this.prepareTimer);
      this.prepareTimer = setTimeout(() => {
        growth.patch({ previewState: 'ready' });
        this.setData({ state: 'ready' });
      }, PREPARE_DELAY);
    }
  },

  onHide() {
    if (this.prepareTimer) clearTimeout(this.prepareTimer);
  },

  onUnload() {
    if (this.prepareTimer) clearTimeout(this.prepareTimer);
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/portrait/portrait' }) });
  },

  backToPortrait() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/portrait/portrait' }) });
  },

  retryPrepare() {
    const growth = getGrowth();
    growth.patch({ previewState: 'preparing' });
    this.setData({ state: 'preparing' });
    this.prepareTimer = setTimeout(() => {
      growth.patch({ previewState: 'ready' });
      this.setData({ state: 'ready' });
    }, PREPARE_DELAY);
  },

  finishPreview() {
    getGrowth().patch({ previewState: 'ready' });
    this.setData({ state: 'ready' });
  },

  buyBase() {
    getGrowth().patch({ product: 'base' });
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },

  openReport() {
    wx.navigateTo({ url: '/pages/growth-report/growth-report' });
  },

  sampleReport() {
    wx.navigateTo({ url: '/pages/growth-report/growth-report?sample=1' });
  },

  purchaseInfo() {
    wx.showModal({
      title: '购买与售后说明',
      content: '一次购买一份冻结快照的报告，可重复查看。金额以购买确认页的服务端报价为准；符合条件的同一基础快照可按已发布道具补差。\n\n报告采用当前内容模板，本机校准与复盘练习不会改写已购快照。iOS退款由用户向App Store申请，其他终端由商家在微信后台处理；订单页登记售后不代表已退款。',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});
