const { goHome: goPreviewHome } = require('../../app-store');
const { store, getApiClient, friendlyError, ensureEntryUnlocked } = require('../../app-store');

function listFromInput(value) {
  return value.split(/\n/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
}

Page({
  goHome: goPreviewHome,
  data: {
    loading: false,
    submitting: false,
    taskId: '',
    error: '',
    round: 1,
    confirmedFacts: '',
    unknowns: '',
    priority: '',
    goal: '',
    canSubmit: false
  },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    const activeTask = store.getState().activeTask || {};
    const taskId = query.taskId || activeTask.taskId || '';
    this.setData({
      taskId,
      error: taskId ? '' : '缺少任务，请先确认镜像'
    });
  },

  onShow() {
    ensureEntryUnlocked();
  },

  onInput(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ [key]: event.detail.value });
    this.refreshValidation();
  },

  refreshValidation() {
    const canSubmit = this.data.round === 1
      ? listFromInput(this.data.confirmedFacts).length > 0 && listFromInput(this.data.unknowns).length > 0
      : Boolean(this.data.priority.trim() && this.data.goal.trim());
    this.setData({ canSubmit });
  },

  async reflect() {
    if (!this.data.canSubmit || this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    try {
      const activeTask = store.getState().activeTask || {};
      const body = this.data.round === 1
        ? {
            expected_version: activeTask.version,
            round: 1,
            confirmed_facts: listFromInput(this.data.confirmedFacts),
            unknowns_to_verify: listFromInput(this.data.unknowns)
          }
        : {
            expected_version: activeTask.version,
            round: 2,
            priority_need_or_boundary: this.data.priority.trim(),
            self_executable_goal: this.data.goal.trim()
          };
      const response = await getApiClient().createTaskReflection(this.data.taskId, body);
      const data = response.data || {};
      store.patchActiveTask({
        version: data.version,
        [`reflectionVersionR${this.data.round}`]: data.reflection_version
      });

      if (this.data.round === 2) {
        wx.switchTab({ url: '/pages/report/report' });
      } else {
        this.setData({ round: 2, submitting: false, canSubmit: false });
      }
    } catch (error) {
      this.setData({ submitting: false, error: friendlyError(error) });
    }
  }
});
