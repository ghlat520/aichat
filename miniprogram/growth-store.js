// growth-store.js — 自我探索流程的共享状态（原型 V1.2 状态机 1:1 移植）
// 纯逻辑工厂 + wx storage 注入：页面用 getGrowth() 单例，单测用 createGrowthStore(mock)。
// 与原型一致：题目为演示数据、支付为本地模拟，不连接后端与支付渠道。
const CONTENT = require('./growth-content');

const STORAGE_KEY = 'aichat_growth_state_v1';

function emptyExperience() {
  return { event: '', action: '', result: '', energy: '' };
}

function defaults() {
  // 与原型 defaults() 演示态一致：特质/优势已完成、MBTI 进行到第 3 题（严格对齐 UI 首屏）
  return {
    currentTool: 'mbti',
    answers: { mbti: [3, 4], traits: [], strengths: [] },
    results: { mbti: false, traits: true, strengths: true },
    sources: {
      traits: { kind: 'native', name: '原型样例版本 v1', date: '2026-10-26' },
      strengths: { kind: 'native', name: '原型样例版本 v1', date: '2026-10-26' }
    },
    autoNext: true,
    experiences: [emptyExperience(), emptyExperience()],
    confirmed: false,
    goals: [],
    experienceMode: 'guided',
    experienceIndex: 0,
    experiencePrompt: '协作顺利的一次',
    previewState: 'idle',
    paid: false,
    careerPaid: false,
    baseNet: CONTENT.PRICES.base,
    bound: false,
    product: 'base',
    payment: 'none',
    order: null,
    calibrated: false,
    calibrationText: '',
    version: '1.0',
    oldVersion: false,
    reflected: false,
    reviewText: '',
    reviewOutcome: '',
    reviewNext: '',
    selectedAction: 0,
    actionStarted: false,
    expired: false,
    reportFilter: 'all',
    reportSaved: false,
    refund: 'none',
    refundScope: 'upgrade',
    refundAmount: 0,
    supportSent: false,
    supportReason: '内容纠错',
    supportText: '',
    careerInterest: [],
    careerValues: [],
    skills: '',
    careerGoal: '',
    careerTime: '',
    careerConstraints: '',
    careerReady: false,
    share: { type: true, strength: true, experience: false },
    posterKind: 'challenge',
    posterName: '',
    shareEntry: 'mbti',
    socialVote: null,
    voiceId: 'jobs',
    voiceMood: '全部',
    voiceNotes: { jobs: '', federer: '', bezos: '' },
    savedVoices: [],
    voiceDecision: ''
  };
}

function toggleIn(list, item) {
  const index = list.indexOf(item);
  if (index < 0) list.push(item);
  else list.splice(index, 1);
}

function createGrowthStore(storage) {
  let state = defaults();
  let loaded = false;

  function persist() {
    if (!loaded) return;
    try {
      storage.setStorageSync(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // 存储失败不阻断流程：状态仍在内存中，刷新后回退到上次成功保存的进度
    }
  }

  function hydrate() {
    try {
      const raw = storage.getStorageSync(STORAGE_KEY);
      if (raw) {
        const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
        state = Object.assign(defaults(), saved, {
          answers: Object.assign({ mbti: [], traits: [], strengths: [] }, saved.answers),
          results: Object.assign({ mbti: false, traits: false, strengths: false }, saved.results),
          experiences: (saved.experiences && saved.experiences.length >= 2)
            ? saved.experiences.slice(0, 2)
            : [emptyExperience(), emptyExperience()],
          share: Object.assign({ type: true, strength: true, experience: false }, saved.share),
          voiceNotes: Object.assign({ jobs: '', federer: '', bezos: '' }, saved.voiceNotes)
        });
      }
    } catch (error) {
      state = defaults();
    }
    loaded = true;
  }

  function get() {
    if (!loaded) hydrate();
    return state;
  }

  function patch(part) {
    if (!loaded) hydrate();
    state = Object.assign({}, state, part);
    persist();
    return state;
  }

  function resetAll() {
    state = defaults();
    persist();
    return state;
  }

  // —— 测评作答 ——
  function resumeIndex(tool) {
    const answers = state.answers[tool] || [];
    return Math.min(CONTENT.QUESTIONS[tool].length - 1, answers.length);
  }

  function savedChoice(tool, index) {
    return (state.answers[tool] || [])[index] || 0;
  }

  function saveAnswer(tool, index, value) {
    const answers = state.answers[tool] || [];
    answers[index] = value;
    state.answers[tool] = answers;
    persist();
    return { finished: index === CONTENT.QUESTIONS[tool].length - 1 };
  }

  function completeTool(tool, kind, meta) {
    state.results[tool] = true;
    state.sources[tool] = Object.assign(
      { kind: kind || 'native', name: '原型样例版本 v1', date: '2026-10-26' },
      meta || {}
    );
    persist();
  }

  function resetTool(tool) {
    state.answers[tool] = [];
    state.results[tool] = false;
    delete state.sources[tool];
    persist();
  }

  function setAutoNext(enabled) {
    state.autoNext = !!enabled;
    persist();
  }

  // —— 个人经历 ——
  function setExperience(index, field, value) {
    state.experiences[index][field] = value;
    if (state.confirmed) state.confirmed = false;
    persist();
  }

  function toggleExperienceEnergy(index, word) {
    const words = state.experiences[index].energy.split('；').filter(Boolean);
    toggleIn(words, word);
    setExperience(index, 'energy', words.join('；'));
  }

  function fillExamples() {
    state.experiences = CONTENT.SAMPLE_EXPERIENCES.map((item) => Object.assign({}, item));
    state.experienceMode = 'all';
    state.confirmed = false;
    persist();
  }

  function hasExperiences() {
    return state.experiences.length >= 2
      && state.experiences.every((item) => item.event.trim() && item.action.trim() && item.result.trim());
  }

  function confirmExperiences() {
    state.confirmed = true;
    persist();
  }

  function actualExperiences() {
    return state.confirmed ? state.experiences : CONTENT.SAMPLE_EXPERIENCES;
  }

  function ready() {
    return state.results.traits && state.results.strengths && state.confirmed && hasExperiences() && state.goals.length > 0;
  }

  function typeCode() {
    return (state.sources.mbti && state.sources.mbti.type) || 'INFP';
  }

  // —— 陪伴故事 ——
  function setVoice(id) {
    state.voiceId = CONTENT.VOICE_STORIES[id] ? id : 'jobs';
    state.voiceDecision = '';
    persist();
  }

  function saveVoiceNote(id, text) {
    state.voiceNotes[id] = text;
    persist();
  }

  function saveVoice(id) {
    if (!state.savedVoices.includes(id)) state.savedVoices.push(id);
    persist();
  }

  // —— 海报与分享 ——
  function currentVoiceStory() {
    return CONTENT.VOICE_STORIES[state.voiceId] || CONTENT.VOICE_STORIES.jobs;
  }

  function posterContent(kind) {
    const posterKind = kind || state.posterKind;
    if (posterKind === 'comfort') {
      const voice = currentVoiceStory();
      return {
        eyebrow: '把一点温柔，送给此刻的你',
        title: voice.posterTitle,
        description: '"' + voice.quote + '" —— ' + voice.name + '（' + voice.quoteLabel + '）',
        tags: ['给自己留一小步'],
        cta: '读读这段故事，借一点力量',
        footer: voice.name + ' · ' + voice.sourceLabel + ' · ' + voice.quoteLabel
      };
    }
    if (posterKind === 'challenge') {
      return {
        eyebrow: '名人观察 · 邀你猜一猜',
        title: '马斯克更像\nINFP，还是 INTJ？',
        description: state.socialVote
          ? '我选了' + (state.socialVote === 'uncertain' ? '"还不能确定"' : state.socialVote) + '。你会怎么选？'
          : '先凭直觉选一个，再看看公开资料线索。',
        tags: ['公开言行讨论', '类型为推测'],
        cta: '来选一个，也测测自己',
        footer: '公开资料观察 · 类型为讨论假设'
      };
    }
    if (posterKind === 'result') {
      return {
        eyebrow: '认识自己的一个小发现',
        title: state.share.type && state.results.mbti ? typeCode() + '\n按自己的节奏表达。' : '遇见，\n更好的你自己。',
        description: '我开始留意，哪些选择让我有能量，哪些方式更适合自己。',
        tags: state.share.strength ? ['理解他人', '梳理信息', '持续学习'] : [],
        cta: '也来免费认识自己',
        footer: '原型结果样例 · 不定义能力与职业'
      };
    }
    return {
      eyebrow: '我的优势，我想这样用',
      title: '把复杂的事，\n慢慢理清楚。',
      description: '先看见自己的优势，再把一个小练习带回真实生活。',
      tags: state.share.strength ? ['一次具体经历', '一个可以尝试的行动'] : [],
      cta: '发现你值得发展的优势',
      footer: '原型优势样例 · 从真实经历找依据'
    };
  }

  function inviteQuery(kind) {
    const posterKind = kind || state.posterKind;
    const query = {
      entry: posterKind === 'comfort' ? 'voices' : state.shareEntry,
      campaign: posterKind === 'comfort' ? 'voices-v1' : posterKind === 'challenge' ? 'musk-v1' : 'personal-v1',
      kind: posterKind
    };
    if (posterKind === 'comfort') query.voice = state.voiceId;
    if (posterKind === 'challenge' && state.socialVote) query.pick = state.socialVote;
    return query;
  }

  function inviteQueryString(kind) {
    const query = inviteQuery(kind);
    return Object.keys(query)
      .map((key) => key + '=' + encodeURIComponent(query[key]))
      .join('&');
  }

  // —— 报告购买（本地模拟）——
  function reportPrice() {
    if (state.product === 'career') {
      return state.paid ? Math.max(0, CONTENT.PRICES.career - state.baseNet) : CONTENT.PRICES.career;
    }
    return CONTENT.PRICES.base;
  }

  function createOrder() {
    state.order = {
      product: state.product,
      amount: reportPrice(),
      upgrade: state.product === 'career' && state.paid,
      baseCredit: state.product === 'career' && state.paid ? state.baseNet : 0,
      id: '1026',
      date: '2026-10-26'
    };
    persist();
    return state.order;
  }

  function settlePayment(paymentState) {
    state.payment = paymentState;
    if (paymentState === 'success') {
      if (state.product === 'career') state.careerPaid = true;
      else state.paid = true;
    }
    persist();
  }

  function canReadBase() {
    return state.paid || state.careerPaid;
  }

  function submitSupport(reason, text) {
    state.supportReason = reason;
    state.supportText = text;
    state.supportSent = true;
    state.refund = 'requested';
    persist();
  }

  function advanceRefund() {
    if (state.refund === 'requested') state.refund = 'processing';
    else if (state.refund === 'processing') {
      state.refund = 'refunded';
      state.refundAmount = state.order ? state.order.amount : reportPrice();
      if (state.product === 'career') {
        state.careerPaid = false;
        if (state.refundScope === 'all') state.paid = false;
      } else {
        state.paid = false;
      }
    }
    persist();
  }

  function submitCalibration(text) {
    state.calibrationText = text;
    state.calibrated = true;
    state.version = '1.1';
    persist();
  }

  function submitReflection(fields) {
    state.reviewText = fields.reviewText;
    state.reviewOutcome = fields.reviewOutcome;
    state.reviewNext = fields.reviewNext;
    state.reflected = true;
    persist();
  }

  function deleteReport() {
    state.paid = false;
    state.careerPaid = false;
    state.reportSaved = false;
    persist();
  }

  function reset() {
    return resetAll();
  }

  hydrate();

  return {
    get,
    patch,
    reset,
    resetAll,
    resumeIndex,
    savedChoice,
    saveAnswer,
    completeTool,
    resetTool,
    setAutoNext,
    setExperience,
    toggleExperienceEnergy,
    fillExamples,
    hasExperiences,
    confirmExperiences,
    actualExperiences,
    ready,
    typeCode,
    setVoice,
    saveVoiceNote,
    saveVoice,
    currentVoiceStory,
    posterContent,
    inviteQuery,
    inviteQueryString,
    reportPrice,
    createOrder,
    settlePayment,
    canReadBase,
    submitSupport,
    advanceRefund,
    submitCalibration,
    submitReflection,
    deleteReport
  };
}

let singleton = null;
function getGrowth() {
  if (!singleton) singleton = createGrowthStore(wx);
  return singleton;
}

// —— 接收方直达配置解析（显式参数优先于 scene 短标识）——
function resolveInviteConfig(query) {
  const q = query || {};
  let base = {};
  if (q.scene) {
    base = CONTENT.SCENE_CODES[decodeURIComponent(String(q.scene))] || {};
  }
  return {
    entry: ['mbti', 'traits', 'strengths', 'voices'].includes(q.entry) ? q.entry : (base.entry || 'mbti'),
    campaign: q.campaign || base.campaign || 'musk-v1',
    kind: ['challenge', 'result', 'strength', 'comfort'].includes(q.kind) ? q.kind : (base.kind || 'challenge'),
    voice: CONTENT.VOICE_STORIES[q.voice] ? q.voice : (CONTENT.VOICE_STORIES[base.voice] ? base.voice : 'jobs'),
    pick: ['INFP', 'INTJ', 'ENTP', 'uncertain'].includes(q.pick) ? q.pick : null
  };
}

module.exports = { createGrowthStore, getGrowth, resolveInviteConfig, STORAGE_KEY };
