// pages/growth-share/growth-share.js — 分享预览与海报（V1.2 原型 share 屏）
// 只分享用户主动勾选的内容；PNG 为 900×1380 本地生成；码位为示意，暂不可真实扫码。
const { getGrowth } = require('../../growth-store');

const TABS = [
  { id: 'comfort', label: '一句力量' },
  { id: 'challenge', label: '轻松猜想' },
  { id: 'result', label: '我的偏好' },
  { id: 'strength', label: '我的优势' }
];

Page({
  data: {
    tabs: TABS,
    posterKind: 'challenge',
    poster: null,
    titleLines: [],
    posterName: '',
    shareEntry: 'mbti',
    entryOptions: [],
    shareFlags: { type: true, strength: true, experience: false },
    showShareFlags: false,
    experienceSnippet: '',
    inviteQuery: '',
    posterSaveState: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const growth = getGrowth();
    const state = growth.get();
    const kind = state.posterKind;
    const poster = growth.posterContent(kind);
    const showShareFlags = kind === 'result' || kind === 'strength';
    const entryOptions = kind === 'comfort'
      ? [['voices', '这段故事'], ['mbti', '认识自己'], ['traits', '性格小探索'], ['strengths', '看看优势']]
      : [['mbti', '认识自己'], ['traits', '性格小探索'], ['strengths', '看看优势']];
    this.setData({
      posterKind: kind,
      poster,
      titleLines: poster.title.split('\n'),
      posterName: state.posterName,
      shareEntry: state.shareEntry,
      entryOptions,
      shareFlags: state.share,
      showShareFlags,
      experienceSnippet: showShareFlags && state.share.experience
        ? growth.actualExperiences()[0].event
        : '',
      inviteQuery: growth.inviteQueryString(kind)
    });
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  setPosterKind(event) {
    const kind = event.currentTarget.dataset.kind;
    const growth = getGrowth();
    const patch = { posterKind: kind };
    if (kind === 'comfort') patch.shareEntry = 'voices';
    else if (growth.get().shareEntry === 'voices') patch.shareEntry = 'mbti';
    growth.patch(patch);
    this.refresh();
  },

  setShareEntry(event) {
    getGrowth().patch({ shareEntry: event.currentTarget.dataset.entry });
    this.refresh();
  },

  onNameInput(event) {
    getGrowth().patch({ posterName: event.detail.value });
    this.setData({ posterName: event.detail.value });
  },

  toggleShareFlag(event) {
    const key = event.currentTarget.dataset.flag;
    const growth = getGrowth();
    const share = Object.assign({}, growth.get().share);
    share[key] = !share[key];
    growth.patch({ share });
    this.refresh();
  },

  simulateRecipient() {
    wx.navigateTo({ url: '/pages/invite/invite?' + this.data.inviteQuery });
  },

  onShareAppMessage() {
    const poster = this.data.poster;
    return {
      title: poster.title.replace('\n', ' '),
      path: '/pages/invite/invite?' + this.data.inviteQuery
    };
  },

  savePoster() {
    this.setData({ posterSaveState: '' });
    const query = wx.createSelectorQuery();
    query.select('#poster-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        this.setData({ posterSaveState: 'fail' });
        wx.showToast({ title: '海报画布未就绪，请稍后再试', icon: 'none' });
        return;
      }
      this.drawPoster(res[0].node, () => {
        wx.canvasToTempFilePath({
          canvas: res[0].node,
          success: (out) => {
            wx.saveImageToPhotosAlbum({
              filePath: out.tempFilePath,
              success: () => {
                this.setData({ posterSaveState: 'ok' });
                wx.showToast({ title: '已生成 PNG 海报，码位为原型示意', icon: 'none' });
              },
              fail: () => {
                this.setData({ posterSaveState: 'preview' });
                wx.previewImage({ urls: [out.tempFilePath] });
              }
            });
          },
          fail: () => {
            this.setData({ posterSaveState: 'fail' });
            wx.showToast({ title: '海报生成失败，请重试', icon: 'none' });
          }
        });
      });
    });
  },

  // —— 900 × 1380 海报绘制（与原型 saveGrowthPoster 布局一致）——
  drawPoster(canvas, done) {
    const dpr = 1;
    canvas.width = 900 * dpr;
    canvas.height = 1380 * dpr;
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    const kind = this.data.posterKind;
    const poster = this.data.poster;

    const round = (x, y, w, h, r, fill) => {
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
      c.fill();
    };
    const text = (v, x, y, size = 28, color = '#28334b', weight = '400') => {
      c.fillStyle = color;
      c.font = `${weight} ${size}px "PingFang SC", sans-serif`;
      c.fillText(v, x, y);
    };
    const wrap = (v, x, y, width, size = 29, line = 49, color = '#687991', limit = 6) => {
      c.fillStyle = color;
      c.font = `400 ${size}px "PingFang SC", sans-serif`;
      let row = '';
      let rows = 0;
      for (const ch of v) {
        if (c.measureText(row + ch).width > width && row) {
          c.fillText(row, x, y);
          y += line;
          row = ch;
          if (++rows >= limit - 1) {
            row += '…';
            break;
          }
        } else {
          row += ch;
        }
      }
      if (row) c.fillText(row, x, y);
    };
    const rocket = (cx, cy, s) => {
      c.fillStyle = '#edf1ff';
      c.beginPath();
      c.arc(cx, cy, 54 * s, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#a2b9e8';
      c.beginPath();
      c.moveTo(cx - 16 * s, cy + 20 * s);
      c.lineTo(cx - 30 * s, cy + 35 * s);
      c.lineTo(cx - 28 * s, cy + 10 * s);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(cx + 14 * s, cy - 6 * s);
      c.lineTo(cx + 32 * s, cy - 2 * s);
      c.lineTo(cx + 19 * s, cy + 16 * s);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#a9bde7';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - 21 * s, cy + 16 * s);
      c.quadraticCurveTo(cx - 19 * s, cy - 22 * s, cx + 16 * s, cy - 36 * s);
      c.quadraticCurveTo(cx + 15 * s, cy + 6 * s, cx - 6 * s, cy + 24 * s);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#c2d8f3';
      c.beginPath();
      c.arc(cx + 2 * s, cy - 8 * s, 10 * s, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d8b2d4';
      c.beginPath();
      c.moveTo(cx - 18 * s, cy + 22 * s);
      c.lineTo(cx - 29 * s, cy + 41 * s);
      c.lineTo(cx - 9 * s, cy + 28 * s);
      c.closePath();
      c.fill();
      c.fillStyle = '#b7a3d6';
      c.beginPath();
      c.arc(cx - 40 * s, cy - 12 * s, 3 * s, 0, Math.PI * 2);
      c.arc(cx + 38 * s, cy - 46 * s, 3 * s, 0, Math.PI * 2);
      c.fill();
    };
    const companion = (cx, cy, s) => {
      c.fillStyle = '#e7edff';
      c.beginPath();
      c.ellipse(cx, cy + 30 * s, 62 * s, 40 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c1d3ff';
      c.beginPath();
      c.ellipse(cx - 10 * s, cy - 10 * s, 44 * s, 36 * s, 0, 0, Math.PI * 2);
      c.ellipse(cx + 26 * s, cy - 4 * s, 34 * s, 28 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#5066a0';
      c.beginPath();
      c.arc(cx - 18 * s, cy - 12 * s, 4 * s, 0, Math.PI * 2);
      c.arc(cx + 12 * s, cy - 10 * s, 4 * s, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#5066a0';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(cx - 3 * s, cy - 4 * s, 7 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      c.fillStyle = '#e5c5ec';
      c.beginPath();
      c.ellipse(cx - 28 * s, cy - 4 * s, 8 * s, 4.5 * s, 0, 0, Math.PI * 2);
      c.ellipse(cx + 22 * s, cy - 2 * s, 8 * s, 4.5 * s, 0, 0, Math.PI * 2);
      c.fill();
    };

    const bg = c.createLinearGradient(0, 0, 900, 1380);
    bg.addColorStop(0, kind === 'comfort' ? '#fcf0f3' : kind === 'strength' ? '#e2f2ef' : '#e7edff');
    bg.addColorStop(1, '#fafbff');
    c.fillStyle = bg;
    c.fillRect(0, 0, 900, 1380);

    text('关系清晰卡', 66, 89, 30, '#5f73b8', '550');
    text('给自己一点探索的空间', 574, 87, 19, '#8d9ab3');
    round(66, 142, 490, 49, 10, '#ffffffa8');
    text(poster.eyebrow, 84, 175, 23, '#7585b4');
    this.data.titleLines.forEach((line, i) => text(line, 66, 286 + i * 91, 65, '#28334b', '550'));

    if (kind === 'challenge') rocket(720, 455, 1.9);
    else companion(730, 455, 1.7);

    wrap(poster.description, 66, 625, 758, 29, 49);
    let tx = 66;
    for (const tag of poster.tags) {
      const w = tag.length * 24 + 34;
      round(tx, 727, w, 49, 9, '#ffffffbb');
      text(tag, tx + 17, 760, 23, '#7085b8');
      tx += w + 13;
    }

    if (this.data.showShareFlags && this.data.shareFlags.experience) {
      round(66, 803, 768, 128, 12, '#ffffff99');
      text('我主动选择分享的经历', 87, 836, 21, '#8a99b3');
      wrap(this.data.experienceSnippet, 87, 875, 716, 23, 36, '#71839e', 2);
    }

    text((this.data.posterName || '探索中的我').slice(0, 16) + ' · 想听听你的看法', 66, 987, 25, '#8291aa');
    round(52, 1035, 796, 219, 20, '#ffffffdd');
    round(76, 1062, 157, 155, 14, '#f2f5fc');
    round(112, 1090, 83, 75, 22, '#e3eafa');
    text('清', 135, 1143, 40, '#6577dc');
    text('码位示意', 105, 1194, 20, '#8b98af');
    text(poster.cta, 269, 1097, 31, '#536895', '550');
    text('正式接入后，扫码直达对应功能', 269, 1144, 23, '#8090aa');
    text('交互原型 · 暂不可真实扫码', 269, 1193, 21, '#9aa5ba');
    wrap(poster.footer, 66, 1290, 768, 22, 30, '#929eb5', 2);
    text('本地 UI 原型演示', 66, 1350, 21, '#a0abc0');

    setTimeout(done, 60);
  }
});
