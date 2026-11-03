// pages/via-question/via-question.js — VIA 答题与续答（2026-11-03 原型 V2 via-question 屏）
// 72 题：选中即持久化、320ms 后自动切题；换维度定位该组首道未答；末题查漏补答。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

const AUTO_NEXT_DELAY = 320;

// 按美德分组顺序展开：24 项 × 3 题（与原型 questions 构造一致）
const STRENGTHS = CONTENT.VIA_GROUPS.reduce((all, group) => all.concat(group.items), []);
const QUESTIONS = STRENGTHS.reduce((all, item, strengthIndex) => {
  const groupIndex = CONTENT.VIA_GROUPS.findIndex((group) => group.items.indexOf(item) >= 0);
  return all.concat(item.q.map((text) => ({ text, strengthIndex, groupIndex })));
}, []);

function firstMissingFrom(answers, from, to) {
  for (let i = from; i < to; i += 1) {
    const value = answers[i];
    if (!(Number.isInteger(value) && value >= 1 && value <= 5)) return i;
  }
  return -1;
}

Page({
  data: {
    index: 0,
    total: QUESTIONS.length,
    question: '',
    strength: { zh: '', en: '' },
    groupIndex: 0,
    groupOptions: [],
    options: [],
    selected: 0,
    answeredCount: 0,
    progressPercent: 0,
    message: '选中圆圈后，将自动进入下一题',
    nextDisabled: true,
    nextLabel: '下一题',
    previousLabel: '返回介绍',
    sheet: ''
  },

  onLoad(query) {
    const q = Number(query && query.q);
    let index = getGrowth().viaFirstMissing();
    if (index < 0) index = 0;
    if (q >= 1 && q <= QUESTIONS.length) index = q - 1;
    this.applyState(index);
  },

  onShow() {
    this.applyState(this.data.index);
  },

  onHide() {
    this.cancelAutoNext();
  },

  onUnload() {
    this.cancelAutoNext();
  },

  cancelAutoNext() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    this.viaLocked = false; // 取消待执行切换即解锁（沿用 MBTI 已验证语义）
  },

  applyState(nextIndex) {
    const growth = getGrowth();
    const total = QUESTIONS.length;
    const index = Math.max(0, Math.min(total - 1, typeof nextIndex === 'number' ? nextIndex : 0));
    const item = QUESTIONS[index];
    const strength = STRENGTHS[item.strengthIndex];
    const answers = (growth.get().via || {}).answers || [];
    const answeredCount = answers.filter((value) => Number.isInteger(value) && value >= 1 && value <= 5).length;
    this.setData({
      index,
      total,
      question: item.text,
      strength: { zh: strength.zh, en: strength.en },
      groupIndex: item.groupIndex,
      groupOptions: CONTENT.VIA_GROUPS.map((group, gi) => {
        const progress = growth.viaGroupProgress(gi);
        return { value: gi, label: group.v + ' · ' + progress.answered + '/' + progress.total + ' 题' };
      }),
      options: CONTENT.VIA_LABELS.map((label, n) => ({
        value: n + 1,
        label,
        side: n < 2 ? 'left' : n > 2 ? 'right' : 'middle',
        size: n === 0 || n === 4 ? 'large' : n === 2 ? 'small' : 'medium'
      })),
      selected: (answers[index] || 0),
      answeredCount,
      progressPercent: Math.round(answeredCount / total * 100),
      message: '选中圆圈后，将自动进入下一题',
      nextDisabled: !(Number.isInteger(answers[index]) && answers[index] >= 1),
      nextLabel: index === total - 1 ? '查看优势排序' : '下一题',
      previousLabel: index === 0 ? '返回介绍' : '上一题'
    });
  },

  changeGroup(event) {
    this.cancelAutoNext();
    const groupIndex = Number(event.detail.value);
    const progress = getGrowth().viaGroupProgress(groupIndex);
    const answers = (getGrowth().get().via || {}).answers || [];
    const missing = firstMissingFrom(answers, progress.indices[0], progress.indices[0] + progress.total);
    this.applyState(missing === -1 ? progress.indices[0] : missing);
  },

  choose(event) {
    if (this.viaLocked) return;
    const value = Number(event.currentTarget.dataset.value);
    if (!(value >= 1 && value <= 5)) return;
    const growth = getGrowth();
    const index = this.data.index;
    growth.viaSaveAnswer(index, value); // 选中即持久化，320ms 只管跳题
    this.viaLocked = true;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      this.viaLocked = false;
      this.advance();
    }, AUTO_NEXT_DELAY);
    const answeredCount = growth.viaAnsweredCount();
    this.setData({
      selected: value,
      answeredCount,
      progressPercent: Math.round(answeredCount / this.data.total * 100),
      nextDisabled: false,
      message: '已选择，正在进入下一题…'
    });
  },

  advance() {
    const growth = getGrowth();
    const total = this.data.total;
    if (this.data.index < total - 1) {
      this.applyState(this.data.index + 1);
      return;
    }
    if (!growth.viaComplete()) {
      const missing = growth.viaFirstMissing();
      this.applyState(missing);
      this.setData({ message: '还有题目未选择，先补全这一题吧' });
      return;
    }
    growth.viaPatch({ preview: false });
    wx.redirectTo({ url: '/pages/via-result/via-result' });
  },

  next() {
    this.cancelAutoNext();
    this.advance();
  },

  previous() {
    this.cancelAutoNext();
    if (this.data.index === 0) {
      wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/via-intro/via-intro' }) });
      return;
    }
    this.applyState(this.data.index - 1);
  },

  goIntro() {
    this.cancelAutoNext();
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/via-intro/via-intro' }) });
  },

  pause() {
    this.cancelAutoNext();
    this.setData({ sheet: 'pause' });
  },

  closeSheet() {
    this.setData({ sheet: '' });
  },

  keepProgress() {
    this.closeSheet();
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  preventScroll() {}
});
