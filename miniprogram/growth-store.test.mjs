// growth-store.test.mjs — 自我探索流程状态机单测（零运行时依赖）
// 跑法：node --test miniprogram/growth-store.test.mjs
// 覆盖：V1.2 原型关键行为——作答进度、经历确认门槛、海报内容、邀请参数、模拟订单与退款。
import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createGrowthStore } = require('./growth-store.js');
const CONTENT = require('./growth-content.js');

function memWx() {
  const mem = {};
  return {
    mem,
    getStorageSync: (k) => mem[k],
    setStorageSync: (k, v) => { mem[k] = v; }
  };
}

function readyStore(storage) {
  const g = createGrowthStore(storage);
  g.completeTool('traits', 'native');
  g.completeTool('strengths', 'native');
  CONTENT.SAMPLE_EXPERIENCES.forEach((exp, i) => {
    ['event', 'action', 'result'].forEach((f) => g.setExperience(i, f, exp[f]));
  });
  g.patch({ goals: ['协作'] });
  g.confirmExperiences();
  return g;
}

test('初始状态：与原型演示态一致（特质/优势已完成、MBTI 进行中），经历为两段空表单', () => {
  const g = createGrowthStore(memWx());
  const s = g.get();
  assert.equal(s.results.mbti, false);
  assert.equal(s.results.traits, true);
  assert.equal(s.results.strengths, true);
  assert.equal(s.answers.mbti.length, 2);
  assert.equal(g.resumeIndex('mbti'), 2);
  assert.equal(s.experiences.length, 2);
  assert.equal(g.hasExperiences(), false);
  assert.equal(g.ready(), false);
});

test('作答：saveAnswer 逐题保存，末题 finished=true，resumeIndex 跳到未答处', () => {
  const g = createGrowthStore(memWx());
  g.resetTool('mbti'); // 初始演示态 MBTI 已有进度，先清空再验证作答逻辑
  assert.equal(g.resumeIndex('mbti'), 0);
  assert.equal(g.saveAnswer('mbti', 0, 3).finished, false);
  assert.equal(g.resumeIndex('mbti'), 1);
  assert.equal(g.savedChoice('mbti', 0), 3);
  const last = CONTENT.QUESTIONS.mbti.length - 1;
  assert.equal(g.saveAnswer('mbti', last, 4).finished, true);
});

test('完成测评后 results/sources 记录来源；resetTool 清空进度', () => {
  const g = createGrowthStore(memWx());
  g.completeTool('mbti', 'import', { kind: 'import', name: '我的已有测评 · 未知', date: '2026-10-26', type: 'INTJ' });
  assert.equal(g.get().results.mbti, true);
  assert.equal(g.typeCode(), 'INTJ');
  g.resetTool('mbti');
  assert.equal(g.get().results.mbti, false);
  assert.equal(g.get().answers.mbti.length, 0);
  assert.equal(g.typeCode(), 'INFP');
});

test('经历确认：字段不齐不给 confirm；编辑已确认经历会回到未确认', () => {
  const g = createGrowthStore(memWx());
  g.setExperience(0, 'event', '情境');
  g.setExperience(0, 'action', '行动');
  g.setExperience(0, 'result', '结果');
  assert.equal(g.hasExperiences(), false);
  g.setExperience(1, 'event', '情境2');
  g.setExperience(1, 'action', '行动2');
  g.setExperience(1, 'result', '结果2');
  assert.equal(g.hasExperiences(), true);
  g.confirmExperiences();
  assert.equal(g.get().confirmed, true);
  g.setExperience(0, 'event', '改一下');
  assert.equal(g.get().confirmed, false);
});

test('ready()：缺目标不算就绪；actualExperiences 未确认时用示例', () => {
  const g = readyStore(memWx());
  assert.equal(g.ready(), true);
  assert.equal(g.actualExperiences()[0].event, CONTENT.SAMPLE_EXPERIENCES[0].event);
  const g2 = createGrowthStore(memWx());
  g2.completeTool('traits');
  g2.completeTool('strengths');
  assert.equal(g2.ready(), false);
});

test('海报内容：四种 kind 的标题与文案随状态变化', () => {
  const g = createGrowthStore(memWx());
  assert.ok(g.posterContent('challenge').title.includes('INFP'));
  g.patch({ socialVote: 'INTJ' });
  assert.ok(g.posterContent('challenge').description.includes('INTJ'));
  g.patch({ posterKind: 'comfort' });
  const comfort = g.posterContent('comfort');
  assert.equal(comfort.eyebrow, '把一点温柔，送给此刻的你');
  assert.ok(comfort.footer.includes('乔布斯'));
  const result = g.posterContent('result');
  assert.equal(result.title, '遇见，\n更好的你自己。');
});

test('邀请参数：challenge 带上猜想，comfort 指向 voices + 人物', () => {
  const g = createGrowthStore(memWx());
  g.patch({ socialVote: 'ENTP' });
  const q = g.inviteQuery('challenge');
  assert.equal(q.entry, 'mbti');
  assert.equal(q.campaign, 'musk-v1');
  assert.equal(q.pick, 'ENTP');
  const q2 = g.inviteQuery('comfort');
  assert.equal(q2.entry, 'voices');
  assert.equal(q2.voice, 'jobs');
  assert.ok(g.inviteQueryString('comfort').includes('voice=jobs'));
});

test('订单展示只从服务器响应更新：待确认不解锁，有效权益才解锁', () => {
  const g = readyStore(memWx());
  const order = { order_id: 'TEST_BASE', sku: 'base', price_fen: 2990, payment_state: 'PENDING', refund_state: 'NONE', entitlement_state: 'NONE', refunded_fen: 0 };
  g.applyServerOrder(order);
  assert.equal(g.get().order.amount, 29.9);
  assert.equal(g.canReadBase(), false);
  g.applyServerOrder({ ...order, payment_state: 'PAID', entitlement_state: 'ACTIVE' });
  assert.equal(g.canReadBase(), true);
  g.applyServerOrder({ ...order, order_id: 'TEST_UPGRADE', sku: 'upgrade', price_fen: 2000, payment_state: 'PAID', entitlement_state: 'ACTIVE' });
  assert.equal(g.get().order.amount, 20);
  assert.equal(g.get().careerPaid, true);
  assert.equal(g.canReadBase(), true);
});

test('售后登记不改变付款与权益，只有服务端退款确认才撤销', () => {
  const g = readyStore(memWx());
  const order = { order_id: 'TEST_BASE', sku: 'base', price_fen: 2990, payment_state: 'PAID', refund_state: 'NONE', entitlement_state: 'ACTIVE', refunded_fen: 0 };
  g.applyServerOrder(order);
  g.submitSupport('内容纠错', '解释不符合');
  assert.equal(g.get().refund, 'none');
  assert.equal(g.canReadBase(), true);
  g.applyServerOrder({ ...order, refund_state: 'COMPLETED', entitlement_state: 'REVOKED', refunded_fen: 2990 });
  assert.equal(g.get().refund, 'refunded');
  assert.equal(g.get().order.payment_state, 'PAID');
  assert.equal(g.get().paid, false);
  assert.equal(g.canReadBase(), false);
});

test('校准与复盘：提交后版本升级为 1.1，复盘保存 reflected', () => {
  const g = readyStore(memWx());
  g.submitCalibration('实际是临时会议让我不适');
  assert.equal(g.get().calibrated, true);
  assert.equal(g.get().version, '1.1');
  g.submitReflection({ reviewText: '试了一次', reviewOutcome: '更清楚', reviewNext: '保留' });
  assert.equal(g.get().reflected, true);
});

test('陪伴故事：saveVoice 收藏去重，笔记按人物保存', () => {
  const g = createGrowthStore(memWx());
  g.saveVoice('federer');
  g.saveVoice('federer');
  assert.deepEqual(g.get().savedVoices, ['federer']);
  g.saveVoiceNote('federer', '下一分');
  assert.equal(g.get().voiceNotes.federer, '下一分');
});

test('持久化：状态写入 storage，重建后恢复进度', () => {
  const storage = memWx();
  const g = createGrowthStore(storage);
  g.saveAnswer('traits', 0, 2);
  g.completeTool('mbti');
  const g2 = createGrowthStore(storage);
  assert.equal(g2.get().answers.traits[0], 2);
  assert.equal(g2.get().results.mbti, true);
});

test('resetAll：一键回到原型演示初始态', () => {
  const g = readyStore(memWx());
  g.resetAll();
  assert.equal(g.get().results.traits, true); // 演示态默认已完成（与原型一致）
  assert.equal(g.get().paid, false);
  assert.equal(g.get().goals.length, 0);
});

test('scene 短标识：已知码定向，显式参数优先，未知码回默认', () => {
  const { resolveInviteConfig } = require('./growth-store.js');
  const byScene = resolveInviteConfig({ scene: 'mk01_tr_v1' });
  assert.equal(byScene.entry, 'traits');
  assert.equal(byScene.kind, 'challenge');
  assert.equal(byScene.campaign, 'musk-v1');
  const bySceneVoice = resolveInviteConfig({ scene: 'vc01_vo_f1' });
  assert.equal(bySceneVoice.entry, 'voices');
  assert.equal(bySceneVoice.kind, 'comfort');
  assert.equal(bySceneVoice.voice, 'federer');
  const explicitWins = resolveInviteConfig({ scene: 'mk01_tr_v1', entry: 'strengths' });
  assert.equal(explicitWins.entry, 'strengths');
  const unknown = resolveInviteConfig({ scene: 'not_registered' });
  assert.equal(unknown.entry, 'mbti');
  assert.equal(unknown.kind, 'challenge');
});
