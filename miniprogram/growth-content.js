// growth-content.js — 自我探索与温暖陪伴的内容数据（V1.2 原型 1:1 移植）
// 纯数据模块：不依赖 wx，可被页面与单测直接 require。
// 内容边界：题目为 6 道交互演示题；结果与价格为原型样例；来源标注见各 SOURCE 常量。

// —— 经典题（IPIP-50 官方条目中文适配，仅取 6 道做交互演示）——
const CLASSIC_TRAIT_ITEMS = [
  { number: 1, zh: '我是聚会中活跃气氛的人。', original: 'Am the life of the party.' },
  { number: 2, zh: '我不太关心他人。', original: 'Feel little concern for others.' },
  { number: 3, zh: '做事总是提前准备好。', original: 'Am always prepared.' },
  { number: 4, zh: '我很容易感到压力。', original: 'Get stressed out easily.' },
  { number: 15, zh: '我的想象力很丰富。', original: 'Have a vivid imagination.' },
  { number: 6, zh: '我平时不太爱说话。', original: "Don't talk a lot." }
];
const CLASSIC_SOURCE = 'https://www.ipip.ori.org/New_IPIP-50-item-scale.htm';
const MUSK_SOURCE = 'https://www.tesla.com/secret-master-plan';

// —— 三项测评（V1.2 文案）——
const TOOLS = {
  mbti: {
    id: 'mbti',
    name: '认识我的性格偏好',
    short: '16 型人格',
    desc: '看看怎样沟通和做选择，更合你的心意。',
    color: '',
    title: '你的偏好，\n有自己的模样。',
    intro: '从日常选择出发，认识你的思考与沟通偏好。\n类型是一个观察起点，也允许你慢慢变化。',
    summary: '你倾向先理解自己的感受与价值，再用细腻的方式回应外界。'
  },
  traits: {
    id: 'traits',
    name: '看见我的性格底色',
    short: '性格特质',
    desc: '理解自己的节奏，也学着温柔地照顾它。',
    color: 'aqua',
    title: '比一个标签，\n更丰富的自己。',
    intro: '从五个连续维度，认识自己的行为特点。\n看见你在不同环境里，如何发挥与调整。',
    summary: '你的开放性与宜人性较突出，喜欢理解新想法，也会留意他人的体验。'
  },
  strengths: {
    id: 'strengths',
    name: '发现我身上的优势',
    short: '优势探索',
    desc: '从认真做过的小事里，找到值得发展的力量。',
    color: 'pink',
    title: '你擅长的事，\n值得被认真看见。',
    intro: '从习惯与行为里，发现值得发展的优势。\n再带着真实经历，找出适合你的使用方式。',
    summary: '理解、整理和学习，是这份样例中值得继续探索的三个优势主题。'
  }
};
const TOOL_ORDER = ['mbti', 'traits', 'strengths'];

// —— 演示题（traits 使用 IPIP 经典条目）——
const QUESTIONS = {
  mbti: [
    '忙碌的一周后，独处通常能让我恢复能量。',
    '开始做一件事前，我更愿意先理解它背后的可能性。',
    '做重要决定时，我会认真考虑它与自己在意的价值是否一致。',
    '与人交流时，我倾向先听懂对方，再表达自己的想法。',
    '面对尚未确定的安排，我愿意给新的想法留一点空间。',
    '比起很快得到结论，我更愿意多想一会儿，找到自己的答案。'
  ],
  traits: CLASSIC_TRAIT_ITEMS.map((item) => item.zh),
  strengths: [
    '有人说不清自己的想法时，我能耐心听，并帮他理出重点。',
    '面对杂乱的信息，我会自然地寻找它们之间的联系。',
    '学到新方法后，我愿意找一个小场景试试看。',
    '团队出现分歧时，我常能理解不同人的考虑。',
    '完成一项工作时，我会留意哪些步骤可以变得更清楚。',
    '一件事做得顺利时，我愿意总结它为什么有效。'
  ]
};
const ANSWER_LABELS_CLASSIC = ['非常不符合', '比较不符合', '说不清／居中', '比较符合', '非常符合'];
const ANSWER_LABELS_AGREE = ['很不同意', '不太同意', '说不清／居中', '比较同意', '很同意'];

// —— 名人观察（猜想为讨论假设，非本人测评结果）——
const CELEBRITY = {
  name: '马斯克',
  coverTag: '从一个熟悉的人，打开一个新话题',
  coverTitle: '马斯克更像\n哪一种偏好？',
  coverCopy: '先凭直觉选一个。\n再看看，公开资料能告诉我们什么。',
  options: [
    { id: 'INFP', label: '更在意愿景与个人价值' },
    { id: 'INTJ', label: '更重视长期构想与系统规划' },
    { id: 'ENTP', label: '喜欢探索可能性与挑战既有做法' },
    { id: 'uncertain', label: '公开表现还不足以判断' }
  ],
  insight: {
    tag: '公开事实',
    factTitle: '一条可以核对的线索',
    fact: '在 2006 年的特斯拉总体规划中，他描述了从高价跑车出发、再逐步支持更可负担车型的分阶段路径，并把它放在长期能源目标中。',
    factSource: 'Tesla 署名文章 · 2006.08.02',
    read1: { tag: '一种解读', text: '他会把长远设想与具体步骤放在一起表达。' },
    read2: { tag: '仍有其他解释', text: '公开的商业规划也受工作角色、团队与传播场景影响，不能直接换算成他的 MBTI 类型。' }
  }
};

// —— 借一点力量：人物故事（原话均有一手出处）——
const VOICE_STORIES = {
  jobs: {
    id: 'jobs',
    name: '史蒂夫·乔布斯',
    initial: '乔',
    moods: ['有点迷茫', '想重新开始'],
    title: '重新开始，也可以轻一点。',
    quote: '重新做初学者的轻盈。',
    english: 'the lightness of being a beginner again',
    quoteLabel: '节译',
    sourceLabel: '斯坦福大学毕业演讲 · 2005.06.12',
    source: 'https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says',
    story: '在斯坦福演讲里，他回顾离开苹果后的失落和茫然。后来，他发现自己仍然热爱正在做的事，于是重新出发，创办了 NeXT 和 Pixar。',
    steps: ['他先重新确认：自己仍然喜欢做什么。', '再把注意力放回创造与尝试，接受重新做初学者。'],
    takeaway: '暂时放下"我应该已经很厉害"的要求，给自己留一个重新学、重新试的空间。',
    prompt: '有哪件小事，是你现在仍然愿意试一试的？',
    posterTitle: '给自己，\n一次重新开始的温柔。'
  },
  federer: {
    id: 'federer',
    name: '罗杰·费德勒',
    initial: '费',
    moods: ['遇到挫折', '有点迷茫'],
    title: '这一分过去，还有下一分。',
    quote: '这只是一分。',
    english: 'It’s only a point.',
    quoteLabel: '译',
    sourceLabel: '达特茅斯学院毕业演讲 · 2024.06.09',
    source: 'https://home.dartmouth.edu/news/2024/06/2024-commencement-address-roger-federer',
    story: '他在演讲中谈到失利、自我怀疑，以及比赛里反复丢分的经历。他提醒自己，一分结束后，把注意力带回下一分。',
    steps: ['认真投入正在发生的这一分。', '结束后，练习把注意力带回下一次可以做的事。'],
    takeaway: '先给失落一点空间，再把"这一次没做好"和"我整个人都不行"轻轻分开。',
    prompt: '接下来的一小步，有什么是你还愿意为自己做的？',
    posterTitle: '这次没做好，\n也值得被温柔对待。'
  },
  bezos: {
    id: 'bezos',
    name: '杰夫·贝索斯',
    initial: '贝',
    moods: ['在做选择'],
    title: '可以调整的选择，先迈一小步。',
    quote: '多数决策，大概应在掌握七成所需信息时做出。',
    english: 'Most decisions should probably be made with somewhere around 70% of the information you wish you had.',
    quoteLabel: '译',
    sourceLabel: '亚马逊 2016 年度致股东信',
    source: 'https://www.aboutamazon.com/news/company-news/2016-letter-to-shareholders',
    story: '这封信讨论企业里的决策节奏。他把许多可以调整的决定比作"双向门"，提出先行动，再及时发现问题并修正。',
    steps: ['先分清：这个选择以后是否可以调整。', '对可以调整的小决定，用小范围尝试去获得新信息。'],
    takeaway: '把一个大问题缩成一次可调整的小尝试，也许就能看清一点。原话来自企业决策情境，这里借用的是小步验证的思路。',
    prompt: '如果只试一小步，你愿意先做什么？',
    posterTitle: '给选择一点空间，\n也给自己一点耐心。'
  }
};
const VOICE_MOODS = ['全部', '有点迷茫', '遇到挫折', '想重新开始', '在做选择', '留给自己的'];

// —— 个人经历 ——
const EXPERIENCE_PROMPTS = [
  { key: '协作顺利的一次', hint: '想一想：有哪次事情经过你的参与，变得更清楚或更顺利？' },
  { key: '帮到别人的一刻', hint: '想一想：有谁因为你的帮助，更明白了一件事或少走了一点弯路？' },
  { key: '学会一件新事', hint: '想一想：你最近学会了什么，又把它用在了哪里？' }
];
const ENERGY_WORDS = ['很投入', '有成就感', '有点费力', '经常被打断'];
const GOAL_OPTIONS = ['沟通', '协作', '工作安排', '学习'];
const SAMPLE_EXPERIENCES = [
  {
    event: '一次跨部门项目，大家对需求理解不一致，会议反复没有进展。',
    action: '我分别听了三位同事的想法，把需求拆成共同目标和待确认问题，再整理成一页说明。',
    result: '团队确认了优先级，下一次会议明确了分工，项目可以继续推进。',
    energy: '把复杂信息整理清楚让我有成就感；长时间协调情绪比较费力。'
  },
  {
    event: '新同事加入团队，需要在一周内熟悉一套陌生的工作流程。',
    action: '我把自己的学习笔记整理成入门清单，陪他走了一次流程，让他自己操作后再一起复盘。',
    result: '他可以独立完成基础任务，之后也把自己的补充写进了清单。',
    energy: '看到别人理解并会用，让我很有能量；临时被打断时会比较累。'
  }
];

// —— 报告内容（原型样例）——
const CHAPTERS = [
  '这份报告基于什么',
  '我的性格与行为画像',
  '值得发展的三项优势',
  '我容易发挥与容易消耗的环境',
  '优势过度使用与盲点',
  '我的场景建议',
  '未来七天的行动',
  '校准与复盘'
];
const STRENGTH_DATA = [
  ['理解他人', '先理解不同人的需要，再把分歧转成可讨论的问题。', '宜人性倾向、优势主题与经历 1 相互呼应。'],
  ['梳理信息', '从零散内容里找结构，让复杂的事变得可以行动。', '开放性、优势主题与两段经历共同支持。'],
  ['持续学习', '把新方法放进小场景里试，再根据反馈调整。', '优势主题与经历 2 提供线索，仍需更多情境验证。']
];
const ACTION_DATA = [
  ['会议前的一页纸', '下一次协作前，用 10 分钟写下共同目标、已知信息和 3 个待确认问题。', '观察会议能否更快形成下一步；若增加沟通负担，就减少内容。'],
  ['先听懂，再确认', '选一次不紧急的沟通，先复述对方的意思，再问"我理解得对吗？"', '记录对方是否愿意补充，以及你是否更清楚对方的需要。'],
  ['把经验留给下一次', '完成一个小任务后，花 5 分钟记下有效做法、费力部分和一个调整。', '一周后看哪一步值得保留；没有帮助的步骤可以停止。']
];
const MBTI_DIMENSIONS = [
  ['内向 I', '外向 E', 62, '能量偏好'],
  ['直觉 N', '实感 S', 57, '接近中间，两种方式都可能出现'],
  ['情感 F', '思考 T', 64, '决策偏好'],
  ['知觉 P', '判断 J', 53, '接近中间，不必急着给自己定型']
];
const TRAIT_DIMENSIONS = [
  ['开放性', 78, '喜欢理解新想法，愿意探索不同可能'],
  ['尽责性', 66, '倾向整理任务，也愿意为新情况调整'],
  ['外向性', 43, '更喜欢有准备、有深度的交流'],
  ['宜人性', 81, '留意他人感受，重视合作关系'],
  ['情绪敏感性', 58, '变化时需要一点时间，也能逐步恢复']
];
const MBTI_TYPES = ['INFP', 'INFJ', 'INTP', 'INTJ', 'ENFP', 'ENFJ', 'ENTP', 'ENTJ', 'ISFP', 'ISFJ', 'ISTP', 'ISTJ', 'ESFP', 'ESFJ', 'ESTP', 'ESTJ'];

// —— 职业探索（第二期）——
const CAREER_INTERESTS = ['理解人', '整理信息', '创造内容', '动手实践', '分析问题', '组织协作'];
const CAREER_VALUES = ['自主空间', '帮助他人', '稳定节奏', '持续学习', '创造表达', '收入成长'];
const CAREER_DIRECTIONS = [
  ['用户研究与洞察', '理解他人、整理访谈信息', '需要练习提问与分析方法；不等于已经具备研究岗位能力', '访谈两位愿意参与的同事，整理一个小问题的观察'],
  ['内容策划与知识整理', '把复杂信息整理为清楚表达', '需验证是否喜欢持续产出，以及面对修改时的适应性', '围绕熟悉领域写一份入门说明，请一位读者使用'],
  ['项目协作与需求澄清', '澄清目标、理解多方需求', '临时协调较多时可能消耗，需要核对职责与边界', '在现有任务里试一次需求澄清会，并复盘能量感受']
];

// —— 订单与售后 ——
const SUPPORT_REASONS = ['交付失败', '重复付款', '内容纠错', '内容质量', '隐私问题'];
const PAYMENT_STATES = {
  pending: { icon: '…', cls: 'wait', title: '正在确认支付', desc: '请稍等，我们正在核对这笔订单。\n不需要再次付款。' },
  success: { icon: '✓', cls: '', title: '报告已经准备好了', desc: '付款已确认，你的说明书可以打开了。\n之后也可以从"我的报告"找回。' },
  cancel: { icon: '×', cls: 'failure', title: '这次购买已取消', desc: '还没有完成付款。\n免费测评结果和经历都还在。' },
  failed: { icon: '!', cls: 'failure', title: '本次支付未完成', desc: '支付已明确结束。\n可以返回确认页再试，或继续免费使用。' },
  delivery: { icon: '…', cls: 'wait', title: '付款已收到，正在交付', desc: '这份报告还在恢复交付中。\n请勿重复购买，可在订单中查看处理进度。' },
  refunded: { icon: '↩', cls: '', title: '退款已确认', desc: '原付款记录保留，对应付费权益已撤销。\n已确认到账金额可在订单页查看。' },
  suspended: { icon: '…', cls: 'wait', title: '报告权益已暂停', desc: '退款结果或关联基础订单需要进一步核实。\n请查询原订单或登记售后，无需重复付款。' }
};

// —— 价格（评审提案，原型演示）——
const PRICES = { base: 29.9, career: 49.9 };

// —— 小程序码 scene 短标识（评审说明示例：mk01_tr_v1）——
// 正式码签发后在此登记新映射；真实扫码只投递 ?scene=短标识，由 resolveInviteConfig 解码。
// 约定：前两位=campaign（mk01 名人观察 / vc01 力量故事 / gr01 个人分享），中段=entry，尾段=版本。
const SCENE_CODES = {
  mk01_mb_v1: { entry: 'mbti', campaign: 'musk-v1', kind: 'challenge' },
  mk01_tr_v1: { entry: 'traits', campaign: 'musk-v1', kind: 'challenge' },
  mk01_st_v1: { entry: 'strengths', campaign: 'musk-v1', kind: 'challenge' },
  vc01_vo_v1: { entry: 'voices', campaign: 'voices-v1', kind: 'comfort', voice: 'jobs' },
  vc01_vo_f1: { entry: 'voices', campaign: 'voices-v1', kind: 'comfort', voice: 'federer' },
  vc01_vo_b1: { entry: 'voices', campaign: 'voices-v1', kind: 'comfort', voice: 'bezos' },
  gr01_mb_v1: { entry: 'mbti', campaign: 'personal-v1', kind: 'result' },
  gr01_st_v1: { entry: 'strengths', campaign: 'personal-v1', kind: 'strength' }
};

module.exports = {
  CLASSIC_TRAIT_ITEMS,
  CLASSIC_SOURCE,
  MUSK_SOURCE,
  TOOLS,
  TOOL_ORDER,
  QUESTIONS,
  ANSWER_LABELS_CLASSIC,
  ANSWER_LABELS_AGREE,
  CELEBRITY,
  VOICE_STORIES,
  VOICE_MOODS,
  EXPERIENCE_PROMPTS,
  ENERGY_WORDS,
  GOAL_OPTIONS,
  SAMPLE_EXPERIENCES,
  CHAPTERS,
  STRENGTH_DATA,
  ACTION_DATA,
  MBTI_DIMENSIONS,
  TRAIT_DIMENSIONS,
  MBTI_TYPES,
  CAREER_INTERESTS,
  CAREER_VALUES,
  CAREER_DIRECTIONS,
  SUPPORT_REASONS,
  PAYMENT_STATES,
  PRICES,
  SCENE_CODES
};
