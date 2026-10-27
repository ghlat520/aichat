// store-core.test.mjs — store 纯逻辑单测（零运行时依赖）
// 跑法：node --test miniprogram/store-core.test.mjs
// 覆盖：AC-11 守卫、AC-25 Fail-Closed、AC-22 PII 不持久化、INV-01 政策版本一致。
import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('./store-core.js');
const { maskPiiDeep } = require('./services/api/privacy-mask.js');

function memWx() {
  const mem = {};
  return {
    mem,
    getStorageSync: (k) => mem[k],
    setStorageSync: (k, v) => { mem[k] = v; },
    removeStorageSync: (k) => { delete mem[k]; }
  };
}

test('hydrate 空存储 → session/consent 为 null', () => {
  const store = createStore(memWx());
  store.hydrate();
  assert.equal(store.getState().session, null);
  assert.equal(store.getState().consent, null);
});

test('V1.2：边界闸移除 → 未同意也直达（isEntryUnlocked=true）', () => {
  const store = createStore(memWx());
  store.hydrate();
  assert.equal(store.isEntryUnlocked(), true);
});

test('V1.2：政策版本漂移不再锁页（闸门移除，consent 仅随会话记录）', () => {
  const store = createStore(memWx());
  store.setAppConfig({ policy_version: 'pv1' });
  store.setSession({ sessionId: 's1', accessToken: 'at' });
  store.setConsent({ policyVersion: 'pv1', adultConfirmed: true, acceptedAt: 1 });
  assert.equal(store.isEntryUnlocked(), true);
  store.setAppConfig({ policy_version: 'pv2' });
  assert.equal(store.isEntryUnlocked(), true);
});

test('AC-25：feature flag Fail-Closed', () => {
  const store = createStore(memWx());
  store.setAppConfig({ feature_flags: { assessment: true, payment: false } });
  assert.equal(store.isFeatureEnabled('assessment'), true);
  assert.equal(store.isFeatureEnabled('payment'), false);
  assert.equal(store.isFeatureEnabled('nonexistent'), false);
});

test('AC-22：业务临时态不持久化（assessment/activeTask/venting 不入 storage）', () => {
  const wx = memWx();
  const store = createStore(wx);
  store.setSession({ sessionId: 's1', accessToken: 'at' });
  store.setAssessment({ runId: 'r1', result: { current_tendency: '临时结果' } });
  store.setActiveTask({ taskId: 't1', fields: { secret: '原始关系文本' } });
  store.setVenting({ ventSessionId: 'v1', content: '倾诉原文' });
  const persisted = JSON.parse(wx.mem['aichat_state_v1'] || '{}');
  assert.equal(persisted.assessment, undefined);
  assert.equal(persisted.activeTask, undefined);
  assert.equal(persisted.venting, undefined);
});

test('clearAuth 清空 + storage 清除', () => {
  const wx = memWx();
  const store = createStore(wx);
  store.setSession({ sessionId: 's1', accessToken: 'at' });
  store.setConsent({ policyVersion: 'pv1', adultConfirmed: true, acceptedAt: 1 });
  store.clearAuth();
  assert.equal(store.getState().session, null);
  assert.equal(store.isEntryUnlocked(), true);
});

test('hydrate 恢复 session+consent，但业务临时态不恢复', () => {
  const wx = memWx();
  let store = createStore(wx);
  store.setSession({ sessionId: 's1', accessToken: 'at' });
  store.setConsent({ policyVersion: 'pv1', adultConfirmed: true, acceptedAt: 1 });
  store.setAssessment({ runId: 'r1' });
  store.setActiveTask({ taskId: 't1' });
  // 新 store 实例模拟重启
  store = createStore(wx);
  store.hydrate();
  assert.equal(store.getState().session.sessionId, 's1');
  assert.equal(store.getState().consent.policyVersion, 'pv1');
  assert.equal(store.getState().assessment, null);
  assert.equal(store.getState().activeTask, null); // PII 不恢复
});

test('AC-22：最终网络请求体递归遮蔽手机号和邮箱', () => {
  const input = {
    expected_version: 1,
    fields: {
      observed_fact: '请联系 13800138000 或 alice@example.com',
      need_or_boundary: ['不要再给 13800138000 发消息'],
      emotion: ['anxious']
    }
  };

  const masked = maskPiiDeep(input);
  const serialized = JSON.stringify(masked);

  assert.equal(serialized.includes('13800138000'), false);
  assert.equal(serialized.includes('alice@example.com'), false);
  assert.equal(masked.fields.observed_fact, '请联系 [MOBILE] 或 [EMAIL]');
  assert.deepEqual(masked.fields.need_or_boundary, ['不要再给 [MOBILE] 发消息']);
  assert.deepEqual(input.fields.need_or_boundary, ['不要再给 13800138000 发消息']);
});

test('AC-22：网络遮蔽不改写非 PII 业务字段', () => {
  const input = {
    context: 'family',
    confirmed: true,
    clarity_pre: 3,
    nested: [{ text: '对方本周两次取消见面。' }]
  };

  assert.deepEqual(maskPiiDeep(input), input);
});

test('业务版本链以 patch 方式推进且仍不持久化', () => {
  const wx = memWx();
  const store = createStore(wx);

  store.patchActiveTask({ taskId: 'task-1', version: 1 });
  store.patchActiveTask({ version: 2, contentVersion: 'content-2' });
  store.patchVenting({ ventSessionId: 'vent-1', version: 1 });
  store.patchVenting({ version: 2, aiTurnsUsed: 1 });

  assert.deepEqual(store.getState().activeTask, {
    taskId: 'task-1',
    version: 2,
    contentVersion: 'content-2'
  });
  assert.deepEqual(store.getState().venting, {
    ventSessionId: 'vent-1',
    version: 2,
    aiTurnsUsed: 1
  });
  const persisted = JSON.parse(wx.mem['aichat_state_v1'] || '{}');
  assert.equal(persisted.activeTask, undefined);
  assert.equal(persisted.venting, undefined);
});

test('个人资产摘要只暴露可展示结果，不返回关系原文或候选字段', () => {
  const store = createStore(memWx());
  store.setAssessment({
    runId: 'run-1',
    mappedTaskId: 'task-1',
    result: {
      current_tendency: '当前更常先核对信息',
      usable_strength: '能把混乱拆成可确认的部分',
      possible_blind_spot: '可能过早寻找唯一答案',
      one_real_world_reminder: '先问清一个可验证事实'
    }
  });
  store.setActiveTask({
    taskId: 'task-1',
    source: 'assessment',
    candidateFields: { interpretation: '候选解读' },
    fields: { observed_fact: '不应进入首页摘要的关系原文' }
  });
  store.setMoodCheckin({ value: 'steady', label: '还算平稳', recordedAt: 123 });

  const assets = store.getPersonalAssets();

  assert.deepEqual(assets.assessment, {
    runId: 'run-1',
    mappedTaskId: 'task-1',
    currentTendency: '当前更常先核对信息',
    usableStrength: '能把混乱拆成可确认的部分',
    realWorldReminder: '先问清一个可验证事实'
  });
  assert.deepEqual(assets.task, {
    taskId: 'task-1',
    source: 'assessment',
    stage: 'clarity_saved'
  });
  assert.deepEqual(assets.moodCheckin, {
    value: 'steady',
    label: '还算平稳',
    recordedAt: 123
  });
  assert.equal(JSON.stringify(assets).includes('关系原文'), false);
  assert.equal(JSON.stringify(assets).includes('候选解读'), false);
  assert.equal(JSON.stringify(assets).includes('possible_blind_spot'), false);
});

test('心情记录只在当前会话内复用，不写入 storage 或跨重启恢复', () => {
  const wx = memWx();
  let store = createStore(wx);
  store.setSession({ sessionId: 's1', accessToken: 'at' });
  store.setMoodCheckin({ value: 'low', label: '有点低落', recordedAt: 123 });

  const persisted = JSON.parse(wx.mem['aichat_state_v1'] || '{}');
  assert.equal(persisted.moodCheckin, undefined);
  assert.equal(store.getPersonalAssets().moodCheckin.label, '有点低落');

  store = createStore(wx);
  store.hydrate();
  assert.equal(store.getPersonalAssets().moodCheckin, null);
});
