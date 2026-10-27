// pages/reports/reports.js — 我的报告（V1.2 原型 reports 屏）
// 免费结果、已购报告、修订版本放回同一空间；新测评不覆盖旧报告。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');
const { getVirtualPayment } = require('../../services/virtual-payment');
const { friendlyError } = require('../../app-store');

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
    expired: false,
    notice: '',
    nextCursor: null
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
    this.setData({
      filter,
      freeItems,
      paidItems: [],
      hasPaid: false,
      version: state.version,
      calibrated: state.calibrated,
      expired: state.expired
    });
    this.loadPaid();
  },

  async loadPaid(before) {
    try {
      const result = await getVirtualPayment().list(before);
      const paidItems = result.items.filter(order => order.payment_state === 'PAID' && order.entitlement_state === 'ACTIVE' && order.refund_state === 'NONE')
        .map(order => ({ id: order.order_id, kind: order.sku === 'base' ? 'base' : 'career',
          name: order.sku === 'base' ? '个人优势说明书' : '职业探索报告', aqua: order.sku !== 'base', version: order.report_version,
          date: order.created_at.slice(0, 10) }));
      const items = before ? this.data.paidItems.concat(paidItems) : paidItems;
      this.setData({ paidItems: items, hasPaid: items.length > 0, nextCursor: result.next_cursor, notice: '' });
    } catch (error) { this.setData({ notice: '微信登录后可恢复已购报告；免费结果可继续查看。' }); }
  },

  async morePaid() { if (this.data.nextCursor) await this.loadPaid(this.data.nextCursor); },

  async restorePaid() {
    try { await getVirtualPayment().bind(); await this.loadPaid(); }
    catch (error) { this.setData({ notice: friendlyError(error) }); }
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
    const { id, kind } = event.currentTarget.dataset;
    wx.navigateTo({ url: (kind === 'career' ? '/pages/career-report/career-report' : '/pages/growth-report/growth-report') + '?orderId=' + encodeURIComponent(id) });
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order/order' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  async exportReport() {
    const selected = this.data.paidItems[0];
    if (!selected) return;
    try { await getVirtualPayment().readReport(selected.id); }
    catch (error) { wx.showToast({ title: friendlyError(error), icon: 'none' }); return; }
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
      content: '清空本机的报告展示。后台购买记录保留，微信登录后仍可恢复；此操作不会退款。',
      confirmText: '清空本机',
      cancelText: '保留报告',
      success: (res) => {
        if (res.confirm) {
          getGrowth().deleteReport();
          this.setData({ paidItems: [], hasPaid: false });
          wx.showToast({ title: '已清空本机展示', icon: 'none' });
        }
      }
    });
  }
});
