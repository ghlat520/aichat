// app.js — 关系清晰卡小程序入口逻辑
// 职责：初始化全局状态 store + API client，恢复会话/同意态。
const { store, initApiClient } = require('./app-store');
const { getGrowth } = require('./growth-store');

App({
  globalData: {
    appid: 'wx9a9d1af441eb953d',
    apiBase: 'http://127.0.0.1:8080',
    version: '0.0.1',
    store: store, // 暴露给 E2E evaluate 用（getApp().globalData.store）
    growth: getGrowth() // 自我探索流程状态（E2E evaluate 可用 getApp().globalData.growth）
  },

  onLaunch() {
    // 启动即恢复持久化的 session + consent（PII 不入库，见 INV-08/AC-22）
    store.hydrate();
    // 初始化 API client（注入 wx 运行时 + tokenProvider）
    initApiClient(this.globalData.apiBase, wx);
  }
});
