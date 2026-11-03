// pages/growth-question/growth-question.js — 答题与续答
// 通用分支：V1.2 原型 question 屏（整行选项、可关自动前进）。
// MBTI 分支：2026-11-02 原型 questionPage——一题一页、五档圆圈、固定 320ms 自动切题、
// 四步维度跳转（续答定位首个未答）、末题查漏补答，进度本地持久化。
const { getGrowth } = require('../../growth-store');
const CONTENT = require('../../growth-content');

const AUTO_NEXT_DELAY = 220;
const MBTI_AUTO_NEXT_DELAY = 320;

function mbtiGroups() {
  return CONTENT.MBTI_GROUPS;
}

function firstMissing(answers, from, to) {
  for (let i = from; i < to; i += 1) {
    const value = answers[i];
    if (!(Number.isInteger(value) && value >= 1 && value <= 5)) return i;
  }
  return -1;
}

Page({
  data: {
    toolId: 'mbti',
    toolShort: 'MBTI 性格测试',
    isClassic: false,
    isMbti: true,
    question: '',
    options: [],
    index: 0,
    total: CONTENT.QUESTIONS.mbti.length,
    selected: 0,
    autoNext: true,
    sheet: '',
    savedCount: 0,
    group: {},
    steps: [],
    answeredCount: 0,
    ends: { left: '', right: '' },
    circleOptions: [],
    message: '选择后会自动进入下一题',
    nextDisabled: true,
    nextLabel: '下一题',
    previousLabel: '返回介绍',
    footProgress: '第 1 / 40 题',
    hintSuffix: CONTENT.MBTI_QUESTION_HINT_SUFFIX
  },

  onLoad(query) {
    const toolId = CONTENT.TOOLS[query && query.tool] ? query.tool : 'mbti';
    this.toolId = toolId;
    if (toolId === 'mbti') {
      const growth = getGrowth();
      const page = Number(query && query.page);
      const single = Number(query && query.q);
      let index = growth.resumeIndex('mbti');
      if (single >= 1 && single <= this.data.total) index = single - 1;
      else if (page >= 1 && page <= 4) index = (page - 1) * 10;
      this.applyMbtiState(index);
    } else {
      this.applyState();
    }
    wx.setNavigationBarTitle({ title: CONTENT.TOOLS[toolId].short });
  },

  onShow() {
    if (this.toolId === 'mbti') this.applyMbtiState(this.data.index);
    else this.applyState();
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
    this.mbtiLocked = false; // 取消待执行切换即解锁（对齐原型 cancelAutoAdvance）
  },

  // —— MBTI 分支 ——
  applyMbtiState(nextIndex) {
    const growth = getGrowth();
    const groups = mbtiGroups();
    const total = this.data.total;
    const index = Math.max(0, Math.min(total - 1,
      typeof nextIndex === 'number' ? nextIndex : growth.resumeIndex('mbti')));
    const stepIndex = Math.floor(index / 10);
    const group = groups[stepIndex];
    const answers = growth.get().answers.mbti || [];
    const [title, left, right] = group.items[index % 10];
    const selected = growth.savedChoice('mbti', index);
    const circleOptions = [1, 2, 3, 4, 5].map((value) => {
      const label = value < 3
        ? (value === 1 ? '明显更接近' : '稍微更接近') + '“' + left + '”'
        : value > 3
          ? (value === 5 ? '明显更接近' : '稍微更接近') + '“' + right + '”'
          : '两种描述都适合我';
      return {
        value,
        side: value < 3 ? 'left' : value > 3 ? 'right' : 'middle',
        size: value === 1 || value === 5 ? 'large' : value === 3 ? 'small' : 'medium',
        label,
        ariaLabel: '第' + (index + 1) + '题，' + label
      };
    });
    this.setData({
      toolId: 'mbti',
      toolShort: CONTENT.TOOLS.mbti.short,
      isMbti: true,
      index,
      total,
      question: title,
      ends: { left, right },
      group: {
        title: group.title,
        code: group.code,
        note: group.note,
        hint: group.note + ' ' + CONTENT.MBTI_QUESTION_HINT_SUFFIX
      },
      steps: groups.map((item, i) => ({
        code: item.code,
        title: item.title,
        complete: firstMissing(answers, i * 10, i * 10 + 10) === -1,
        current: i === stepIndex
      })),
      answeredCount: growth.answeredCount('mbti'),
      circleOptions,
      message: '选择后会自动进入下一题',
      nextDisabled: !selected,
      nextLabel: index === total - 1 ? '查看结果样例' : '下一题',
      previousLabel: index === 0 ? '返回介绍' : '上一题',
      footProgress: '第 ' + (index + 1) + ' / ' + total + ' 题',
      selected
    });
  },

  stepTap(event) {
    this.cancelAutoNext();
    const step = Number(event.currentTarget.dataset.step);
    const growth = getGrowth();
    const answers = growth.get().answers.mbti || [];
    const from = step * 10;
    const missing = firstMissing(answers, from, from + 10);
    this.applyMbtiState(missing === -1 ? from : missing);
  },

  chooseMbti(event) {
    if (this.mbtiLocked) return;
    const value = Number(event.currentTarget.dataset.value);
    if (!(value >= 1 && value <= 5)) return;
    const growth = getGrowth();
    const index = this.data.index;
    growth.saveAnswer('mbti', index, value); // 选中即持久化（原型 change 即写，320ms 只管跳题）
    this.mbtiLocked = true;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      this.mbtiLocked = false;
      this.advanceMbti();
    }, MBTI_AUTO_NEXT_DELAY);
    this.setData({
      selected: value,
      answeredCount: growth.answeredCount('mbti'),
      nextDisabled: false,
      message: '已选择，正在进入下一题…'
    });
  },

  advanceMbti() {
    const growth = getGrowth();
    const total = this.data.total;
    if (this.data.index === total - 1) {
      const answers = growth.get().answers.mbti || [];
      const missing = firstMissing(answers, 0, total);
      if (missing !== -1) {
        this.applyMbtiState(missing);
        this.setData({ message: '还有题目未选择，先完成这一题吧' });
        return;
      }
      growth.completeTool('mbti', 'native', {
        name: CONTENT.MBTI_DEMO_SOURCE_NAME,
        date: new Date().toISOString().slice(0, 10)
      });
      wx.redirectTo({ url: '/pages/growth-result/growth-result?tool=mbti' });
      return;
    }
    this.applyMbtiState(this.data.index + 1);
  },

  saveMbti() {
    this.cancelAutoNext();
    this.advanceMbti();
  },

  previousMbti() {
    this.cancelAutoNext();
    if (this.data.index === 0) {
      this.goIntro();
      return;
    }
    this.applyMbtiState(this.data.index - 1);
  },

  goIntro() {
    this.cancelAutoNext();
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: '/pages/growth-intro/growth-intro?tool=mbti' })
    });
  },

  // —— 通用分支（traits / strengths 演示题，保持 V1.2 行为）——
  applyState(nextIndex) {
    const growth = getGrowth();
    const state = growth.get();
    const index = typeof nextIndex === 'number' ? nextIndex : growth.resumeIndex(this.toolId);
    const labels = this.toolId === 'traits' ? CONTENT.ANSWER_LABELS_CLASSIC : CONTENT.ANSWER_LABELS_AGREE;
    this.setData({
      toolId: this.toolId,
      toolShort: CONTENT.TOOLS[this.toolId].short,
      isMbti: false,
      isClassic: this.toolId === 'traits',
      question: CONTENT.QUESTIONS[this.toolId][index],
      options: labels.map((label, i) => ({ value: i + 1, label })),
      index,
      total: CONTENT.QUESTIONS[this.toolId].length,
      selected: growth.savedChoice(this.toolId, index),
      autoNext: state.autoNext
    });
  },

  goBack() {
    this.cancelAutoNext();
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  choose(event) {
    const value = Number(event.currentTarget.dataset.value);
    this.setData({ selected: value });
    if (this.data.autoNext) {
      if (this.autoTimer) clearTimeout(this.autoTimer);
      const snapshot = { index: this.data.index };
      this.autoTimer = setTimeout(() => {
        if (this.data.index === snapshot.index) this.save();
      }, AUTO_NEXT_DELAY);
    }
  },

  save() {
    this.cancelAutoNext();
    if (!this.data.selected) return;
    const growth = getGrowth();
    const { finished } = growth.saveAnswer(this.toolId, this.data.index, this.data.selected);
    if (finished) {
      growth.completeTool(this.toolId, 'native');
      wx.redirectTo({ url: '/pages/growth-result/growth-result?tool=' + this.toolId });
      return;
    }
    this.applyState(this.data.index + 1);
  },

  previous() {
    this.cancelAutoNext();
    if (this.data.index === 0) return;
    const growth = getGrowth();
    const index = this.data.index - 1;
    this.setData({
      index,
      question: CONTENT.QUESTIONS[this.toolId][index],
      selected: growth.savedChoice(this.toolId, index)
    });
  },

  toggleAutoNext(event) {
    this.cancelAutoNext();
    getGrowth().setAutoNext(!!event.detail.value.length);
    this.setData({ autoNext: !!event.detail.value.length });
  },

  pause() {
    this.cancelAutoNext();
    this.setData({ sheet: 'pause', savedCount: (getGrowth().get().answers[this.toolId] || []).length });
  },

  pauseMbti() {
    this.cancelAutoNext();
    this.setData({ sheet: 'pause', savedCount: getGrowth().answeredCount('mbti') });
  },

  closeSheet() {
    this.setData({ sheet: '' });
  },

  keepProgress() {
    this.closeSheet();
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  classicSource() {
    this.cancelAutoNext();
    this.setData({ sheet: 'source' });
  },

  copyClassicSource() {
    wx.setClipboardData({ data: CONTENT.CLASSIC_SOURCE });
  },

  preventScroll() {}
});
