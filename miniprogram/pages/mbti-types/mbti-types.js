// Reference reading only: selecting a card never creates a measurement result.
const CONTENT = require('../../growth-content');
const UI = require('../../growth-ui-data.js');

const GROUP_CHIPS = [{ code: 'all', label: '全部' }].concat(
  Object.keys(CONTENT.MBTI_TYPE_GROUPS).map((code) => ({
    code,
    label: CONTENT.MBTI_TYPE_GROUPS[code]
  }))
);

Page({
  data: {
    group: 'all',
    typeOptions: CONTENT.MBTI_TYPE_CONTENT.map(type => ({ code: type.code, label: type.code + ' ' + type.name })),
    pickerIndex: 0,
    groupChips: GROUP_CHIPS,
    cards: [],
    visibleCount: 16,
    currentIndex: 0,
    cardOffsets: [],
    selectedType: null,
    selectedFigure: null,
    showSources: false
  },

  onLoad(query) {
    wx.setNavigationBarTitle({ title: '16 型名人图鉴' });
    this.selectInGroup('all', query && query.code);
  },

  selectInGroup(group, code) {
    const visible = CONTENT.MBTI_TYPE_CONTENT.filter(type => group === 'all' || type.group === group);
    const selected = visible.find(type => type.code === code) || visible[0];
    if (!selected) return;
    const currentIndex = visible.indexOf(selected);
    const cardOffsets = visible.map((type, index) => {
      let offset = (index - currentIndex + visible.length) % visible.length;
      if (offset > visible.length / 2) offset -= visible.length;
      return offset;
    });
    const patch = {
      group, currentIndex, cardOffsets, visibleCount: visible.length,
      selectedType: selected,
      selectedFigure: UI.typeFigures[selected.code],
      pickerIndex: CONTENT.MBTI_TYPE_CONTENT.findIndex(type => type.code === selected.code)
    };
    if (group !== this.data.group || !this.data.cards.length) {
      patch.cards = visible.map(type => ({ ...type, portrait: UI.typePortraits[type.code], figure: UI.typeFigures[type.code], groupLabel: CONTENT.MBTI_TYPE_GROUPS[type.group] }));
    }
    this.setData(patch);
  },

  selectType(event) {
    const code = event.currentTarget.dataset.code;
    if (this.data.cards.some(type => type.code === code)) this.selectInGroup(this.data.group, code);
  },

  setGroup(event) {
    const group = event.currentTarget.dataset.group;
    if (GROUP_CHIPS.some(chip => chip.code === group)) this.selectInGroup(group, this.data.selectedType && this.data.selectedType.code);
  },

  onPickType(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= CONTENT.MBTI_TYPE_CONTENT.length) return;
    const type = CONTENT.MBTI_TYPE_CONTENT[index];
    this.selectInGroup(this.data.group === 'all' || type.group === this.data.group ? this.data.group : 'all', type.code);
  },

  stepType(event) {
    const step = Number(event.currentTarget.dataset.step), cards = this.data.cards;
    if ((step !== -1 && step !== 1) || !cards.length) return;
    const next = (this.data.currentIndex + step + cards.length) % cards.length;
    this.selectInGroup(this.data.group, cards[next].code);
  },

  onTypeSwipe(event) {
    const detail = event.detail, cards = this.data.cards;
    if (!detail || detail.source !== 'touch' || !Number.isInteger(detail.current) || detail.current < 0 || detail.current >= cards.length) return;
    this.selectInGroup(this.data.group, cards[detail.current].code);
  },

  goTest() {
    wx.navigateTo({ url: '/pages/growth-intro/growth-intro?tool=mbti' });
  },

  toggleSources() {
    this.setData({ showSources: !this.data.showSources });
  },

  copySource() {
    wx.setClipboardData({ data: this.data.selectedFigure.sourceUrl });
  },

  goCross() {
    if (this.data.selectedType) wx.redirectTo({ url: '/pages/via-mbti/via-mbti?code=' + this.data.selectedType.code });
  },

  goViaIntro() {
    wx.navigateTo({ url: '/pages/via-intro/via-intro' });
  },

  goDiscover() {
    wx.switchTab({ url: '/pages/assessment/assessment' });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  }
});
