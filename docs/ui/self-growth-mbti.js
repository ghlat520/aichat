// 最新“觉察日记”版原型：保留题目、左右描述和结果，只更新五档圆圈选择与单题自动切换。
(() => {
  const description = 'MBTI 是一套基于荣格心理类型理论的性格框架，能帮你从「精力来源、信息获取、决策方式、生活节奏」四个维度更了解自己——但它只是自我探索与社交娱乐工具，不是心理诊断，没有好坏之分。';
  const groups = [
    { code: 'E/I', title: '精力来源', left: 'E 外向', right: 'I 内向', note: '你通常从哪里获得能量？', items: [
      ['忙碌了一周，休息时更想', '约朋友出门聊聊', '一个人安静充电'],
      ['来到不太熟悉的聚会', '主动找人认识', '先观察，再慢慢加入'],
      ['有了一个新想法', '边和别人聊边整理', '自己先想清楚再说'],
      ['连续与人相处之后', '通常更有精神', '需要一点独处时间'],
      ['面对一群新同事', '很快和大家聊起来', '先熟悉少数几个人'],
      ['遇到值得开心的事', '马上找人分享', '先自己回味一下'],
      ['参加小组讨论时', '倾向当场说出想法', '倾向想好后再表达'],
      ['安排理想的周末', '喜欢热闹丰富的活动', '喜欢安静自在的安排'],
      ['整理一件复杂的事情', '讨论能帮助我想清楚', '独立思考更有帮助'],
      ['舒服的社交节奏是', '认识更多不同的人', '和熟悉的人深入相处']
    ] },
    { code: 'S/N', title: '信息获取', left: 'S 实感', right: 'N 直觉', note: '你习惯怎样了解一件事？', items: [
      ['学习一项新技能', '先看具体步骤与示范', '先理解原理和可能性'],
      ['听别人讲一件事', '更关注具体事实和细节', '更关注背后的含义'],
      ['开始一项新任务', '参考已有的可靠经验', '尝试不同的新方法'],
      ['看待一个新点子', '先想怎样实际落地', '先想还能延伸出什么'],
      ['阅读一份说明', '喜欢明确的例子和数据', '喜欢整体概念与联系'],
      ['回忆一次经历', '记得当时发生的细节', '记得它带给我的启发'],
      ['讨论未来的计划', '先考虑眼前的现实条件', '先探索长远的可能性'],
      ['解决熟悉的问题', '愿意采用已经有效的办法', '想看看有没有另一条路'],
      ['了解一个新领域', '从具体内容逐步了解', '先建立全貌再补细节'],
      ['注意力更容易被吸引到', '身边正在发生的事情', '脑海中冒出的联想']
    ] },
    { code: 'T/F', title: '决策方式', left: 'T 思考', right: 'F 情感', note: '做决定时，你通常先考虑什么？', items: [
      ['面对一个重要决定', '先分析逻辑和利弊', '先考虑价值和人的感受'],
      ['朋友来找我倾诉', '先帮忙理清问题和办法', '先理解并回应对方感受'],
      ['给别人提建议时', '优先把问题说准确', '优先让对方感到被理解'],
      ['评价一个方案', '更看重标准是否一致', '更看重是否照顾具体处境'],
      ['发生意见分歧时', '先核对事实与论据', '先理解彼此在意什么'],
      ['分配团队的任务', '先看规则和工作效率', '先看成员的需要和状态'],
      ['发现一个明显的问题', '倾向直接指出来', '倾向先考虑表达方式'],
      ['需要作出取舍时', '客观分析更能帮助我', '内心认同更能帮助我'],
      ['一条反馈让我觉得有用', '它准确指出了可以改进的点', '它让我感到被支持和理解'],
      ['希望自己作出的决定', '经得起一致的逻辑推敲', '符合自己珍视的价值']
    ] },
    { code: 'J/P', title: '生活节奏', left: 'J 判断', right: 'P 知觉', note: '你更喜欢怎样安排日常生活？', items: [
      ['准备一次旅行', '提前安排主要行程', '留空间，到了再决定'],
      ['面对一项截止任务', '尽早分步骤完成', '根据当时状态集中推进'],
      ['开始新的一天', '有个清楚的计划更安心', '保留灵活安排更自在'],
      ['已经确定的安排有变化', '希望尽快重新定下来', '愿意顺势调整看看'],
      ['同时有几件事情要做', '喜欢按顺序逐项完成', '喜欢灵活穿插推进'],
      ['做一个不太紧急的决定', '倾向尽早确定下来', '倾向多保留一些选项'],
      ['整理工作或生活空间', '喜欢物品各有固定位置', '喜欢按使用习惯灵活放置'],
      ['开展一项长期计划', '明确的阶段和清单有帮助', '探索中调整方向有帮助'],
      ['面对临时出现的机会', '先看是否影响原有安排', '愿意调整安排去尝试'],
      ['让我感到舒适的节奏', '事情逐渐确定并完成', '随时可以探索新的选择']
    ] }
  ];
  const valid = value => Number.isInteger(value) && value >= 1 && value <= 5;
  const answered = () => state.answers.mbti.filter(valid).length;
  const questionIndex = () => Number.isInteger(state.mbtiQuestion) ? state.mbtiQuestion : 0;
  const pageIndex = () => Math.floor(questionIndex() / 10);
  const pageAnswered = index => Array.from({ length: 10 }, (_, i) => state.answers.mbti[index * 10 + i]).filter(valid).length;
  const missingQuestion = () => Array.from({ length: 40 }, (_, index) => index).find(index => !valid(state.answers.mbti[index]));
  globalThis.mbtiAnsweredCount = answered;
  globalThis.mbtiPageIndex = pageIndex;
  globalThis.mbtiQuestionIndex = questionIndex;
  Object.assign(tools.mbti, { name: 'MBTI 性格测试', short: 'MBTI 性格测试', desc: '从精力来源、信息获取、决策方式和生活节奏四个维度了解自己。' });
  const originalIntro = renderers.intro, originalQuestion = renderers.question, originalResult = renderers.result;
  const actionButton = (text, action, cls = 'primary', extra = '') => `<button class="${cls}" data-mbti-action="${action}" ${extra}>${text}</button>`;

  function introPage() {
    return `<section class="mbti-ui">${head('MBTI 性格测试', 'discover', '基础免费')}<div class="mbti-intro-hero"><span class="mbti-type-mark">E / I &nbsp; S / N<br>T / F &nbsp; J / P</span><h2>MBTI 性格测试</h2><p>了解自己的四种日常偏好</p></div><p class="mbti-description">${description}</p><div class="mbti-intro-facts"><span><b>40 题</b>每个维度 10 题</span><span><b>一题一页</b>选择后自动切换</span><span><b>可暂停</b>返回后继续作答</span></div><div class="mbti-dimension-list">${groups.map((group, index) => `<div><span>${index + 1}</span><p><b>${group.title}</b><small>${group.note}</small></p><strong>${group.code}</strong></div>`).join('')}</div><p class="mbti-simple-note">按平时的自己选择即可。选中圆圈后会着色、打勾，再自动进入下一题；可以返回修改。</p>${actionButton(answered() ? '继续 MBTI 性格测试' : '开始 MBTI 性格测试', 'start')}${actionButton('先看 ENTP 结果样例', 'sample', 'secondary')}<p class="footer-note">中文题目为 UI 体验示例，题型参考 <a href="https://openpsychometrics.org/tests/OEJTS/" target="_blank" rel="noreferrer">OEJTS</a>。<br>正式题库与计分在 UI 确认后另行接入。</p></section>`;
  }

  function questionPage() {
    const number = questionIndex(), step = pageIndex(), group = groups[step];
    const url = new URL(location.href); url.searchParams.set('mbti-page', step + 1); url.searchParams.set('mbti-q', number + 1); history.replaceState({}, '', url);
    return `<section class="mbti-ui mbti-question-ui"><header class="mbti-question-header"><div class="mbti-question-top">${actionButton(icon('back'), 'back-intro', 'back', 'aria-label="返回 MBTI 测试介绍"')}<strong>MBTI 性格测试</strong>${actionButton('暂停', 'pause', 'text-link')}</div><div class="between"><h2>${group.title} <small>${group.code}</small></h2><span>第 ${number + 1} 题 / 共 40 题</span></div><nav class="mbti-step-tabs" aria-label="四个测试维度">${groups.map((item, index) => actionButton(`<b>${item.code}</b><span>${item.title}</span>`, 'step', `mbti-step ${index === step ? 'selected' : ''} ${pageAnswered(index) === 10 ? 'complete' : ''}`, `data-step="${index}" aria-label="${item.title}，第${index + 1}页" ${index === step ? 'aria-current="step"' : ''}`)).join('')}</nav><p class="mbti-question-hint">${group.note} 圆圈越大，越接近这一边；中间代表都适合。</p><div class="mbti-answer-progress"><span id="mbti-total-progress">已答 ${answered()} / 40 题</span><span>选择后自动进入下一题</span></div></header><div class="mbti-question-scroll" id="mbti-question-scroll" aria-label="当前题目">${group.items.slice(number % 10, number % 10 + 1).map(([title, left, right]) => {
      const labels = [`明显更接近“${left}”`, `稍微更接近“${left}”`, '两种描述都适合我', `稍微更接近“${right}”`, `明显更接近“${right}”`];
      return `<fieldset class="mbti-question-item is-current" id="mbti-item-${number}"><legend><span>${String(number + 1).padStart(2, '0')}</span>${title}</legend><div class="mbti-question-ends"><span>${left}</span><span>${right}</span></div><div class="mbti-answer-options">${labels.map((label, value) => `<label class="mbti-answer-option ${value < 2 ? 'left' : value > 2 ? 'right' : 'middle'} ${value === 0 || value === 4 ? 'large' : value === 2 ? 'small' : 'medium'}"><input type="radio" name="mbti-answer-${number}" value="${value + 1}" data-mbti-answer="${number}" ${state.answers.mbti[number] === value + 1 ? 'checked' : ''} aria-label="第${number + 1}题，${esc(label)}"><span class="mbti-answer-circle" aria-hidden="true"><svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></label>`).join('')}</div></fieldset>`;
    }).join('')}<p class="mbti-question-footnote">中文 UI 示例题 · 答案没有好坏之分。</p></div><footer class="mbti-question-footer"><div><span id="mbti-page-progress">第 ${number + 1} / 40 题</span><span id="mbti-page-message" role="status">${state.mbtiError || '选择后会自动进入下一题'}</span></div><div class="mbti-question-buttons">${actionButton(number === 0 ? '返回介绍' : '上一题', 'previous', 'secondary')}${actionButton(number === 39 ? '查看结果样例' : '下一题', 'next', 'primary', `id="mbti-next" ${valid(state.answers.mbti[number]) ? '' : 'disabled'}`)}</div></footer></section>`;
  }

  const reportSections = [
    { id: 'overview', title: '特点概况', paragraphs: [
      '对ENTP类型的人来说，最重要的是有创造力，能预见到美好的未来，并且时刻具有挑战性。将“聪明”用来形容这种类型的人是最合适不过的了。',
      'ENTP人话说得快，脑子转得也快。他们既喜欢为自己的利益而辩，也喜欢炫耀自己的辩论技巧而跟人辩。辩论时，他们既喜欢表现乖张的幽默，也喜欢唱反调。那些并不视辩论为一种显示的人，在与他们辩论过程中，往往会觉得很困惑，甚至感到很受伤害。'
    ] },
    { id: 'details', title: '特点详解', paragraphs: [
      '由于ENTP人很善言辞，所以他们在解决问题时很机灵，很有技巧性。然而有时他们却力争“超越”自我，他们经常“不择手段”——只要有条件，他们便无视某些规则的存在去抄近路，即使是在野心勃勃的欺骗性活动中溃败而终，也在所不惜。无论在工作还是在家里，他们都喜欢玩各种体力或智力上的玩具，越复杂他们就越喜欢。虽然，他们很快便会喜新厌旧。',
      'ENTP人基本上都很乐观，在遇到大挫折时，他们只视其为一个挑战，并坚定地去解决掉；但是，当他们碰到小挫折或小麻烦时，却很容易发脾气。ENTP人不能忍受那些执迷不悟、愚钝的人，同时，他们也会毫不掩饰地表达这一点。其实，只要他们生活中没什么烦扰的事，他们平时还是很亲切和蔼的，有时甚至很讨人喜欢。'
    ] },
    { id: 'relationships', title: '人际关系', paragraphs: [
      '在人际关系方面他们能一下子与所爱的人亲密起来。有些人在私底下表达这种感情；而另外一些人，对亲人的亲密程度却表现得很公然，以致于那些平时只见得他们工作中的一面的共事者们大吃一惊。',
      'ENTP人也善于结交那些与他们一样聪明、一样有趣的人。除了以上两方面，人性的其他方面似乎都被ENTP人给淡忘了，除非当他们作听众时——给人或好，或坏，或什么样的感觉都有可能。'
    ] },
    { id: 'basic', title: '基本描述', paragraphs: [
      '友好可爱，坦率直言；才思敏捷，精力充沛，玩世不恭；富有想象力和创新精神；好奇灵活，不可预见的；有逻辑性，善于分析。',
      '当情况环境转变时，你很容易忽视他人的情感，变得迟钝和鲁莽。'
    ] },
    { id: 'strengths', title: '优势', bullets: [
      '出色的交际才能，能使别人对自己的观点感到兴奋。', '急切地“想知道盒子外面的世界”，能想出一些新的可能性。', '具有杰出的创造性地解决问题的技能。', '探索精神、创新意识，以及克服困难的勇气。', '兴趣爱好广泛，易于接受新的事物。', '有“走自己的路，让别人说去吧”的乐观主义激情。', '学习新知识的信心和动力都很强大。', '天生好奇心理，快速地搜集所需信息的技能。', '能够把握事情的全局，弄清思想和行为的长远影响。', '同时处理多个问题的能力。', '对别人的需要和意图的知觉。', '能灵活地适应新情况，有熟练的变换能力。', '在社交生活中不会感到拘谨，能舒适地适应大多数社交场合。'
    ] },
    { id: 'weaknesses', title: '劣势', bullets: [
      '难于让自己有条不紊和富有条理性。', '经常不能区分事情的优先秩序。', '过于自信，可能会不恰当地运用自己的能力和社交经历。', '倾向于用“是不是有可能”来看待问题，而不是可能性的大小来衡量问题。', '很可能不切实际地许诺。', '对思维狭窄和思想顽固的人缺乏耐心。', '问题一旦解决，兴趣便不复存在。', '不喜欢按照传统的公式化的方式办事。', '对待细节和后续工作可能缺乏耐心，对自己要求不严。', '对事物容易感到厌倦，并且可能在不恰当的时候把注意力转向别的地方。', '不喜欢重复性的工作。', '对自己不信任的人耐心不够。'
    ] },
    { id: 'roles', title: '适合岗位', paragraphs: [
      '有机会从事创造性解决问题的工作，工作有一定的逻辑顺序和公正的标准，能够通过工作提高个人权力并常与权力人物交流。'
    ], bullets: [
      '各类项目的策划人和发起者、投资顾问（房地产、金融、贸易、商业等）、企业业主、社团负责人、政府官员等。',
      '投资经纪人、金融规划师、艺术总监、访谈类节目主持人、公关专业人士、企业公关经理等。',
      '产品开发、营销策划、管理系统开发、工业设计类经理、投资行业职员、广告创意指导等。'
    ] },
    { id: 'fields', title: '适合领域', paragraphs: ['投资、银行、公共关系、政治、市场营销、自我创业、创造性领域。'] },
    { id: 'love', title: '爱情', paragraphs: [
      'ENTP性格类型的人天性纯良，豁达开朗，逍遥自在。和他们相处时，总能感觉非常快乐。他们在与他人的互动过程中获取快乐和满足感。',
      '他们对于理论和概念的讨论特别感兴趣。由于他们喜欢与人争论的过程，他们可能会成为争议的导火线。一般他们喜欢调侃和群体活动，并能在这种交往活动中显得魅力四射。他们的问题是，在他们寻找新点子或计划时，有时会忽视他们亲近的人。'
    ] },
    { id: 'love-strengths', title: '感情中的优点', bullets: [
      '激情似火，积极向上且受人欢迎，拥有极强的人格魅力。', '优秀的沟通技巧。', '在交往过程中特别注重对于自己能力的提升和培养。', '悠闲自在，擅于自我调节，通常都是非常容易相处的。', '拥有大智慧，总是能想出一些伟大的策略或点子。', '很会赚钱，但是不擅理财。', '对于他们的承诺和人际关系都是十分严肃认真的。', '在情感上受到打击之后，能迅速走出阴影。'
    ] },
    { id: 'love-weaknesses', title: '感情中的弱点', bullets: [
      '对于新鲜事物总是激动不已，他们可能会频繁更替自己的爱人或朋友。', '常会放弃对于他们计划或想法的执行。', '他们热爱争辩的性格可能会引发与他人的矛盾。', '热爱冒险且花钱无节制，通常不擅理财。', '虽然他们对爱人和朋友十分看重，但是如果这段关系不能让他们获得成长的帮助，那么他们很可能会选择退出。'
    ] },
    { id: 'partner', title: 'ENTP型爱人', paragraphs: [
      '在亲密的爱侣关系中，ENTP所追求的目标与他们在普通朋友关系中的目标是相似的，那就是“进步与成长”。他们会一直问自己一些像“怎样才能让感情质量提升呢？”“这段感情会驶向何方？”“我在这段感情中有得到提升么？”这类的问题。他们总是会充满热情地接受那些在他们看来能够对他们的进步和知识有所帮助的新点子、新计划以及爱人。一般说来，在一段感情中ENTP所表现出的热情和意图都是正面有益的。',
      'ENTP的一大问题就是他们对于计划的执行往往不能坚持到底。这对于他们的爱侣来说就是个麻烦了。随着问题的加剧，他们的爱侣会渐渐失去对ENTP的信心，不相信ENTP能够言行一致。最终的结果就是在爱情关系中，ENTP成为“狼来了”悲剧中的那个男主角。',
      '在性方面，ENTP充满激情，并对不断提升双方倾注大量努力。他们会全情投入并会不断质疑。他们喜欢顺其自然而循规蹈矩，并乐于接受新鲜的概念和新的冒险。他们将性关系更多地视为是一种传达爱意的身体接触，而非直接表达爱意的机会。',
      '总体而言，ENTP对于爱情的健康与走向有着如孩子一般的热情及真挚的兴趣。因此，他们希望能和他们的另一半一起营造一个健康成长性的爱情关系。ENTP需要注意对于他们感受的关注。当面对生活中让人激动的外界潜在价值时，ENTP也不能因此忽视他们的感情。',
      '两个性格发展完整的个体的确可以拥有一段健康的恋情，但是ENTP的最优选是INFJ或INTJ。ENTP的主导性格是外向直觉，这与以内向直觉为主导的性格人群是最好的配搭。',
      '虽然说任何性格类型的两个个体，只要性格发展完整都可以拥有一段健康的恋情。但是，与ENTP更合适的天生伴侣为INFJ或INTJ型性格。ENTP的主导官能“外向直觉”与这两种性格类型的主导官能“内向直觉”最为匹配。'
    ] }
  ];
  // Same ENTP layout example throughout the page; these values are not live test scores.
  const resultAxes = [
    ['外向', 'E', 16], ['知觉', 'P', 12], ['情感', 'F', 2], ['直觉', 'N', 17],
    ['内向', 'I', 5], ['判断', 'J', 10], ['思考', 'T', 22], ['感觉', 'S', 9]
  ];
  function resultRadar() {
    const point = (index, radius) => {
      const angle = -Math.PI / 2 + index * Math.PI / 4;
      return [180 + Math.cos(angle) * radius, 164 + Math.sin(angle) * radius];
    };
    const coordinates = values => values.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
    const rings = [0.2, 0.4, 0.6, 0.8, 1].map(scale => `<polygon points="${coordinates(resultAxes.map((_, i) => point(i, 94 * scale)))}"/>`).join('');
    const axes = resultAxes.map((_, i) => { const [x, y] = point(i, 94); return `<line x1="180" y1="164" x2="${x}" y2="${y}"/>`; }).join('');
    const values = resultAxes.map(([, , value], i) => point(i, 94 * value / 25));
    const labels = resultAxes.map(([name, code, value], i) => {
      const [x, y] = point(i, 137);
      return `<text class="mbti-radar-label" x="${x}" y="${y - 4}" text-anchor="middle" data-axis="${code}" data-score="${value}"><tspan x="${x}">${name}(${code})</tspan><tspan class="mbti-radar-value" x="${x}" dy="18">${value}分</tspan></text>`;
    }).join('');
    return `<svg class="mbti-result-radar" viewBox="0 0 360 330" role="img" aria-labelledby="mbti-radar-title mbti-radar-desc"><title id="mbti-radar-title">ENTP 八维人格倾向多边形图，展示样例</title><desc id="mbti-radar-desc">${resultAxes.map(([name, code, value]) => `${name}${code} ${value}分`).join('，')}。每轴以25分为显示上限，非本轮测试计分。</desc><g class="mbti-radar-grid">${rings}${axes}</g><polygon class="mbti-radar-shape" points="${coordinates(values)}"/>${values.map(([x, y]) => `<circle class="mbti-radar-point" cx="${x}" cy="${y}" r="2.8"/>`).join('')}${labels}</svg>`;
  }
  function resultPage() {
    return `<section class="mbti-ui mbti-report">${head('MBTI 性格测试结果', 'discover', '免费结果')}<p class="mbti-result-demo">ENTP 固定排版样例 · 图中分数为展示数据，未接入真实计分</p><header class="mbti-report-cover"><span class="mbti-result-ribbon">我的测试结果</span><span class="mbti-report-leaf">${icon('leaf')}</span><h1>ENTP</h1><h2>发明家型人格</h2><span class="mbti-result-alias">别称：辩论家</span><p class="mbti-result-keywords">关键词：好奇、灵活、创新</p></header><section class="mbti-radar-card" aria-labelledby="mbti-radar-heading"><div class="between"><h2 id="mbti-radar-heading">八维人格倾向</h2><span>示例分数</span></div>${resultRadar()}<p class="mbti-radar-note">外向与内向、感觉与直觉、思考与情感、判断与知觉<br>以多边形直观看见八项倾向的分布。</p></section><section class="mbti-brief-card"><h2>性格分析</h2><p>${esc(reportSections[0].paragraphs[0])}</p></section><p class="mbti-report-boundary">自我探索与社交娱乐工具，不是心理诊断，没有好坏之分。</p><details class="mbti-report-directory"><summary>报告目录 <span>12 个章节</span></summary><nav aria-label="ENTP 报告章节">${reportSections.map(item => `<a href="#mbti-report-${item.id}" data-mbti-section="${item.id}">${item.title}</a>`).join('')}</nav></details><article>${reportSections.map(item => `<section class="mbti-report-section" id="mbti-report-${item.id}"><h2>${item.title}</h2>${(item.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join('')}${item.bullets ? `<ul>${item.bullets.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}</section>`).join('')}</article><p class="mbti-report-end">以上内容用于展示所提供的 ENTP 文案模板。<br>此页不根据本轮作答生成个人分析。</p>${actionButton('返回答题', 'resume')}${goButton('回到自测首页', 'discover', 'secondary')}</section>`;
  }

  renderers.intro = () => state.tool === 'mbti' ? introPage() : originalIntro();
  renderers.question = () => state.tool === 'mbti' ? questionPage() : originalQuestion();
  renderers.result = () => state.tool === 'mbti' ? resultPage() : originalResult();
  globalThis.mbtiReviewState = () => {
    const meta = {
      intro: ['MBTI 性格测试', '直接说明用途、四个维度与作答方式，先看清楚再开始。', ['按用户给定的说明展示，不使用含糊名称。', '40 道中文 UI 示例，四个维度各 10 题，选择后自动进入下一题。']],
      question: ['MBTI 四维答题', '保留原有题目和左右描述，只调整五档选择控件。', ['五圈按大中小中大排列，左侧青绿、右侧紫色，与两侧描述对应。', '选中后着色并打勾，再自动进入下一题；上一题、暂停与续答保留选择。']],
      result: ['ENTP 结果样例', '参考提供的图片：人格摘要、八维多边形、性格简析、目录和十二张详细卡片。', ['原有 12 个章节的文字与顺序保持一致，仅调整卡片排版。', '摘要、分数与长报告统一使用 ENTP 固定样例，非真实计分。']]
    }[page];
    if (meta) { $('#inspector-title').textContent = meta[0]; $('#inspector-desc').textContent = meta[1]; $('#review-points').innerHTML = meta[2].map(text => `<li>${text}</li>`).join(''); }
    $('#scenarios').innerHTML = groups.map((item, index) => actionButton(`${item.title} ${item.code}`, 'step', 'scenario', `data-step="${index}"`)).join('') + actionButton('ENTP 结果样例', 'sample', 'scenario');
    return `当前测试：MBTI 性格测试\n四个维度各 10 题，共 40 题\n当前题：${questionIndex() + 1} / 40\n已作答：${answered()} / 40\n结果模板：ENTP 发明家型人格\n本轮仅审核 UI；题目和结果均为示例\n输入只在本页内存中保留`;
  };
  let autoAdvanceTimer;
  function cancelAutoAdvance() {
    clearTimeout(autoAdvanceTimer);
    const item = $('.mbti-question-item');
    if (item) item.disabled = false;
  }
  function openQuestion(index) {
    cancelAutoAdvance(); state.mbtiQuestion = index; state.mbtiError = ''; go('question');
  }
  function start(resume = true) {
    state.tool = 'mbti'; openQuestion(resume ? (missingQuestion() ?? questionIndex()) : 0);
  }
  function nextQuestion() {
    if (!valid(state.answers.mbti[questionIndex()])) return;
    if (questionIndex() < 39) openQuestion(questionIndex() + 1);
    else {
      const missing = missingQuestion();
      if (missing !== undefined) { openQuestion(missing); state.mbtiError = '还有题目未选择，先完成这一题吧'; render(); return; }
      state.results.mbti = true;
      state.sources.mbti = { kind: 'native', name: '40 题中文 UI 示例 · 未进行正式计分', date: new Date().toISOString().slice(0, 10) };
      go('result');
    }
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('[data-mbti-section]');
    if (anchor) {
      event.preventDefault();
      const viewport = $('#viewport'), section = document.getElementById('mbti-report-' + anchor.dataset.mbtiSection);
      viewport.scrollTo({ top: viewport.scrollTop + section.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 18, behavior: 'smooth' });
      return;
    }
    const target = event.target.closest('button');
    if (!target) return;
    cancelAutoAdvance();
    if (target.dataset.action === 'resume-mbti') { event.preventDefault(); event.stopImmediatePropagation(); start(); return; }
    if (state.tool === 'mbti' && target.dataset.action === 'retest') { event.preventDefault(); event.stopImmediatePropagation(); state.answers.mbti = []; state.results.mbti = false; state.mbtiQuestion = 0; delete state.sources.mbti; go('intro'); return; }
    if (state.tool === 'mbti' && target.dataset.action === 'start-test') { event.preventDefault(); event.stopImmediatePropagation(); start(); return; }
    const action = target.dataset.mbtiAction;
    if (!action || target.disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (action === 'start' || action === 'resume') start();
    else if (action === 'sample') { state.tool = 'mbti'; go('result'); }
    else if (action === 'back-intro') go('intro');
    else if (action === 'pause') sheet('作答进度已保留', `<p>本轮已选择 ${answered()} / 40 题。返回自测后可以继续，刷新页面会清除本轮进度。</p>`, actionButton('返回自测，稍后继续', 'pause-confirm') + actionButton('继续作答', 'close-sheet', 'secondary'));
    else if (action === 'pause-confirm') { closeSheet(); go('discover'); }
    else if (action === 'close-sheet') closeSheet();
    else if (action === 'step') {
      closeSheet(); state.tool = 'mbti';
      const first = Number(target.dataset.step) * 10;
      openQuestion(Array.from({ length: 10 }, (_, n) => first + n).find(n => !valid(state.answers.mbti[n])) ?? first);
    }
    else if (action === 'previous') { if (questionIndex() === 0) go('intro'); else openQuestion(questionIndex() - 1); }
    else if (action === 'next') nextQuestion();
  }, true);
  document.addEventListener('change', event => {
    const target = event.target;
    if (!target.matches('input[data-mbti-answer]')) return;
    const number = Number(target.dataset.mbtiAnswer), item = target.closest('fieldset');
    state.answers.mbti[number] = Number(target.value);
    $('#mbti-total-progress').textContent = `已答 ${answered()} / 40 题`;
    $('#mbti-next').disabled = false;
    $('#mbti-page-message').textContent = '已选择，正在进入下一题…';
    $('#state-panel').textContent = mbtiReviewState();
    item.disabled = true;
    autoAdvanceTimer = setTimeout(() => {
      if (page !== 'question' || state.tool !== 'mbti' || questionIndex() !== number || document.getElementById(`mbti-item-${number}`) !== item || !$('#overlay').hidden) return;
      nextQuestion();
    }, 320);
  });
  const query = new URLSearchParams(location.search), requested = Number(query.get('mbti-page')), requestedQuestion = Number(query.get('mbti-q'));
  state.mbtiQuestion = Number.isInteger(requestedQuestion) && requestedQuestion >= 1 && requestedQuestion <= 40 ? requestedQuestion - 1 : Number.isInteger(requested) && requested >= 1 && requested <= 4 ? (requested - 1) * 10 : 0;

  const style = document.createElement('style');
  style.textContent = `
.mbti-ui .mbti-intro-hero{text-align:center;margin:12px 0 20px}.mbti-ui .mbti-type-mark{display:inline-block;font-size:14px;letter-spacing:4px;line-height:2;color:#7d88bd;background:#eef0fb;border-radius:19px;padding:12px 18px;margin-bottom:15px}.mbti-ui .mbti-intro-hero h2{font-size:26px;line-height:1.55;font-weight:600;letter-spacing:-.7px}.mbti-ui .mbti-intro-hero p{font-size:12px;color:var(--muted);margin-top:7px}.mbti-ui .mbti-description{font-size:13px;line-height:1.95;color:#61708a;background:white;border:1px solid var(--line);border-radius:14px;padding:16px}.mbti-ui .mbti-intro-facts{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;gap:8px;margin:22px 0}.mbti-ui .mbti-intro-facts span{font-size:10px;color:var(--muted);line-height:1.8}.mbti-ui .mbti-intro-facts b{display:block;font-size:18px;font-weight:550;color:#5d6d97;margin-bottom:4px}.mbti-ui .mbti-dimension-list{border-top:1px solid var(--line)}.mbti-ui .mbti-dimension-list>div{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}.mbti-ui .mbti-dimension-list>div>span{width:25px;height:25px;border-radius:8px;background:#e9eefb;color:#7e8cc2;display:grid;place-items:center;font-size:11px}.mbti-ui .mbti-dimension-list p{flex:1}.mbti-ui .mbti-dimension-list b{display:block;font-size:13px;font-weight:550}.mbti-ui .mbti-dimension-list small{display:block;font-size:10px;color:var(--muted);margin-top:4px}.mbti-ui .mbti-dimension-list strong{font-size:14px;font-weight:500;color:#8d94b1}.mbti-ui .mbti-simple-note{font-size:11px;line-height:1.9;color:var(--muted);margin:18px 0}
.screen.mbti-question-screen{height:100%;min-height:0;padding:0}.mbti-question-ui{height:100%;display:flex;flex-direction:column;min-height:0}.mbti-question-ui .mbti-question-header{padding:0 18px 12px;border-bottom:1px solid var(--line);flex-shrink:0;background:var(--canvas)}.mbti-question-ui .mbti-question-top{height:57px;display:flex;align-items:center;gap:11px}.mbti-question-ui .mbti-question-top>strong{font-size:14px;font-weight:550;flex:1}.mbti-question-ui .mbti-question-header h2{font-size:21px;font-weight:550;line-height:1.6}.mbti-question-ui .mbti-question-header h2 small{font-size:13px;color:#8190b3;font-weight:400;margin-left:5px}.mbti-question-ui .mbti-question-header>.between>span{font-size:10px;color:var(--muted)}.mbti-question-ui .mbti-step-tabs{display:flex;gap:7px;margin:13px 0}.mbti-question-ui .mbti-step{flex:1;padding:7px 3px;background:#edf0f7;border:1px solid transparent;border-radius:9px;font-size:10px;color:#8d98ad}.mbti-question-ui .mbti-step b{display:block;font-size:12px;font-weight:550;margin-bottom:3px}.mbti-question-ui .mbti-step.selected{background:#e8edff;border-color:#c2cdec;color:#6577dc}.mbti-question-ui .mbti-question-hint{font-size:11px;line-height:1.8;color:#6d7e98}.mbti-question-ui .mbti-answer-progress{display:flex;justify-content:space-between;gap:6px;margin-top:10px;font-size:9px;color:#929db1}.mbti-question-ui .mbti-question-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 18px;scrollbar-width:thin}.mbti-question-ui .mbti-question-item{min-width:0;margin:0;padding:17px 0 18px;border:0;border-bottom:1px solid var(--line)}.mbti-question-ui .mbti-question-item legend{float:left;width:100%;font-size:13px;font-weight:500;line-height:1.75;margin-bottom:10px}.mbti-question-ui .mbti-question-item legend>span{font-size:10px;font-weight:500;color:#9ba7bc;display:inline-block;min-width:22px}.mbti-question-ui .mbti-question-ends{clear:both;display:flex;justify-content:space-between;align-items:flex-start;gap:17px;font-size:11px;line-height:1.8;margin:3px 0 10px}.mbti-question-ui .mbti-question-ends>span{max-width:48%;color:#267c75}.mbti-question-ui .mbti-question-ends>span:last-child{text-align:right;color:#7d60a3}.mbti-question-ui .mbti-answer-options{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;align-items:center}.mbti-question-ui .mbti-answer-option{position:relative;cursor:pointer;min-width:0;min-height:56px;display:grid;place-items:center;--choice:#99a3b5;--choice-bg:#f1f3f7}.mbti-question-ui .mbti-answer-option.left{--choice:#267c75;--choice-bg:#e5f4f0}.mbti-question-ui .mbti-answer-option.right{--choice:#7d60a3;--choice-bg:#f0eafa}.mbti-question-ui .mbti-answer-option input{position:absolute;opacity:0;width:1px;height:1px}.mbti-question-ui .mbti-answer-circle{width:34px;height:34px;border:2px solid var(--choice);border-radius:50%;background:var(--choice-bg);display:grid;place-items:center;transition:background .15s,box-shadow .15s}.mbti-question-ui .mbti-answer-option.large .mbti-answer-circle{width:48px;height:48px}.mbti-question-ui .mbti-answer-option.small .mbti-answer-circle{width:20px;height:20px}.mbti-question-ui .mbti-answer-circle .icon{display:none;width:18px;height:18px;color:white}.mbti-question-ui .mbti-answer-option.small .icon{width:11px;height:11px}.mbti-question-ui .mbti-answer-option input:checked+.mbti-answer-circle{background:var(--choice);box-shadow:0 0 0 4px var(--choice-bg)}.mbti-question-ui .mbti-answer-option input:checked+.mbti-answer-circle .icon{display:block}.mbti-question-ui .mbti-answer-option input:focus-visible+.mbti-answer-circle{outline:3px solid #9da9f0;outline-offset:4px}.mbti-question-ui .mbti-question-footnote{font-size:10px;color:var(--muted);line-height:1.8;padding:18px 0}.mbti-question-ui .mbti-question-footer{flex-shrink:0;padding:10px 18px 17px;border-top:1px solid #e2e7f1;background:white}.mbti-question-ui .mbti-question-footer>div:first-child{display:flex;justify-content:space-between;gap:6px;font-size:10px;color:var(--muted);margin-bottom:10px}.mbti-question-ui .mbti-question-footer>div:first-child>span:first-child{color:var(--brand)}.mbti-question-ui .mbti-question-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mbti-question-ui .mbti-question-buttons .secondary{margin:0}.mbti-question-ui .mbti-question-buttons button{min-height:43px}.mbti-question-ui .mbti-question-buttons button:disabled{background:#dce2f1;color:#8d99b2;opacity:1}
.mbti-question-ui .mbti-question-item.is-current{margin:0;padding:25px 20px;border:1px solid #e0e6f0;border-radius:17px;background:white;min-height:280px}.mbti-question-ui .mbti-question-item.is-current legend{font-size:21px;line-height:1.8;margin-bottom:24px}.mbti-question-ui .mbti-question-item.is-current .mbti-question-ends{font-size:13px;line-height:1.9;margin-bottom:20px}.mbti-question-ui .mbti-question-item.is-current .mbti-answer-options{margin:14px 0 10px}.mbti-question-ui .mbti-question-scroll{padding-top:20px}.mbti-question-ui .mbti-step.complete:not(.selected){color:#267c75;background:#e5f4f0;border-color:#c4e2d9}.mbti-question-ui .mbti-question-footnote{text-align:center}.mbti-question-ui .mbti-question-item.is-current:disabled{opacity:1}

.screen.mbti-result-screen{padding:0 14px 28px;background:var(--canvas)}.mbti-report .page-head{height:59px;grid-template-columns:31px 1fr 47px}.mbti-report .page-head h1{font-size:15px;color:var(--ink)}.mbti-report .page-head .back{background:var(--paper);border-color:var(--line)}.mbti-report .head-note{color:var(--muted);border-color:var(--line);background:var(--paper)}.mbti-report .mbti-result-demo{font-size:9px;line-height:1.9;color:var(--muted);text-align:center;margin:0 0 16px}.mbti-report .mbti-report-cover{position:relative;padding:43px 18px 24px;text-align:center;background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:none;margin-bottom:24px}.mbti-report .mbti-result-ribbon{position:absolute;left:0;top:0;padding:9px 18px 10px 16px;background:var(--brand);color:#fff;font-size:12px;line-height:1.5;font-weight:500;border-radius:0 0 14px 0}.mbti-report .mbti-report-leaf .icon{width:26px;height:26px;color:#8b98bd;margin:0 auto 6px}.mbti-report .mbti-report-cover h1{font-size:45px;line-height:1.25;letter-spacing:5px;font-weight:550;color:var(--brand);margin:5px 0}.mbti-report .mbti-report-cover h2{font-size:22px;line-height:1.7;font-weight:550;color:#3c4d6c;margin-top:3px}.mbti-report .mbti-result-alias{font-size:11px;line-height:1.9;color:var(--muted);display:block;margin-top:4px}.mbti-report .mbti-result-keywords{font-size:12px;line-height:1.9;color:var(--muted);border-top:1px solid var(--line);margin-top:16px;padding-top:13px}.mbti-report .mbti-radar-card{border:1px solid var(--line);border-radius:20px;background:white;padding:20px 11px 16px;margin-bottom:16px;box-shadow:0 -5px 0 -1px #ffffff5c}.mbti-report .mbti-radar-card>.between{padding:0 7px;gap:10px}.mbti-report .mbti-radar-card h2{font-size:16px;font-weight:550;color:#3c4d6c;line-height:1.8}.mbti-report .mbti-radar-card>.between>span{font-size:9px;color:#7d8db4;background:#eef1fc;border-radius:5px;padding:4px 6px}.mbti-report .mbti-result-radar{display:block;width:100%;height:auto;overflow:visible;margin:12px 0 4px}.mbti-report .mbti-radar-grid{fill:none;stroke:var(--line);stroke-width:1}.mbti-report .mbti-radar-grid line{stroke:var(--line)}.mbti-report .mbti-radar-shape{fill:#6577dc18;stroke:var(--brand);stroke-width:4;stroke-linejoin:round}.mbti-report .mbti-radar-point{fill:white;stroke:var(--brand);stroke-width:1.8}.mbti-report .mbti-radar-label{font-size:14.5px;fill:var(--muted);font-family:inherit}.mbti-report .mbti-radar-value{font-size:13px;fill:#7c8db7}.mbti-report .mbti-radar-note{text-align:center;font-size:9px;line-height:1.9;color:#96a2b8;margin:0 3px}.mbti-report .mbti-brief-card,.mbti-report .mbti-report-section{margin:0 0 16px;padding:22px 18px;border:1px solid var(--line);border-radius:19px;background:white}.mbti-report .mbti-brief-card h2,.mbti-report .mbti-report-section h2{display:inline-block;font-size:18px;font-weight:550;line-height:1.6;color:#3c4d6c;border-bottom:4px solid #e9edff;padding:0 2px 2px;margin-bottom:13px}.mbti-report .mbti-brief-card h2::before,.mbti-report .mbti-report-section h2::before{content:'';display:inline-block;width:9px;height:9px;border-radius:50%;background:#91a0d7;margin-right:8px;box-shadow:2px -2px 0 #d8dff5}.mbti-report .mbti-brief-card p,.mbti-report .mbti-report-section p{font-size:14px;line-height:2;color:#687790;margin:0 0 13px;overflow-wrap:anywhere}.mbti-report .mbti-brief-card p:last-child,.mbti-report .mbti-report-section p:last-child{margin-bottom:0}.mbti-report .mbti-report-section{scroll-margin-top:16px}.mbti-report .mbti-report-section ul{padding:0 0 0 17px;margin:0}.mbti-report .mbti-report-section li{font-size:14px;line-height:1.95;color:#687790;padding-left:2px;margin-bottom:10px;overflow-wrap:anywhere}.mbti-report .mbti-report-section li:last-child{margin-bottom:0}.mbti-report .mbti-report-section li::marker{color:#a3afd0;font-size:10px}.mbti-report .mbti-report-boundary{font-size:9px;color:var(--muted);line-height:1.9;text-align:center;margin:13px 5px 19px}.mbti-report .mbti-report-directory{background:white;border:1px solid var(--line);border-radius:15px;padding:17px 18px;margin-bottom:16px}.mbti-report .mbti-report-directory summary{cursor:pointer;font-size:14px;color:#6f7e9b;list-style:none;display:flex;justify-content:space-between;align-items:center;font-weight:500}.mbti-report .mbti-report-directory summary>span{font-size:10px;color:#9aa6ba;font-weight:400}.mbti-report .mbti-report-directory nav{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-top:20px}.mbti-report .mbti-report-directory a{font-size:12px;line-height:1.8;color:#7f8eac}.mbti-report .mbti-report-end{font-size:9px;line-height:1.9;color:var(--muted);text-align:center;margin:0 0 22px}.mbti-report>.primary{background:var(--brand);color:white;border-color:var(--brand)}.mbti-report>.secondary{background:white;border-color:var(--line);color:var(--brand)}@media(max-width:350px){.mbti-report .mbti-report-section,.mbti-report .mbti-brief-card{padding:20px 16px}.mbti-report .mbti-report-cover h1{font-size:42px}.mbti-report .mbti-radar-card{padding-left:5px;padding-right:5px}.mbti-report .mbti-report-section p,.mbti-report .mbti-report-section li{font-size:13px}}
`;
  document.head.append(style);
})();
