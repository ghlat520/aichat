const { goHome: goPreviewHome } = require('../../app-store');
const { store, getSessionBoundClient, ensureGuestSession, friendlyError, ensureEntryUnlocked } = require('../../app-store');

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
    ownerSessionId: '',
    sessionHidden: false,
    sections: [],
    evaluations: defaultEvaluations(),
    contentVersion: '',
    error: ''
  },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    this.logoutVersion = store.getLogoutVersion();
    const activeTask = store.getState().activeTask || {};
    this.setData({ taskId: query.taskId || activeTask.taskId || '', ownerSessionId: (store.getState().session || {}).sessionId || '' });
    if (this.data.taskId) this.loadMirror();
    else this.setData({ loading: false, error: '缺少任务，请先完成六字段' });
  },

  onShow() {
    ensureEntryUnlocked();
    this.setData({ sessionHidden: (this.logoutVersion !== undefined && this.logoutVersion !== store.getLogoutVersion())
      || (!!this.data.ownerSessionId && this.data.ownerSessionId !== (store.getState().session || {}).sessionId) });
  },

  async loadMirror() {
    const owner = this.data.ownerSessionId || (store.getState().session || {}).sessionId;
    const logoutVersion = store.getLogoutVersion();
    try {
      const sessionId = await ensureGuestSession();
      if ((owner && owner !== sessionId) || logoutVersion !== store.getLogoutVersion()) throw new Error('登录状态已变化，请重试');
      this.setData({ ownerSessionId: sessionId });
      const activeTask = store.getState().activeTask || {};
      const response = await getSessionBoundClient(sessionId).createTaskMirror(this.data.taskId, {
        expected_version: activeTask.version
      });
      if ((store.getState().session || {}).sessionId !== sessionId || logoutVersion !== store.getLogoutVersion()) {
        this.setData({ sessionHidden: true }); return;
      }
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
      this.setData({ loading: false, error: friendlyError(error),
        sessionHidden: logoutVersion !== store.getLogoutVersion() || (!!owner && owner !== (store.getState().session || {}).sessionId) });
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
    const owner = this.data.ownerSessionId || (store.getState().session || {}).sessionId;
    const logoutVersion = store.getLogoutVersion();
    try {
      const sessionId = await ensureGuestSession();
      if ((owner && owner !== sessionId) || logoutVersion !== store.getLogoutVersion()) throw new Error('登录状态已变化，请重试');
      const activeTask = store.getState().activeTask || {};
      const response = await getSessionBoundClient(sessionId).confirmTaskMirror(this.data.taskId, {
        expected_version: activeTask.version,
        content_version: activeTask.contentVersion || this.data.contentVersion,
        confirmed: true,
        evaluations
      });
      if ((store.getState().session || {}).sessionId !== sessionId || logoutVersion !== store.getLogoutVersion()) {
        this.setData({ submitting: false, sessionHidden: true }); return;
      }
      const data = response.data || {};
      store.patchActiveTask({
        version: data.version,
        confirmedContentVersion: data.confirmed_content_version
      });
      wx.redirectTo({ url: `/pages/reflection/reflection?taskId=${this.data.taskId}` });
    } catch (error) {
      this.setData({ submitting: false, error: friendlyError(error),
        sessionHidden: logoutVersion !== store.getLogoutVersion() || (!!owner && owner !== (store.getState().session || {}).sessionId) });
    }
  }
});
