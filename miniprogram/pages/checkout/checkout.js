// pages/checkout/checkout.js — 购买确认（V1.2 原型 checkout 屏）
// 一次购买一份报告；职业升级按已付净额抵扣。支付为本地模拟，不连接支付渠道。
const { getGrowth } = require('../../growth-store');

function money(n) {
  return Number(n).toFixed(2);
}

Page({
  data: {
    career: false,
    upgrade: false,
    amount: '29.90',
    amountNumber: 29.9,
    credit: '0.00',
    blocked: false,
    bound: false,
    hasMbti: false,
    goalsText: '协作',
    delivery: [],
    careerReady: false
  },

  onShow() {
    const growth = getGrowth();
    const state = growth.get();
    const career = state.product === 'career';
    const upgrade = career && state.paid;
    const amount = growth.reportPrice();
    this.setData({
      career,
      upgrade,
      amount: money(amount),
      amountNumber: amount,
      credit: money(Math.min(49.9, state.baseNet)),
      blocked: upgrade && state.refund === 'processing',
      bound: state.bound,
      hasMbti: !!state.results.mbti,
      goalsText: state.goals.join('、') || '协作',
      careerReady: !!state.careerReady,
      delivery: career
        ? ['个人优势内容 + 2～3 个探索方向', '方向比较、能力差距与 30 天自主计划', '一次校准与 7 天内一次复盘']
        : ['8 章个人优势说明书，可重复查看', '围绕你的目标，最多 3 项可选行动', '一次集中校准与 7 天内一次复盘']
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/report-preview/report-preview' }) });
  },

  purchaseInfo() {
    wx.showModal({
      title: '购买与售后说明',
      content: '一次购买一份报告，可重复查看和保存。个人优势说明书 ¥29.90，职业探索报告 ¥49.90；同一快照符合条件的基础实付可抵扣升级。\n\n付款确认后有 7 天服务窗口，含一次集中校准与一次行动复盘。窗口结束后报告仍可查看。内容错误、交付异常与退款可从"订单与售后"申请处理。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  bindAccount() {
    wx.showModal({
      title: '把报告保存在自己的账号里',
      content: '绑定微信后可以在其他设备找回报告。这个步骤只在购买时需要，免费结果无需绑定。',
      confirmText: '演示绑定微信',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) {
          getGrowth().patch({ bound: true });
          this.setData({ bound: true });
          wx.showToast({ title: '已演示账号绑定', icon: 'none' });
        }
      }
    });
  },

  confirmPurchase() {
    const growth = getGrowth();
    if (!growth.get().bound) {
      wx.showModal({
        title: '用微信保存这份报告',
        content: '购买时绑定账号，方便之后在其他设备找回已购报告。免费测评与基础结果可以继续使用。',
        confirmText: '继续 · 演示绑定',
        cancelText: '先不购买',
        success: (res) => {
          if (res.confirm) {
            growth.patch({ bound: true });
            this.setData({ bound: true });
            this.requestPayment();
          }
        }
      });
      return;
    }
    this.requestPayment();
  },

  requestPayment() {
    const growth = getGrowth();
    growth.createOrder();
    if (growth.reportPrice() === 0) {
      growth.settlePayment('success');
      wx.redirectTo({ url: '/pages/payment/payment' });
      return;
    }
    const career = this.data.career;
    wx.showModal({
      title: '演示支付流程',
      content: `本次为 UI 原型，不连接支付渠道，也不会实际扣款。\n\n¥${this.data.amount}\n${career ? '职业探索报告' : '个人优势说明书'}`,
      confirmText: '模拟支付',
      cancelText: '模拟取消',
      success: (res) => {
        if (res.confirm) {
          growth.settlePayment('pending');
        } else {
          growth.settlePayment('cancel');
        }
        wx.redirectTo({ url: '/pages/payment/payment' });
      }
    });
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order/order' });
  },

  backToFree() {
    wx.redirectTo({ url: '/pages/portrait/portrait' });
  }
});
