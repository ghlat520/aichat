const {
  store,
  getSessionBoundClient,
  friendlyError,
  ensureGuestSession,
  syncTabBar,
  goHome,
  routeToSafetyIfBlocked
} = require('../../app-store');
const { getPractice, setFlowIntent, takeFlowIntent } = require('../../practice-store');
const UI = require('../../growth-ui-data.js');
let practiceEditorSequence = 0;
const STAGES = ['讲清', '反馈', '练习', '行动', '复盘'];
const OUTCOMES = [{ id: 'done', label: '已经尝试' }, { id: 'partial', label: '尝试了一部分' }, { id: 'not-started', label: '尚未开始' }];
function localOwner() {
  const session = store.getState().session;
  return store.getLogoutVersion() + ':' + (session ? session.sessionId : 'preview');
}
function practiceView(snapshot) {
  const c = snapshot.current, deep = snapshot.mode === 'deep';
  const field = (key, title, placeholder, optional = false) => ({ key, title, placeholder, optional, value: c[key], maxlength: key === 'facts' ? 2000 : key === 'rehearsal' ? 900 : 400 });
  const view = {
    ...snapshot, screen: 'form', title: '', description: '', fields: [], extraFields: [], quotes: [], primary: null, secondary: null,
    art: UI.images.feedback, source: c.sourceDiary || null,
    stages: STAGES.map((title, index) => ({ title, index, selected: index === c.step, disabled: index > Math.min(4, c.confirmed + 1) })),
    directions: Object.keys(UI.directions).map(id => ({ id, name: UI.directions[id].name, selected: id === c.goal })),
    outcomes: OUTCOMES.map(row => ({ ...row, selected: c.outcome === row.id })),
    history: snapshot.records.filter(row => row.id !== c.id),
    reviewView: deep ? c.step === 4 : c.lightView === 'review'
  };
  const planForm = () => {
    view.title = '设定微行动';
    view.description = '选一个两分钟就能开始的动作。';
    view.fields = [field('what', '行动内容', '例如：先说“我确认一下安排，再答复你”。'), field('when', '开始时机', '例如：收到新的任务请求时。')];
    if (deep) view.fields.push(field('criterion', '怎样算完成这一步？', snapshot.direction.criterion));
    view.extraFields = [field('backup', '备选动作', '把动作再缩小一点，或换一个更合适的时机。', true)];
    if (!deep) view.extraFields.push(field('criterion', '完成标准', '只设一个自己看得见的标准。', true));
    view.extraTitle = '备选动作与完成标准';
    view.primary = { label: '保存这个微行动', action: deep ? 'save-plan' : 'light-save-plan' };
    view.helper = '保存的是计划。实际有没有尝试，由你在复盘时记录。';
    if (deep && c.rehearsal) view.quotes = [{ title: '练习内容', text: c.rehearsal }];
  };
  const plan = () => {
    if (snapshot.planReady && (deep ? c.confirmed >= 3 : c.lightView !== 'edit-plan')) {
      view.screen = 'plan';
      view.title = '我的微行动'; view.description = '尝试之后，再回来留一句反馈。';
      view.primary = { label: '记录三问复盘', action: deep ? 'review' : 'light-review' };
      view.secondary = { label: '调整微行动', action: deep ? 'edit-plan' : 'light-edit-plan' };
    } else planForm();
  };
  const review = () => {
    if (!snapshot.planReady) {
      view.screen = 'empty'; view.title = '先设定微行动';
      view.description = '先定下动作，再记录尝试与反馈。';
      view.primary = { label: '选一个微行动', action: deep ? 'mode-light' : 'light-plan' };
    } else if (snapshot.reviewed && !c.reviewEditing) {
      view.screen = 'review-saved'; view.title = '复盘记录'; view.description = '三问复盘已保存';
      view.quotes = [{ title: '实际行动', text: c.actual }, { title: '效果与阻碍', text: c.result }, { title: '下一步调整', text: c.next }].filter(row => row.text);
      view.primary = { label: '开始新一轮微行动', action: 'new' };
      view.secondary = { label: '调整这次复盘', action: 'edit-review' };
    } else {
      view.screen = 'review-form'; view.title = '三问复盘';
      view.description = '每题一句，也可以记录尚未开始的原因。';
      view.fields = [field('actual', '1. 实际做了什么？', '哪怕只做了一点，或者还没开始。'), field('result', '2. 效果与阻碍是什么？', '留下一点真实反馈，不必总结大道理。', deep && c.outcome === 'not-started'), field('next', '3. 下次调整什么？', '继续有效的一步，或把动作再缩小一点。')];
      view.showOutcome = true;
      view.primary = { label: '保存三问复盘', action: deep ? 'save-review' : 'light-save-review' };
    }
  };
  if (!deep) { if (view.reviewView) review(); else plan(); }
  else if (c.step === 0) {
    view.title = '梳理这件事'; view.description = '从反馈里找线索，在练习中做调整，用一次行动验证。'; view.showGoals = true;
    view.fields = [field('facts', '发生了什么？', '从一件具体的事开始，暂时分开事实与猜测。'), field('desired', '你希望发生什么变化？', '写下你在意的需要，或想推进的一件事。')];
    view.extraTitle = '补充感受与想法';
    view.extraFields = [field('feeling', '当时，我有什么感受？', '可以用自己的话描述。', true), field('interpretation', '我脑中的解释或猜测', '哪些尚未经过确认？', true)];
    view.primary = { label: '看看可以调整的角度', action: 'next' };
  } else if (c.step === 1) {
    view.title = '查看反馈'; view.description = '先核对这件事，再决定什么对你有启发。'; view.showFeedback = true;
    view.quotes = [{ title: '期望变化', text: c.desired }, { title: '事件经过', text: c.facts }];
    view.fields = [field('insight', '我认同，或想修正的一点', '这个角度符合我吗？我还发现了什么？')];
    view.primary = { label: '把这一点放进练习', action: 'next' };
  } else if (c.step === 2) {
    view.title = '练习新回应'; view.description = '写出愿意尝试的回应或做法，按自己的意思修改。'; view.showRehearsal = true;
    view.quotes = [{ title: '练习目标', text: c.insight }];
    view.fields = [field('rehearsal', '我的新回应或新做法', '用自己的话写，不必套用句式。')];
    view.primary = { label: '练习之后，定下一步', action: 'next' };
  } else if (c.step === 3) plan();
  else review();
  return view;
}

function splitList(value) {
  return value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

Page({
  data: {
    workspaceMode: 'growth',
    practice: null,
    practiceEditorToken: '',
    practiceError: '',
    practiceExtra: false,
    practiceHistory: false,
    loading: true,
    sending: false,
    finishing: false,
    confirming: false,
    enabled: true,
    error: '',
    ventSessionId: '',
    ownerSessionId: '',
    sessionHidden: false,
    version: 0,
    messages: [],
    input: '',
    maxTurns: 8,
    aiTurnsUsed: 0,
    aiTurnsRemaining: 8,
    deadlineAt: '',
    limitReached: false,
    summary: null,
    summaryVersion: '',
    summaryEmotionText: '',
    summaryNeedsText: '',
    confirmedTaskId: ''
  },

  onLoad(query = {}) {
    if (query.mode === 'online') { this.setData({ workspaceMode: 'online' }); this.start(); }
  },

  onShow() {
    syncTabBar(this, 3);
    const intent = takeFlowIntent(localOwner(), 'practice');
    if (intent) this.setData({ workspaceMode: 'growth' });
    if (this.data.workspaceMode === 'growth') {
      this.practiceVisible = true;
      this.practiceOwner = localOwner();
      const practice = this.practiceStore();
      if (intent) { practice.act('mode-light'); practice.act(intent.type === 'review' ? 'light-review' : 'light-plan'); }
      this.refreshPractice();
      return;
    }
    const sessionId = (store.getState().session || {}).sessionId;
    this.setData({ sessionHidden: !!this.data.ownerSessionId && this.data.ownerSessionId !== sessionId });
    if (this.isTimeExpired()) this.setData({ limitReached: true });
  },

  goHome,
  onHide() { this.practiceVisible = false; this.setData({ practiceEditorToken: '' }); },
  practiceStore() { return getPractice(localOwner()); },
  refreshPractice(scroll = false) {
    this.setData({ practice: practiceView(this.practiceStore().get()), practiceEditorToken: String(++practiceEditorSequence), practiceError: '' }, scroll ? () => wx.pageScrollTo({ scrollTop: 0, duration: 0 }) : undefined);
  },
  checkPracticeEvent(event) {
    if (this.data.workspaceMode !== 'growth' || !this.practiceVisible) return false;
    if (this.practiceOwner !== localOwner()) { this.onShow(); return false; }
    const dataset = event && event.currentTarget && event.currentTarget.dataset;
    return Boolean(this.data.practiceEditorToken && dataset && dataset.editor === this.data.practiceEditorToken);
  },
  onPracticeField(event) {
    if (!this.checkPracticeEvent(event)) return;
    try {
      this.practiceStore().updateField(event.currentTarget.dataset.key, event.detail.value);
      if (this.data.practiceError) this.setData({ practiceError: '' });
    } catch (error) { this.setData({ practiceError: error.message }); }
  },
  practiceAction(event) {
    if (!this.checkPracticeEvent(event)) return;
    const action = event.currentTarget.dataset.action;
    if (action === 'extra' || action === 'history') {
      this.refreshPractice();
      this.setData(action === 'extra' ? { practiceExtra: !this.data.practiceExtra } : { practiceHistory: !this.data.practiceHistory });
      return;
    }
    if (action === 'diary' || action === 'source') {
      const c = this.practiceStore().get().current;
      setFlowIntent(localOwner(), action === 'source' && c.sourceDiaryId ? { target: 'diary', type: 'entry', id: c.sourceDiaryId } : { target: 'diary', type: 'write' });
      wx.switchTab({ url: '/pages/diary/diary' }); return;
    }
    try {
      if (action === 'goal' || action === 'outcome') this.practiceStore().updateField(action, event.currentTarget.dataset.value);
      else this.practiceStore().act(action, event.currentTarget.dataset.value);
      this.refreshPractice(!['goal', 'outcome', 'scaffold'].includes(action));
      if (['light-save-plan', 'save-plan', 'light-save-review', 'save-review'].includes(action)) wx.showToast({ title: action.includes('review') ? '三问复盘已暂存' : '微行动计划已暂存', icon: 'none' });
    } catch (error) { this.setData({ practiceError: error.message }); }
  },
  openOnline(event) {
    if (!this.checkPracticeEvent(event)) return;
    this.practiceVisible = false;
    this.setData({ workspaceMode: 'online', practiceEditorToken: '' });
    this.onShow();
    this.start();
  },
  closeOnline() { this.setData({ workspaceMode: 'growth' }); this.onShow(); },

  async restart() {
    const restartVersion = (this.restartVersion || 0) + 1;
    this.restartVersion = restartVersion;
    const previous = { ...this.data };
    if (previous.input || previous.messages.length || previous.summary) {
      if (!this.savedDrafts) this.savedDrafts = new Map();
      this.savedDrafts.set(`${previous.ownerSessionId}:${previous.ventSessionId}`, previous);
    }
    this.setData({ loading: true, sending: false, finishing: false, confirming: false, error: '', ventSessionId: '', ownerSessionId: '', sessionHidden: false, messages: [], input: '', aiTurnsUsed: 0, aiTurnsRemaining: 8, deadlineAt: '', limitReached: false, summary: null, summaryVersion: '', confirmedTaskId: '' });
    await this.start();
    if (this.restartVersion === restartVersion && !this.data.ventSessionId) {
      const error = this.data.error;
      const sessionId = (store.getState().session || {}).sessionId;
      this.setData({ ...previous, loading: false, sending: false, finishing: false, confirming: false, error,
        sessionHidden: !!previous.ownerSessionId && previous.ownerSessionId !== sessionId });
    }
  },

  async start() {
    if (this.data.loading === false && this.data.ventSessionId) return;
    const startVersion = (this.startVersion || 0) + 1;
    this.startVersion = startVersion;
    this.setData({ loading: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.startVersion !== startVersion) return;
      this.setData({ ownerSessionId: sessionId });
      const config = store.getState().appConfig || {};
      const response = await getSessionBoundClient(sessionId).createVentSession({
        policy_version: config.policy_version,
        confirmed: true
      });
      if (this.startVersion !== startVersion) return;
      if ((store.getState().session || {}).sessionId !== sessionId) {
        this.setData({ loading: false, sessionHidden: true });
        return;
      }
      const data = response.data;
      store.setVenting({
        ventSessionId: data.vent_session_id,
        version: data.version,
        rawMessages: []
      });
      this.setData({
        loading: false,
        ventSessionId: data.vent_session_id,
        ownerSessionId: sessionId,
        version: data.version,
        aiTurnsUsed: data.ai_turns_used,
        aiTurnsRemaining: data.ai_turns_remaining,
        maxTurns: data.max_ai_turns,
        deadlineAt: data.deadline_at
      });
    } catch (error) {
      if (this.startVersion === startVersion) {
        const sessionId = (store.getState().session || {}).sessionId;
        this.setData({ loading: false, error: friendlyError(error),
          sessionHidden: !!this.data.ownerSessionId && this.data.ownerSessionId !== sessionId });
      }
    }
  },

  onInput(event) {
    this.setData({ input: event.detail.value });
  },

  isTimeExpired() {
    return Boolean(this.data.deadlineAt && Date.now() >= Date.parse(this.data.deadlineAt));
  },

  async send() {
    const text = this.data.input.trim();
    if (!text || this.data.loading || !this.data.ventSessionId || this.data.sending) return;
    if (this.data.limitReached || this.data.aiTurnsRemaining <= 0 || this.isTimeExpired()) {
      this.setData({ limitReached: true });
      wx.showToast({ title: '本次倾诉已到停止点', icon: 'none' });
      return;
    }
    const ventId = this.data.ventSessionId;
    const owner = this.data.ownerSessionId;
    this.setData({ sending: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.data.ownerSessionId && this.data.ownerSessionId !== sessionId) {
        await this.restart();
        if (this.data.ownerSessionId !== sessionId || this.data.sessionHidden || !this.data.ventSessionId) return;
        this.setData({ input: text });
        await this.send();
        return;
      }
      const response = await getSessionBoundClient(sessionId).createVentTurn(ventId, {
        expected_version: this.data.version,
        text
      });
      if ((store.getState().session || {}).sessionId !== sessionId || this.data.ventSessionId !== ventId) {
        if (this.data.ventSessionId === ventId) this.setData({ sending: false, sessionHidden: true });
        return;
      }
      const data = response.data;
      const messages = this.data.messages.concat([{ role: 'user', text }]);
      if (data.reply) {
        messages.push({ role: 'assistant', text: data.reply.text, aiLabel: data.reply.ai_label });
      }
      const limitReached = data.ai_turns_remaining <= 0 || this.isTimeExpired();
      store.patchVenting({
        version: data.version,
        rawMessages: (store.getState().venting.rawMessages || []).concat([text])
      });
      this.setData({
        sending: false,
        input: '',
        messages,
        version: data.version,
        aiTurnsUsed: data.ai_turns_used,
        aiTurnsRemaining: data.ai_turns_remaining,
        deadlineAt: data.deadline_at,
        limitReached
      }, () => {
        if (!routeToSafetyIfBlocked(data)) {
          wx.pageScrollTo({ selector: '#venting-bottom', duration: 200 });
        }
      });
    } catch (error) {
      if (this.data.ventSessionId === ventId && this.data.ownerSessionId === owner) this.setData({ sending: false, error: friendlyError(error) });
    }
  },

  async finish() {
    if (this.data.finishing || !this.data.aiTurnsUsed) return;
    const ventId = this.data.ventSessionId;
    const owner = this.data.ownerSessionId;
    this.setData({ finishing: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.data.ownerSessionId !== sessionId) {
        this.setData({ limitReached: true });
        throw new Error('这次对话已结束，请开始新的倾诉。');
      }
      const response = await getSessionBoundClient(sessionId).finishVentSession(ventId, {
        expected_version: this.data.version
      });
      if ((store.getState().session || {}).sessionId !== sessionId || this.data.ventSessionId !== ventId) {
        if (this.data.ventSessionId === ventId) this.setData({ finishing: false, sessionHidden: true });
        return;
      }
      const data = response.data;
      const summary = data.summary || {};
      store.patchVenting({
        version: data.version,
        summaryVersion: data.summary_version,
        summary
      });
      this.setData({
        finishing: false,
        version: data.version,
        summary,
        summaryVersion: data.summary_version,
        summaryEmotionText: (summary.emotion || []).join('，'),
        summaryNeedsText: (summary.need_or_boundary || []).join('，'),
        limitReached: true
      });
    } catch (error) {
      if (this.data.ventSessionId === ventId && this.data.ownerSessionId === owner) this.setData({ finishing: false, error: friendlyError(error) });
    }
  },

  onSummaryInput(event) {
    const key = event.currentTarget.dataset.key;
    const value = event.detail.value;
    if (key === 'emotion') {
      this.setData({
        summaryEmotionText: value,
        summary: { ...this.data.summary, emotion: splitList(value) }
      });
      return;
    }
    if (key === 'need_or_boundary') {
      this.setData({
        summaryNeedsText: value,
        summary: { ...this.data.summary, need_or_boundary: splitList(value) }
      });
      return;
    }
    const parsed = key === 'clarity_pre' ? Number(value) : value;
    this.setData({ summary: { ...this.data.summary, [key]: parsed } });
  },

  async confirmSummary() {
    if (this.data.confirming || !this.data.summary) return;
    const ventId = this.data.ventSessionId;
    const owner = this.data.ownerSessionId;
    this.setData({ confirming: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.data.ownerSessionId !== sessionId) {
        throw new Error('这次对话已结束，请开始新的倾诉。');
      }
      const summary = this.data.summary;
      const response = await getSessionBoundClient(sessionId).confirmVentSummary(ventId, {
        expected_version: this.data.version,
        summary_version: this.data.summaryVersion,
        confirmed: true,
        fields: {
          context: summary.context,
          observed_fact: summary.observed_fact,
          looping_thought: summary.looping_thought,
          emotion: summary.emotion,
          need_or_boundary: summary.need_or_boundary,
          current_goal: summary.current_goal,
          clarity_pre: summary.clarity_pre
        }
      });
      if ((store.getState().session || {}).sessionId !== sessionId || this.data.ventSessionId !== ventId) {
        if (this.data.ventSessionId === ventId) this.setData({ confirming: false, sessionHidden: true });
        return;
      }
      const data = response.data;
      store.patchVenting({ version: data.version, confirmed: true });
      store.setActiveTask({
        taskId: data.task_id,
        version: data.task_version,
        contentVersion: data.content_version,
        source: 'vent',
        fields: summary
      });
      this.setData({
        confirming: false,
        version: data.version,
        confirmedTaskId: data.task_id
      });
    } catch (error) {
      if (this.data.ventSessionId === ventId && this.data.ownerSessionId === owner) this.setData({ confirming: false, error: friendlyError(error) });
    }
  },

  goToClarity() {
    wx.navigateTo({ url: '/pages/clarity-edit/clarity-edit?entry=direct' });
  },

  goToMirror() {
    wx.redirectTo({ url: `/pages/mirror/mirror?taskId=${this.data.confirmedTaskId}` });
  }
});
