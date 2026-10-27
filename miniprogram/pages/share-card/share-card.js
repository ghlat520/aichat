const { goHome: goPreviewHome } = require('../../app-store');
const { getApiClient, friendlyError, ensureEntryUnlocked } = require('../../app-store');

Page({
  goHome: goPreviewHome,
  data: { loading: true, runId: '', preview: null, error: '' },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    const runId = query.runId || '';
    this.setData({ runId });
    if (!runId) {
      this.setData({ loading: false, error: '缺少测评记录，无法生成分享预览' });
      return;
    }
    this.loadPreview();
  },

  async loadPreview() {
    try {
      const response = await getApiClient().createAssessmentShareCard(this.data.runId);
      this.setData({ loading: false, preview: response.data.preview || response.data });
    } catch (error) {
      this.setData({ loading: false, error: friendlyError(error) });
    }
  },

  onShow() {
    ensureEntryUnlocked();
  },

  cancel() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  }
});
