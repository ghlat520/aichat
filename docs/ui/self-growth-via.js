// VIA prototype: source questions from VIA优势自评卷-72题版.html; reference mapping from 优势测评整合工具.html.
(() => {
/* 24 项 × 3 题，按 6 大美德分组 */
const DATA=[
 {v:"智慧与知识",c:"#2563eb",items:[
   {en:"Creativity",zh:"创造力",d:"概念化有用事物、产出好点子",q:["我能想出别人没想到的办法来解决难题。","我喜欢用新颖的方式完成日常任务。","当旧方法行不通时，我乐于尝试全新的思路。"]},
   {en:"Curiosity",zh:"好奇心",d:"探索、求新、开放体验",q:["我对不熟悉的领域总想一探究竟。","我常因为“想知道为什么”而去查资料。","新体验和新观点让我兴奋而非不安。"]},
   {en:"Judgment",zh:"判断力",d:"批判性思维、开放心智",q:["做决定前，我会认真听取不同甚至相反的意见。","我尽量不被第一印象或情绪带偏判断。","面对争议，我能客观地权衡各方证据。"]},
   {en:"Love of Learning",zh:"热爱学习",d:"系统性地扩充知识",q:["掌握一项新技能的过程本身就让我满足。","我常主动找课程、书或资料来深入某个主题。","比起已懂的，我更被“还不懂的”吸引。"]},
   {en:"Perspective",zh:"洞察力",d:"提供明智 counsel、看全局",q:["朋友遇到困惑时常来征求我的看法。","我能从长远和全局的角度看问题。","我的经验让我能给旁人中肯的建议。"]}
 ]},
 {v:"勇气",c:"#dc2626",items:[
   {en:"Bravery",zh:"勇敢",d:"不退缩、为正确之事发声",q:["即使会得罪人，我也会为认为对的事发声。","面对恐惧或风险，我仍选择行动而非逃避。","我愿意为坚持的原则承担后果。"]},
   {en:"Perseverance",zh:"毅力",d:"持久、勤奋、有始有终",q:["目标受阻时，我会换方法而不是放弃。","我一旦开始就不容易半途而废。","长期的枯燥或挫折不会轻易把我击退。"]},
   {en:"Honesty",zh:"诚实",d:"真实、正直、表里如一",q:["我尽量真实地表达自己的想法和感受。","我为自己的言行负责，不推卸。","即便没人监督，我也坚持做对的事。"]},
   {en:"Zest",zh:"热情",d:"活力、热忱、energized",q:["我对生活总体上充满干劲和活力。","做喜欢的事时我全情投入、能量满满。","我很容易对事情提起兴致。"]}
 ]},
 {v:"人性",c:"#059669",items:[
   {en:"Love",zh:"爱",d:"给予与接受爱、温暖",q:["我重视并用心经营亲密关系。","我既愿意付出爱，也坦然接受别人的爱。","与所爱之人在一起让我感到踏实温暖。"]},
   {en:"Kindness",zh:"善良",d:"慷慨、关怀、利他",q:["看到别人有难，我会主动搭把手。","我待人温和、愿意体谅他人。","帮忙时不期待对方回报。"]},
   {en:"Social Intelligence",zh:"社交智慧",d:"理解自我与他人",q:["我能较快察觉别人的情绪变化。","我懂得在不同场合用不同方式与人相处。","我能读懂对话里没说出口的潜台词。"]}
 ]},
 {v:"公正",c:"#0891b2",items:[
   {en:"Teamwork",zh:"团队合作",d:"公民意识、忠诚、协作",q:["作为团队一员，我乐于配合而非抢功。","我对集体的目标有责任感。","我愿意为团队的整体利益让步个人偏好。"]},
   {en:"Fairness",zh:"公平",d:"公正、不偏私",q:["我对所有人一视同仁，不被亲疏影响。","做涉及他人的决定时，我尽量客观不偏私。","我反感靠关系或特权绕过规则。"]},
   {en:"Leadership",zh:"领导力",d:"组织、引导群体",q:["在群体里，我常自然承担起组织推动的角色。","我能鼓舞大家朝共同目标努力。","我关心团队成员之间的关系是否融洽。"]}
 ]},
 {v:"节制",c:"#7c3aed",items:[
   {en:"Forgiveness",zh:"宽恕",d:"慈悲、给人第二次机会",q:["别人无意冒犯我后，我能放下不再记仇。","我愿意给别人改正和补救的机会。","我不会长期用过去的事指责他人。"]},
   {en:"Humility",zh:"谦逊",d:"modest、不居功",q:["我取得成绩时不爱张扬。","我清楚自己的局限，也乐意承认不知。","我不太在意成为众人关注的焦点。"]},
   {en:"Prudence",zh:"审慎",d:"谨慎、为未来规划",q:["做重大决定前，我会先想清楚潜在风险。","我不轻易冒没必要的险。","我习惯为将来做打算、留余地。"]},
   {en:"Self-Regulation",zh:"自律",d:"自控、disciplined",q:["我能控制冲动，不轻易被情绪牵着走。","我按时完成该做的事，少拖延。","面对诱惑时，我能管住自己。"]}
 ]},
 {v:"超越",c:"#db2777",items:[
   {en:"Appreciation of Beauty",zh:"欣赏美",d:"敬畏、惊叹、升华感",q:["自然的壮美或他人的才华常让我动容。","我会被艺术、音乐或巧思深深吸引。","我常留意并珍惜生活中的美好细节。"]},
   {en:"Gratitude",zh:"感恩",d:"thankful、表达谢意",q:["我对别人给我的帮助常心怀感谢并表达。","我认为自己拥有的已值得珍惜。","我习惯在心里或口头记下值得感激的事。"]},
   {en:"Hope",zh:"希望",d:"乐观、面向未来",q:["即使处境困难，我也相信情况会好转。","我对未来抱现实而积极的预期。","我倾向于把精力放在“怎么改善”而非“有多糟”。"]},
   {en:"Humor",zh:"幽默",d:"playfulness、逗人笑",q:["我常用玩笑化解紧张或尴尬。","我能从压力中找出轻松的一面。","逗别人笑让我自己也开心。"]},
   {en:"Spirituality",zh:"灵性",d:"信念、目的感",q:["我感到生活有超越日常的意义或目的。","我相信自己与更大的整体有所连接。","我在日常中也能体会到某种“意义感”。"]}
 ]}
];
const CROSS = [{"code":"INTJ","name":"建筑师","strengths":["洞察力","创造力","热爱学习","审慎","判断力"],"description":"远见与深度思考者，靠洞察与创意破局"},{"code":"INTP","name":"逻辑学家","strengths":["创造力","热爱学习","判断力","好奇心","审慎"],"description":"概念引擎，为求真与理解而活"},{"code":"ENTJ","name":"指挥官","strengths":["领导力","希望","毅力","公平","诚实"],"description":"天生的组织者，把愿景变成结果"},{"code":"ENTP","name":"辩论家","strengths":["创造力","好奇心","幽默","洞察力","社交智慧"],"description":"点子制造机，在辩论与可能中充电"},{"code":"INFJ","name":"提倡者","strengths":["爱","希望","灵性","感恩","善良"],"description":"理想主义的守护者，用意义连接人"},{"code":"INFP","name":"调停者","strengths":["爱","善良","灵性","希望","欣赏美"],"description":"价值驱动的内核，在美与真诚中扎根"},{"code":"ENFJ","name":"主人公","strengths":["爱","领导力","社交智慧","希望","感恩"],"description":"赋能他人的催化剂，温暖而有号召力"},{"code":"ENFP","name":"竞选者","strengths":["热情","创造力","爱","希望","幽默"],"description":"热情的可能主义者，点燃周围的人"},{"code":"ISTJ","name":"物流师","strengths":["责任","审慎","公平","毅力","自律"],"description":"可靠的基石，用责任与秩序托底"},{"code":"ISFJ","name":"守卫者","strengths":["善良","责任","爱","团队合作","感恩"],"description":"无声的奉献者，细心照护身边人"},{"code":"ESTJ","name":"总经理","strengths":["责任","公平","领导力","诚实","审慎"],"description":"秩序的构建者，把事落地并管到位"},{"code":"ESFJ","name":"执政官","strengths":["善良","爱","团队合作","社交智慧","感恩"],"description":"关系的黏合剂，让群体温暖运转"},{"code":"ISTP","name":"鉴赏家","strengths":["勇敢","审慎","创造力","判断力","毅力"],"description":"冷静的实战派，动手解决问题"},{"code":"ISFP","name":"探险家","strengths":["欣赏美","善良","灵性","爱","热情"],"description":"安静的艺术家，活在当下与美感里"},{"code":"ESTP","name":"企业家","strengths":["勇敢","热情","幽默","社交智慧","适应"],"description":"行动派猛人，在现实刺激中爆发"},{"code":"ESFP","name":"表演者","strengths":["热情","幽默","善良","欣赏美","社交智慧"],"description":"天生的舞台，把快乐带给别人"}];
  const strengths = DATA.flatMap((group, groupIndex) => group.items.map(item => ({ ...item, group: group.v, groupIndex })));
  const questions = strengths.flatMap((item, strengthIndex) => item.q.map(text => ({ text, strengthIndex, groupIndex: item.groupIndex })));
  const labels = ['非常不像我', '不太像', '一般', '比较像', '非常像我'];
  const valid = value => Number.isInteger(value) && value >= 1 && value <= 5;
  const current = () => state.via || (state.via = { answers: [], index: 0, preview: false, filter: 'all' });
  const answered = () => current().answers.filter(valid).length;
  const complete = () => answered() === questions.length;
  const firstMissing = () => questions.findIndex((_, index) => !valid(current().answers[index]));
  const button = (text, action, cls = 'primary', extra = '') => `<button class="${cls}" data-via-action="${action}" ${extra}>${text}</button>`;
  const groupIndices = index => questions.flatMap((item, n) => item.groupIndex === index ? [n] : []);
  const notes = '基于 VIA 24 项框架的探索性自评，不是官方验证量表，不用于心理诊断。';
  const virtueCards = () => DATA.map(group => `<div><strong>${group.v}</strong><small>${group.items.length} 项优势 · ${group.items.length * 3} 题</small></div>`).join('');

  globalThis.viaCatalogCards = () => {
    const count = answered();
    return `<button class="test-card" data-via-action="catalog"><span class="via-catalog-art">${icon('leaf')}</span><span class="grow"><h3>VIA 性格优势</h3><p>从 72 句日常描述中，看见你的 24 项性格优势。</p><span class="tags"><span class="tag aqua">${complete() ? '已完成 · 查看结果' : count ? `继续 ${count} / ${questions.length} 题` : '探索性自评'}</span><span class="tag gray">72 题 · 24 项优势</span></span></span><span class="chevron">${icon('next')}</span></button><button class="test-card" data-go="via-mbti"><span class="via-catalog-art lilac">${icon('cards')}</span><span class="grow"><h3>VIA × MBTI 对照表</h3><p>查看 16 型各自的优势参考，换一个角度认识自己。</p><span class="tags"><span class="tag">16 型参考</span><span class="tag gray">每型 5 项 · 非测评结论</span></span></span><span class="chevron">${icon('next')}</span></button>`;
  };
  globalThis.assessmentRecentCards = () => {
    let html = mbtiHasResult() ? `<button class="recent-row" data-tool="mbti" data-tool-page="result"><span class="feature-icon">${icon('test')}</span><span class="grow"><b>MBTI 性格测试 · 结果样例</b><span class="tiny">免费查看</span></span><span class="chevron">${icon('next')}</span></button>` : '';
    if (complete()) html += `<button class="recent-row" data-via-action="catalog"><span class="feature-icon aqua">${icon('leaf')}</span><span class="grow"><b>VIA 性格优势 · 我的排序</b><span class="tiny">已完成 72 题 · 本轮自评</span></span><span class="chevron">${icon('next')}</span></button>`;
    return html || '<p class="small">完成一项自评，你的发现会留在这里。</p>';
  };
  globalThis.assessmentResultCount = () => Number(mbtiHasResult()) + Number(complete());
  globalThis.viaAnsweredCount = answered;
  globalThis.viaHasResult = complete;
  globalThis.viaReportRecord = () => complete() ? `<section class="report-item"><button class="report-item-main" data-via-action="catalog"><span class="feature-icon aqua">${icon('leaf')}</span><span class="grow"><h3>VIA 性格优势 · 免费基础结果</h3><p class="tiny">本轮 72 题自评 · 三题均分排序</p><span class="tag gray" style="margin-top:8px">24 项完整查看</span></span><span class="chevron">${icon('next')}</span></button></section>` : '';
  globalThis.openViaComparison = code => { current().filter = CROSS.some(row => row.code === code) ? code : 'all'; go('via-mbti'); };
  function introPage() {
    return `<section class="via-page">${head('VIA 性格优势', 'discover', '探索自评')}<div class="via-hero"><span class="via-hero-icon">${icon('leaf')}</span><h2>发现那些，<br>你自然会用的力量。</h2><p>性格偏好之外，也看看你如何把事情做好。</p></div><div class="via-facts"><span><b>72 题</b>每项优势 3 题</span><span><b>24 项</b>完整优势排序</span><span><b>6 类</b>美德框架</span></div><p class="via-note">${notes} 请按平时的自己作答，1 分代表“非常不像我”，5 分代表“非常像我”。</p>${button(answered() ? `继续作答 · ${answered()} / 72 题` : '开始 VIA 性格优势自评', 'start')}${complete() ? button('查看我的优势排序', 'personal', 'secondary') : ''}${button('先看结果排版样例', 'sample', 'secondary')}<div class="via-section-heading"><h3>从六个角度，看见你的优势</h3></div><div class="via-virtues">${virtueCards()}</div><p class="footer-note">题目采用提供的 72 题版本；每项 3 题取均分后排序。<br>选中即保留本轮答案，随后自动进入下一题。<br>原型仅在当前页面内存中保存，刷新后会清除。</p></section>`;
  }
  function questionPage() {
    const v = current(), item = questions[v.index], strength = strengths[item.strengthIndex];
    const url = new URL(location.href); url.searchParams.set('via-q', v.index + 1); history.replaceState({}, '', url);
    return `<section class="via-page via-question"><header class="via-question-header"><div class="via-question-top">${button(icon('back'), 'intro', 'back', 'aria-label="返回 VIA 介绍"')}<strong>VIA 性格优势</strong>${button('暂停', 'pause', 'text-link')}</div><label class="via-group-label">当前维度<select data-via-group aria-label="切换美德维度">${DATA.map((g, index) => `<option value="${index}" ${item.groupIndex === index ? 'selected' : ''}>${g.v} · ${groupIndices(index).filter(n => valid(v.answers[n])).length}/${groupIndices(index).length} 题</option>`).join('')}</select></label><div class="between via-progress-text"><span id="via-progress">已答 ${answered()} / ${questions.length} 题</span><span>第 ${v.index + 1} 题</span></div><div class="via-progress-track"><span id="via-progress-bar" style="width:${answered() / questions.length * 100}%"></span></div></header><div class="via-question-stage"><fieldset class="via-question-card" id="via-item-${v.index}"><legend class="via-sr-only">第 ${v.index + 1} 题：${esc(item.text)}</legend><div class="via-item-caption"><span>${strength.zh} <small>${strength.en}</small></span><span>${String(v.index + 1).padStart(2, '0')} / 72</span></div><h2>${esc(item.text)}</h2><p class="via-question-hint">这句话，与你平时的样子有多接近？</p><div class="via-options">${labels.map((label, n) => `<label class="via-option ${n < 2 ? 'left' : n > 2 ? 'right' : 'middle'} ${n === 0 || n === 4 ? 'large' : n === 2 ? 'small' : 'medium'}"><input type="radio" name="via-answer-${v.index}" value="${n + 1}" data-via-answer="${v.index}" ${v.answers[v.index] === n + 1 ? 'checked' : ''} aria-label="${label}，${n + 1}分"><span class="via-circle" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="via-option-label">${label}</span></label>`).join('')}</div><p class="via-selection-status" id="via-selection-status" role="status">${v.message || '选中圆圈后，将自动进入下一题'}</p></fieldset><p class="via-small-note">题目与选项保持原文；没有好坏之分。</p></div><footer class="via-question-footer">${button(v.index ? '上一题' : '返回介绍', 'previous', 'secondary')}${button(v.index === questions.length - 1 ? '查看优势排序' : '下一题', 'next', 'primary', `id="via-next" ${valid(v.answers[v.index]) ? '' : 'disabled'}`)}</footer></section>`;
  }
  function ranked(demo = false) {
    const sampleTotals = [13, 14, 12, 15, 13, 11, 14, 12, 13, 14, 15, 13, 12, 13, 12, 11, 10, 12, 11, 13, 14, 13, 14, 11];
    return strengths.map((item, index) => {
      const total = demo ? sampleTotals[index] : item.q.reduce((sum, _, n) => sum + current().answers[index * 3 + n], 0);
      return { ...item, index, total, score: +(total / 3).toFixed(2) };
    }).sort((a, b) => b.total - a.total || a.index - b.index);
  }
  function resultPage() {
    const demo = current().preview || !complete(), scores = ranked(demo);
    return `<section class="via-page via-result">${head('VIA 性格优势结果', 'discover', demo ? '排版样例' : '本轮自评')}<p class="via-note ${demo ? 'example' : ''}">${demo ? '结果排版样例 · 非你的作答结果，未写入个人进度。' : '根据本轮 72 个答案计算：每项 3 题取均分，按高到低排列。'}</p><div class="via-result-heading"><span class="via-hero-icon">${icon('leaf')}</span><h2>看见你的优势，<br>也看见更多可能。</h2><p>24 项优势人人都拥有，排序靠后也不代表缺点。</p></div><div class="via-section-heading"><h3>本次自评均分前 5</h3><span>${demo ? '示例数据' : '按本轮选择计算'}</span></div><div class="via-top-five">${scores.slice(0, 5).map((item, n) => `<section class="via-top-card"><span class="via-rank">${n + 1}</span><div><h3>${item.zh}</h3><small>${item.en}</small><p>${item.d}</p></div><strong>${item.score.toFixed(2)}<small>/ 5</small></strong></section>`).join('')}</div><p class="via-small-note">同分项按原题顺序显示，前 5 仅作本次自评参考。</p><section class="via-ranking-card"><h3>完整 24 项优势排序</h3>${scores.map((item, n) => `<div class="via-rank-row" data-strength="${item.en}" data-score="${item.score}"><span>${String(n + 1).padStart(2, '0')}</span><div><div class="between"><b>${item.zh}</b><strong>${item.score.toFixed(2)}</strong></div><small>${item.en}</small><div class="via-strength-bar"><span style="width:${(item.score - 1) / 4 * 100}%"></span></div></div></div>`).join('')}</section><p class="via-note">这是探索性自评快照，不是 VIA 官方报告。可以用实际经历继续验证，也可在 VIA 官方网站进一步了解。</p>${goButton('看看 VIA × MBTI 对照表', 'via-mbti')}${demo && complete() ? button('回到我的本轮结果', 'personal', 'secondary') : button(demo ? '开始我的 72 题自评' : '回看我的作答', demo ? 'start' : 'review', 'secondary')}${goButton('看看 MBTI 16 型优缺点', 'mbti-types', 'secondary')}${goButton('返回自测首页', 'discover', 'secondary')}</section>`;
  }
  function crossPage() {
    const filter = current().filter, rows = CROSS.filter(row => filter === 'all' || row.code === filter), names = new Set(strengths.map(s => s.zh));
    const url = new URL(location.href); if (filter === 'all') url.searchParams.delete('via-type'); else url.searchParams.set('via-type', filter); history.replaceState({}, '', url);
    return `<section class="via-page via-cross">${head('VIA × MBTI 对照', 'discover', '参考对照')}<h2 class="page-title">从另一种视角，<br>看看你的优势。</h2><p class="lead">16 型各自的 5 项优势参考，适合找共鸣、做自我对照。</p><p class="via-note">沿用所提供整合工具中的探索性映射，基于类型取向推断，非官方交叉验证，也不是你的 VIA 实测结果。</p><label class="via-filter-label" for="via-type-filter">选择想看的 MBTI 类型<select id="via-type-filter" data-via-filter><option value="all">全部 16 型</option>${CROSS.map(row => `<option value="${row.code}" ${row.code === filter ? 'selected' : ''}>${row.code} · ${row.name}</option>`).join('')}</select></label><p class="via-small-note">原表中的“责任”“适应”为补充描述词，不属于这份问卷的 24 项计分维度，以下单独标注。</p><div class="via-cross-list">${rows.map(row => `<section class="via-cross-card" data-type="${row.code}"><div class="between"><h3>${row.code}</h3><span>${row.name}</span></div><div class="via-cross-tags">${row.strengths.map(name => `<span class="${names.has(name) ? '' : 'supplement'}">${name}${names.has(name) ? '' : '<small>补充描述</small>'}</span>`).join('')}</div><p>${row.description}</p>${mbtiCelebrityCard(row.code, true)}<button class="text-link" data-explore-action="type" data-code="${row.code}">看看 ${row.code} 的优点与盲点</button></section>`).join('')}</div>${goButton('开始 VIA 性格优势自评', 'via-intro')}${goButton('返回自测首页', 'discover', 'secondary')}</section>`;
  }

  Object.assign(renderers, { 'via-intro': introPage, 'via-question': questionPage, 'via-result': resultPage, 'via-mbti': crossPage });
  const pages = [
    ['via-intro', 'VIA 性格优势介绍', 'VIA 自评', '采用提供的 72 题版本，六类美德、24 项优势、每项 3 题。', ['进入完整问卷或明确标注的排版样例。', '输入仅保留在本原型页内存。']],
    ['via-question', 'VIA 答题与续答', 'VIA 自评', '题目保持原文，五档选择后自动进入下一题。', ['答案立即保存，暂停和取消切换不会丢失选择。', '六类维度可切换，续答定位第一道未答题。']],
    ['via-result', 'VIA 免费基础结果', 'VIA 自评', '72 题完成后按三题均分给出 Top 5 和完整 24 项排序。', ['样例不写入个人答案，实际分数来自本轮输入。', '同分按原题顺序显示；不将低排名称为缺点。']],
    ['via-mbti', 'VIA × MBTI 对照表', '参考对照', '沿用整合工具第三部分的 16 型映射。', ['每型 5 项，支持选择类型查看，并展示对应的四位名人参考与共鸣引导。', '责任与适应标为补充描述，不纳入 VIA 计分。']]
  ];
  pageMeta.push(...pages);
  reviewGroups.find(group => group.id === 'discover').pages.splice(4, 0, ...pages.map(item => item[0]));
  Object.assign(reviewLabels, Object.fromEntries(pages.map(item => [item[0], item[1]])));
  globalThis.viaReviewState = () => {
    $('#scenarios').innerHTML = goButton('VIA 介绍', 'via-intro', 'scenario') + button('继续自评', 'start', 'scenario') + button('结果排版样例', 'sample', 'scenario') + goButton('16 型参考对照', 'via-mbti', 'scenario');
    return `VIA：${answered()} / ${questions.length} 题\n24 项优势，每项 3 题取均分\n当前题：${current().index + 1}\n结果：${current().preview || !complete() ? '排版样例，不写入个人记录' : '本轮实际自评均分'}\n对照表：16 型，每型 5 项\n补充描述：责任、适应（不计分）\n刷新后清除本轮输入`;
  };
  let autoTimer;
  function cancelNext() { clearTimeout(autoTimer); const item = $('.via-question-card'); if (item) item.disabled = false; }
  function openQuestion(index) { cancelNext(); current().index = index; current().message = ''; current().preview = false; go('via-question'); }
  function start() { openQuestion(firstMissing() < 0 ? current().index : firstMissing()); }
  function advance() {
    const v = current(); if (!valid(v.answers[v.index])) return;
    if (v.index < questions.length - 1) openQuestion(v.index + 1);
    else if (!complete()) { openQuestion(firstMissing()); current().message = '还有题目未选择，先补全这一题吧'; render(); }
    else { v.preview = false; go('via-result'); }
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target) return;
    cancelNext();
    const action = target.dataset.viaAction; if (!action || target.disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (action === 'catalog') { current().preview = false; go(complete() ? 'via-result' : 'via-intro'); }
    else if (action === 'start') start();
    else if (action === 'intro') go('via-intro');
    else if (action === 'sample') { current().preview = true; go('via-result'); }
    else if (action === 'personal') { current().preview = false; go('via-result'); }
    else if (action === 'review') openQuestion(0);
    else if (action === 'previous') { if (current().index) openQuestion(current().index - 1); else go('via-intro'); }
    else if (action === 'next') advance();
    else if (action === 'pause') sheet('本轮选择已保留', `<p>已作答 ${answered()} / 72 题，稍后可以继续。刷新会清除原型进度。</p>`, button('返回自测，稍后继续', 'pause-confirm') + button('继续作答', 'close-sheet', 'secondary'));
    else if (action === 'pause-confirm') { closeSheet(); go('discover'); }
    else if (action === 'close-sheet') closeSheet();
  }, true);
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-via-filter]')) { current().filter = target.value; render({ keepScroll: true }); return; }
    if (target.matches('[data-via-group]')) { const indices = groupIndices(Number(target.value)); openQuestion(indices.find(n => !valid(current().answers[n])) ?? indices[0]); return; }
    if (!target.matches('[data-via-answer]')) return;
    const v = current(), index = Number(target.dataset.viaAnswer), item = target.closest('fieldset');
    v.answers[index] = Number(target.value);
    $('#via-progress').textContent = `已答 ${answered()} / 72 题`; $('#via-progress-bar').style.width = `${answered() / 72 * 100}%`;
    $('#via-next').disabled = false; $('#via-selection-status').textContent = '已选择，正在进入下一题…'; $('#state-panel').textContent = viaReviewState();
    item.disabled = true;
    autoTimer = setTimeout(() => { if (page !== 'via-question' || v !== current() || current().index !== index || document.getElementById(`via-item-${index}`) !== item || !$('#overlay').hidden) return; advance(); }, 320);
  });
  const requestedType = new URLSearchParams(location.search).get('via-type');
  if (CROSS.some(row => row.code === requestedType)) current().filter = requestedType;
  const requested = Number(new URLSearchParams(location.search).get('via-q'));
  if (Number.isInteger(requested) && requested >= 1 && requested <= questions.length) current().index = requested - 1;
  const style = document.createElement('style');
  style.textContent = `
#self-tools .via-catalog-art{width:76px;min-height:87px;flex-shrink:0;border-radius:23px;background:#e7f3f2;display:grid;place-items:center;color:#6e9b99}#self-tools .via-catalog-art.lilac{background:#eeeffb;color:#8c96c4}#self-tools .via-catalog-art>.icon{width:37px;height:37px}.via-page .via-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.via-page .via-hero{text-align:center;margin:16px 0 24px}.via-page .via-hero-icon{display:grid;place-items:center;width:60px;height:60px;margin:0 auto 18px;border-radius:20px;background:#e7f3f2;color:#83a8a3}.via-page .via-hero-icon>.icon{width:29px;height:29px}.via-page .via-hero h2,.via-page .via-result-heading h2{font-size:26px;line-height:1.65;letter-spacing:-.5px;font-weight:550;color:#3f506c}.via-page .via-hero p,.via-page .via-result-heading p{font-size:11px;line-height:1.9;color:#95a1b7;margin-top:11px}.via-page .via-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin:20px 0}.via-page .via-facts span{font-size:10px;line-height:1.9;color:var(--muted)}.via-page .via-facts b{display:block;font-size:19px;font-weight:550;color:#6a7da2;margin-bottom:5px}.via-page .via-note{background:white;border:1px solid var(--line);border-radius:13px;padding:14px;font-size:11px;color:#7c89a2;line-height:1.95;margin:18px 0}.via-page .via-note.example{background:#f0eefb;border-color:#e3def5;color:#9082a8}.via-page .via-section-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:28px 0 16px}.via-page .via-section-heading h3{font-size:15px;font-weight:550;line-height:1.8}.via-page .via-section-heading>span{font-size:9px;color:#9aa5b8}.via-page .via-virtues{display:grid;grid-template-columns:1fr 1fr;gap:10px}.via-page .via-virtues>div{padding:16px 13px;background:white;border:1px solid var(--line);border-radius:13px}.via-page .via-virtues strong{display:block;font-size:13px;font-weight:500}.via-page .via-virtues small{display:block;font-size:10px;color:#97a3b7;line-height:1.8;margin-top:5px}.via-page .via-small-note{font-size:10px;color:#98a4b7;line-height:1.95;margin:15px 0}
.screen.via-question-screen{height:100%;min-height:0;padding:0}.via-question{height:100%;display:flex;flex-direction:column;min-height:0}.via-question .via-question-header{padding:0 18px 15px;border-bottom:1px solid var(--line);flex-shrink:0}.via-question .via-question-top{height:57px;display:flex;align-items:center;gap:11px}.via-question .via-question-top>strong{font-size:14px;font-weight:550;flex:1}.via-question .via-group-label{display:flex;align-items:center;gap:12px;font-size:11px;color:#8a96ac;margin:10px 0 17px}.via-question .via-group-label select{flex:1;min-width:0;min-height:38px;border:1px solid #e0e6f2;border-radius:9px;background:white;padding:8px;color:#7182a4;font-size:12px}.via-question .via-progress-text{font-size:10px;color:#96a2b8}.via-question .via-progress-track{height:3px;background:#e8ecf6;border-radius:6px;overflow:hidden;margin-top:10px}.via-question .via-progress-track>span{display:block;height:100%;background:#99aad7}.via-question .via-question-stage{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:20px 16px}.via-question .via-question-card{min-width:0;min-height:325px;margin:0;padding:23px 18px;background:white;border:1px solid #e0e6f0;border-radius:17px}.via-question .via-item-caption{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#8b99b1;line-height:1.8}.via-question .via-item-caption>span:first-child{flex:1;min-width:0}.via-question .via-item-caption small{display:block;font-size:9px;color:#a5afc0}.via-question .via-item-caption>span:last-child{font-size:10px;white-space:nowrap}.via-question .via-question-card h2{font-size:22px;line-height:1.8;letter-spacing:.1px;font-weight:550;margin:27px 0 12px;color:#3d4f6d}.via-question .via-question-hint{font-size:10px;color:#9aa7ba;line-height:1.8;margin:10px 0 22px}.via-question .via-options{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;align-items:start}.via-question .via-option{position:relative;min-width:0;min-height:80px;display:flex;align-items:center;flex-direction:column;justify-content:flex-start;cursor:pointer;--choice:#99a3b5;--soft:#f1f3f7;padding-top:5px}.via-question .via-option.left{--choice:#267c75;--soft:#e5f4f0}.via-question .via-option.right{--choice:#7d60a3;--soft:#f0eafa}.via-question .via-option input{position:absolute;width:1px;height:1px;opacity:0}.via-question .via-circle{width:34px;height:34px;border:2px solid var(--choice);border-radius:50%;background:var(--soft);display:grid;place-items:center;margin:7px 0;transition:background .15s,box-shadow .15s}.via-question .via-option.large .via-circle{width:48px;height:48px;margin:0}.via-question .via-option.small .via-circle{width:20px;height:20px;margin:14px 0}.via-question .via-circle svg{width:18px;height:18px;display:none;color:white}.via-question .via-option.small svg{width:11px;height:11px}.via-question .via-option input:checked+.via-circle{background:var(--choice);box-shadow:0 0 0 4px var(--soft)}.via-question .via-option input:checked+.via-circle svg{display:block}.via-question .via-option input:focus-visible+.via-circle{outline:3px solid #a3b1e2;outline-offset:4px}.via-question .via-option-label{font-size:9px;line-height:1.7;text-align:center;color:#8d9bb1;margin-top:12px;white-space:normal}.via-question .via-selection-status{font-size:10px;text-align:center;color:#9ca7ba;line-height:1.9;min-height:19px;margin-top:20px}.via-question .via-question-footer{flex-shrink:0;background:white;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 18px 17px}.via-question .via-question-footer .secondary{margin:0}.via-question .via-question-footer button{min-height:43px}.via-question .via-question-footer button:disabled{background:#dfe5f2;color:#94a0b7;opacity:1}.via-question .via-small-note{text-align:center;font-size:9px}
.via-result .via-result-heading{text-align:center;margin:20px 0 28px}.via-result .via-top-five{display:grid;gap:11px}.via-result .via-top-card{display:flex;align-items:flex-start;gap:12px;background:white;border:1px solid var(--line);border-radius:15px;padding:17px 14px;min-width:0}.via-result .via-rank{width:27px;height:27px;border-radius:9px;background:#eaf0fb;color:#7f90bf;font-size:12px;display:grid;place-items:center;flex-shrink:0}.via-result .via-top-card>div{flex:1;min-width:0}.via-result .via-top-card h3{font-size:17px;font-weight:550;line-height:1.7}.via-result .via-top-card small{display:block;font-size:9px;color:#99a5b8;line-height:1.8;overflow-wrap:anywhere}.via-result .via-top-card p{font-size:11px;color:#8290a7;line-height:1.9;margin-top:7px;overflow-wrap:anywhere}.via-result .via-top-card>strong{font-size:19px;font-weight:500;line-height:1.5;color:#7a8db8;text-align:right}.via-result .via-top-card>strong small{font-size:9px;font-weight:400}.via-result .via-ranking-card{padding:21px 17px;background:white;border:1px solid var(--line);border-radius:17px;margin:25px 0}.via-result .via-ranking-card>h3{font-size:16px;font-weight:550;margin-bottom:16px}.via-result .via-rank-row{display:flex;gap:13px;padding:14px 0;border-bottom:1px solid var(--line)}.via-result .via-rank-row:last-child{border-bottom:0;padding-bottom:2px}.via-result .via-rank-row>span{font-size:10px;line-height:1.9;color:#a2aec2;min-width:18px}.via-result .via-rank-row>div{flex:1;min-width:0}.via-result .via-rank-row b{font-size:13px;font-weight:500}.via-result .via-rank-row strong{font-size:12px;font-weight:500;color:#7b8cb5}.via-result .via-rank-row small{display:block;font-size:9px;color:#a1acbd;line-height:1.8;margin:5px 0 9px;overflow-wrap:anywhere}.via-result .via-strength-bar{height:5px;background:#edf0f8;border-radius:8px;overflow:hidden}.via-result .via-strength-bar>span{display:block;height:100%;border-radius:8px;background:#b1bddf}
.via-cross .via-filter-label{display:block;font-size:12px;color:#7d8ca7;line-height:1.9;margin:24px 0 12px}.via-cross select{display:block;width:100%;min-height:43px;margin-top:9px;border:1px solid #dfe6f2;background:white;border-radius:10px;padding:9px 12px;color:#6a7ca2;font-size:12px}.via-cross .via-cross-list{display:grid;gap:14px;margin:20px 0 26px}.via-cross .via-cross-card{padding:21px 18px;background:white;border:1px solid var(--line);border-radius:16px}.via-cross .via-cross-card h3{font-size:24px;letter-spacing:1.5px;color:#778ac0;font-weight:550}.via-cross .via-cross-card>.between>span{font-size:12px;color:#8795ad}.via-cross .via-cross-tags{display:flex;flex-wrap:wrap;gap:7px;margin:17px 0 13px}.via-cross .via-cross-tags>span{font-size:11px;line-height:1.8;padding:4px 8px;background:#eef1fc;color:#7d8db6;border-radius:7px}.via-cross .via-cross-tags>span.supplement{color:#91a0af;background:#f0f3f6}.via-cross .via-cross-tags small{font-size:8px;display:block;line-height:1.5}.via-cross .via-cross-card p{font-size:12px;color:#8d99ae;line-height:1.9}.via-page button:focus-visible,.via-page select:focus-visible{outline:3px solid #a3b1e2;outline-offset:3px}@media(max-width:350px){.via-question .via-question-stage{padding:15px 12px}.via-question .via-question-card{padding:20px 16px}.via-question .via-question-card h2{font-size:20px}.via-question .via-option-label{font-size:9px}.via-page .via-hero h2{font-size:24px}#self-tools .via-catalog-art{width:59px;min-height:78px}#self-tools .via-catalog-art>.icon{width:30px;height:30px}}@media(prefers-reduced-motion:reduce){.via-question .via-circle{transition:none}}
`;
  document.head.append(style);
})();
