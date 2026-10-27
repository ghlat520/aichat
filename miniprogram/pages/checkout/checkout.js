const { getGrowth } = require('../../growth-store');
const { getVirtualPayment } = require('../../services/virtual-payment');
const { friendlyError } = require('../../app-store');

Page({
  data: { career: false, upgrade: false, amount: '--', amountNumber: 0, blocked: false,
    bound: false, hasMbti: false, goalsText: '', delivery: [], careerReady: false,
    busy: false, quoteReady: false, error: '' },
  onShow() {
    const state = getGrowth().get();
    this.product = state.product;
    this.snapshot = getGrowth().purchaseSnapshot(this.product);
    const career = this.product === 'career';
    this.setData({ career, bound: state.bound, hasMbti: !!state.results.mbti,
      goalsText: state.goals.join('、'), careerReady: !!state.careerReady,
      delivery: career ? ['个人优势内容与职业探索方向', '方向比较、能力差距与 30 天自主计划', '同一购买快照可重复查看']
        : ['8 章个人优势说明书，可重复查看', '围绕你的目标，最多 3 项可选行动', '同一购买快照可重复查看'] });
    this.loadQuote();
  },
  async loadQuote() {
    this.setData({ quoteReady: false, error: '' });
    try {
      this.quote = await getVirtualPayment().quote(this.product, this.snapshot);
      const price = this.quote.existing_order ? this.quote.existing_order.price_fen : this.quote.price_fen;
      this.setData({ amount: (price / 100).toFixed(2), amountNumber: price / 100,
        upgrade: this.quote.sku === 'upgrade', quoteReady: true });
      return this.quote;
    } catch (error) { this.setData({ error: friendlyError(error) }); return null; }
  },
  goBack() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/report-preview/report-preview' }) }); },
  purchaseInfo() {
    wx.showModal({ title: '购买与售后说明', showCancel: false, content:
      '一次购买一份冻结快照的报告，付款由服务端确认后解锁，可在同一微信身份下找回。当前报告采用现有版本的内容模板。购买后可重复查看。iOS退款由用户向App Store申请，其他终端由商家在微信后台处理；售后登记不代表退款成功。' });
  },
  async bindAccount() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try { await getVirtualPayment().bind(); this.setData({ bound: true }); await this.loadQuote(); }
    catch (error) { this.setData({ error: friendlyError(error) }); }
    finally { this.setData({ busy: false }); }
  },
  async confirmPurchase() {
    if (this.data.busy || !this.data.quoteReady) return;
    this.setData({ busy: true, error: '' });
    try {
      getVirtualPayment().assertSupported();
      await getVirtualPayment().bind();
      this.setData({ bound: true });
      const quote = await this.loadQuote();
      if (!quote) return;
      if (quote.existing_order && (quote.existing_order.sku !== quote.sku || quote.existing_order.payment_state !== 'PENDING' || quote.existing_order.payment_started)) {
        getGrowth().applyServerOrder(quote.existing_order);
        wx.redirectTo({ url: '/pages/payment/payment' });
        return;
      }
      const confirmed = await new Promise(resolve => wx.showModal({ title: '确认支付 ¥' + this.data.amount,
        content: '购买当前快照的' + (this.data.career ? '职业探索报告' : '个人优势说明书')
          + '。内容采用当前报告模板，可重复查看。iOS退款请向App Store申请；其他售后从订单页登记。',
        confirmText: '确认购买', success: result => resolve(result.confirm), fail: () => resolve(false) }));
      if (!confirmed) return;
      await getVirtualPayment().purchase({ product: this.product, snapshot: this.snapshot, quote });
      wx.redirectTo({ url: '/pages/payment/payment' });
    } catch (error) { this.setData({ error: friendlyError(error) }); }
    finally { this.setData({ busy: false }); }
  },
  goOrder() { wx.navigateTo({ url: '/pages/order/order' }); },
  backToFree() { wx.redirectTo({ url: '/pages/portrait/portrait' }); }
});
