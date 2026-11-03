const { store, getSessionBoundClient, friendlyError, goHome } = require('../../app-store');
const emotionLabels = { anxious: '焦虑', hurt: '受伤', angry: '生气', confused: '困惑', sad: '难过', hopeful: '期待', calm: '平静', other: '还说不清' };
Page({
  data: { loading: false, taskId: '', reportId: '', summary: null, demo: true, emotions: [], needs: [], emotionText: '', needText: '', error: '' },
  onLoad(query = {}) { this.loadCurrentCard(query.taskId); },
  onShow() {
    const task = store.getState().activeTask || {};
    if (task.taskId !== this.data.taskId || (!this.data.loading && this.data.demo && task.reflectionVersionR1 && task.reflectionVersionR2)) this.loadCurrentCard();
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
    const owner = (store.getState().session || {}).sessionId;
    const taskId = this.data.taskId;
    const isCurrent = () => owner && (store.getState().session || {}).sessionId === owner
      && (store.getState().activeTask || {}).taskId === taskId;
    try {
      const client = getSessionBoundClient(owner);
      const task = store.getState().activeTask || {};
      let reportId = task.reportId || this.data.reportId;
      if (!reportId) {
        const created = await client.createTaskReport(this.data.taskId, {
          expected_task_version: task.version,
          confirmed_content_version: task.confirmedContentVersion,
          reflection_versions: [task.reflectionVersionR1, task.reflectionVersionR2]
        });
        if (!isCurrent()) return;
        reportId = created.data.report_id;
      }
      const response = await client.getFreeReportSummary(reportId);
      if (!isCurrent()) return;
      const summary = response.data.free_summary;
      if (!summary) throw new Error('这张清晰卡暂时没有可显示的内容');
      const parts = summary.emotion_and_needs || {};
      store.patchActiveTask({ reportId });
      const emotions = (parts.emotions || []).map(value => emotionLabels[value] || value);
      const needs = parts.needs_or_boundaries || [];
      this.setData({ loading: false, demo: false, reportId, summary, emotions, needs, emotionText: emotions.join('，'), needText: needs.join('，') });
    } catch (error) { if (isCurrent()) this.setData({ loading: false, error: friendlyError(error) }); }
  },
  goToClarity() {
    const suffix = this.data.taskId ? '?taskId=' + encodeURIComponent(this.data.taskId) : '?entry=direct';
    wx.navigateTo({ url: '/pages/clarity-edit/clarity-edit' + suffix });
  },
  goToAction() { wx.navigateTo({ url: '/pages/action/action?taskId=' + encodeURIComponent(this.data.taskId) }); }
});
