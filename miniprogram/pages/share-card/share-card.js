const { goHome: goPreviewHome } = require('../../app-store');
const { store, getSessionBoundClient, friendlyError, ensureEntryUnlocked } = require('../../app-store');
const { currentReportOwner, openReportPoster } = require('../../report-poster');

Page({
  goHome: goPreviewHome,
  data: { loading: true, runId: '', preview: null, error: '' },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    this._alive = true;
    this.reportPosterOwner = currentReportOwner();
    const runId = query.runId || '';
    this.setData({ runId });
    if (!runId) {
      this.setData({ loading: false, error: '缺少测评记录，无法生成分享预览' });
      return;
    }
    return this.loadPreview();
  },

  async loadPreview() {
    const version = this._loadVersion = (this._loadVersion || 0) + 1;
    const owner = (store.getState().session || {}).sessionId;
    const isCurrent = () => this._alive && version === this._loadVersion && this.reportPosterOwner === currentReportOwner();
    try {
      const response = await getSessionBoundClient(owner).createAssessmentShareCard(this.data.runId);
      if (!isCurrent()) return;
      this.setData({ loading: false, preview: response.data.preview || response.data });
    } catch (error) {
      if (isCurrent()) this.setData({ loading: false, error: friendlyError(error) });
    }
  },

  onShow() {
    ensureEntryUnlocked();
    if (this.reportPosterOwner !== currentReportOwner()) {
      this._loadVersion++;
      this.setData({ loading: false, preview: null, error: '身份已变化，请返回自测重新打开' });
    }
  },

  onUnload() {
    this._alive = false;
    this._loadVersion++;
  },

  goShare() {
    openReportPoster('communication', this.data, this.reportPosterOwner);
  },

  cancel() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  }
});
