const { store, getSessionBoundClient, friendlyError, ensureEntryUnlocked, ensureGuestSession, syncTabBar, goHome } = require('../../app-store');
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
    sessionHidden: false,
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
    else if (this.data.ownerSessionId) {
      this.setData({ sessionHidden: this.data.ownerSessionId !== (store.getState().session || {}).sessionId });
    }
  },

  // ===== 自测首页（catalog，2026-11-03 原型 V2 discover 屏）=====
  refreshCatalog() {
    const growth = getGrowth();
    const state = growth.get();
    const mbtiAnswered = growth.answeredCount('mbti');
    const mbtiDone = state.results.mbti && mbtiAnswered === CONTENT.QUESTIONS.mbti.length;
    const viaAnswered = growth.viaAnsweredCount();
    const viaDone = growth.viaComplete();

    const tools = [
      {
        id: 'mbti',
        name: CONTENT.TOOLS.mbti.name,
        desc: CONTENT.TOOLS.mbti.desc,
        tag: '40 题 · 自动切换',
        statusLabel: mbtiDone ? '已完成问卷 · 查看结果' : mbtiAnswered > 0 ? '进行中' : '免费开始'
      },
      {
        id: 'via',
        name: CONTENT.TOOLS.via.name,
        desc: CONTENT.TOOLS.via.desc,
        tag: '72 题 · 24 项优势',
        statusLabel: viaDone ? '已完成 · 查看结果' : viaAnswered > 0 ? '继续 ' + viaAnswered + ' / 72 题' : '探索性自评'
      },
      {
        id: 'cross',
        name: 'VIA × MBTI 对照表',
        desc: '查看 16 型各自的优势参考，换一个角度认识自己。',
        tag: '每型 5 项 · 非测评结论',
        statusLabel: '16 型参考'
      }
    ];
    const continueTool = !mbtiDone && mbtiAnswered > 0
      ? { short: 'MBTI 性格测试', answered: mbtiAnswered, total: CONTENT.QUESTIONS.mbti.length, current: growth.resumeIndex('mbti') + 1 }
      : null;
    const recentTools = [];
    if (mbtiDone) recentTools.push({ id: 'mbti', name: 'MBTI 性格测试 · 结果样例', note: '免费查看' });
    if (viaDone) recentTools.push({ id: 'via', name: 'VIA 性格优势 · 我的排序', note: '已完成 72 题 · 本轮自评' });
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
    // V2：轻阅读入口改为 16 型优缺点参考页
    wx.navigateTo({ url: '/pages/mbti-types/mbti-types' });
  },

  tapTool(event) {
    const id = event.currentTarget.dataset.id;
    if (id === 'mbti') {
      const growth = getGrowth();
      const done = growth.get().results.mbti && growth.answeredCount('mbti') === CONTENT.QUESTIONS.mbti.length;
      wx.navigateTo({ url: done ? '/pages/growth-result/growth-result?tool=mbti' : '/pages/growth-intro/growth-intro?tool=mbti' });
      return;
    }
    if (id === 'via') {
      const growth = getGrowth();
      wx.navigateTo({ url: growth.viaComplete() ? '/pages/via-result/via-result' : '/pages/via-intro/via-intro' });
      return;
    }
    if (id === 'cross') {
      wx.navigateTo({ url: '/pages/via-mbti/via-mbti' });
    }
  },

  resumeTool() {
    if (!this.data.continueTool) return;
    wx.navigateTo({ url: '/pages/growth-question/growth-question?tool=mbti' });
  },

  tapRecent(event) {
    const id = event.currentTarget.dataset.id;
    if (id === 'via') {
      getGrowth().viaPatch({ preview: false });
      wx.navigateTo({ url: '/pages/via-result/via-result' });
      return;
    }
    wx.navigateTo({ url: '/pages/growth-result/growth-result?tool=mbti' });
  },

  goReports() {
    wx.navigateTo({ url: '/pages/reports/reports' });
  },

  openPaidReport() {
    wx.navigateTo({ url: '/pages/growth-report/growth-report' });
  },

  startRelationship() {
    const currentId = (store.getState().session || {}).sessionId;
    const sessionHidden = !!this.data.ownerSessionId && this.data.ownerSessionId !== currentId;
    this.setData({ mode: 'relationship', sessionHidden });
    wx.setNavigationBarTitle({ title: '自有引力' });
    if (!sessionHidden) this.enterRelationshipFlow();
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
        ownerSessionId: (store.getState().session || {}).sessionId,
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
    this.setData({ loading: true, started: false, submitting: false, sessionHidden: false, ownerSessionId: '', error: '', currentIndex: 0, currentAnswer: '', answers: {}, answeredCount: 0, runId: '', result: null, mappedTaskId: '' });
    await this.loadAssessment();
  },

  chooseAnswer(event) {
    if (this.data.submitting) return;
    this.setData({ currentAnswer: event.currentTarget.dataset.value }, () => this.next());
  },

  async loadAssessment() {
    const loadVersion = (this.loadVersion || 0) + 1;
    this.loadVersion = loadVersion;
    try {
      const sessionId = await ensureGuestSession();
      if (this.loadVersion !== loadVersion) return;
      this.setData({ ownerSessionId: sessionId });
      const client = getSessionBoundClient(sessionId);
      const definition = await client.getCurrentAssessment();
      if (this.loadVersion !== loadVersion || (store.getState().session || {}).sessionId !== sessionId) return;
      const items = normalizeItems(definition.data && definition.data.items);
      if (items.length < 6 || items.length > 8) {
        throw new Error(`题目数量异常：${items.length}`);
      }
      const definitionVersion = definition.data.definition_version;
      const run = await client.createAssessmentRun({ definition_version: definitionVersion });
      if (this.loadVersion !== loadVersion || (store.getState().session || {}).sessionId !== sessionId) return;
      this.setData({
        loading: false,
        definitionVersion,
        itemCount: items.length,
        items,
        currentItem: items[0],
        ownerSessionId: sessionId,
        runId: run.data.run_id,
        runVersion: run.data.version || 1
      });
    } catch (error) {
      if (this.loadVersion === loadVersion) this.setData({ loading: false, error: friendlyError(error),
        sessionHidden: !!this.data.ownerSessionId && this.data.ownerSessionId !== (store.getState().session || {}).sessionId });
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

    const runId = this.data.runId;
    this.setData({ submitting: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.data.ownerSessionId && this.data.ownerSessionId !== sessionId) {
        await this.restart();
        return;
      }
      const answer = await getSessionBoundClient(sessionId).putAssessmentAnswer(runId, item.item_id, {
        expected_version: this.data.runVersion,
        option_code: optionCode
      });
      if ((store.getState().session || {}).sessionId !== sessionId || this.data.runId !== runId) return;
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
      if (this.data.runId === runId) this.setData({ submitting: false, error: friendlyError(error) });
    }
  },

  async completeAndMap(answerVersion, answers) {
    const owner = this.data.ownerSessionId;
    const runId = this.data.runId;
    const isCurrent = () => owner && (store.getState().session || {}).sessionId === owner && this.data.runId === runId;
    try {
      const client = getSessionBoundClient(owner);
      const completed = await client.completeAssessmentRun(runId);
      if (!isCurrent()) return;
      const completedVersion = completed.data.version || answerVersion;
      const mapped = await client.mapAssessmentToTask(runId, {
        expected_version: completedVersion,
        context: 'family',
        clarity_pre: 3,
        confirmed: true
      });
      if (!isCurrent()) return;
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
      if (isCurrent()) this.setData({ submitting: false, error: friendlyError(error) });
    }
  },

  goToShare() {
    wx.navigateTo({ url: `/pages/share-card/share-card?runId=${this.data.runId}` });
  },

  goToClarity() {
    wx.navigateTo({ url: `/pages/clarity-edit/clarity-edit?taskId=${this.data.mappedTaskId}` });
  }
});
