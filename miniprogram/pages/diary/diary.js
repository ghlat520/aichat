const { store, syncTabBar, goHome } = require('../../app-store');
const { getDiary, getExampleEntries, summarizeEntries, localDate, DIMENSIONS, MOODS } = require('../../diary-store');

function treeImage(branches) {
  const shapes = [
    { path: 'M181 253 Q139 253 80 215', x: 80, y: 215, angle: -52 },
    { path: 'M182 268 Q241 264 288 224', x: 288, y: 224, angle: 44 },
    { path: 'M179 204 Q118 192 63 146', x: 63, y: 146, angle: -50 },
    { path: 'M181 213 Q249 199 299 155', x: 299, y: 155, angle: 46 },
    { path: 'M181 180 Q144 142 124 82', x: 124, y: 82, angle: -28 },
    { path: 'M180 179 Q211 119 234 63', x: 234, y: 63, angle: 25 }
  ];
  const leaves = [[0, -8, -36], [16, 7, 45], [-16, 18, -55], [13, 31, 48], [-16, 42, -50], [9, 53, 42], [-11, 63, -48]];
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 340"><ellipse cx="182" cy="314" rx="66" ry="9" fill="#e9eef3"/><path d="M177 314 Q183 273 179 238 Q184 208 180 174" fill="none" stroke="#a3adb5" stroke-width="10" stroke-linecap="round"/><path d="M178 307 Q159 316 144 313 M183 309 Q204 319 221 314" fill="none" stroke="#a3adb5" stroke-width="4" stroke-linecap="round"/>';
  branches.forEach((branch, index) => {
    const shape = shapes[index];
    svg += `<path d="${shape.path}" fill="none" stroke="${branch.count ? branch.color : '#cdd6dd'}" stroke-width="${branch.count ? 4.5 : 2.5}" stroke-linecap="round"/>`;
    if (!branch.count) {
      svg += `<circle cx="${shape.x}" cy="${shape.y}" r="3.5" fill="#d7dfe5"/>`;
      return;
    }
    const amount = Math.min(7, branch.count * 2 + 1);
    svg += `<g transform="translate(${shape.x} ${shape.y}) rotate(${shape.angle})">`;
    leaves.slice(0, amount).forEach(([x, y, angle], leaf) => {
      svg += `<ellipse cx="${x}" cy="${y}" rx="9" ry="17" transform="rotate(${angle} ${x} ${y})" fill="${branch.color}" opacity="${leaf % 2 ? '.65' : '.88'}"/>`;
    });
    svg += '</g>';
  });
  svg += '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function displayEntry(entry) {
  const mood = MOODS.find(item => item.id === entry.mood) || MOODS[1];
  return {
    ...entry, moodLabel: mood.label, moodColor: mood.color,
    dateLabel: `${Number(entry.date.slice(5, 7))} 月 ${Number(entry.date.slice(8))} 日`,
    excerpt: entry.content.length > 66 ? entry.content.slice(0, 66) + '…' : entry.content,
    dimensionLabels: DIMENSIONS.filter(item => entry.dimensions.includes(item.id)).map(item => item.label)
  };
}

let editorSequence = 0;
Page({
  data: {
    panel: 'tree', editing: false, editorToken: '', viewingExample: false,
    entries: [], branches: [], dimensions: [], moods: MOODS,
    draft: { id: '', date: '', mood: 'calm', content: '', dimensions: [] },
    today: '', days: 0, total: 0, week: [], treeImage: '',
    branchId: 'emotion', selectedBranch: null, detailId: '', detail: null, notice: '',
    letter: [
      '亲爱的你：',
      '在这三篇示例日记里，有一个很小、却值得停下来看的片刻：你说了“都可以”，身体却没有跟着放松。肩膀的紧绷，或许在提醒你——你也有一些希望被听见的意见。',
      '接着，你写下了那句反复出现的念头：“拒绝别人就会让人失望。”你没有急着把它当作事实，而是开始问：这是不是我的一种猜测？这个停顿，本身就是一次新的觉察。',
      '从这些片段里，可以提出一个待验证的猜想：有时候，你可能会先照顾他人的期待，晚一点才发现自己的需要。但几篇日记不足以概括一个人；这也可能只是某个忙碌的工作日。你可以保留不认同的部分。',
      '如果愿意，下次不必一下子做到坚定拒绝。先试试你已经写下的那句话：“我需要一点时间考虑。”说完，留意身体有没有松一点，也看看对方实际上怎样回应。',
      '还有那二十分钟的散步。你在不赶路的时候，重新感觉到了呼吸。这或许可以成为明天的一小步：给自己留十分钟，不完成什么，只感受此刻。',
      '树枝记录的是你写到了什么。没有长出叶子的地方，也不意味着你做得不够好。等你愿意的时候，再从一个新的角度看看自己。',
      '愿你慢慢听见自己的声音，也允许自己慢慢改变。'
    ]
  },

  onShow() {
    syncTabBar(this, 2);
    const owner = this.currentOwner();
    if (this.owner && this.owner !== owner) {
      this.setData({ panel: 'tree', editing: false, editorToken: '', viewingExample: false, detailId: '', notice: '身份已变化，上一轮体验的记录已清除。' });
    }
    this.owner = owner;
    this.refresh();
  },

  goHome,
  currentOwner() {
    const session = store.getState().session;
    return `${store.getLogoutVersion()}:${session ? session.sessionId : 'preview'}`;
  },
  checkOwner() {
    if (this.owner === this.currentOwner()) return true;
    this.onShow();
    return false;
  },
  checkEditor(event) {
    if (!this.checkOwner()) return false;
    const dataset = event && event.currentTarget && event.currentTarget.dataset;
    return this.data.editing && dataset && dataset.editor === this.data.editorToken;
  },
  diary() { return getDiary(this.currentOwner()); },
  refreshDraft(afterRender) {
    const draft = this.diary().get().draft;
    this.setData({ draft, dimensions: DIMENSIONS.map(item => ({ ...item, selected: draft.dimensions.includes(item.id) })) }, afterRender);
  },
  refresh(scrollToTop = false) {
    const entries = this.data.viewingExample ? getExampleEntries() : this.diary().get().entries;
    const summary = summarizeEntries(entries);
    const today = localDate();
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - 6 + index);
      const day = localDate(date);
      return { date: day, label: day === today ? '今' : String(date.getDate()), recorded: entries.some(entry => entry.date === day) };
    });
    const displayed = entries.map(displayEntry);
    this.setData({
      entries: displayed, total: summary.total, days: summary.days, branches: summary.branches,
      selectedBranch: summary.branches.find(item => item.id === this.data.branchId) || summary.branches[0],
      treeImage: treeImage(summary.branches), today, week,
      detail: displayed.find(entry => entry.id === this.data.detailId) || null
    });
    this.refreshDraft(scrollToTop ? () => wx.pageScrollTo({ scrollTop: 0, duration: 0 }) : undefined);
  },
  selectPanel(event) {
    if (!this.checkOwner()) return;
    this.setData({ panel: event.currentTarget.dataset.panel, detailId: '', notice: '' });
    this.refresh(true);
  },
  toggleExample() {
    if (!this.checkOwner()) return;
    this.setData({ viewingExample: !this.data.viewingExample, detailId: '', notice: '' });
    this.refresh();
  },
  showLetterSources() {
    if (!this.checkOwner()) return;
    this.setData({ panel: 'journal', viewingExample: true, detailId: '', notice: '' });
    this.refresh(true);
  },
  selectBranch(event) {
    if (!this.checkOwner()) return;
    this.setData({ branchId: event.currentTarget.dataset.id });
    this.refresh();
  },
  openEditor() {
    if (!this.checkOwner()) return;
    this.setData({ viewingExample: false, editing: true, editorToken: String(++editorSequence), detailId: '', notice: '' });
    this.refresh(true);
  },
  closeEditor(event) { if (this.checkEditor(event)) this.setData({ editing: false, editorToken: '', notice: '' }); },
  writeFromBranch() {
    if (!this.checkOwner()) return;
    const draft = this.diary().get().draft;
    this.diary().updateDraft({ dimensions: [...new Set([...draft.dimensions, this.data.branchId])] });
    this.openEditor();
  },
  onContent(event) {
    if (!this.checkEditor(event)) return;
    this.diary().updateDraft({ content: event.detail.value });
    this.refreshDraft();
    if (this.data.notice) this.setData({ notice: '' });
  },
  onDate(event) { if (!this.checkEditor(event)) return; this.diary().updateDraft({ date: event.detail.value }); this.refreshDraft(); },
  selectMood(event) { if (!this.checkEditor(event)) return; this.diary().updateDraft({ mood: event.currentTarget.dataset.id }); this.refreshDraft(); },
  toggleDimension(event) {
    if (!this.checkEditor(event)) return;
    const id = event.currentTarget.dataset.id;
    const dimensions = this.diary().get().draft.dimensions;
    this.diary().updateDraft({ dimensions: dimensions.includes(id) ? dimensions.filter(item => item !== id) : [...dimensions, id] });
    this.refreshDraft();
  },
  saveEntry(event) {
    if (!this.checkEditor(event)) return;
    try {
      const saved = this.diary().save();
      this.setData({ panel: 'journal', editing: false, editorToken: '', viewingExample: false, detailId: saved.id, notice: '' });
      this.refresh(true);
      wx.showToast({ title: '已暂存到本次体验', icon: 'none' });
    } catch (error) { this.setData({ notice: error.message }); }
  },
  viewEntry(event) { if (!this.checkOwner()) return; this.setData({ detailId: event.currentTarget.dataset.id }); this.refresh(true); },
  closeEntry() { if (this.checkOwner()) this.setData({ detailId: '', detail: null }); },
  editEntry(event) {
    if (!this.checkOwner()) return;
    if (this.data.viewingExample) return;
    const id = event.currentTarget.dataset.id;
    const owner = this.owner;
    const open = () => {
      if (!this.checkOwner() || owner !== this.currentOwner()) return;
      try { this.diary().edit(id); this.openEditor(); }
      catch (error) { this.setData({ notice: error.message }); }
    };
    const draft = this.diary().get().draft;
    if (draft.content.trim() && draft.id !== id) {
      wx.showModal({ title: '打开这篇记录？', content: '打开后会替换当前未保存的草稿。', confirmText: '打开记录', cancelText: '保留草稿', success: result => { if (result.confirm) open(); } });
    } else open();
  }
});
