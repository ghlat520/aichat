const { store } = require('./app-store');

function currentReportOwner() {
  return store.getLogoutVersion() + ':' + ((store.getState().session || {}).sessionId || 'preview');
}

function clip(value, limit) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  const chars = Array.from(text);
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : text;
}

function reportPoster(source, data) {
  let title, eyebrow, description, rows, footer;
  if (source === 'via') {
    const sample = data.demo || !data.complete;
    if (!Array.isArray(data.topFive) || data.topFive.length !== 5 || data.topFive.some(item => !Number.isFinite(Number(item.score)) || Number(item.score) < 1 || Number(item.score) > 5)) return null;
    title = '我的性格优势';
    eyebrow = 'VIA 性格优势 · ' + (sample ? '排版样例' : '本轮自评');
    description = sample ? '24 项优势中，样例均分最高的 5 项。' : '24 项优势中，本轮均分最高的 5 项。';
    rows = data.topFive.map(item => ({ label: item.zh, value: Number(item.score).toFixed(2) + ' / 5' }));
    footer = sample ? '样例数据，非你的作答结果。' : '探索性自评，非 VIA 官方报告；排序靠后不等于缺点。';
  } else if (source === 'mbti') {
    if (!data.mbtiCover) return null;
    title = data.mbtiCover.code + '\n' + data.mbtiCover.name;
    eyebrow = 'MBTI · 结果样例';
    description = 'ENTP 固定排版样例，非本轮计分。';
    rows = [{ label: '性格偏好', value: data.mbtiCover.code }, { label: '别称', value: data.mbtiCover.alias.replace('别称：', '') }, { label: '关键词', detail: data.mbtiCover.keywords.replace('关键词：', '') }];
    footer = data.mbtiNotice;
  } else if (source === 'traits') {
    title = '我的性格特质'; eyebrow = '性格特质 · 演示结果';
    description = '五个连续维度，观察性格差异。';
    rows = (data.dimensions || []).slice(0, 5).map(item => ({ label: item.label, value: item.score + ' / 100' }));
    footer = '演示数据，非本轮计分；分数不是人群百分位。';
  } else if (source === 'strengths') {
    title = '我的优势主题'; eyebrow = '优势主题 · 演示结果';
    description = '三个值得继续探索的优势主题。';
    rows = (data.strengths || []).slice(0, 3).map(item => ({ label: item.name, detail: item.desc }));
    footer = '演示内容，需结合真实经历验证。';
  } else if (source === 'growth-preview') {
    if (data.state !== 'ready' || !data.previewFragment) return null;
    const fragment = data.previewFragment;
    title = '个人优势说明书'; eyebrow = '报告预览 · 样例片段';
    description = '先看一项优势，再结合经历验证。';
    rows = [{ label: fragment.strength, detail: fragment.description }, { label: '适用场景', detail: fragment.context }, { label: '留意盲点', detail: fragment.boundary }];
    footer = '样例预览，非完整报告；不含经历原文。';
  } else if (source === 'growth-report') {
    if (data.locked || !data.reportShareReady) return null;
    title = '个人优势说明书'; eyebrow = data.sample ? '个人优势 · 报告样例' : '个人优势 · 模板节选';
    description = '三项候选优势，放回生活中验证。';
    rows = (data.strengths || []).slice(0, 3).map(item => ({ label: item[0], detail: item[1] }));
    footer = data.sample ? '报告样例，非个性化解读。' : '当前报告模板节选；未分享经历原文。';
  } else if (source === 'career-report') {
    title = '职业探索报告'; eyebrow = data.paid ? '职业探索 · 模板节选' : '职业探索 · 报告预览';
    description = '从当前可见方向中，选一个继续探索。';
    rows = (data.directions || []).slice(0, 3).map(item => ({ label: item.name, detail: item.action }));
    footer = '职业方向仅供探索，不是就业或能力结论。';
  } else if (source === 'communication') {
    const preview = data.preview;
    if (!preview) return null;
    title = '我的沟通倾向'; eyebrow = '沟通轻自测 · 结果节选';
    description = preview.title;
    rows = [{ label: '可用优势', detail: preview.usable_strength }, { label: '现实提醒', detail: preview.one_real_world_reminder }].filter(item => item.detail);
    footer = [preview.ai_label, preview.disclaimer].filter(Boolean).join('；');
  } else return null;
  if (!rows.length) return null;
  return {
    source, kind: ['via', 'strengths', 'growth-report'].includes(source) ? 'strength' : 'result',
    title: clip(title, 28), eyebrow: clip(eyebrow, 32), description: clip(description, 54),
    rows: rows.map(item => ({ label: clip(item.label, 20), value: clip(item.value, 18), detail: clip(item.detail, 48) })),
    tags: [], cta: '扫码进入小程序', footer: clip(footer, 72)
  };
}

function openReportPoster(source, data, owner) {
  if (owner !== currentReportOwner()) {
    wx.showToast({ title: '身份已变化，请重新打开结果', icon: 'none' });
    return false;
  }
  const poster = reportPoster(source, data);
  if (!poster) {
    wx.showToast({ title: '结果尚未准备好', icon: 'none' });
    return false;
  }
  wx.navigateTo({
    url: '/pages/growth-share/growth-share?report=1',
    success(result) {
      if (owner === currentReportOwner()) result.eventChannel.emit('reportPoster', { poster, owner });
    }
  });
  return true;
}

module.exports = { currentReportOwner, openReportPoster };
