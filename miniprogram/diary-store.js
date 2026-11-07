// 体验版日记仅驻留内存；不调用 storage、网络或日志接口。
const DIMENSIONS = [
  { id: 'emotion', label: '情绪与身体', color: '#8b9fcb', prompt: '此刻是什么情绪？身体的哪个地方最有感觉？' },
  { id: 'relationship', label: '关系', color: '#c18ca5', prompt: '今天和谁相处时，我更自在，或有些紧绷？' },
  { id: 'needs', label: '价值与需要', color: '#86aaa2', prompt: '在这件事里，我真正在意和需要的是什么？' },
  { id: 'action', label: '行动模式', color: '#c2a17b', prompt: '我做了什么？下次想保留或试着改变哪一小步？' },
  { id: 'thinking', label: '思维方式', color: '#a291bb', prompt: '脑海里反复出现哪句话？它是事实，还是我的猜测？' },
  { id: 'meaning', label: '方向与意义', color: '#8da978', prompt: '今天哪个片刻，让我靠近了想过的生活？' }
];
const MOODS = [
  { id: 'light', label: '轻快', color: '#e3b77d' },
  { id: 'calm', label: '平静', color: '#8ab6ac' },
  { id: 'mixed', label: '复杂', color: '#a89bc4' },
  { id: 'tired', label: '疲惫', color: '#9baac4' },
  { id: 'low', label: '低落', color: '#9c9db7' }
];

function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function emptyDraft() {
  return { id: '', date: localDate(), mood: '', content: '', dimensions: [], lines: { event: '', feeling: '', insight: '' }, freeContent: '' };
}

function copyEntry(entry) {
  return { ...entry, dimensions: [...entry.dimensions], ...(entry.lines ? { lines: { ...entry.lines } } : {}), ...(entry.inspiration ? { inspiration: { ...entry.inspiration } } : {}) };
}

function createDiaryStore() {
  let entries = [];
  let draft = emptyDraft();
  let sequence = 0;

  return {
    get() {
      return { entries: entries.map(copyEntry), draft: copyEntry(draft) };
    },
    updateDraft(patch) {
      for (const field of ['date', 'mood', 'dimensions']) {
        if (Object.prototype.hasOwnProperty.call(patch, field)) draft[field] = field === 'dimensions' ? [...patch[field]] : String(patch[field] || '');
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'inspiration')) draft.inspiration = patch.inspiration ? { source: String(patch.inspiration.source || ''), question: String(patch.inspiration.question || '') } : undefined;
      if (Object.prototype.hasOwnProperty.call(patch, 'content')) draft.freeContent = String(patch.content || '');
      if (Object.prototype.hasOwnProperty.call(patch, 'freeContent')) draft.freeContent = String(patch.freeContent || '');
      if (Object.prototype.hasOwnProperty.call(patch, 'lines')) {
        if (!patch.lines || typeof patch.lines !== 'object' || Array.isArray(patch.lines)) throw new Error('请使用三行觉察的有效字段');
        for (const key of ['event', 'feeling', 'insight']) if (Object.prototype.hasOwnProperty.call(patch.lines, key)) {
          const value = String(patch.lines[key] || '');
          if (value.length > 600) throw new Error('每行请控制在 600 字以内');
          draft.lines[key] = value;
        }
      }
      if (['content', 'freeContent', 'lines'].some(field => Object.prototype.hasOwnProperty.call(patch, field))) {
        const titles = { event: '发生的事', feeling: '感受与在意', insight: '新的发现' };
        const lines = Object.entries(draft.lines).filter(([, value]) => value.trim()).map(([key, value]) => `${titles[key]}：${value.trim()}`);
        draft.content = lines.length ? [...lines, ...(draft.freeContent.trim() ? [draft.freeContent] : [])].join('\n\n') : draft.freeContent;
      }
    },
    save() {
      const content = String(draft.content || '').trim();
      if (!content) throw new Error('先写下一点今天的感受，再保存吧。');
      if (content.length > 2000) throw new Error('这篇记录超过 2000 字，请精简后保存。');
      const date = new Date(`${draft.date}T12:00:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(date.getTime()) || localDate(date) !== draft.date || draft.date > localDate()) {
        throw new Error('请选择今天或之前的有效日期。');
      }
      if (draft.mood && !MOODS.some(mood => mood.id === draft.mood)) throw new Error('请重新选择此刻的心情。');
      const dimensions = [...new Set(draft.dimensions)].filter(id => DIMENSIONS.some(dimension => dimension.id === id));
      const entry = { ...copyEntry(draft), dimensions, content, id: draft.id || `diary-${Date.now()}-${++sequence}` };
      const index = entries.findIndex(item => item.id === entry.id);
      if (index < 0) entries.unshift(entry);
      else entries[index] = entry;
      entries.sort((a, b) => b.date.localeCompare(a.date));
      draft = emptyDraft();
      return copyEntry(entry);
    },
    edit(id) {
      const entry = entries.find(item => item.id === id);
      if (!entry) throw new Error('这篇记录已不在本次体验中，请返回日记列表。');
      draft = { ...emptyDraft(), ...copyEntry(entry), lines: entry.lines ? { ...entry.lines } : { event: '', feeling: '', insight: '' }, freeContent: entry.freeContent === undefined ? entry.content : entry.freeContent };
    }
  };
}

function summarizeEntries(entries) {
  const branches = DIMENSIONS.map(dimension => ({
    ...dimension,
    count: entries.filter(entry => entry.dimensions.includes(dimension.id)).length
  }));
  return { total: entries.length, days: new Set(entries.map(entry => entry.date)).size, branches };
}

function getExampleEntries() {
  return [
    { id: 'example-3', date: '2026-10-30', mood: 'calm', content: '傍晚没有继续刷手机，出门走了二十分钟。慢慢走着，呼吸也松下来了。我想要的生活里，应该有一些这样不赶路的时刻。', dimensions: ['emotion', 'action', 'meaning'] },
    { id: 'example-2', date: '2026-10-29', mood: 'mixed', content: '又想起昨天没说出口的意见。我发现自己总觉得“拒绝别人就会让人失望”。这只是我的猜测。下次想试着先说：我需要一点时间考虑。', dimensions: ['emotion', 'needs', 'thinking', 'action'] },
    { id: 'example-1', date: '2026-10-28', mood: 'tired', content: '讨论方案时，我又抢着说“都可以”。回到座位才发现肩膀一直绷着。其实我希望自己的意见也被听见。', dimensions: ['emotion', 'relationship', 'needs'] }
  ];
}

let activeOwner;
let activeDiary;
function getDiary(owner) {
  if (!activeDiary || activeOwner !== owner) {
    activeOwner = owner;
    activeDiary = createDiaryStore();
  }
  return activeDiary;
}

module.exports = { createDiaryStore, getDiary, localDate, DIMENSIONS, MOODS, summarizeEntries, getExampleEntries };
