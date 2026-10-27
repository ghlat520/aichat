const tabs = [
  { path: '/pages/entry/entry', label: '首页', icon: 'home' },
  { path: '/pages/assessment/assessment', label: '自测', icon: 'test' },
  { path: '/pages/venting/venting', label: '说一说', icon: 'chat-light' },
  { path: '/pages/report/report', label: '清晰卡', icon: 'cards' },
  { path: '/pages/profile/profile', label: '我的', icon: 'user' }
];
Component({
  options: { styleIsolation: 'apply-shared' },
  data: { selected: 0, tabs },
  methods: {
    switchTab(event) {
      const selected = Number(event.currentTarget.dataset.index);
      const tab = tabs[selected];
      if (!tab) return;
      wx.switchTab({ url: tab.path, success: () => this.setData({ selected }) });
    }
  }
});
