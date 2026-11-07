// pages/growth-share/growth-share.js — 分享预览与海报（V1.2 原型 share 屏）
// 只分享主动选择的摘要；报告通过事件通道传入，不保存原始作答或经历。
const { getGrowth } = require('../../growth-store');
const { currentReportOwner } = require('../../report-poster');
const UI = require('../../growth-ui-data.js');

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
    posterSaveState: '',
    reportMode: false, reportError: '', qrReady: false, qrSrc: '', posterImage: '', posterBusy: false
  },

  onLoad(query) {
    this._alive = true;
    this._owner = currentReportOwner();
    this._posterVersion = 0;
    this._reportMode = !!(query && query.report === '1');
    const account = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const qrReady = !!(UI.reportCode && account && account.miniProgram && account.miniProgram.appId === UI.reportCode.appId);
    this.setData({ reportMode: this._reportMode, qrReady, qrSrc: qrReady ? UI.reportCode.src : '', reportError: qrReady ? (this._reportMode ? '请从结果页生成海报' : '') : '当前应用的小程序码不可用' });
    if (this._reportMode) {
      this.getOpenerEventChannel().on('reportPoster', payload => {
        if (!this.isPosterCurrent() || !payload || payload.owner !== this._owner || !payload.poster || !Array.isArray(payload.poster.rows)) return;
        this._posterVersion++;
        this.setData({ poster: payload.poster, posterKind: payload.poster.kind, titleLines: payload.poster.title.split('\n'), showShareFlags: false, posterName: '', experienceSnippet: '', posterImage: '', reportError: this.data.qrReady ? '' : '当前应用的小程序码不可用' }, () => this.preparePoster());
      });
    }
  },

  onShow() {
    if (!this.isPosterCurrent()) {
      this._posterVersion++;
      this.setData({ poster: null, titleLines: [], posterImage: '', posterName: '', experienceSnippet: '', posterBusy: false, reportError: '身份已变化，请返回结果页重新生成' });
      return;
    }
    if (!this._reportMode) this.refresh();
  },

  onReady() {
    this._ready = true;
    this.preparePoster();
  },

  preparePoster() {
    const version = this._posterVersion;
    if (this._ready && this.data.poster && this.data.qrReady) this.generatePoster().catch(error => this.posterError(error, version));
  },

  onUnload() {
    this._alive = false;
    this._posterVersion++;
    clearTimeout(this._nameTimer);
  },

  isPosterCurrent(version) {
    return this._alive && this._owner === currentReportOwner() && (version === undefined || version === this._posterVersion);
  },

  refresh() {
    this._posterVersion++;
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
      inviteQuery: growth.inviteQueryString(kind),
      posterImage: '', posterBusy: false
    }, () => this.preparePoster());
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/assessment/assessment' }) });
  },

  setPosterKind(event) {
    if (!this.isPosterCurrent()) return;
    const kind = event.currentTarget.dataset.kind;
    const growth = getGrowth();
    const patch = { posterKind: kind };
    if (kind === 'comfort') patch.shareEntry = 'voices';
    else if (growth.get().shareEntry === 'voices') patch.shareEntry = 'mbti';
    growth.patch(patch);
    this.refresh();
  },

  setShareEntry(event) {
    if (!this.isPosterCurrent()) return;
    getGrowth().patch({ shareEntry: event.currentTarget.dataset.entry });
    this.refresh();
  },

  onNameInput(event) {
    if (!this.isPosterCurrent()) return;
    const name = event.detail.value.slice(0, 16);
    if (!this._reportMode) getGrowth().patch({ posterName: name });
    this._posterVersion++;
    this.setData({ posterName: name, posterImage: '', posterSaveState: '', posterBusy: false });
    clearTimeout(this._nameTimer);
    this._nameTimer = setTimeout(() => this.preparePoster(), 240);
  },

  toggleShareFlag(event) {
    if (!this.isPosterCurrent()) return;
    const key = event.currentTarget.dataset.flag;
    const growth = getGrowth();
    const share = Object.assign({}, growth.get().share);
    share[key] = !share[key];
    growth.patch({ share });
    this.refresh();
  },

  simulateRecipient() {
    if (!this.isPosterCurrent()) return;
    if (this._reportMode) { wx.switchTab({ url: '/pages/entry/entry' }); return; }
    wx.navigateTo({ url: '/pages/invite/invite?' + this.data.inviteQuery });
  },

  onShareAppMessage() {
    if (!this.isPosterCurrent() || !this.data.poster) return { title: '一起探索自己', path: '/pages/entry/entry' };
    return {
      title: this.data.poster.eyebrow + ' · ' + this.data.poster.title.replace(/\n/g, ' '),
      path: this._reportMode ? '/pages/entry/entry' : '/pages/invite/invite?' + this.data.inviteQuery,
      ...(this.data.posterImage ? { imageUrl: this.data.posterImage } : {})
    };
  },

  posterError(error, version) {
    if (!this.isPosterCurrent(version) || (error && error.message === 'STALE_POSTER')) return;
    this.setData({ posterBusy: false, posterSaveState: 'fail' });
    wx.showToast({ title: this.data.reportError || '海报生成失败，请重试', icon: 'none' });
  },

  async generatePoster() {
    if (!this.isPosterCurrent() || !this.data.poster || !this.data.qrReady) throw new Error('POSTER_UNAVAILABLE');
    if (this.data.posterImage) return this.data.posterImage;
    const version = this._posterVersion;
    if (this._pending && this._pending.version === version) return this._pending.promise;
    this.setData({ posterBusy: true, posterSaveState: '' });
    const pending = { version };
    pending.promise = (async () => {
      const canvas = await new Promise((resolve, reject) => {
        wx.createSelectorQuery().select('#poster-canvas').fields({ node: true, size: true }).exec(result => {
          if (!result || !result[0] || !result[0].node) reject(new Error('CANVAS_UNAVAILABLE'));
          else resolve(result[0].node);
        });
      });
      const code = await new Promise((resolve, reject) => {
        const image = canvas.createImage();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('CODE_IMAGE_UNAVAILABLE'));
        image.src = this.data.qrSrc;
      });
      if (!this.isPosterCurrent(version)) throw new Error('STALE_POSTER');
      this.drawPoster(canvas, code);
      const path = await new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: 'png', success: result => resolve(result.tempFilePath), fail: reject }));
      if (!this.isPosterCurrent(version)) throw new Error('STALE_POSTER');
      this.setData({ posterImage: path });
      return path;
    })();
    this._pending = pending;
    try { return await pending.promise; }
    finally {
      if (this._pending === pending) {
        this._pending = null;
        if (this.isPosterCurrent(version)) this.setData({ posterBusy: false });
      }
    }
  },

  async previewPoster() {
    const version = this._posterVersion;
    try {
      const path = await this.generatePoster();
      if (this.isPosterCurrent(version)) wx.previewImage({ urls: [path] });
    } catch (error) { this.posterError(error, version); }
  },

  async savePoster() {
    const version = this._posterVersion;
    try {
      const path = await this.generatePoster();
      if (!this.isPosterCurrent(version)) return;
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success: () => {
          if (!this.isPosterCurrent(version)) return;
          this.setData({ posterSaveState: 'ok' });
          wx.showToast({ title: '已保存海报', icon: 'success' });
        },
        fail: () => {
          if (!this.isPosterCurrent(version)) return;
          this.setData({ posterSaveState: 'preview' });
          wx.showToast({ title: '未保存，可长按图片保存', icon: 'none' });
          wx.previewImage({ urls: [path] });
        }
      });
    } catch (error) { this.posterError(error, version); }
  },

  async sharePoster() {
    const version = this._posterVersion;
    try {
      const path = await this.generatePoster();
      if (!this.isPosterCurrent(version)) return;
      const preview = () => {
        if (!this.isPosterCurrent(version)) return;
        wx.showToast({ title: '长按图片可保存或转发', icon: 'none' });
        wx.previewImage({ urls: [path] });
      };
      if (wx.showShareImageMenu && wx.canIUse && wx.canIUse('showShareImageMenu')) {
        wx.showShareImageMenu({ path, fail: error => { if (!String(error.errMsg).includes('cancel')) preview(); } });
      } else preview();
    } catch (error) { this.posterError(error, version); }
  },

  // —— 900 × 1380 海报绘制（与原型 saveGrowthPoster 布局一致）——
  drawPoster(canvas, codeImage) {
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
      let row = '', count = 0;
      const chars = Array.from(String(v));
      for (const ch of chars) {
        if (ch === '\n' || (row && c.measureText(row + ch).width > width)) {
          if (count === limit - 1) {
            while (row && c.measureText(row + '…').width > width) row = Array.from(row).slice(0, -1).join('');
            c.fillText(row + '…', x, y);
            return;
          }
          c.fillText(row, x, y);
          y += line; count++; row = ch === '\n' ? '' : ch;
        } else row += ch;
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

    text('自有引力', 66, 89, 30, '#5f73b8', '550');
    text('给自己一点探索的空间', 574, 87, 19, '#8d9ab3');
    round(66, 142, 490, 49, 10, '#ffffffa8');
    text(poster.eyebrow, 84, 175, 23, '#7585b4');
    this.data.titleLines.forEach((line, i) => text(line, 66, 286 + i * 91, 65, '#28334b', '550'));

    if (this.data.reportMode) {
      companion(748, 265, 1.05);
      wrap(poster.description, 66, 445, 758, 29, 44, '#687991', 2);
      const rowHeight = poster.rows.length > 3 ? 76 : 128;
      poster.rows.forEach((row, index) => {
        const y = 535 + index * rowHeight;
        round(66, y, 768, rowHeight - 12, 16, '#ffffffc9');
        text(String(index + 1).padStart(2, '0'), 85, y + 39, 22, '#8094b4');
        text(row.label, 134, y + 39, 30, '#28334b', '550');
        if (row.value) {
          c.textAlign = 'right'; text(row.value, 814, y + 39, 27, '#3155d9', '550'); c.textAlign = 'left';
        }
        if (row.detail) wrap(row.detail, 134, y + 73, 650, 24, 32, '#687991', 2);
        if (poster.source === 'via') {
          round(134, y + 50, 640, 4, 2, '#dbe9e4');
          round(134, y + 50, 640 * parseFloat(row.value) / 5, 4, 2, '#247b70');
        }
      });
    } else {
      if (kind === 'challenge') rocket(720, 455, 1.9);
      else companion(730, 455, 1.7);
      wrap(poster.description, 66, 625, 758, 29, 49, '#687991', 2);
      let tx = 66;
      for (const tag of poster.tags) {
        const w = tag.length * 24 + 34;
        round(tx, 727, w, 49, 9, '#ffffffbb');
        text(tag, tx + 17, 760, 23, '#7085b8');
        tx += w + 13;
      }
    }

    if (this.data.showShareFlags && this.data.shareFlags.experience) {
      round(66, 803, 768, 128, 12, '#ffffff99');
      text('我主动选择分享的经历', 87, 836, 21, '#8a99b3');
      wrap(this.data.experienceSnippet, 87, 875, 716, 23, 36, '#71839e', 2);
    }

    const report = this.data.reportMode;
    text((this.data.posterName || '探索中的我').slice(0, 16) + ' · 想听听你的看法', 66, report ? 949 : 987, 25, '#8291aa');
    round(52, report ? 970 : 1035, 796, report ? 300 : 219, 20, '#ffffffdd');
    const codeSize = report ? 280 : 169;
    c.drawImage(codeImage, report ? 66 : 76, report ? 980 : 1062, codeSize, codeSize);
    const codeTextX = report ? 378 : 269;
    text('扫码探索自己', codeTextX, report ? 1035 : 1097, 31, '#536895', '550');
    text('打开小程序首页', codeTextX, report ? 1091 : 1144, 23, '#8090aa');
    text('长按图片识别小程序码', codeTextX, report ? 1168 : 1193, 21, '#8291aa');
    wrap(poster.footer, 66, 1290, 768, 22, 30, '#929eb5', 2);
    text('探索自己 · 觉察开悟 · 自我驱动', 66, 1350, 21, '#7b8db3');
  }
});
