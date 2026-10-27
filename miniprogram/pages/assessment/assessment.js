const { store, getApiClient, friendlyError, ensureEntryUnlocked, ensureGuestSession, syncTabBar, goHome } = require('../../app-store');
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

function normalizeItems(items) {
  return (items || []).map((item) => ({
    item_id: item.item_id,
    text: item.prompt || item.text || '',
    options: (item.options || []).map((option) => ({
      value: option.option_code || option.code,
      label: option.text || option.label
    }))
  }));
}

Page({
  data: {
    // mode=catalog：V1.2 自测首页；mode=relationship：原有 8 题关系轻自测（逻辑不变）
    mode: 'catalog',
    tools: [],
    continueTool: null,
    recentTools: [],
    hasPaid: false,
    version: '1.0',
    loading: true,
    started: false,
    submitting: false,
    enabled: true,
    error: '',
    definitionVersion: '',
    itemCount: 0,
    items: [],
    currentIndex: 0,
    currentItem: null,
    currentAnswer: '',
    answers: {},
    answeredCount: 0,
    runId: '',
    ownerSessionId: '',
    runVersion: 0,
    result: null,
    mappedTaskId: ''
  },

  onLoad(query) {
    if (!ensureEntryUnlocked()) return;
    if (query && query.relationship === '1') {
      this.startRelationship();
      return;
    }
    this.refreshCatalog();
  },

  onShow() {
    syncTabBar(this, 1);
    ensureEntryUnlocked();
    if (this.data.mode === 'catalog') this.refreshCatalog();
  },

  // ===== 自测首页（catalog）=====
  refreshCatalog() {
    const growth = getGrowth();
    const state = growth.get();
    const tools = CONTENT.TOOL_ORDER.map((id) => {
      const answered = (state.answers[id] || []).length;
      return {
        id,
        name: CONTENT.TOOLS[id].name,
        short: CONTENT.TOOLS[id].short,
        desc: CONTENT.TOOLS[id].desc,
        color: CONTENT.TOOLS[id].color,
        answered,
        total: CONTENT.QUESTIONS[id].length,
        date: (state.sources[id] && state.sources[id].date) || '2026-10-26',
        status: state.results[id] ? 'done' : answered > 0 ? 'doing' : 'fresh'
      };
    });
    const continueTool = tools.find((tool) => tool.status === 'doing') || null;
    const recentTools = tools.filter((tool) => tool.status === 'done');
    wx.setNavigationBarTitle({ title: '自测' });
    this.setData({
      mode: 'catalog',
      tools,
      continueTool,
      recentTools,
      hasPaid: !!(state.paid || state.careerPaid),
      version: state.version
    });
  },

  focusExplore() {
    wx.pageScrollTo({ selector: '#self-tools', offsetY: -20, duration: 300 });
  },

  openGentleVoices() {
    getGrowth().patch({ voiceMood: '全部' });
    wx.navigateTo({ url: '/pages/voices/voices' });
  },

  openDecisionVoices() {
    getGrowth().patch({ voiceMood: '在做选择' });
    wx.navigateTo({ url: '/pages/voices/voices' });
  },

  tapTool(event) {
    const id = event.currentTarget.dataset.id;
    const status = event.currentTarget.dataset.status;
    if (status === 'done') {
      wx.navigateTo({ url: '/pages/growth-result/growth-result?tool=' + id });
      return;
    }
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=' + id });
  },

  resumeTool() {
    if (!this.data.continueTool) return;
    wx.navigateTo({ url: '/pages/growth-question/growth-question?tool=' + this.data.continueTool.id });
  },

  goCelebrity() {
    wx.navigateTo({ url: '/pages/celebrity/celebrity' });
  },

  goReports() {
    wx.navigateTo({ url: '/pages/reports/reports' });
  },

  openPaidReport() {
    wx.navigateTo({ url: '/pages/growth-report/growth-report' });
  },

  startRelationship() {
    this.setData({ mode: 'relationship' });
    wx.setNavigationBarTitle({ title: '关系清晰卡' });
    this.enterRelationshipFlow();
  },

  backToCatalog() {
    this.refreshCatalog();
  },

  // ===== 原有关系轻自测（保持原行为）=====
  enterRelationshipFlow() {
    const enabled = store.isFeatureEnabled('assessment');
    this.setData({ enabled, loading: true });
    if (!enabled) {
      this.setData({ loading: false, error: '人格自测功能当前未开放' });
      return;
    }
    const savedAssessment = store.getState().assessment;
    if (savedAssessment && savedAssessment.result) {
      this.setData({
        loading: false,
        runId: savedAssessment.runId,
        runVersion: savedAssessment.runVersion,
        result: savedAssessment.result,
        mappedTaskId: savedAssessment.mappedTaskId
      });
      return;
    }
    this.loadAssessment();
  },

  goHome,

  goHomeTab() {
    wx.switchTab({ url: '/pages/entry/entry' });
  },

  begin() {
    this.setData({ started: true });
  },

  async restart() {
    store.setAssessment(null);
    this.setData({ loading: true, started: false, submitting: false, error: '', currentIndex: 0, currentAnswer: '', answers: {}, answeredCount: 0, runId: '', result: null, mappedTaskId: '' });
    await this.loadAssessment();
  },

  chooseAnswer(event) {
    if (this.data.submitting) return;
    this.setData({ currentAnswer: event.currentTarget.dataset.value }, () => this.next());
  },

  async loadAssessment() {
    try {
      const client = getApiClient();
      const definition = await client.getCurrentAssessment();
      const items = normalizeItems(definition.data && definition.data.items);
      if (items.length < 6 || items.length > 8) {
        throw new Error(`题目数量异常：${items.length}`);
      }
      const definitionVersion = definition.data.definition_version;
      const run = await client.createAssessmentRun({ definition_version: definitionVersion });
      this.setData({
        loading: false,
        definitionVersion,
        itemCount: items.length,
        items,
        currentItem: items[0],
        ownerSessionId: (store.getState().session || {}).sessionId,
        runId: run.data.run_id,
        runVersion: run.data.version || 1
      });
    } catch (error) {
      this.setData({ loading: false, error: friendlyError(error) });
    }
  },

  onAnswerChange(event) {
    this.setData({ currentAnswer: event.detail.value });
  },

  previous() {
    if (this.data.submitting || this.data.currentIndex === 0) return;
    const index = this.data.currentIndex - 1;
    const item = this.data.items[index];
    this.setData({
      currentIndex: index,
      currentItem: item,
      currentAnswer: this.data.answers[item.item_id] || ''
    });
  },

  async next() {
    const item = this.data.currentItem;
    const optionCode = this.data.currentAnswer;
    if (!item || !optionCode || this.data.submitting) return;

    this.setData({ submitting: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.data.ownerSessionId && this.data.ownerSessionId !== sessionId) {
        await this.restart();
        return;
      }
      const answer = await getApiClient().putAssessmentAnswer(this.data.runId, item.item_id, {
        expected_version: this.data.runVersion,
        option_code: optionCode
      });
      const answers = { ...this.data.answers, [item.item_id]: optionCode };
      const runVersion = answer.data.version;
      const isLast = this.data.currentIndex === this.data.items.length - 1;
      if (isLast) {
        await this.completeAndMap(runVersion, answers);
        return;
      }

      const index = this.data.currentIndex + 1;
      const nextItem = this.data.items[index];
      this.setData({
        submitting: false,
        runVersion,
        answers,
        answeredCount: Object.keys(answers).length,
        currentIndex: index,
        currentItem: nextItem,
        currentAnswer: answers[nextItem.item_id] || ''
      });
    } catch (error) {
      this.setData({ submitting: false, error: friendlyError(error) });
    }
  },

  async completeAndMap(answerVersion, answers) {
    try {
      const client = getApiClient();
      const completed = await client.completeAssessmentRun(this.data.runId);
      const completedVersion = completed.data.version || answerVersion;
      const mapped = await client.mapAssessmentToTask(this.data.runId, {
        expected_version: completedVersion,
        context: 'family',
        clarity_pre: 3,
        confirmed: true
      });
      const task = mapped.data.task || {};
      store.patchActiveTask({
        taskId: task.task_id,
        version: task.version || 1,
        contentVersion: task.content_version || 0,
        source: 'assessment',
        candidateFields: mapped.data.candidate_fields || null
      });
      store.setAssessment({
        runId: this.data.runId,
        runVersion: completedVersion,
        result: completed.data.result || completed.data,
        mappedTaskId: task.task_id || ''
      });
      this.setData({
        submitting: false,
        answers,
        answeredCount: Object.keys(answers).length,
        runVersion: completedVersion,
        result: completed.data.result || completed.data,
        mappedTaskId: task.task_id || ''
      });
    } catch (error) {
      this.setData({ submitting: false, error: friendlyError(error) });
    }
  },

  goToShare() {
    wx.navigateTo({ url: `/pages/share-card/share-card?runId=${this.data.runId}` });
  },

  goToClarity() {
    wx.navigateTo({ url: `/pages/clarity-edit/clarity-edit?taskId=${this.data.mappedTaskId}` });
  }
});
