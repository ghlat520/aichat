import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const localRequire = createRequire(import.meta.url);

function pageFixture(name, savedAssessment = null, options = {}) {
  const calls = [];
  const scrolls = [];
  const navigations = [];
  const emitted = [];
  const listeners = {};
  const state = { session: { sessionId: 'visitor-new' }, appConfig: { policy_version: 'current' }, assessment: savedAssessment, activeTask: null, venting: null };
  const store = {
    getState: () => state,
    getLogoutVersion: () => 0,
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
  const dependencies = { store, getApiClient: () => client, getSessionBoundClient: () => client, ensureEntryUnlocked: () => true,
    ensureGuestSession: options.ensureSession || (async () => state.session.sessionId), syncTabBar() {}, goHome() {}, routeToSafetyIfBlocked: () => false, friendlyError: error => error.message };
  // V1.2：assessment 页新增 growth-store / growth-content 依赖，按路径分发 mock
  const growthState = { answers: { mbti: [], traits: [], strengths: [] }, results: { mbti: false, traits: false, strengths: false }, sources: {}, paid: false, careerPaid: false, version: '1.0' };
  const growthStoreMock = { get: () => growthState, patch: (part) => Object.assign(growthState, part) };
  const growthContentMock = {
    TOOL_ORDER: ['mbti', 'traits', 'strengths'],
    TOOLS: Object.fromEntries(['mbti', 'traits', 'strengths'].map((id) => [id, { name: '工具' + id, short: id, desc: '描述', color: '' }])),
    QUESTIONS: { mbti: Array(6).fill('题'), traits: Array(6).fill('题'), strengths: Array(6).fill('题') }
  };
  const require = (path) => {
    if (path.endsWith('report-poster')) {
      const module = { exports: {} };
      vm.runInNewContext(readFileSync(new URL('./report-poster.js', import.meta.url), 'utf8'), { module, require, wx: context.wx });
      return module.exports;
    }
    if (path.endsWith('practice-store')) return localRequire('./practice-store');
    if (path.endsWith('growth-ui-data.js')) return localRequire('./growth-ui-data.js');
    if (path.endsWith('growth-store')) return options.growth ? { getGrowth: () => options.growth } : growthStoreMock;
    if (path.endsWith('growth-content')) return ['mbti-types', 'via-result', 'growth-result', 'growth-report', 'career-report', 'report-preview'].includes(name) ? localRequire('./growth-content') : growthContentMock;
    return dependencies;
  };
  const context = { require, setTimeout, clearTimeout, wx: { showToast() {}, setNavigationBarTitle() {}, navigateTo(options) { navigations.push(options); if (options.success) options.success({ eventChannel: { emit(event, payload) { emitted.push({ event, payload }); } } }); }, redirectTo(options) { navigations.push(options); }, switchTab(options) { navigations.push(options); }, pageScrollTo(options) { scrolls.push({ selector: options.selector, messageCount: page.data.messages.length }); } }, Page(config) {
    page = { ...config, data: structuredClone(config.data), setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); } };
  } };
  context.wx.getAccountInfoSync = () => ({ miniProgram: { appId: localRequire('./growth-ui-data.js').reportCode?.appId } });
  Object.assign(context.wx, options.wx || {});
  vm.runInNewContext(readFileSync(new URL(`./pages/${name}/${name}.js`, import.meta.url), 'utf8'), context);
  page.getOpenerEventChannel = () => ({ on(event, listener) { listeners[event] = listener; } });
  return { page, calls, state, scrolls, client, navigations, emitted, receive(event, payload) { listeners[event]?.(payload); } };
}

test('VIA 结果生成海报使用本轮真实前五项，不带出作答与经历原文', () => {
  const growth = localRequire('./growth-store').createGrowthStore({ getStorageSync() {}, setStorageSync() {} });
  for (let i = 0; i < 72; i++) growth.viaSaveAnswer(i, i < 3 ? 5 : 3);
  growth.viaPatch({ preview: false });
  growth.setExperience(0, 'event', '不应进入海报的私密经历');
  const { page, navigations, emitted } = pageFixture('via-result', null, { growth });
  page.onLoad();
  page.goShare();
  assert.equal(navigations.at(-1).url, '/pages/growth-share/growth-share?report=1');
  const poster = emitted.at(-1).payload.poster;
  assert.equal(poster.rows.length, 5);
  assert.equal(poster.rows[0].label, '创造力');
  assert.equal(poster.rows[0].value, '5.00 / 5');
  assert.match(poster.eyebrow, /本轮自评/);
  assert.doesNotMatch(JSON.stringify(emitted), /私密经历|answers/);
});

function posterCanvasBoundary() {
  const effects = { images: [], exports: [], saves: [], previews: [], forwards: [], text: [], toasts: [] };
  let saved;
  const savedOnce = new Promise(resolve => { saved = resolve; });
  const drawing = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (key === 'measureText') return text => ({ width: Array.from(String(text)).length * 20 });
    if (key === 'drawImage') return image => effects.images.push(image.src);
    if (key === 'fillText') return text => effects.text.push(text);
    return () => {};
  } });
  const canvas = { getContext: () => drawing, createImage() {
    return { set src(value) { this._src = value; queueMicrotask(() => this.onload()); }, get src() { return this._src; } };
  } };
  const wx = {
    createSelectorQuery() { return { select() { return this; }, fields() { return this; }, exec(callback) { callback([{ node: canvas }]); } }; },
    canvasToTempFilePath(options) { const file = '/tmp/poster-' + (effects.exports.length + 1) + '.png'; effects.exports.push(file); options.success({ tempFilePath: file }); },
    saveImageToPhotosAlbum(options) { effects.saves.push(options.filePath); options.success(); saved(); },
    previewImage(options) { effects.previews.push(options.urls); },
    showShareImageMenu(options) { effects.forwards.push(options.path); options.success?.(); },
    showToast(options) { effects.toasts.push(options.title); },
    canIUse() { return true; }
  };
  return { wx, effects, canvas, savedOnce };
}

function receivePoster(fixture) {
  fixture.page.onLoad({ report: '1' });
  fixture.receive('reportPoster', { owner: '0:visitor-new', poster: { source: 'via', kind: 'strength', title: '我的性格优势', eyebrow: '本轮自评', description: '本轮前五项', rows: [{ label: '创造力', value: '5.00 / 5' }], tags: [], cta: '扫码进入小程序', footer: '探索性自评' } });
}

test('报告海报生成真实 PNG，并绘入当前应用的小程序码后保存', async () => {
  const boundary = posterCanvasBoundary();
  const fixture = pageFixture('growth-share', null, { wx: boundary.wx });
  receivePoster(fixture);
  fixture.page.savePoster();
  await boundary.savedOnce;
  assert.deepEqual(boundary.effects.images, ['/assets/miniprogram-code.jpg']);
  assert.deepEqual(boundary.effects.saves, ['/tmp/poster-1.png']);
  assert.equal(fixture.page.data.posterSaveState, 'ok');
  assert.doesNotMatch(boundary.effects.text.join(' '), /码位示意|不能扫码|交互原型/);
});

test('沟通自测只把服务端分享摘要送入海报，迟到的旧身份预览不展示', async () => {
  const first = pageFixture('share-card');
  first.client.createAssessmentShareCard = async () => ({ data: { preview: { title: '当前沟通起点', usable_strength: '愿意倾听', one_real_world_reminder: '先确认边界', ai_label: '探索性提示', disclaimer: '非诊断' }, raw_answers: ['不应进入海报'] } });
  await first.page.onLoad({ runId: 'run-current' });
  first.page.goShare();
  assert.equal(first.emitted.at(-1).payload.poster.rows[0].detail, '愿意倾听');
  assert.doesNotMatch(JSON.stringify(first.emitted), /raw_answers|不应进入海报|run-current/);
  const late = pageFixture('share-card');
  let finish;
  late.client.createAssessmentShareCard = () => new Promise(resolve => { finish = resolve; });
  const loading = late.page.onLoad({ runId: 'run-old' });
  late.state.session = { sessionId: 'someone-else' };
  late.page.onShow();
  finish({ data: { preview: { title: '旧身份摘要', usable_strength: '不应展示' } } });
  await loading;
  assert.equal(late.page.data.preview, null);
  late.page.goShare();
  assert.equal(late.navigations.length, 0);
});

test('拒绝相册权限只预览；修改署名后重新生成；转发取消不提示成功', async () => {
  const boundary = posterCanvasBoundary();
  boundary.wx.saveImageToPhotosAlbum = options => options.fail({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' });
  boundary.wx.showShareImageMenu = options => options.fail({ errMsg: 'showShareImageMenu:fail cancel' });
  const fixture = pageFixture('growth-share', null, { wx: boundary.wx });
  receivePoster(fixture);
  await fixture.page.savePoster();
  assert.equal(fixture.page.data.posterSaveState, 'preview');
  assert.equal(boundary.effects.previews.length, 1);
  assert.doesNotMatch(boundary.effects.toasts.join(' '), /已保存海报/);
  fixture.page.onNameInput({ detail: { value: '新的署名' } });
  await fixture.page.sharePoster();
  assert.equal(boundary.effects.exports.length, 2);
  assert.ok(boundary.effects.text.some(text => text.includes('新的署名')));
  assert.equal(boundary.effects.previews.length, 1);
  assert.doesNotMatch(boundary.effects.toasts.join(' '), /转发成功|已发送/);
  fixture.page.onUnload();
});

test('身份变化或离开页面发生在图片解码期间，不导出和保存旧海报', async () => {
  for (const cause of ['identity', 'unload']) {
    const boundary = posterCanvasBoundary();
    let release;
    boundary.canvas.createImage = () => ({ set src(value) { this._src = value; release = () => this.onload(); }, get src() { return this._src; } });
    const fixture = pageFixture('growth-share', null, { wx: boundary.wx });
    receivePoster(fixture);
    const pending = fixture.page.savePoster();
    for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
    assert.equal(typeof release, 'function');
    if (cause === 'identity') fixture.state.session = { sessionId: 'different-owner' };
    else fixture.page.onUnload();
    release();
    await pending;
    assert.equal(boundary.effects.exports.length, 0);
    assert.equal(boundary.effects.saves.length, 0);
  }
});

test('应用身份不匹配时不可生成带其他小程序码的海报', async () => {
  const boundary = posterCanvasBoundary();
  boundary.wx.getAccountInfoSync = () => ({ miniProgram: { appId: 'wx-other-application' } });
  const fixture = pageFixture('growth-share', null, { wx: boundary.wx });
  receivePoster(fixture);
  await fixture.page.savePoster();
  assert.equal(fixture.page.data.qrReady, false);
  assert.equal(boundary.effects.exports.length, 0);
  assert.equal(boundary.effects.saves.length, 0);
  assert.match(fixture.page.data.reportError, /小程序码不可用/);
});

test('结果所属身份已变化时，不进入海报页或传递旧结果', () => {
  const growth = localRequire('./growth-store').createGrowthStore({ getStorageSync() {}, setStorageSync() {} });
  const fixture = pageFixture('via-result', null, { growth });
  fixture.page.onLoad();
  fixture.state.session = { sessionId: 'different-owner' };
  fixture.page.goShare();
  assert.equal(fixture.navigations.length, 0);
  assert.equal(fixture.emitted.length, 0);
});

test('VIA 样例海报的正文也不冒充本轮作答', () => {
  const growth = localRequire('./growth-store').createGrowthStore({ getStorageSync() {}, setStorageSync() {} });
  const fixture = pageFixture('via-result', null, { growth });
  fixture.page.onLoad();
  fixture.page.goShare();
  const poster = fixture.emitted.at(-1).payload.poster;
  assert.match(poster.eyebrow, /样例/);
  assert.match(poster.description, /样例/);
  assert.doesNotMatch(poster.description, /本轮/);
});

test('报告预览只导出可见样例片段，准备中不能生成海报', () => {
  const growth = localRequire('./growth-store').createGrowthStore({ getStorageSync() {}, setStorageSync() {} });
  const fixture = pageFixture('report-preview', null, { growth });
  fixture.page.onLoad({});
  fixture.page.onShow();
  fixture.page.setData({ experienceAction: '不得分享的私密经历原文' });
  fixture.page.goShare();
  const poster = fixture.emitted.at(-1).payload.poster;
  assert.match(poster.eyebrow, /预览.*样例/);
  assert.equal(poster.rows[0].label, '梳理信息');
  assert.doesNotMatch(JSON.stringify(fixture.emitted), /私密经历原文|理解他人|持续学习/);
  growth.patch({ previewState: 'preparing' });
  fixture.page.onShow();
  const count = fixture.navigations.length;
  fixture.page.goShare();
  assert.equal(fixture.navigations.length, count);
  fixture.page.onUnload();
});

for (const failure of ['query', 'decode', 'export']) {
  test('新海报成功后，旧的 ' + failure + ' 失败不覆盖成功状态', async () => {
    const boundary = posterCanvasBoundary(), pending = [];
    if (failure === 'query') boundary.wx.createSelectorQuery = () => ({ select() { return this; }, fields() { return this; }, exec(callback) { pending.push(callback); } });
    if (failure === 'decode') boundary.canvas.createImage = () => ({ set src(value) { this._src = value; pending.push(this); }, get src() { return this._src; } });
    if (failure === 'export') boundary.wx.canvasToTempFilePath = options => pending.push(options);
    const fixture = pageFixture('growth-share', null, { wx: boundary.wx });
    receivePoster(fixture);
    const old = fixture.page.previewPoster();
    for (let i = 0; i < 20 && pending.length < 1; i++) await Promise.resolve();
    assert.equal(pending.length, 1);
    fixture.page.onNameInput({ detail: { value: '当前署名' } });
    const current = fixture.page.previewPoster();
    for (let i = 0; i < 20 && pending.length < 2; i++) await Promise.resolve();
    assert.equal(pending.length, 2);
    if (failure === 'query') pending[1]([{ node: boundary.canvas }]);
    else if (failure === 'decode') pending[1].onload();
    else pending[1].success({ tempFilePath: '/tmp/current.png' });
    await current;
    const image = fixture.page.data.posterImage;
    assert.ok(image);
    if (failure === 'query') pending[0](null);
    else if (failure === 'decode') pending[0].onerror();
    else pending[0].fail({ errMsg: 'old export failed' });
    await old;
    assert.equal(fixture.page.data.posterImage, image);
    assert.notEqual(fixture.page.data.posterSaveState, 'fail');
    assert.doesNotMatch(boundary.effects.toasts.join(' '), /生成失败/);
    fixture.page.onUnload();
  });
}

test('MBTI 与兼容基础结果的海报保留样例边界，付费报告锁定时不能导出', async () => {
  const growth = localRequire('./growth-store').createGrowthStore({ getStorageSync() {}, setStorageSync() {} });
  for (const tool of ['mbti', 'traits', 'strengths']) {
    const { page, emitted } = pageFixture('growth-result', null, { growth });
    page.onLoad({ tool });
    page.shareResult();
    const poster = emitted.at(-1).payload.poster;
    assert.match(poster.eyebrow, /样例|演示/);
    assert.ok(poster.rows.length > 0);
    if (tool === 'mbti') assert.match(poster.title, /ENTP/);
  }
  const locked = pageFixture('growth-report', null, { growth });
  locked.page.onLoad({});
  await locked.page.onShow();
  locked.page.goShare();
  assert.equal(locked.navigations.length, 0);
  const sample = pageFixture('growth-report', null, { growth });
  sample.page.onLoad({ sample: '1' });
  await sample.page.onShow();
  sample.page.goShare();
  assert.match(sample.emitted.at(-1).payload.poster.eyebrow, /样例/);
  assert.doesNotMatch(JSON.stringify(sample.emitted), /跨部门项目|新同事加入/);
  const career = pageFixture('career-report', null, { growth });
  career.page.onLoad({});
  await career.page.onShow();
  career.page.goShare();
  assert.equal(career.emitted.at(-1).payload.poster.rows.length, 1);
  assert.match(career.emitted.at(-1).payload.poster.eyebrow, /预览/);
});

test('海报不接收其他身份的结果，身份切换与页面离开后不再显示旧摘要', () => {
  const { page, state, receive } = pageFixture('growth-share');
  page.onLoad({ report: '1' });
  const poster = { source: 'via', kind: 'strength', title: '我的性格优势', eyebrow: '本轮自评', description: '仅分享结果', rows: [{ label: '创造力', value: '5.00 / 5' }], tags: [], cta: '扫码进入小程序', footer: '探索性自评' };
  receive('reportPoster', { owner: '0:visitor-old', poster });
  assert.equal(page.data.poster, null);
  receive('reportPoster', { owner: '0:visitor-new', poster });
  assert.equal(page.data.poster.title, '我的性格优势');
  state.session = { sessionId: 'visitor-other' };
  page.onShow();
  assert.equal(page.data.poster, null);
  assert.match(page.data.reportError, /身份/);
  receive('reportPoster', { owner: '0:visitor-new', poster });
  assert.equal(page.data.poster, null);
  page.onUnload();
  state.session = { sessionId: 'visitor-new' };
  receive('reportPoster', { owner: '0:visitor-new', poster });
  assert.equal(page.data.poster, null);
  page.onNameInput({ detail: { value: '迟到的署名' } });
  assert.equal(page.data.posterName, '');
});

test('16 型卡片从指定类型打开，滑动和前后切换同步详情，VIA 链接使用当前类型', () => {
  const { page, navigations } = pageFixture('mbti-types');
  page.onLoad({ code: 'INFP' });
  assert.equal(page.data.selectedType.code, 'INFP');
  assert.equal(page.data.currentIndex, 5);
  assert.equal(page.data.visibleCount, 16);
  assert.equal(page.data.selectedType.up.length, 4);
  assert.equal(page.data.selectedType.dn.length, 4);
  page.onTypeSwipe({ detail: { current: 6, source: 'touch' } });
  assert.equal(page.data.selectedType.code, 'ENFJ');
  page.stepType({ currentTarget: { dataset: { step: -1 } } });
  assert.equal(page.data.selectedType.code, 'INFP');
  page.goCross({ currentTarget: { dataset: { code: 'INTJ' } } });
  assert.equal(navigations.at(-1).url, '/pages/via-mbti/via-mbti?code=INFP');
});

test('16 型卡片循环切换、分组和四字母查找保持当前类型一致', () => {
  const { page } = pageFixture('mbti-types');
  page.onLoad({ code: 'ESFP' });
  page.stepType({ currentTarget: { dataset: { step: 1 } } });
  assert.equal(page.data.selectedType.code, 'INTJ');
  page.setGroup({ currentTarget: { dataset: { group: 'NF' } } });
  assert.equal(page.data.visibleCount, 4);
  assert.equal(page.data.selectedType.code, 'INFJ');
  page.selectType({ currentTarget: { dataset: { code: 'ENFP' } } });
  assert.equal(page.data.currentIndex, 3);
  page.onTypeSwipe({ detail: { current: 0, source: '' } });
  assert.equal(page.data.selectedType.code, 'ENFP');
  page.onPickType({ detail: { value: '13' } });
  assert.equal(page.data.selectedType.code, 'ISFP');
  assert.equal(page.data.currentIndex, 13);
  assert.equal(page.data.group, 'all');
  assert.equal(page.data.visibleCount, 16);
  page.onPickType({ detail: { value: 'unknown' } });
  page.setGroup({ currentTarget: { dataset: { group: 'unknown' } } });
  page.onTypeSwipe({ detail: { current: 20, source: 'touch' } });
  assert.equal(page.data.selectedType.code, 'ISFP');
});

test('关系自测入口直接恢复已有测评；默认落地为自测首页目录', () => {
  const saved = { runId: 'completed-run', runVersion: 9, mappedTaskId: 'task-current', result: { current_tendency: '当前沟通起点' } };
  const { page, calls } = pageFixture('assessment', saved);
  page.onLoad({ relationship: '1' });
  assert.equal(page.data.mappedTaskId, 'task-current');
  assert.equal(page.data.result.current_tendency, '当前沟通起点');
  assert.equal(page.data.mode, 'relationship');
  assert.deepEqual(calls, []);
});

test('退出后关系自测隐藏旧结果，但不删除结果草稿', () => {
  const saved = { runId: 'old-run', runVersion: 2, mappedTaskId: 'old-task', result: { current_tendency: '旧会话结果' } };
  const { page, state } = pageFixture('assessment', saved);
  page.onLoad({ relationship: '1' });
  state.session = null;
  page.onShow();
  assert.equal(page.data.sessionHidden, true);
  assert.equal(page.data.result.current_tendency, '旧会话结果');
  assert.equal(state.assessment.result.current_tendency, '旧会话结果');
  assert.match(readFileSync(new URL('./pages/assessment/assessment.wxml', import.meta.url), 'utf8'), /wx:if="\{\{sessionHidden\}\}"/);
});

test('关系字段保存的迟到响应不能写入新的会话', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { createStore } = localRequire('./store-core.js');
  const memory = new Map();
  const wx = { getStorageSync: key => memory.get(key), setStorageSync: (key, value) => memory.set(key, value) };
  const store = createStore(wx);
  store.setSession({ sessionId: 'old', accessToken: 'old' });
  store.setActiveTask({ taskId: 'old-task', fields: { observed_fact: '原草稿' } });
  const client = { putClarityFields: async () => { markStarted(); await pending; return { data: { version: 2, content_version: 2 } }; } };
  const deps = { store, getApiClient: () => client, getSessionBoundClient: () => client,
    ensureGuestSession: async () => store.getState().session.sessionId, friendlyError: error => error.message,
    ensureEntryUnlocked: () => true, goHome() {}, routeToSafetyIfBlocked: () => false };
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/clarity-edit/clarity-edit.js', import.meta.url), 'utf8'), {
    wx, require: () => deps, Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  Object.assign(page.data, { canSubmit: true, taskId: 'old-task', taskVersion: 1, ownerSessionId: 'old',
    fields: { context: 'family', observed_fact: '旧用户私密内容', interpretation: 'x', emotion: ['sad'], need_or_boundary: ['x'], next_step_goal: 'x' } });
  const save = page.submit();
  await started;
  store.clearSession();
  store.setSession({ sessionId: 'new', accessToken: 'new' });
  release();
  await save;
  assert.equal(store.getState().activeTask, null);
  store.setSession({ sessionId: 'old', accessToken: 'old' });
  assert.equal(store.getState().activeTask.fields.observed_fact, '原草稿');
});

test('直接整理的新草稿在旧会话失效并自动转访客后仍可提交', async () => {
  const { createStore } = localRequire('./store-core.js');
  const memory = new Map();
  const wx = { getStorageSync: key => memory.get(key), setStorageSync: (key, value) => memory.set(key, value) };
  const store = createStore(wx);
  store.setSession({ sessionId: 'old', accessToken: 'old' });
  const client = { createClarityTask: async () => ({ data: { task_id: 'new-task', version: 1 } }),
    putClarityFields: async () => ({ data: { version: 2, content_version: 1 } }) };
  const deps = { store, getSessionBoundClient: () => client,
    ensureGuestSession: async () => { store.setSession({ sessionId: 'new', accessToken: 'new' }); return 'new'; },
    friendlyError: error => error.message, ensureEntryUnlocked: () => true, goHome() {}, routeToSafetyIfBlocked: () => false };
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/clarity-edit/clarity-edit.js', import.meta.url), 'utf8'), {
    wx, require: () => deps, Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  Object.assign(page.data, { canSubmit: true, taskId: '', ownerSessionId: 'old',
    fields: { context: 'family', observed_fact: '尚未提交的新草稿', interpretation: 'x', emotion: ['sad'], need_or_boundary: ['x'], next_step_goal: 'x' } });
  await page.submit();
  assert.equal(page.data.saved, true);
  assert.equal(page.data.sessionHidden, false);
  assert.equal(store.getState().activeTask.taskId, 'new-task');
  assert.equal(store.getState().activeTask.fields.observed_fact, '尚未提交的新草稿');
});

for (const scenario of [
  { page: 'mirror', method: 'loadMirror', api: 'createTaskMirror', data: { version: 2, content_version: 2, mirror: {} } },
  { page: 'reflection', method: 'reflect', api: 'createTaskReflection', data: { version: 2, reflection_version: 'r2' } }
]) {
  test(`${scenario.page} 迟到响应不能更新新会话的关系任务`, async () => {
    let release, markStarted;
    const pending = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { markStarted = resolve; });
    const { createStore } = localRequire('./store-core.js');
    const memory = new Map();
    const wx = { getStorageSync: key => memory.get(key), setStorageSync: (key, value) => memory.set(key, value) };
    const store = createStore(wx);
    store.setSession({ sessionId: 'old', accessToken: 'old' });
    store.setActiveTask({ taskId: 'old-task', version: 1 });
    const client = { [scenario.api]: async () => { markStarted(); await pending; return { data: scenario.data }; } };
    const deps = { store, getApiClient: () => client, getSessionBoundClient: () => client,
      ensureGuestSession: async () => store.getState().session.sessionId, friendlyError: error => error.message,
      ensureEntryUnlocked: () => true, goHome() {} };
    let page;
    vm.runInNewContext(readFileSync(new URL(`./pages/${scenario.page}/${scenario.page}.js`, import.meta.url), 'utf8'), {
      wx, require: () => deps, Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
    });
    Object.assign(page.data, { taskId: 'old-task', ownerSessionId: 'old', canSubmit: true, confirmedFacts: '事实', unknowns: '未知' });
    const request = page[scenario.method]();
    await started;
    store.clearSession();
    store.setSession({ sessionId: 'new', accessToken: 'new' });
    release();
    await request;
    assert.equal(store.getState().activeTask, null);
  });
}

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

test('退出后隐藏原会话倾诉内容而不删除页面中的草稿', () => {
  const { page, state } = pageFixture('venting');
  Object.assign(page.data, { workspaceMode: 'online', ownerSessionId: 'visitor-new', messages: [{ role: 'user', text: '保留的草稿' }], input: '未发送的内容' });
  state.session = null;
  page.onShow();
  assert.equal(page.data.sessionHidden, true);
  assert.equal(page.data.messages[0].text, '保留的草稿');
  assert.equal(page.data.input, '未发送的内容');
  assert.match(readFileSync(new URL('./pages/venting/venting.wxml', import.meta.url), 'utf8'), /wx:if="\{\{sessionHidden\}\}"/);
});

test('默认说一说使用本地轻量练习；切换模式保留文字并拒绝旧编辑器与跨身份事件', () => {
  const { page, calls, state } = pageFixture('venting');
  state.session = { sessionId: 'local-practice-owner' };
  page.onLoad({}); page.onShow();
  assert.equal(page.data.workspaceMode, 'growth');
  assert.equal(page.data.practice.mode, 'light');
  assert.deepEqual(calls, []);
  const event = (key, value) => ({ currentTarget: { dataset: { key, editor: page.data.practiceEditorToken } }, detail: { value } });
  page.onPracticeField(event('what', '先核对自己的安排'));
  const delayed = event('what', '旧编辑器的迟到输入');
  page.practiceAction({ currentTarget: { dataset: { action: 'mode-deep', editor: page.data.practiceEditorToken } } });
  page.practiceAction({ currentTarget: { dataset: { action: 'mode-light', editor: page.data.practiceEditorToken } } });
  page.onPracticeField(delayed);
  assert.equal(page.practiceStore().get().current.what, '先核对自己的安排');
  page.onHide(); page.onPracticeField(event('what', '隐藏后的输入'));
  page.onShow();
  assert.equal(page.practiceStore().get().current.what, '先核对自己的安排');
  state.session = { sessionId: 'another-local-practice-owner' };
  page.onPracticeField(event('what', '上一身份的内容'));
  assert.equal(page.practiceStore().get().current.what, '');
});

test('微行动选填收起再展开时，从同一份草稿回显刚填写的文字', () => {
  const { page, state } = pageFixture('venting');
  state.session = { sessionId: 'optional-practice-owner' };
  page.onShow();
  const action = name => page.practiceAction({ currentTarget: { dataset: { action: name, editor: page.data.practiceEditorToken } } });
  action('extra');
  page.onPracticeField({ currentTarget: { dataset: { key: 'backup', editor: page.data.practiceEditorToken } }, detail: { value: '如果没时间，先写一句开头' } });
  action('extra'); action('extra');
  assert.equal(page.data.practice.extraFields.find(field => field.key === 'backup').value, '如果没时间，先写一句开头');
});

test('首页显式微行动或复盘意图可从在线倾诉切回轻量，保留在线草稿', () => {
  const { page, state, calls } = pageFixture('venting');
  state.session = { sessionId: 'explicit-practice-intent-owner' };
  const { setFlowIntent, takeFlowIntent } = localRequire('./practice-store');
  Object.assign(page.data, { workspaceMode: 'online', input: '在线倾诉尚未发送的草稿' });
  setFlowIntent('0:explicit-practice-intent-owner', { target: 'practice', type: 'review' });
  page.onShow();
  assert.equal(page.data.workspaceMode, 'growth');
  assert.equal(page.data.practice.mode, 'light');
  assert.equal(page.data.practice.reviewView, true);
  assert.equal(page.data.input, '在线倾诉尚未发送的草稿');
  assert.equal(takeFlowIntent('0:explicit-practice-intent-owner', 'practice'), null);
  assert.deepEqual(calls, []);
});

test('切换身份并开始新倾诉后，旧会话迟到的总结不能污染新对话', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { page, state, client } = pageFixture('venting');
  client.finishVentSession = async () => { markStarted(); await pending; return { data: { version: 2, summary: { observed_fact: '旧私密总结' } } }; };
  Object.assign(page.data, { ownerSessionId: 'visitor-new', ventSessionId: 'old-vent', loading: false, aiTurnsUsed: 1 });
  const finishing = page.finish();
  await started;
  state.session = { sessionId: 'different-visitor' };
  await page.restart();
  release();
  await finishing;
  assert.equal(page.data.ventSessionId, 'vent-new');
  assert.equal(page.data.ownerSessionId, 'different-visitor');
  assert.equal(page.data.summary, null);
  assert.equal(state.venting.summary, undefined);
});

test('新倾诉准备期间输入被禁用，且请求完成前绑定会话归属', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { page, client } = pageFixture('venting');
  client.createVentSession = async () => { markStarted(); await pending; return { data: { vent_session_id: 'v', version: 1 } }; };
  const starting = page.start();
  await started;
  assert.equal(page.data.ownerSessionId, 'visitor-new');
  assert.match(readFileSync(new URL('./pages/venting/venting.wxml', import.meta.url), 'utf8'), /disabled="\{\{loading \|\| !ventSessionId \|\| limitReached \|\| sending\}\}"/);
  release();
  await starting;
});

test('开启新倾诉失败时保留先前会话尚未发送的草稿', async () => {
  const { page, state } = pageFixture('venting');
  Object.assign(page.data, { ownerSessionId: 'visitor-new', ventSessionId: 'old-vent', sessionHidden: true,
    input: '未发送的草稿', messages: [{ role: 'user', text: '之前的消息' }] });
  state.session = null;
  await page.restart();
  assert.equal(page.data.sessionHidden, true);
  assert.equal(page.data.input, '未发送的草稿');
  assert.equal(page.data.messages[0].text, '之前的消息');
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

test('新访客倾诉启动失败时停止重试并保留旧草稿', async () => {
  let ensures = 0;
  const { page, calls, client } = pageFixture('venting', null, { ensureSession: async () => {
    if (++ensures > 3) throw new Error('重试上限哨兵');
    return 'visitor-new';
  } });
  let starts = 0;
  client.createVentSession = async () => { starts++; throw new Error('网络不可用'); };
  Object.assign(page.data, { loading: false, ventSessionId: 'vent-old', ownerSessionId: 'visitor-old',
    deadlineAt: '2099-01-01T00:00:00Z', input: '未发送的草稿', messages: [{ role: 'user', text: '旧消息' }] });
  await page.send();
  assert.equal(starts, 1);
  assert.equal(page.data.input, '未发送的草稿');
  assert.equal(page.data.messages[0].text, '旧消息');
  assert.match(page.data.error, /网络不可用/);
  assert.deepEqual(calls, []);
});

test('旧倾诉重启响应迟到时，不把旧输入写入后来的会话', async () => {
  let release, markStarted;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const { page, state, client } = pageFixture('venting');
  client.createVentSession = async () => {
    if (state.session.sessionId === 'visitor-new') { markStarted(); await pending; return { data: { vent_session_id: 'vent-a', version: 1 } }; }
    return { data: { vent_session_id: 'vent-b', version: 1 } };
  };
  Object.assign(page.data, { loading: false, ventSessionId: 'old-vent', ownerSessionId: 'old-visitor',
    input: '旧私密输入', deadlineAt: '2099-01-01T00:00:00Z' });
  const oldSend = page.send();
  await started;
  state.session = { sessionId: 'visitor-b' };
  await page.restart();
  release();
  await oldSend;
  assert.equal(page.data.ownerSessionId, 'visitor-b');
  assert.equal(page.data.ventSessionId, 'vent-b');
  assert.equal(page.data.input, '');
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
