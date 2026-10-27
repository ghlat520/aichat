const { goHome: goPreviewHome } = require('../../app-store');
const { store, getApiClient, friendlyError, ensureEntryUnlocked } = require('../../app-store');

const SECTION_LABELS = [
  ['confirmed_event', '已确认事件'],
  ['current_interpretation', '当前解读'],
  ['feelings', '感受'],
  ['need_or_boundary', '需要或边界'],
  ['question_to_solve', '要解决的问题']
];

const defaultEvaluations = () => Object.fromEntries(
  SECTION_LABELS.map(([key]) => [key, { accuracy: 'accurate', correction: '' }])
);

Page({
  goHome: goPreviewHome,
  data: {
    loading: true,
    submitting: false,
    taskId: '',
    sections: [],
    evaluations: defaultEvaluations(),
    contentVersion: '',
    error: ''
  },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    const activeTask = store.getState().activeTask || {};
    this.setData({ taskId: query.taskId || activeTask.taskId || '' });
    if (this.data.taskId) this.loadMirror();
    else this.setData({ loading: false, error: '缺少任务，请先完成六字段' });
  },

  onShow() {
    ensureEntryUnlocked();
  },

  async loadMirror() {
    try {
      const activeTask = store.getState().activeTask || {};
      const response = await getApiClient().createTaskMirror(this.data.taskId, {
        expected_version: activeTask.version
      });
      const data = response.data || {};
      const mirror = data.mirror || {};
      const sections = SECTION_LABELS.map(([key, label]) => ({
        key,
        label,
        text: mirror[key] || '',
        accuracy: 'accurate',
        correction: ''
      }));
      store.patchActiveTask({
        taskId: this.data.taskId,
        contentVersion: data.content_version,
        version: data.version
      });
      this.setData({
        loading: false,
        sections,
        contentVersion: data.content_version
      });
    } catch (error) {
      this.setData({ loading: false, error: friendlyError(error) });
    }
  },

  onAccuracyChange(event) {
    const key = event.currentTarget.dataset.key;
    const accuracy = event.detail.value;
    const evaluations = {
      ...this.data.evaluations,
      [key]: { ...this.data.evaluations[key], accuracy }
    };
    const sections = this.data.sections.map((section) => (
      section.key === key ? { ...section, accuracy } : section
    ));
    this.setData({ evaluations, sections });
  },

  onCorrectionInput(event) {
    const key = event.currentTarget.dataset.key;
    const correction = event.detail.value;
    const evaluations = {
      ...this.data.evaluations,
      [key]: { ...this.data.evaluations[key], correction }
    };
    const sections = this.data.sections.map((section) => (
      section.key === key ? { ...section, correction } : section
    ));
    this.setData({ evaluations, sections });
  },

  async confirm() {
    if (this.data.submitting) return;
    const evaluations = {};
    for (const [key] of SECTION_LABELS) {
      const item = this.data.evaluations[key];
      if (item.accuracy !== 'accurate' && !item.correction.trim()) {
        this.setData({ error: '选择部分准确或不准确时，请填写修正内容' });
        return;
      }
      evaluations[key] = item.accuracy === 'accurate'
        ? { accuracy: item.accuracy }
        : { accuracy: item.accuracy, correction: item.correction.trim() };
    }
    this.setData({ submitting: true, error: '' });
    try {
      const activeTask = store.getState().activeTask || {};
      const response = await getApiClient().confirmTaskMirror(this.data.taskId, {
        expected_version: activeTask.version,
        content_version: activeTask.contentVersion || this.data.contentVersion,
        confirmed: true,
        evaluations
      });
      const data = response.data || {};
      store.patchActiveTask({
        version: data.version,
        confirmedContentVersion: data.confirmed_content_version
      });
      wx.redirectTo({ url: `/pages/reflection/reflection?taskId=${this.data.taskId}` });
    } catch (error) {
      this.setData({ submitting: false, error: friendlyError(error) });
    }
  }
});
