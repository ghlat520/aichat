const { store, syncTabBar, goHome } = require('../../app-store');
const { getGrowth } = require('../../growth-store');

Page({
  data: {
    assets: {},
    growthStats: { results: 0, reports: 0, reflections: 0, savedVoices: 0 }
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
  goCards() { wx.switchTab({ url: '/pages/report/report' }); },
  goPrivacy() { wx.navigateTo({ url: '/pages/data-control/data-control' }); }
});
