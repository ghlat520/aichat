import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { createDiaryStore, summarizeEntries, getExampleEntries, getDiary } = require('./diary-store');
let fixtureId = 0;

function contentEvent(page, value) {
  return { detail: { value }, currentTarget: { dataset: { editor: page.data.editorToken } } };
}

function editorEvent(page) { return { currentTarget: { dataset: { editor: page.data.editorToken } } }; }

function diaryPage({ confirmLater = false } = {}) {
  const state = { session: { sessionId: `diary-fixture-${++fixtureId}` } };
  const calls = [];
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/diary/diary.js', import.meta.url), 'utf8'), {
    require(path) {
      if (path === '../../diary-store') return require('./diary-store');
      if (path === '../../practice-store') return require('./practice-store');
      if (path === '../../app-store') return {
        store: { getState: () => state, getLogoutVersion: () => 0 },
        syncTabBar: (target, index) => calls.push(['selected', index]), goHome() {}
      };
      throw new Error(`Unexpected dependency: ${path}`);
    },
    wx: { showToast: value => calls.push(['toast', value.title]), switchTab: options => calls.push(['switchTab', options.url]), showModal: options => confirmLater ? calls.push(['modal', options]) : options.success({ confirm: true }) },
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  return { page, state, calls };
}

test('写下日记后可回看、编辑；未保存的草稿与已有记录互不覆盖', () => {
  const diary = createDiaryStore();
  diary.updateDraft({ date: '2026-10-28', mood: 'calm', content: '散步时注意到肩膀慢慢放松了。', dimensions: ['emotion'] });
  const saved = diary.save();
  assert.equal(diary.get().entries.length, 1);
  assert.equal(diary.get().entries[0].content, '散步时注意到肩膀慢慢放松了。');
  diary.updateDraft({ content: '还没写完的另一段记录' });
  assert.equal(diary.get().draft.content, '还没写完的另一段记录');
  assert.equal(diary.get().entries[0].content, '散步时注意到肩膀慢慢放松了。');
  diary.edit(saved.id);
  diary.updateDraft({ content: '散步时肩膀放松了，也愿意早点休息。' });
  diary.save();
  assert.equal(diary.get().entries.length, 1);
  assert.equal(diary.get().entries[0].content, '散步时肩膀放松了，也愿意早点休息。');
});

test('空白、过长或日期无效的日记不进入记录；保存失败保留草稿', () => {
  const diary = createDiaryStore();
  for (const content of ['   ', '字'.repeat(2001)]) {
    diary.updateDraft({ content });
    assert.throws(() => diary.save());
    assert.equal(diary.get().entries.length, 0);
    assert.equal(diary.get().draft.content, content);
  }
  diary.updateDraft({ content: '一段真实的记录', date: '2026-02-30' });
  assert.throws(() => diary.save());
  assert.equal(diary.get().entries.length, 0);
});

test('六维树按记录的标注计数；重复标注只算一次，编辑后重新计算', () => {
  const diary = createDiaryStore();
  diary.updateDraft({ date: '2026-10-28', content: '我注意到肩膀紧绷，原来很希望能被认真听见。', dimensions: ['emotion', 'emotion', 'needs'] });
  const first = diary.save();
  diary.updateDraft({ date: '2026-10-28', content: '和朋友散步时，说出了今天的感受。', dimensions: ['emotion', 'relationship'] });
  diary.save();
  let tree = summarizeEntries(diary.get().entries);
  assert.equal(tree.days, 1);
  assert.equal(tree.total, 2);
  assert.deepEqual(tree.branches.map(branch => branch.count), [2, 1, 1, 0, 0, 0]);
  diary.edit(first.id);
  diary.updateDraft({ dimensions: ['thinking'] });
  diary.save();
  tree = summarizeEntries(diary.get().entries);
  assert.deepEqual(tree.branches.map(branch => branch.count), [1, 1, 0, 0, 1, 0]);
});

test('示例记录与私人记录隔离，外部修改快照不能改动已存日记', () => {
  const diary = createDiaryStore();
  const examples = getExampleEntries();
  assert.equal(examples.length, 3);
  assert.equal(diary.get().entries.length, 0);
  assert.deepEqual(summarizeEntries(examples).branches.map(branch => branch.count), [3, 1, 2, 2, 1, 1]);
  examples[0].content = '改动示例副本';
  assert.notEqual(getExampleEntries()[0].content, '改动示例副本');
  diary.updateDraft({ content: '自己的感受', dimensions: ['needs'] });
  diary.save();
  const snapshot = diary.get();
  snapshot.entries[0].content = '改动快照';
  snapshot.entries[0].dimensions.push('emotion');
  assert.equal(diary.get().entries[0].content, '自己的感受');
  assert.deepEqual(diary.get().entries[0].dimensions, ['needs']);
});

test('同一身份切换页面保留记录；身份改变或重新启动不展示上一份日记', () => {
  const first = getDiary('visitor-a');
  first.updateDraft({ content: '只属于这一轮体验的记录' });
  first.save();
  assert.equal(getDiary('visitor-a').get().entries.length, 1);
  assert.equal(getDiary('visitor-b').get().entries.length, 0);
  assert.equal(getDiary('visitor-a').get().entries.length, 0);
  assert.equal(createDiaryStore().get().entries.length, 0);
});

test('页面可填写、保存、回看；切换后草稿仍在，示例与个人视图可以安全往返', () => {
  const { page, state, calls } = diaryPage();
  page.onShow();
  assert.equal(calls[0][1], 2);
  page.openEditor();
  page.onContent(contentEvent(page, '午后散步，感觉呼吸慢了下来。'));
  page.toggleDimension({ currentTarget: { dataset: { id: 'emotion', editor: page.data.editorToken } } });
  page.onShow();
  assert.equal(page.data.draft.content, '午后散步，感觉呼吸慢了下来。');
  page.saveEntry(editorEvent(page));
  assert.equal(page.data.entries.length, 1);
  assert.equal(page.data.entries[0].content, '午后散步，感觉呼吸慢了下来。');
  assert.equal(page.data.branches[0].count, 1);
  page.toggleExample();
  assert.equal(page.data.entries.length, 3);
  assert.equal(page.data.viewingExample, true);
  page.toggleExample();
  assert.equal(page.data.entries.length, 1);
  assert.equal(page.data.viewingExample, false);
  state.session = { sessionId: 'a-different-identity' };
  page.onShow();
  assert.equal(page.data.entries.length, 0);
  assert.equal(page.data.draft.content, '');
});

test('底部导航依次为首页、自测、觉察日记、说一说、我的；清晰卡从我的以普通页面进入', () => {
  const config = JSON.parse(readFileSync(new URL('./app.json', import.meta.url), 'utf8'));
  const expected = ['首页', '自测', '觉察日记', '说一说', '我的'];
  assert.deepEqual(config.tabBar.list.map(item => item.text), expected);
  let component;
  const calls = [];
  const wx = { switchTab: options => { calls.push(['switchTab', options.url]); options.success(); }, navigateTo: options => calls.push(['navigateTo', options.url]) };
  vm.runInNewContext(readFileSync(new URL('./custom-tab-bar/index.js', import.meta.url), 'utf8'), {
    Component: value => { component = { ...value, setData() {} }; }, wx
  });
  assert.deepEqual(Array.from(component.data.tabs, item => item.label), expected);
  component.methods.switchTab.call(component, { currentTarget: { dataset: { index: 2 } } });
  assert.deepEqual(calls.pop(), ['switchTab', '/pages/diary/diary']);
  let profile;
  vm.runInNewContext(readFileSync(new URL('./pages/profile/profile.js', import.meta.url), 'utf8'), {
    require: () => ({}), wx, Page: value => { profile = value; }
  });
  profile.goCards();
  assert.deepEqual(calls.pop(), ['navigateTo', '/pages/report/report']);
  assert.equal(config.tabBar.list.some(item => item.pagePath === 'pages/report/report'), false);
});

test('原反思第二轮完成后以普通页面跳转清晰卡，保留原任务和反思版本', async () => {
  const calls = [];
  const state = { session: { sessionId: 'reflection-owner' }, activeTask: { taskId: 'original-task', version: 2 } };
  let page;
  const dependencies = {
    store: { getState: () => state, getLogoutVersion: () => 0, patchActiveTask: patch => Object.assign(state.activeTask, patch) },
    ensureGuestSession: async () => 'reflection-owner',
    friendlyError: error => error.message,
    getSessionBoundClient: () => ({ createTaskReflection: async (taskId, body) => {
      calls.push(['reflect', taskId, body.round]);
      return { data: { version: 3, reflection_version: 'reflection-v2' } };
    } })
  };
  vm.runInNewContext(readFileSync(new URL('./pages/reflection/reflection.js', import.meta.url), 'utf8'), {
    require: () => dependencies,
    wx: { redirectTo: options => calls.push(['redirectTo', options.url]), switchTab: () => assert.fail('清晰卡已不再是 tab 页') },
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  Object.assign(page.data, { taskId: 'original-task', ownerSessionId: 'reflection-owner', round: 2, priority: '给自己一点时间', goal: '明天散步十分钟', canSubmit: true });
  await page.reflect();
  assert.deepEqual(calls, [['reflect', 'original-task', 2], ['redirectTo', '/pages/report/report']]);
  assert.equal(state.activeTask.taskId, 'original-task');
  assert.equal(state.activeTask.reflectionVersionR2, 'reflection-v2');
});

test('身份在输入期间变化时，旧编辑事件被丢弃，不能把旧原文带入新身份', () => {
  const { page, state } = diaryPage();
  page.onShow();
  page.openEditor();
  page.onContent(contentEvent(page, '上一身份尚未保存的私人内容'));
  state.session = { sessionId: 'next-owner-during-input' };
  page.onContent(contentEvent(page, '上一身份尚未保存的私人内容。'));
  page.saveEntry(editorEvent(page));
  assert.equal(page.data.draft.content, '');
  assert.equal(page.data.entries.length, 0);
});

test('打开记录的确认框延迟返回时，不能修改另一身份的草稿', () => {
  const { page, state, calls } = diaryPage({ confirmLater: true });
  page.onShow();
  page.openEditor();
  page.onContent(contentEvent(page, '第一篇记录'));
  page.saveEntry(editorEvent(page));
  const id = page.data.entries[0].id;
  page.openEditor();
  page.onContent(contentEvent(page, '另一份草稿'));
  page.editEntry({ currentTarget: { dataset: { id } } });
  const modal = calls.find(call => call[0] === 'modal')[1];
  state.session = { sessionId: 'next-owner-during-modal' };
  page.onShow();
  page.openEditor();
  page.onContent(contentEvent(page, '新身份自己的草稿'));
  modal.success({ confirm: true });
  assert.equal(page.data.draft.content, '新身份自己的草稿');
  assert.equal(page.data.editing, true);
});

test('上一编辑器的迟到输入在隐藏后或新身份打开编辑器后仍被丢弃', () => {
  const { page, state } = diaryPage();
  page.onShow();
  page.openEditor();
  page.onContent(contentEvent(page, '上一身份的草稿'));
  const delayed = contentEvent(page, '上一身份的草稿，迟到事件');
  state.session = { sessionId: 'owner-after-editor-teardown' };
  page.onShow();
  page.onContent(delayed);
  assert.equal(page.data.draft.content, '');
  page.openEditor();
  page.onContent(contentEvent(page, '新身份的内容'));
  page.onContent(delayed);
  assert.equal(page.data.draft.content, '新身份的内容');
});

test('确认框返回时即使没有 onShow，也要刷新并移除旧身份的编辑器', () => {
  const { page, state, calls } = diaryPage({ confirmLater: true });
  page.onShow();
  page.openEditor();
  page.onContent(contentEvent(page, '已有的记录'));
  page.saveEntry(editorEvent(page));
  const id = page.data.entries[0].id;
  page.openEditor();
  page.onContent(contentEvent(page, '上一个身份的草稿'));
  page.editEntry({ currentTarget: { dataset: { id } } });
  state.session = { sessionId: 'owner-at-modal-return' };
  calls.find(call => call[0] === 'modal')[1].success({ confirm: true });
  assert.equal(page.data.draft.content, '');
  assert.equal(page.data.editing, false);
});

test('轻量与深度模式切换保留同一份微行动和复盘文字', () => {
  const { createPracticeStore } = require('./practice-store');
  const practice = createPracticeStore();
  practice.updateField('what', '先确认自己的时间，再答复临时请求。');
  practice.updateField('when', '下次收到临时请求时。');
  practice.updateField('actual', '我先说明需要确认安排。');
  practice.updateField('result', '有了核对时间的空间。');
  practice.updateField('next', '继续保留这一句回应。');
  practice.act('mode-deep');
  practice.act('mode-light');
  const view = practice.get();
  assert.equal(view.mode, 'light');
  assert.equal(view.current.what, '先确认自己的时间，再答复临时请求。');
  assert.equal(view.current.result, '有了核对时间的空间。');
  assert.equal(view.planReady, false);
  assert.equal(view.reviewed, false);
});

test('三行觉察写一句即可保存，心情可不标注，旧正文补充不丢失', () => {
  const diary = createDiaryStore();
  diary.updateDraft({ lines: { event: '临时任务到来时，我马上答应了。' }, mood: '' });
  const first = diary.save();
  assert.equal(first.lines.event, '临时任务到来时，我马上答应了。');
  assert.equal(first.mood, '');
  diary.edit(first.id);
  diary.updateDraft({ freeContent: '我想先核对自己的安排。' });
  const revised = diary.save();
  assert.equal(revised.id, first.id);
  assert.equal(diary.get().entries.length, 1);
  assert.match(revised.content, /临时任务到来时/);
  assert.match(revised.content, /先核对自己的安排/);
});

test('原生三行编辑器保存后携带自己的日记进入微行动，上一编辑器事件不再生效', () => {
  const { page, calls } = diaryPage();
  page.onShow(); page.openEditor();
  const event = contentEvent(page, '我想先确认安排再答复。');
  event.currentTarget.dataset.key = 'insight';
  page.onLine(event);
  page.saveEntry(editorEvent(page));
  const entry = page.data.entries[0];
  assert.equal(entry.lines.insight, '我想先确认安排再答复。');
  page.onLine(event);
  assert.equal(page.diary().get().draft.content, '');
  page.goMicro();
  const { getPractice, takeFlowIntent } = require('./practice-store');
  const owner = page.currentOwner();
  assert.equal(getPractice(owner).get().current.sourceDiaryId, entry.id);
  assert.equal(takeFlowIntent(owner, 'practice').type, 'plan');
  assert.deepEqual(calls.at(-1), ['switchTab', '/pages/venting/venting']);
});

test('三行草稿先放一放后，落地页与再次打开均回显同一份文字', () => {
  const { page } = diaryPage();
  page.onShow(); page.openEditor();
  const event = contentEvent(page, '先核对自己的安排');
  event.currentTarget.dataset.key = 'insight';
  page.onLine(event);
  page.closeEditor(editorEvent(page));
  assert.match(page.data.draft.content, /先核对自己的安排/);
  page.openEditor();
  assert.equal(page.data.lineFields.find(field => field.key === 'insight').value, '先核对自己的安排');
});

test('微行动保存不冒充执行；复盘按同一轮更新，上游调整后需重新确认', () => {
  const { createPracticeStore } = require('./practice-store');
  const practice = createPracticeStore();
  practice.updateField('what', '先说我确认一下'); practice.updateField('when', '收到请求时');
  practice.act('light-save-plan');
  assert.equal(practice.get().planReady, true);
  assert.equal(practice.get().reviewed, false);
  assert.equal(practice.get().current.outcome, '');
  assert.equal(practice.get().current.confirmed, -1);
  assert.throws(() => practice.act('light-save-review'));
  for (const [key, value] of Object.entries({ actual: '还没遇到这个场景', result: '需要等一个合适的请求', next: '先把回应写在备忘里' })) practice.updateField(key, value);
  practice.act('light-save-review'); practice.act('edit-review');
  practice.updateField('next', '先在心里练习一句'); practice.act('light-save-review');
  assert.equal(practice.get().records.length, 1);
  assert.equal(practice.get().reviewed, true);
  practice.updateField('when', '下次分工讨论时');
  assert.equal(practice.get().planReady, false);
  assert.equal(practice.get().reviewed, false);
  assert.throws(() => practice.act('light-save-review'));
});

test('日记来源冲突保留当前文字；跨身份与迟到页面意图不能串入下一身份', () => {
  const { createPracticeStore, getPractice, setFlowIntent, takeFlowIntent } = require('./practice-store');
  const practice = createPracticeStore();
  practice.updateField('what', '已有的未完成动作');
  assert.throws(() => practice.fromDiary({ id: 'another', content: '另一篇日记' }), { code: 'ACTIVE_PRACTICE' });
  assert.equal(practice.get().current.what, '已有的未完成动作');
  const owner = `practice-isolation-${++fixtureId}`;
  getPractice(owner).updateField('what', '只属于自己的文字');
  setFlowIntent(owner, { target: 'diary', type: 'entry', id: 'private-id' });
  assert.equal(getPractice(owner + '-new').get().active, false);
  assert.equal(takeFlowIntent(owner + '-new', 'diary'), null);
  assert.equal(getPractice(owner).get().active, false);
});

test('从日记返回首页时退出星座子面板，保留星座选择与已保存日记回看', () => {
  const state = { session: { sessionId: 'home-return-' + ++fixtureId } };
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/entry/entry.js', import.meta.url), 'utf8'), {
    require(path) {
      if (path === '../../app-store') return { store: { getState: () => state, getLogoutVersion: () => 0 }, syncTabBar() {}, ApiClientError: class extends Error {} };
      return require(path.replace('../../', './'));
    },
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  const diary = getDiary('0:' + state.session.sessionId);
  diary.updateDraft({ lines: { event: '从星座问题开始的一次觉察' } });
  const saved = diary.save();
  Object.assign(page.data, { panel: 'zodiac', zodiacId: 'pisces' });
  page.onShow();
  assert.equal(page.data.panel, 'home');
  assert.equal(page.data.zodiacId, 'pisces');
  assert.equal(page.data.recent.id, saved.id);
  assert.equal(page.data.next.kind, 'from-diary');
});

test('十二星座均提供具体解读，切换与左右浏览同步，写日记保留原草稿', () => {
  const state = { session: { sessionId: 'zodiac-reading-' + ++fixtureId } }, calls = [];
  let page;
  vm.runInNewContext(readFileSync(new URL('./pages/entry/entry.js', import.meta.url), 'utf8'), {
    require(path) {
      if (path === '../../app-store') return { store: { getState: () => state, getLogoutVersion: () => 0 }, syncTabBar() {}, ApiClientError: class extends Error {} };
      return require(path.replace('../../', './'));
    },
    wx: { switchTab: options => calls.push(options.url) },
    Page(config) { page = { ...config, data: structuredClone(config.data), setData(patch) { Object.assign(this.data, patch); } }; }
  });
  page.onShow(); page.goZodiac();
  assert.deepEqual(Array.from(page.data.selectedSign.traits, trait => trait.label), ['领导力', '亲和力', '执行力', '创造力']);
  const descriptions = new Set();
  for (const sign of page.data.signs) {
    page.selectSign({ currentTarget: { dataset: { id: sign.id } } });
    const selected = page.data.selectedSign;
    for (const key of ['personality', 'career', 'money']) {
      assert.ok(selected[key].body.length >= 30, selected.name + key + '需要具体解释');
      descriptions.add(selected[key].body);
    }
    assert.ok(selected.strength.body && selected.blindspot.body);
    assert.ok(selected.traits.every(trait => trait.style && trait.body.length >= 20 && trait.score === undefined));
  }
  assert.equal(descriptions.size, 36);
  page.stepZodiac({ currentTarget: { dataset: { step: 1 } } });
  assert.equal(page.data.selectedSign.id, 'aries');
  page.onZodiacSwipe({ detail: { current: 9, source: 'touch' } });
  assert.equal(page.data.selectedSign.id, 'capricorn');
  const diary = getDiary('0:' + state.session.sessionId);
  diary.updateDraft({ freeContent: '已经写好的内容，请保留。' });
  page.writeFromSign();
  assert.equal(diary.get().draft.freeContent, '已经写好的内容，请保留。');
  assert.equal(diary.get().draft.inspiration.source, '星座图鉴 · 摩羯座');
  assert.equal(calls.at(-1), '/pages/diary/diary');
  page.closeZodiac();
  page.onZodiacSwipe({ detail: { current: 0, source: 'touch' } });
  assert.equal(page.data.selectedSign.id, 'capricorn');
});

test('深度五节点逐步确认后可保存计划和真实复盘，轻量切换不会伪造前置完成', () => {
  const { createPracticeStore } = require('./practice-store');
  const practice = createPracticeStore();
  practice.act('mode-deep');
  assert.throws(() => practice.act('stage', 4));
  for (const [key, value] of Object.entries({ goal: 'move', facts: '验收：我推迟了一个开头', desired: '先把第一句话写出来' })) practice.updateField(key, value);
  practice.act('next');
  practice.updateField('insight', '把任务缩小到一句话'); practice.act('next');
  practice.updateField('rehearsal', '我先打开文档写一句'); practice.act('next');
  for (const [key, value] of Object.entries({ what: '写一句开头', when: '午休后', criterion: '文档里留下一句话' })) practice.updateField(key, value);
  practice.act('save-plan'); practice.act('review');
  for (const [key, value] of Object.entries({ outcome: 'not-started', actual: '还没到午休时间', next: '先把文档放在桌面' })) practice.updateField(key, value);
  practice.act('save-review'); practice.act('mode-light');
  assert.equal(practice.get().reviewed, true);
  assert.equal(practice.get().current.outcome, 'not-started');
  assert.equal(practice.get().records.length, 1);
  practice.updateField('facts', '任务的条件发生了变化');
  practice.act('mode-deep');
  assert.equal(practice.get().current.step, 0);
  assert.equal(practice.get().planReady, false);
  assert.equal(practice.get().reviewed, false);
});
