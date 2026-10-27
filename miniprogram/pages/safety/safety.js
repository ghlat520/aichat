const { goHome: goPreviewHome } = require('../../app-store');
const { getApiClient, friendlyError } = require('../../app-store');

Page({
  goHome: goPreviewHome,
  data: { loading: true, resources: [], highlightedIds: [], notice: '', error: '' },

  onLoad(query) {
    const highlightedIds = decodeURIComponent(query.resourceIds || '').split(',').filter(Boolean);
    this.setData({ highlightedIds });
    this.load();
  },

  async load() {
    try {
      const response = await getApiClient().getSafetyResources();
      const resources = (response.data.resources || []).map((resource) => ({
        ...resource,
        highlighted: this.data.highlightedIds.includes(resource.code)
      }));
      this.setData({ loading: false, resources, notice: response.data.notice });
    } catch (error) {
      this.setData({ loading: false, error: friendlyError(error) });
    }
  },

  callResource(event) {
    wx.makePhoneCall({ phoneNumber: event.currentTarget.dataset.code });
  }
});
