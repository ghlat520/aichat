const {
  store,
  getApiClient,
  friendlyError,
  ensureGuestSession,
  syncTabBar,
  goHome,
  routeToSafetyIfBlocked
} = require('../../app-store');

function splitList(value) {
  return value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

Page({
  data: {
    loading: true,
    sending: false,
    finishing: false,
    confirming: false,
    enabled: true,
    error: '',
    ventSessionId: '',
    ownerSessionId: '',
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

  onLoad() {
    this.start();
  },

  onShow() {
    syncTabBar(this, 2);
    if (this.isTimeExpired()) this.setData({ limitReached: true });
  },

  goHome,

  async restart() {
    this.setData({ loading: true, sending: false, finishing: false, confirming: false, error: '', ventSessionId: '', messages: [], input: '', aiTurnsUsed: 0, aiTurnsRemaining: 8, deadlineAt: '', limitReached: false, summary: null, summaryVersion: '', confirmedTaskId: '' });
    await this.start();
  },

  async start() {
    if (this.data.loading === false && this.data.ventSessionId) return;
    this.setData({ loading: true, error: '' });
    try {
      await ensureGuestSession();
      const config = store.getState().appConfig || {};
      const response = await getApiClient().createVentSession({
        policy_version: config.policy_version,
        confirmed: true
      });
      const data = response.data;
      store.setVenting({
        ventSessionId: data.vent_session_id,
        version: data.version,
        rawMessages: []
      });
      this.setData({
        loading: false,
        ventSessionId: data.vent_session_id,
        ownerSessionId: (store.getState().session || {}).sessionId,
        version: data.version,
        aiTurnsUsed: data.ai_turns_used,
        aiTurnsRemaining: data.ai_turns_remaining,
        maxTurns: data.max_ai_turns,
        deadlineAt: data.deadline_at
      });
    } catch (error) {
      this.setData({ loading: false, error: friendlyError(error) });
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
    this.setData({ sending: true, error: '' });
    try {
      const sessionId = await ensureGuestSession();
      if (this.data.ownerSessionId && this.data.ownerSessionId !== sessionId) {
        await this.restart();
        this.setData({ input: text });
        if (this.data.ventSessionId) await this.send();
        return;
      }
      const response = await getApiClient().createVentTurn(this.data.ventSessionId, {
        expected_version: this.data.version,
        text
      });
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
      this.setData({ sending: false, error: friendlyError(error) });
    }
  },

  async finish() {
    if (this.data.finishing || !this.data.aiTurnsUsed) return;
    this.setData({ finishing: true, error: '' });
    try {
      if (this.data.ownerSessionId !== await ensureGuestSession()) {
        this.setData({ limitReached: true });
        throw new Error('这次对话已结束，请开始新的倾诉。');
      }
      const response = await getApiClient().finishVentSession(this.data.ventSessionId, {
        expected_version: this.data.version
      });
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
      this.setData({ finishing: false, error: friendlyError(error) });
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
    this.setData({ confirming: true, error: '' });
    try {
      if (this.data.ownerSessionId !== await ensureGuestSession()) {
        throw new Error('这次对话已结束，请开始新的倾诉。');
      }
      const summary = this.data.summary;
      const response = await getApiClient().confirmVentSummary(this.data.ventSessionId, {
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
      this.setData({ confirming: false, error: friendlyError(error) });
    }
  },

  goToClarity() {
    wx.navigateTo({ url: '/pages/clarity-edit/clarity-edit?entry=direct' });
  },

  goToMirror() {
    wx.redirectTo({ url: `/pages/mirror/mirror?taskId=${this.data.confirmedTaskId}` });
  }
});
