const { store, syncTabBar, goHome, friendlyError, resetIdentityDisplay } = require('../../app-store');
const { getGrowth } = require('../../growth-store');
const { getVirtualPayment } = require('../../services/virtual-payment');

// 微信身份区：等级取本地持久 session；不采任何用户资料字段（头像/昵称/手机号，P2/P3 另议）。
const IDENTITY_VIEWS = {
  Visitor: { label: '访客模式', hint: '免费使用；绑定微信后，换设备也能恢复已购报告与订单。' },
  Principal: { label: '已绑定微信', hint: '同一微信身份可在新设备恢复已购内容。' }
};

Page({
  data: {
    assets: {},
    growthStats: { results: 0, reports: 0, reflections: 0, savedVoices: 0 },
    identityLevel: 'Visitor',
    identityLabel: '访客模式',
    identityHint: IDENTITY_VIEWS.Visitor.hint,
    identityBound: false,
    identityBusy: false,
    identityNotice: ''
  },

  onShow() {
    syncTabBar(this, 4);
    const state = getGrowth().get();
    this.setData({
      assets: store.getPersonalAssets(),
      growthStats: {
        results: Object.values(state.results).filter(Boolean).length,
        reports: Number(state.paid) + Number(state.careerPaid),
        reflections: state.reflected ? 1 : 0,
        savedVoices: state.savedVoices.length
      }
    });
    this.refreshIdentity();
  },

  refreshIdentity() {
    const level = (store.getState().session || {}).level === 'Principal' ? 'Principal' : 'Visitor';
    const view = IDENTITY_VIEWS[level];
    this.setData({
      identityLevel: level,
      identityLabel: view.label,
      identityHint: view.hint,
      identityBound: level === 'Principal'
    });
  },

  async bindWechat() {
    if (this.data.identityBusy) return;
    this.setData({ identityBusy: true, identityNotice: '' });
    try {
      await getVirtualPayment().bind('cross_device_recovery');
    } catch (error) {
      this.setData({ identityNotice: friendlyError(error) });
    } finally {
      this.setData({ identityBusy: false });
      this.refreshIdentity();
    }
  },

  logoutWechat() {
    wx.showModal({
      title: '退出登录？',
      content: '仅清除本机的登录信息并回到访客模式；服务器会话将在到期后自动失效。',
      confirmText: '退出登录',
      cancelText: '暂不退出',
      success: (res) => {
        if (!res.confirm) return;
        try {
          store.clearSession();
        } catch (error) {
          this.setData({ identityNotice: '退出失败，请检查本机存储后重试。' });
          return;
        }
        resetIdentityDisplay();
        this.onShow();
        this.setData({ identityNotice: '已退出，回到访客模式；服务器会话将在到期后自动失效。' });
      }
    });
  },

  goHome,
  goDiscover() { wx.switchTab({ url: '/pages/assessment/assessment' }); },
  openReport() { wx.navigateTo({ url: '/pages/growth-report/growth-report' }); },
  goGrowthReports() { wx.navigateTo({ url: '/pages/reports/reports' }); },
  goGrowthReflection() { wx.navigateTo({ url: '/pages/growth-reflection/growth-reflection' }); },
  goSavedVoices() {
    getGrowth().patch({ voiceMood: '留给自己的' });
    wx.navigateTo({ url: '/pages/voices/voices' });
  },
  goOrder() { wx.navigateTo({ url: '/pages/order/order' }); },
  goCards() { wx.navigateTo({ url: '/pages/report/report' }); },
  goRelationshipTest() { wx.reLaunch({ url: '/pages/assessment/assessment?relationship=1' }); },
  goPrivacy() { wx.navigateTo({ url: '/pages/data-control/data-control' }); }
});
