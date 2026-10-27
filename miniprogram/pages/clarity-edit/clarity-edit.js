const {
  store,
  getApiClient,
  friendlyError,
  ensureEntryUnlocked,
  goHome,
  routeToSafetyIfBlocked
} = require('../../app-store');

const CONTEXTS = [
  { value: 'dating_or_partner', label: '伴侣 / 约会' },
  { value: 'family', label: '家庭' },
  { value: 'friendship', label: '朋友' },
  { value: 'workplace', label: '职场' },
  { value: 'other_relationship', label: '其他关系' }
];

Page({
  data: {
    loading: true,
    saving: false,
    saved: false,
    canSubmit: false,
    taskId: '',
    taskVersion: 0,
    error: '',
    contextOptions: CONTEXTS,
    contextLabels: CONTEXTS.map((item) => item.label),
    contextIndex: 1,
    needText: '',
    boundaryText: '',
    emotionOptions: [
      { value: 'anxious', label: '焦虑' },
      { value: 'hurt', label: '受伤' },
      { value: 'angry', label: '生气' },
      { value: 'confused', label: '困惑' },
      { value: 'sad', label: '难过' },
      { value: 'hopeful', label: '期待' },
      { value: 'calm', label: '平静' },
      { value: 'other', label: '其他' }
    ],
    fields: {
      context: 'family',
      observed_fact: '',
      interpretation: '',
      emotion: [],
      need_or_boundary: [],
      next_step_goal: ''
    }
  },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    const activeTask = store.getState().activeTask || {};
    const directEntry = query.entry === 'direct';
    const candidate = directEntry ? {} : (activeTask.candidateFields || {});
    const fields = !directEntry && activeTask.fields ? { ...activeTask.fields } : {
      ...this.data.fields, interpretation: candidate.interpretation || '', next_step_goal: candidate.next_step_goal || ''
    };
    const draft = !directEntry && activeTask.fieldDraft || {};
    this.setData({
      loading: false,
      taskId: directEntry ? '' : (query.taskId || activeTask.taskId || ''),
      taskVersion: directEntry ? 0 : (activeTask.version || 0),
      contextIndex: Math.max(0, CONTEXTS.findIndex(item => item.value === fields.context)),
      needText: draft.needText || (fields.need_or_boundary || []).join('，'),
      boundaryText: draft.boundaryText || '',
      emotionOptions: this.data.emotionOptions.map(item => ({ ...item, checked: fields.emotion.includes(item.value) })),
      fields
    });
    this.refreshValidation();
  },

  onShow() {
    ensureEntryUnlocked();
  },

  goHome,

  onContextChange(event) {
    const contextIndex = Number(event.detail.value);
    const fields = { ...this.data.fields, context: CONTEXTS[contextIndex].value };
    this.setData({ contextIndex, fields, saved: false });
    this.refreshValidation();
  },

  onTextInput(event) {
    const key = event.currentTarget.dataset.key;
    const value = event.detail.value;
    const fields = { ...this.data.fields, [key]: value };
    this.setData({ fields, saved: false });
    this.refreshValidation();
  },

  onNeedsInput(event) {
    const needText = event.detail.value;
    this.setData({
      needText,
      fields: { ...this.data.fields, need_or_boundary: [needText.trim(), this.data.boundaryText.trim()].filter(Boolean) },
      saved: false
    });
    this.refreshValidation();
  },

  onBoundaryInput(event) {
    const boundaryText = event.detail.value;
    this.setData({ boundaryText, fields: { ...this.data.fields, need_or_boundary: [this.data.needText.trim(), boundaryText.trim()].filter(Boolean) }, saved: false });
    this.refreshValidation();
  },

  onEmotionChange(event) {
    const selected = event.detail.value.slice(0, 3);
    this.setData({
      fields: { ...this.data.fields, emotion: selected },
      emotionOptions: this.data.emotionOptions.map(item => ({ ...item, checked: selected.includes(item.value) })),
      saved: false
    });
    this.refreshValidation();
  },

  refreshValidation() {
    const fields = this.data.fields;
    this.setData({
      canSubmit: Boolean(
        fields.context &&
        fields.observed_fact.trim().length >= 20 &&
        fields.interpretation.trim() &&
        fields.emotion.length &&
        fields.need_or_boundary.length &&
        fields.next_step_goal.trim()
      )
    });
  },

  async submit() {
    if (!this.data.canSubmit || this.data.saving) return;
    this.setData({ saving: true, error: '' });
    try {
      const client = getApiClient();
      const fields = this.data.fields;
      let taskId = this.data.taskId;
      let taskVersion = this.data.taskVersion || (store.getState().activeTask || {}).version;
      if (!taskId) {
        const created = await client.createClarityTask({
          entry_type: 'DIRECT',
          context: fields.context,
          clarity_pre: 3
        });
        taskId = created.data.task_id;
        taskVersion = created.data.version || 1;
      }
      const saved = await client.putClarityFields(taskId, {
        expected_version: taskVersion,
        fields
      });
      if (routeToSafetyIfBlocked(saved.data)) {
        this.setData({ saving: false });
        return;
      }
      store.patchActiveTask({
        taskId,
        version: saved.data.version,
        contentVersion: saved.data.content_version,
        source: this.data.taskId ? (store.getState().activeTask || {}).source : 'direct',
        fields,
        fieldDraft: { needText: this.data.needText, boundaryText: this.data.boundaryText }
      });
      this.setData({
        saving: false,
        saved: true,
        taskId,
        taskVersion: saved.data.version
      });
    } catch (error) {
      this.setData({ saving: false, error: friendlyError(error) });
    }
  },

  goToMirror() {
    wx.redirectTo({ url: `/pages/mirror/mirror?taskId=${this.data.taskId}` });
  }
});
