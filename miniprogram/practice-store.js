// Local growth practice: input, mode and review data stay in memory and belong to one identity.
const DATA = require('./growth-ui-data.js');
const PHASE = { goal: 0, facts: 0, feeling: 0, interpretation: 0, desired: 0, insight: 1, rehearsal: 2, what: 3, when: 3, criterion: 3, backup: 3, outcome: 4, actual: 4, result: 4, next: 4 };
const PLAN_KEYS = ['goal', 'facts', 'feeling', 'interpretation', 'desired', 'insight', 'rehearsal', 'what', 'when', 'criterion', 'backup', 'sourceDiaryId'];
const REVIEW_KEYS = [...Object.keys(PHASE), 'sourceDiaryId'];
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b, keys) => keys.every(key => (a[key] || '') === (b[key] || ''));
let sequence = 0;
function initial() {
  const fields = Object.fromEntries(Object.keys(PHASE).map(key => [key, '']));
  return { ...fields, id: `practice-${Date.now()}-${++sequence}`, step: 0, confirmed: -1, lightView: 'plan', reviewEditing: false };
}
function createPracticeStore() {
  let current = initial(), mode = 'light', records = [];
  const hasPlan = () => Boolean(current.savedPlan && current.what.trim() && current.when.trim() && same(current, current.savedPlan, PLAN_KEYS));
  const reviewed = () => hasPlan() && records.some(record => record.id === current.id && same(current, record, REVIEW_KEYS));
  const active = () => Object.keys(PHASE).some(key => Boolean(current[key].trim()));
  const requireFields = keys => {
    const missing = keys.find(key => !current[key].trim());
    if (missing) { const error = new Error(`请补充${({ goal: '这次想推进的方向', facts: '具体发生的事', desired: '希望的变化', insight: '认同或想修正的一点', rehearsal: '愿意尝试的新回应', what: '一个具体的小动作', when: '开始的时间或场景', criterion: '完成这一步的标准', outcome: '这次尝试的进度', actual: '实际尝试或暂时停下的经过', result: '帮助、结果或遇到的阻力', next: '下一步想保留或调整的做法' })[missing]}。`); error.field = missing; throw error; }
  };
  const confirm = () => {
    const keys = [['goal', 'facts', 'desired'], ['insight'], ['rehearsal'], ['what', 'when', 'criterion'], current.outcome === 'not-started' ? ['outcome', 'actual', 'next'] : ['outcome', 'actual', 'result', 'next']][current.step];
    requireFields(keys); current.confirmed = Math.max(current.confirmed, current.step);
  };
  function updateField(key, value) {
    if (!Object.prototype.hasOwnProperty.call(PHASE, key)) throw new Error('不支持的练习字段');
    const text = String(value || '');
    if (key === 'goal' && text && !DATA.directions[text]) throw new Error('请选择已有的探索方向');
    if (key === 'outcome' && text && !['done', 'partial', 'not-started'].includes(text)) throw new Error('请选择实际尝试的进度');
    const limit = key === 'facts' ? 2000 : key === 'rehearsal' ? 900 : 400;
    if (text.length > limit) throw new Error(`这段内容请控制在 ${limit} 字以内`);
    if (current[key] !== text) { current = { ...current, [key]: text, confirmed: Math.min(current.confirmed, PHASE[key] - 1) }; }
  }
  function commitPlan() { current.savedPlan = Object.fromEntries(PLAN_KEYS.map(key => [key, current[key] || ''])); current.lightView = 'plan'; }
  function commitReview() {
    current.reviewEditing = false;
    const record = { ...copy(current), savedAt: new Date().toISOString() }, index = records.findIndex(row => row.id === current.id);
    if (index < 0) records.unshift(record); else records[index] = record;
  }
  return {
    get() { return { current: copy(current), mode, records: copy(records), active: active(), planReady: hasPlan(), reviewed: reviewed(), direction: copy(DATA.directions[current.goal] || DATA.directions.express) }; },
    updateField,
    fromDiary(entry) {
      if (active() && !reviewed() && current.sourceDiaryId !== entry.id) { const error = new Error('当前已有未完成的微行动，已写内容会保留。'); error.code = 'ACTIVE_PRACTICE'; throw error; }
      if (reviewed()) current = initial();
      if (!active()) { current.sourceDiaryId = entry.id; current.sourceDiary = { id: entry.id, content: entry.content }; current.facts = entry.lines && entry.lines.event || entry.content; current.feeling = entry.lines && entry.lines.feeling || ''; current.insight = entry.lines && entry.lines.insight || ''; }
      mode = 'light'; current.lightView = current.lightView || 'plan';
    },
    act(action, value) {
      if (action === 'mode-light') { mode = 'light'; if (reviewed()) current.lightView = 'review'; }
      else if (action === 'mode-deep') { mode = 'deep'; current.step = Math.min(current.step, Math.min(4, current.confirmed + 1)); }
      else if (action === 'stage') { const next = Number(value); if (!Number.isInteger(next) || next < 0 || next > Math.min(4, current.confirmed + 1)) throw new Error('请先确认前面的内容'); current.step = next; }
      else if (action === 'light-plan') current.lightView = 'plan';
      else if (action === 'light-review') current.lightView = 'review';
      else if (action === 'light-edit-plan') current.lightView = 'edit-plan';
      else if (action === 'light-save-plan') { requireFields(['what', 'when']); commitPlan(); }
      else if (action === 'next') { if (mode !== 'deep' || current.step > 2) throw new Error('请使用当前节点的操作'); confirm(); current.step++; }
      else if (action === 'save-plan') { if (mode !== 'deep' || current.step !== 3 || current.confirmed < 2) throw new Error('请先完成前面的练习'); confirm(); commitPlan(); }
      else if (action === 'review') { if (!hasPlan()) throw new Error('先定下一个微行动'); current.step = 4; current.lightView = 'review'; }
      else if (action === 'edit-plan') { current.confirmed = Math.min(current.confirmed, 2); current.step = 3; }
      else if (action === 'edit-review') { if (!hasPlan()) throw new Error('先定下一个微行动'); current.reviewEditing = true; current.lightView = 'review'; if (mode === 'deep') { current.step = 4; current.confirmed = 3; } }
      else if (action === 'light-save-review') { if (!hasPlan()) throw new Error('先保存当前微行动'); requireFields(['actual', 'result', 'next']); commitReview(); }
      else if (action === 'save-review') { if (!hasPlan() || mode !== 'deep' || current.step !== 4) throw new Error('请先确认行动内容'); confirm(); commitReview(); }
      else if (action === 'new') { if (!reviewed()) throw new Error('先保留当前这轮内容，再开始新的一轮'); current = initial(); }
      else if (action === 'scaffold') {
        if (!current.rehearsal.trim()) { const brief = text => Array.from(text).slice(0, 120).join(''); const text = current.goal === 'express' ? `当「${brief(current.facts)}」发生时，我想让你知道：${brief(current.desired)}。我们可以一起商量一个具体做法吗？` : current.goal === 'choose' ? `我希望${brief(current.desired)}。这次先验证一个关键条件，再决定是否继续。` : `我想推进的是：${brief(current.desired)}。我先完成一个能掌握的小步骤，再根据结果调整。`; updateField('rehearsal', text); }
      } else throw new Error('未知的练习操作');
      return this.get();
    }
  };
}
let activeOwner, activeStore, intent;
function getPractice(owner) {
  if (!activeStore || activeOwner !== owner) { activeOwner = owner; activeStore = createPracticeStore(); if (intent && intent.owner !== owner) intent = undefined; }
  return activeStore;
}
function setFlowIntent(owner, value) { intent = { owner, value: copy(value) }; }
function takeFlowIntent(owner, target) {
  if (!intent) return null;
  if (intent.owner !== owner) { intent = undefined; return null; }
  if (intent.value.target !== target) return null;
  const value = intent.value; intent = undefined; return copy(value);
}
module.exports = { createPracticeStore, getPractice, setFlowIntent, takeFlowIntent };
