// pages/growth-report/growth-report.js — 完整优势说明书（V1.2 原型 report 屏）
// 8 章报告、三项候选优势、适用条件、盲点与行动；一次校准和 7 天内一次复盘。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');
const { getVirtualPayment } = require('../../services/virtual-payment');
const { friendlyError } = require('../../app-store');

Page({
  data: {
    sample: false,
    locked: false,
    oldVersion: false,
    version: '1.0',
    calibrated: false,
    calibrationText: '',
    confirmed: false,
    hasMbti: false,
    goals: [],
    experiences: [],
    strengths: CONTENT.STRENGTH_DATA,
    actions: [],
    reportSaved: false,
    expired: false,
    calibratedUsed: false,
    reflected: false,
    actionStarted: false,
    selectedAction: 0
  },

  onLoad(query) {
    this.sampleMode = query && query.sample === '1';
    this.orderId = query && query.orderId;
  },

  async onShow() {
    const growth = getGrowth();
    const state = growth.get();
    const sample = !!this.sampleMode;
    let snapshot = null;
    let purchased = null;
    this.setData({ sample, locked: !sample });
    if (!sample) {
      const id = this.orderId || (state.order && state.order.id);
      if (!id) return;
      try { purchased = await getVirtualPayment().readReport(id); snapshot = purchased.snapshot; }
      catch (error) { wx.showToast({ title: friendlyError(error), icon: 'none' }); return; }
    }
    const experiences = snapshot ? snapshot.experiences : CONTENT.SAMPLE_EXPERIENCES;
    this.setData({
      sample,
      locked: !snapshot && !sample,
      oldVersion: false,
      version: purchased ? purchased.report_version : '样例 v1',
      reportDate: purchased ? purchased.order.created_at.slice(0, 10) : '样例',
      calibrated: false,
      calibrationText: '',
      confirmed: snapshot ? snapshot.confirmed : false,
      hasMbti: snapshot ? !!snapshot.results.mbti : false,
      goals: snapshot ? snapshot.goals : [],
      experiences,
      actions: CONTENT.ACTION_DATA.map(([title, body, observe], index) => ({
        index,
        title,
        body,
        observe,
        selected: false
      })),
      reportSaved: state.reportSaved,
      expired: false,
      calibratedUsed: false,
      reflected: false,
      actionStarted: false,
      selectedAction: 0
    });
    wx.setNavigationBarTitle({ title: sample ? '完整报告样例' : state.oldVersion ? '历史报告 v1.0' : '个人优势说明书' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/reports/reports' }) });
  },

  goPreview() {
    wx.redirectTo({ url: '/pages/report-preview/report-preview' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  saveReport() {
    getGrowth().patch({ reportSaved: true });
    this.setData({ reportSaved: true });
    wx.showToast({ title: '已保存在我的报告中', icon: 'none' });
  },

  goShare() {
    getGrowth().patch({ posterKind: 'strength', shareEntry: 'strengths' });
    wx.navigateTo({ url: '/pages/growth-share/growth-share' });
  },

  selectAction(event) {
    const index = Number(event.currentTarget.dataset.index);
    getGrowth().patch({ selectedAction: index, actionStarted: true });
    this.setData({ selectedAction: index, actionStarted: true });
    wx.redirectTo({ url: '/pages/growth-reflection/growth-reflection' });
  },

  toggleOldVersion() {
    const oldVersion = !this.data.oldVersion;
    getGrowth().patch({ oldVersion });
    this.setData({ oldVersion });
    wx.setNavigationBarTitle({ title: oldVersion ? '历史报告 v1.0' : '个人优势说明书' });
  },

  goCalibrate() {
    wx.navigateTo({ url: '/pages/calibrate/calibrate' });
  },

  goReflection() {
    wx.navigateTo({ url: '/pages/growth-reflection/growth-reflection' });
  },

  goCareer() {
    wx.navigateTo({ url: '/pages/career/career' });
  }
});
