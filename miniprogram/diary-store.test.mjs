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
      if (path === '../../app-store') return {
        store: { getState: () => state, getLogoutVersion: () => 0 },
        syncTabBar: (target, index) => calls.push(['selected', index]), goHome() {}
      };
      throw new Error(`Unexpected dependency: ${path}`);
    },
    wx: { showToast: value => calls.push(['toast', value.title]), showModal: options => confirmLater ? calls.push(['modal', options]) : options.success({ confirm: true }) },
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
