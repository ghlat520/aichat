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
      content: '一次购买一份报告，可重复查看和保存。个人优势说明书 ¥29.90，职业探索报告 ¥49.90；同一快照符合条件的基础实付可抵扣升级。\n\n付款确认后有 7 天服务窗口，含一次集中校准与一次行动复盘。窗口结束后报告仍可查看。内容错误、交付异常与退款可从"订单与售后"申请处理。\n\n以上为本轮 UI 评审提案，本原型不实际收费。',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});
