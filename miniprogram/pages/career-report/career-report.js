// pages/career-report/career-report.js — 职业探索报告（V1.2 原型 career-report 屏，第二期）
// 多个可验证方向，不给唯一职业结论；30 天为自主实践计划长度。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function money(n) {
  return Number(n).toFixed(2);
}

Page({
  data: {
    paid: false,
    basePaid: false,
    goal: '',
    time: '',
    constraints: '',
    values: [],
    directions: [],
    plan: [
      ['第 1 周', '选一个最想验证的方向，明确一个小问题。'],
      ['第 2 周', '做一次小访谈、一份说明或一次澄清会议。'],
      ['第 3 周', '邀请反馈，检查能力差距与能量感受。'],
      ['第 4 周', '比较投入、收获与现实条件，决定继续、调整或停止。']
    ],
    credit: '0.00',
    price: '49.90'
  },

  onShow() {
    const growth = getGrowth();
    const state = growth.get();
    this.setData({
      paid: state.careerPaid,
      basePaid: state.paid,
      goal: state.careerGoal,
      time: state.careerTime || '尚未提供',
      constraints: state.careerConstraints || '现实条件尚未补充，后续需要核对。',
      values: state.careerValues,
      directions: CONTENT.CAREER_DIRECTIONS.slice(0, state.careerPaid ? 3 : 1).map(([name, basis, conflict, action], index) => ({
        index: index + 1,
        name,
        basis,
        conflict,
        action
      })),
      credit: money(Math.min(49.9, state.baseNet)),
      price: money(state.paid ? Math.max(0, 49.9 - state.baseNet) : 49.9)
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/career/career' }) });
  },

  buyCareer() {
    if (getGrowth().get().careerPaid) {
      this.onShow();
      return;
    }
    getGrowth().patch({ product: 'career' });
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },

  backToInput() {
    wx.redirectTo({ url: '/pages/career/career' });
  },

  openBaseReport() {
    wx.redirectTo({ url: '/pages/growth-report/growth-report' });
  },

  goCalibrate() {
    wx.navigateTo({ url: '/pages/calibrate/calibrate' });
  }
});
