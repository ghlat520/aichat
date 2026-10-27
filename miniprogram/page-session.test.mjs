import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const localRequire = createRequire(import.meta.url);

function pageFixture(name, savedAssessment = null) {
  const calls = [];
  const scrolls = [];
  const state = { session: { sessionId: 'visitor-new' }, appConfig: { policy_version: 'current' }, assessment: savedAssessment, activeTask: null, venting: null };
  const store = {
    getState: () => state,
    isFeatureEnabled: () => true,
    setAssessment: value => { state.assessment = value; },
    setVenting: value => { state.venting = value; },
    patchVenting: patch => { state.venting = { ...state.venting, ...patch }; }
  };
  const client = {
    async getCurrentAssessment() { calls.push('questions'); return { data: { definition_version: 'v1', items: Array.from({ length: 8 }, (_, i) => ({ item_id: 'q' + i, prompt: '日常场景', options: [{ option_code: 'A', text: '一种选择' }] })) } }; },
    async createAssessmentRun() { calls.push('run'); return { data: { run_id: 'run-new', version: 1 } }; },
    async putAssessmentAnswer(id) { calls.push('answer:' + id); throw new Error('旧题目不应被提交'); },
    async createVentSession() { calls.push('vent'); return { data: { vent_session_id: 'vent-new', version: 1, ai_turns_used: 0, ai_turns_remaining: 8, max_ai_turns: 8, deadline_at: '2099-01-01T00:00:00Z' } }; },
    async finishVentSession(id) { calls.push('finish:' + id); return { data: { summary: {} } }; },
    async confirmVentSummary(id) { calls.push('confirm:' + id); return { data: { task_id: 'task-new' } }; },
    async createVentTurn(id) { calls.push('turn:' + id); return { data: { version: 2, reply: { text: '可以从一个具体片段开始。' }, ai_turns_used: 1, ai_turns_remaining: 7, deadline_at: '2099-01-01T00:00:00Z' } }; }
  };
  let page;
  const dependencies = { store, getApiClient: () => client, ensureEntryUnlocked: () => true, ensureGuestSession: async () => state.session.sessionId, syncTabBar() {}, goHome() {}, routeToSafetyIfBlocked: () => false, friendlyError: error => error.message };
  // V1.2：assessment 页新增 growth-store / growth-content 依赖，按路径分发 mock
  const growthState = { answers: { mbti: [], traits: [], strengths: [] }, results: { mbti: false, traits: false, strengths: false }, sources: {}, paid: false, careerPaid: false, version: '1.0' };
  const growthStoreMock = { get: () => growthState, patch: (part) => Object.assign(growthState, part) };
  const growthContentMock = {
    TOOL_ORDER: ['mbti', 'traits', 'strengths'],
    TOOLS: Object.fromEntries(['mbti', 'traits', 'strengths'].map((id) => [id, { name: '工具' + id, short: id, desc: '描述', color: '' }])),
    QUESTIONS: { mbti: Array(6).fill('题'), traits: Array(6).fill('题'), strengths: Array(6).fill('题') }
  };
  const require = (path) => {
    if (path.endsWith('growth-store')) return growthStoreMock;
    if (path.endsWith('growth-content')) return growthContentMock;
    return dependencies;
  };
  const context = { require, wx: { showToast() {}, setNavigationBarTitle() {}, pageScrollTo(options) { scrolls.push({ selector: options.selector, messageCount: page.data.messages.length }); } }, Page(config) {
    page = { ...config, data: structuredClone(config.data), setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); } };
  } };
  vm.runInNewContext(readFileSync(new URL(`./pages/${name}/${name}.js`, import.meta.url), 'utf8'), context);
  return { page, calls, state, scrolls };
}

test('关系自测入口直接恢复已有测评；默认落地为自测首页目录', () => {
  const saved = { runId: 'completed-run', runVersion: 9, mappedTaskId: 'task-current', result: { current_tendency: '当前沟通起点' } };
  const { page, calls } = pageFixture('assessment', saved);
  page.onLoad({ relationship: '1' });
  assert.equal(page.data.mappedTaskId, 'task-current');
  assert.equal(page.data.result.current_tendency, '当前沟通起点');
  assert.equal(page.data.mode, 'relationship');
  assert.deepEqual(calls, []);
});

test('匿名会话重新建立后，自测不会携旧 run 提交答案', async () => {
  const { page, calls } = pageFixture('assessment');
  Object.assign(page.data, { runId: 'run-old', ownerSessionId: 'visitor-old', currentItem: { item_id: 'q-old' }, currentAnswer: 'A', started: true });
  await page.next();
  assert.deepEqual(calls, ['questions', 'run']);
  assert.equal(page.data.runId, 'run-new');
  assert.equal(page.data.error, '');
});

test('倾诉结束后可以开始新的对话', async () => {
  const { page, calls } = pageFixture('venting');
  Object.assign(page.data, { loading: false, ventSessionId: 'vent-old', limitReached: true, aiTurnsRemaining: 0, summary: { observed_fact: '旧总结' } });
  await page.restart();
  assert.deepEqual(calls, ['vent']);
  assert.equal(page.data.ventSessionId, 'vent-new');
  assert.equal(page.data.limitReached, false);
  assert.equal(page.data.summary, null);
});

test('恢复匿名会话后，当前心事发送到新对话而非旧资源', async () => {
  const { page, calls } = pageFixture('venting');
  Object.assign(page.data, { loading: false, ventSessionId: 'vent-old', ownerSessionId: 'visitor-old', deadlineAt: '2099-01-01T00:00:00Z', input: '我希望把这件事说清楚。' });
  await page.send();
  assert.deepEqual(calls, ['vent', 'turn:vent-new']);
  assert.equal(page.data.messages.length, 2);
  assert.equal(page.data.messages[0].text, '我希望把这件事说清楚。');
  assert.equal(page.data.error, '');
});

test('说一说连续两轮更新完成后滚到最新内容和输入框', async () => {
  const { page, scrolls } = pageFixture('venting');
  await page.start();
  for (let i = 0; i < 2; i++) {
    page.onInput({ detail: { value: '我想把今天发生的一件小事慢慢说明白。'.repeat(12) } });
    await page.send();
  }
  assert.deepEqual(scrolls, [
    { selector: '#venting-bottom', messageCount: 2 },
    { selector: '#venting-bottom', messageCount: 4 }
  ]);
});

for (const action of ['finish', 'confirmSummary']) {
  test(`匿名会话重建后 ${action} 保留旧内容并提示重新开始，不提交旧对话`, async () => {
    const { page, calls } = pageFixture('venting');
    Object.assign(page.data, { ownerSessionId: 'visitor-old', ventSessionId: 'vent-old', aiTurnsUsed: 1, messages: [{ role: 'user', text: '保留的内容' }], summary: action === 'finish' ? null : { observed_fact: '保留的内容' } });
    await page[action]();
    assert.deepEqual(calls, []);
    assert.equal(page.data.error, '这次对话已结束，请开始新的倾诉。');
    assert.equal(page.data.messages[0].text, '保留的内容');
    if (action === 'finish') assert.equal(page.data.limitReached, true);
    else assert.equal(page.data.summary.observed_fact, '保留的内容');
    assert.equal(page.data.finishing, false);
    assert.equal(page.data.confirming, false);
  });
}

function questionFixture() {
  const timers = new Map();
  let timerId = 0;
  const growth = localRequire('./growth-store.js').createGrowthStore({ getStorageSync() {}, setStorageSync() {} });
  growth.patch({ answers: { mbti: [], traits: [1, 2, 3, 4], strengths: [] }, autoNext: false });
  const answers = growth.get().answers.traits;
  let page;
  const wx = { setNavigationBarTitle() {}, navigateBack() {}, switchTab() {}, redirectTo() {}, showModal() {} };
  vm.runInNewContext(readFileSync(new URL('./pages/growth-question/growth-question.js', import.meta.url), 'utf8'), {
    require: path => path.endsWith('growth-store') ? { getGrowth: () => growth } : localRequire('./growth-content.js'),
    wx,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id),
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  page.onLoad({ tool: 'traits' });
  return { page, answers, flushTimers() { for (const fn of timers.values()) fn(); timers.clear(); } };
}

test('性格特质修改前题后逐题继续，不跳回首道未答题', () => {
  const { page, answers } = questionFixture();
  page.previous();
  page.previous();
  page.choose({ currentTarget: { dataset: { value: 5 } } });
  page.save();
  assert.equal(answers[2], 5);
  assert.equal(page.data.index, 3);
  assert.equal(page.data.selected, 4);
});

test('关闭自动下一题会取消尚未执行的自动保存', () => {
  const { page, answers, flushTimers } = questionFixture();
  page.toggleAutoNext({ detail: { value: ['auto'] } });
  page.choose({ currentTarget: { dataset: { value: 5 } } });
  page.toggleAutoNext({ detail: { value: [] } });
  flushTimers();
  assert.equal(page.data.index, 4);
  assert.equal(page.data.selected, 5);
  assert.equal(answers.length, 4);
});

test('暂停与返回前题取消延迟保存，保留已保存进度', () => {
  for (const action of ['pause', 'previous', 'onHide']) {
    const { page, answers, flushTimers } = questionFixture();
    page.toggleAutoNext({ detail: { value: ['auto'] } });
    page.choose({ currentTarget: { dataset: { value: 5 } } });
    page[action]();
    flushTimers();
    assert.equal(answers.length, 4);
    assert.equal(page.data.index, action === 'previous' ? 3 : 4);
    if (action === 'pause') {
      assert.equal(page.data.sheet, 'pause');
      assert.equal(page.data.savedCount, 4);
    }
  }
});
