const { store, getApiClient, friendlyError, syncTabBar, goHome } = require('../../app-store');
const emotionLabels = { anxious: '焦虑', hurt: '受伤', angry: '生气', confused: '困惑', sad: '难过', hopeful: '期待', calm: '平静', other: '还说不清' };
Page({
  data: { loading: false, taskId: '', reportId: '', summary: null, demo: true, emotions: [], needs: [], emotionText: '', needText: '', error: '' },
  onLoad(query = {}) { this.loadCurrentCard(query.taskId); },
  onShow() {
    syncTabBar(this, 3);
    const task = store.getState().activeTask || {};
    if (!this.data.loading && (task.taskId !== this.data.taskId || (this.data.demo && task.reflectionVersionR1 && task.reflectionVersionR2))) this.loadCurrentCard();
  },
  goHome,
  loadCurrentCard(taskId) {
    const task = store.getState().activeTask || {};
    const id = taskId || task.taskId || '';
    const ready = task.reportId || (task.reflectionVersionR1 && task.reflectionVersionR2);
    this.setData({ taskId: id, reportId: task.reportId || '', demo: !ready, error: '', summary: null, loading: !!ready });
    if (ready) this.genReport();
  },
  async genReport() {
    try {
      const task = store.getState().activeTask || {};
      let reportId = task.reportId || this.data.reportId;
      if (!reportId) {
        const created = await getApiClient().createTaskReport(this.data.taskId, {
          expected_task_version: task.version,
          confirmed_content_version: task.confirmedContentVersion,
          reflection_versions: [task.reflectionVersionR1, task.reflectionVersionR2]
        });
        reportId = created.data.report_id;
      }
      const response = await getApiClient().getFreeReportSummary(reportId);
      const summary = response.data.free_summary;
      if (!summary) throw new Error('这张清晰卡暂时没有可显示的内容');
      const parts = summary.emotion_and_needs || {};
      store.patchActiveTask({ reportId });
      const emotions = (parts.emotions || []).map(value => emotionLabels[value] || value);
      const needs = parts.needs_or_boundaries || [];
      this.setData({ loading: false, demo: false, reportId, summary, emotions, needs, emotionText: emotions.join('，'), needText: needs.join('，') });
    } catch (error) { this.setData({ loading: false, error: friendlyError(error) }); }
  },
  goToClarity() {
    const suffix = this.data.taskId ? '?taskId=' + encodeURIComponent(this.data.taskId) : '?entry=direct';
    wx.navigateTo({ url: '/pages/clarity-edit/clarity-edit' + suffix });
  },
  goToAction() { wx.navigateTo({ url: '/pages/action/action?taskId=' + encodeURIComponent(this.data.taskId) }); }
});
