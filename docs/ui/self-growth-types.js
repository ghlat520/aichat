// Prototype: MBTI 16 型优缺点对照, copied from the user-provided HTML.
(() => {
const T=[
 {c:"INTJ",n:"建筑师",a:"理性战略家",g:"NT",up:["战略远见，能看见别人看不到的长线格局","独立严谨，思考有深度、不盲从","高效专注，认准目标就稳步推进","逻辑清晰，决策少被情绪带偏"],dn:["情感表达弱，易被误读为冷漠或傲慢","对他人能力与动机偏怀疑，信任成本高","计划被打乱会烦躁，容错度低","不擅闲聊，社交「启动」慢"]},
 {c:"INTP",n:"逻辑学家",a:"概念建筑师",g:"NT",up:["极度好奇，对未知有天然探索欲","逻辑严密，善于拆解复杂问题","客观创新，不被惯例束缚","思维独立，敢质疑权威"],dn:["行动易拖延，想得多做得少","忽视社交与情感维系","过于理论化，落地意识弱","对例行事务缺乏耐心"]},
 {c:"ENTJ",n:"指挥官",a:"天生的统帅",g:"NT",up:["天然领导力，能聚人成事","目标导向，结果驱动","果断高效，临事敢拍板","善于统筹资源与全局"],dn:["掌控欲强，易压过他人空间","缺乏耐心，对低效不耐受","容易忽略他人感受与情绪","工作侵占生活，易过劳"]},
 {c:"ENTP",n:"辩论家",a:"点子发动机",g:"NT",up:["机敏善辩，思维跳跃有创意","适应变化，乐于打破常规","点子多，能从多角度看问题","能言善道，感染力强"],dn:["兴趣易转移，常半途而废","好争辩，有时为辩而辩","规则意识弱，细节马虎","做事凭兴致，计划性差"]},
 {c:"INFJ",n:"提倡者",a:"理想主义的引路人",g:"NF",up:["洞察人心，能读懂弦外之音","理想坚定，有内在方向感","富有共情，关系有深度","言行一致，值得托付"],dn:["过度付出易耗竭，难对自己说 no","理想化，有时脱离现实约束","隐藏真实情绪，外人难懂","对冲突与辜负格外敏感"]},
 {c:"INFP",n:"调停者",a:"温柔的理想主义者",g:"NF",up:["真诚善良，内心有稳定价值","富有想象与创造力","共情强，能接住他人情绪","包容，不轻易评判"],dn:["回避冲突，委屈自己","过于敏感，易内耗","执行力偏弱，想法难落地","理想化，对现实落差失落"]},
 {c:"ENFJ",n:"主人公",a:"赋能型领袖",g:"NF",up:["感染力强，能点燃团队","善于赋能他人成长","利他温暖，关系黏合度高","组织协调能力出色"],dn:["过度操心别人，忽略自己","难拒绝，边界模糊","自我价值过度绑定他人评价","为和谐回避必要冲突"]},
 {c:"ENFP",n:"竞选者",a:"热情的自由灵魂",g:"NF",up:["热情洋溢，自带能量场","创意丰富，点子灵动","人际灵活，快速拉近距离","适应力强，乐于尝试"],dn:["专注力易散，难深耕一件事","计划性弱，常临阵赶工","过度承诺，兑现吃力","情绪起伏较大"]},
 {c:"ISTJ",n:"物流师",a:"可靠的基石",g:"SJ",up:["可靠负责，答应的事必做到","严谨细致，出错率低","踏实守诺，让人安心","条理清晰，流程感强"],dn:["抗拒变化，对新事物慢热","过于死板，缺乏弹性","不善表达情感与赞美","容易陷在细节看不到全局"]},
 {c:"ISFJ",n:"守卫者",a:"无声的奉献者",g:"SJ",up:["细心体贴，记得别人的需要","忠诚可靠，长期稳定","默默奉献，不争不抢","观察入微，照顾周到"],dn:["过度牺牲自己成全他人","难拒绝，边界弱","回避冲突，积压情绪","不善为自己的付出邀功"]},
 {c:"ESTJ",n:"总经理",a:"秩序的构建者",g:"SJ",up:["高效组织，能把事落地","务实果断，执行有力","责任心强，言出必行","规则清晰，公平持正"],dn:["控制欲强，容不下不同做法","缺乏变通，固执于流程","忽视情感，显得生硬","难接受非常规的新思路"]},
 {c:"ESFJ",n:"执政官",a:"关系的黏合剂",g:"SJ",up:["热心周到，让人舒服","善于协作，团队润滑剂","维系和谐，氛围担当","执行力强，说到做到"],dn:["过度在意他人评价","回避冲突，难讲真话","难拒绝，易被消耗","倾向从众，独立性弱"]},
 {c:"ISTP",n:"鉴赏家",a:"冷静的实战派",g:"SP",up:["冷静务实，临危不乱","动手力强，能解决实际问题","独立，不依赖他人","逻辑清晰，重实效"],dn:["情感疏离，关系浅层","缺乏长远规划","不爱承诺，显得不可靠","表达少，易被误会冷淡"]},
 {c:"ISFP",n:"探险家",a:"温柔的艺术家",g:"SP",up:["温和包容，与世无争","活在当下，感受力强","审美好，有艺术气质","随和不给人压力"],dn:["回避冲突，难表达需求","规划弱，随波逐流","被动，重大决定犹豫","情绪积压不外露"]},
 {c:"ESTP",n:"企业家",a:"行动派猛人",g:"SP",up:["行动迅速，说干就干","临场机敏，应变力强","现实敢闯，不怕试错","感染力强，带动气氛"],dn:["冲动冒险，忽视长远后果","缺乏耐心，难做长期规划","细节与复盘不足","易厌倦，热度退得快"]},
 {c:"ESFP",n:"表演者",a:"天生的舞台",g:"SP",up:["活泼感染，自带欢乐","享受当下，能量外放","人际热络，破冰快","应变灵活，临场发挥强"],dn:["缺乏规划，走一步看一步","易分心，难持续深耕","回避深层沉重问题","冲动消费与决定"]}
];
  // User-provided 16-type celebrity list: reference material, not confirmed test results.
  const celebrityReferences = {
    INTJ: { names: ['埃隆·马斯克', '尼采', '克里斯托弗·诺兰', '米歇尔·奥巴马'], prompt: '如果你也习惯先看长远，不妨把心中的蓝图拆成今天能走的一小步。' },
    INTP: { names: ['比尔·盖茨', '爱因斯坦', '牛顿', '笛卡尔'], prompt: '如果追问“为什么”让你着迷，给好奇心留些空间，也试着让一个想法落地。' },
    ENTJ: { names: ['史蒂夫·乔布斯', '戈登·拉姆齐', '撒切尔夫人', '富兰克林·罗斯福'], prompt: '如果你总想推动事情向前，试着带上身边人的声音，让目标成为一起走的方向。' },
    ENTP: { names: ['马克·吐温', '爱迪生', '汤姆·汉克斯', '萨莎·拜伦·科恩'], prompt: '如果新点子总让你兴奋，挑一个最想试的，让好奇心变成一次小小的行动。' },
    INFJ: { names: ['马丁·路德·金', '纳尔逊·曼德拉', '特蕾莎修女', 'Lady Gaga'], prompt: '如果你在意意义，也常体察他人的感受，照顾别人时，也给自己的需要留一个位置。' },
    INFP: { names: ['莎士比亚', 'J. R. R. 托尔金', '约翰尼·德普', '朱莉娅·罗伯茨'], prompt: '如果真诚与想象让你产生共鸣，试着用一段文字或一个小作品，表达你珍视的事。' },
    ENFJ: { names: ['贝拉克·奥巴马', '奥普拉·温弗瑞', '本·阿弗莱克', '詹妮弗·劳伦斯'], prompt: '如果陪伴他人成长让你有力量，也别忘了为自己保留休息和被支持的空间。' },
    ENFP: { names: ['罗宾·威廉姆斯', '威尔·史密斯', '小罗伯特·唐尼', '昆汀·塔伦蒂诺'], prompt: '如果新鲜的可能性让你眼睛发亮，选一件此刻最在意的事，把热情多留给它一点。' },
    ISTJ: { names: ['乔治·华盛顿', '安格拉·默克尔', '娜塔莉·波特曼', '安东尼·霍普金斯'], prompt: '如果踏实与守诺让你安心，请看见自己的可靠，也允许计划偶尔有一点弹性。' },
    ISFJ: { names: ['碧昂丝', '伊丽莎白二世', '安妮·海瑟薇', '凯特·米德尔顿'], prompt: '如果你常记得别人的需要，也试着说出自己的期待。温柔同样可以有清晰的边界。' },
    ESTJ: { names: ['Judy 法官', '约翰·洛克菲勒', '弗兰克·辛纳屈', '林登·约翰逊'], prompt: '如果把事情安排妥当让你有成就感，保留这份执行力，也给不同的做法一次机会。' },
    ESFJ: { names: ['泰勒·斯威夫特', '詹妮弗·洛佩兹', '比尔·克林顿', '史蒂夫·哈维'], prompt: '如果你珍惜人与人之间的温暖，在照顾关系的同时，也听一听自己真实的想法。' },
    ISTP: { names: ['迈克尔·乔丹', '克林特·伊斯特伍德', '汤姆·克鲁斯', '丹尼尔·克雷格'], prompt: '如果动手解决问题让你自在，就从一个小尝试开始，也让身边的人听见你的想法。' },
    ISFP: { names: ['迈克尔·杰克逊', '艾薇儿', '布兰妮·斯皮尔斯', 'Lana Del Rey'], prompt: '如果你容易被美好细节打动，可以把感受化成表达，也温柔而清楚地说出自己的需要。' },
    ESTP: { names: ['海明威', '麦当娜', '布鲁斯·威利斯', '艾迪·墨菲'], prompt: '如果行动与尝试让你充满活力，出发前多看一步，让勇气有一个稳稳的落点。' },
    ESFP: { names: ['玛丽莲·梦露', '阿黛尔', '埃尔顿·约翰', '杰米·福克斯'], prompt: '如果分享快乐让你自然发光，也为安静的自己留些时间，找到能长久滋养你的事。' }
  };
  const current = () => state.typeExplore || (state.typeExplore = { mode: 'self', group: 'all', filter: 'all' });
  const groups = { NT: '分析组', NF: '理想组', SJ: '守护组', SP: '探索组' };
  const button = (text, action, cls = 'primary', extra = '') => `<button class="${cls}" data-explore-action="${action}" ${extra}>${text}</button>`;
  globalThis.mbtiCelebrityCard = (code, compact = false) => {
    const reference = celebrityReferences[code];
    if (!reference) return '';
    return `<aside class="mbti-celebrity-card${compact ? ' compact' : ''}" data-celebrity-type="${code}" aria-label="${code} 名人"><ul class="mbti-celebrity-names" aria-label="${code} 名人参考">${reference.names.map(name => `<li>${esc(name)}</li>`).join('')}</ul><p class="mbti-celebrity-prompt">${esc(reference.prompt)}</p></aside>`;
  };
  globalThis.assessmentExploreTeaser = () => `<button class="assessment-explore-teaser" data-go="mbti-types"><span class="assessment-explore-copy"><small>不用先答题 · 先找一点共鸣</small><strong>这段描述，<br>像你，还是像 TA？</strong><span>MBTI 16 型优点与盲点，先逛一逛 ${icon('arrow')}</span></span><span class="assessment-type-art" aria-hidden="true"><b>ENFP</b><b>INTJ</b><b>INFP</b></span></button>`;
  globalThis.openMbtiType = code => {
    current().filter = T.some(type => type.c === code) ? code : 'all'; current().group = 'all'; go('mbti-types');
  };
  function pageContent() {
    const v = current(), visible = T.filter(type => (v.group === 'all' || type.g === v.group) && (v.filter === 'all' || type.c === v.filter));
    const url = new URL(location.href);
    if (v.filter === 'all') url.searchParams.delete('explore-type'); else url.searchParams.set('explore-type', v.filter);
    history.replaceState({}, '', url);
    return `<section class="type-explore-page">${head('MBTI 16 型优缺点', 'discover', '先看看')}<div class="type-explore-intro"><span class="tag">不用先答题</span><h2>从一段熟悉的描述，<br>认识自己，也理解别人。</h2><p>每种倾向都有两面。先找共鸣，再带着好奇去探索。</p></div><nav class="type-explore-modes" aria-label="探索视角">${button('先看看自己', 'mode', v.mode === 'self' ? 'selected' : '', 'data-mode="self"')}${button('也看看 TA', 'mode', v.mode === 'other' ? 'selected' : '', 'data-mode="other"')}</nav><p class="type-explore-guidance">${v.mode === 'self' ? '哪段描述让你觉得熟悉？可以先记住一个想多了解的类型。' : '把类型当作一个交流话题，也给真实的人留下不同的空间。'}</p><label class="type-explore-select">想先了解哪一型？<select data-explore-filter aria-label="选择 MBTI 类型"><option value="all">全部 16 型</option>${T.map(type => `<option value="${type.c}" ${v.filter === type.c ? 'selected' : ''}>${type.c} · ${type.n}</option>`).join('')}</select></label><nav class="type-explore-groups" aria-label="按类型分组">${button('全部', 'group', v.group === 'all' ? 'selected' : '', 'data-group="all"')}${Object.entries(groups).map(([code, name]) => button(`${name} ${code}`, 'group', v.group === code ? 'selected' : '', `data-group="${code}"`)).join('')}</nav><p class="type-explore-note">以下为提供资料中的通行解读，不等于你的测评结果。优点与盲点会随情境、经历和成长而变化，不用于心理诊断或给别人下定论。</p><p class="type-explore-count">当前展示 ${visible.length} 型</p><div class="type-explore-list">${visible.map(type => `<article class="type-explore-card" data-type="${type.c}"><header><div><h3>${type.c} <span>${type.n}</span></h3><p>${type.a}</p></div><span class="tag type-group-badge">${groups[type.g]} ${type.g}</span></header><section class="type-explore-up"><h4>自然发挥的优点</h4><ul>${type.up.map(text => `<li>${esc(text)}</li>`).join('')}</ul></section><section class="type-explore-down"><h4>需要留意的盲点</h4><ul>${type.dn.map(text => `<li>${esc(text)}</li>`).join('')}</ul></section><footer>${button('做 MBTI 性格测试', 'test', 'text-link')}${button('对照 VIA 优势', 'cross', 'text-link', `data-code="${type.c}"`)}</footer></article>`).join('')}</div><p class="type-explore-note">有共鸣，不代表被一种类型定义。你也可以通过自评，看看日常偏好和性格优势是否呼应。</p>${goButton('开始 MBTI 性格测试', 'intro')}${goButton('了解 VIA 性格优势', 'via-intro', 'secondary')}${goButton('返回自测首页', 'discover', 'secondary')}</section>`;
  }
  renderers['mbti-types'] = pageContent;
  pageMeta.push(['mbti-types', 'MBTI 16 型优缺点', '参考阅读', '从提供的 16 型资料中找共鸣，再进入 MBTI 或 VIA 的实际流程。', ['保留 16 型各四项优点与四项盲点，不当作测评结果。', '可切换看自己或看 TA，并带类型跳转 VIA 对照表。']]);
  reviewGroups.find(group => group.id === 'discover').pages.splice(1, 0, 'mbti-types');
  reviewLabels['mbti-types'] = 'MBTI 16 型优缺点';
  globalThis.typeExploreReviewState = () => {
    $('#scenarios').innerHTML = button('浏览全部 16 型', 'all', 'scenario') + goButton('MBTI 测评介绍', 'intro', 'scenario') + goButton('VIA 性格优势介绍', 'via-intro', 'scenario');
    return `参考内容：16 型优点与盲点\n视角：${current().mode === 'self' ? '看看自己' : '也看看 TA'}\n类型：${current().filter}\n分组：${current().group}\n浏览不会生成类型结论或测评完成记录\n测评入口：MBTI 40 题、VIA 72 题`;
  };
  globalThis.assessmentReviewState = () => {
    $('#scenarios').innerHTML = goButton('MBTI 测评介绍', 'intro', 'scenario') + goButton('VIA 性格优势介绍', 'via-intro', 'scenario') + goButton('16 型优缺点', 'mbti-types', 'scenario') + goButton('VIA × MBTI 对照', 'via-mbti', 'scenario');
    return `当前自测：MBTI 与 VIA 性格优势\nMBTI：${mbtiAnsweredCount()} / 40 题\nVIA：${viaAnsweredCount()} / 72 题\n已完成问卷：${assessmentResultCount()} 项\n参考阅读：16 型优缺点、VIA × MBTI 对照\n资料与样例不计作完成记录\n当前自测目录：9 个页面\n原型输入仅在当前页面内存中保留`;
  };
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-explore-action]'); if (!target) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const action = target.dataset.exploreAction;
    if (action === 'mode') { current().mode = target.dataset.mode; render({ keepScroll: true }); }
    else if (action === 'group') { current().group = target.dataset.group; current().filter = 'all'; render({ keepScroll: true }); }
    else if (action === 'all') { current().group = 'all'; current().filter = 'all'; render(); }
    else if (action === 'test') go('intro');
    else if (action === 'reports') { state.reportFilter = 'free'; go('reports'); }
    else if (action === 'type') openMbtiType(target.dataset.code);
    else if (action === 'cross') openViaComparison(target.dataset.code);
  }, true);
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-explore-filter]')) return;
    current().filter = event.target.value; current().group = 'all'; render({ keepScroll: true });
  });
  const requested = new URLSearchParams(location.search).get('explore-type');
  if (T.some(type => type.c === requested)) current().filter = requested;
  const style = document.createElement('style');
  style.textContent = `
:is(.mbti-report,.via-cross) .mbti-celebrity-card{background:#fff;border:1px solid var(--line);border-radius:17px;padding:21px 18px;margin:20px 0;color:var(--ink);min-width:0}:is(.mbti-report,.via-cross) .mbti-celebrity-card.compact{background:var(--canvas);padding:18px 14px;margin:19px 0 16px}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-names{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-names>li{min-width:0;display:flex;align-items:center;justify-content:center;text-align:center;min-height:49px;padding:10px 8px;margin:0;border:1px solid var(--line);border-radius:10px;background:#f4f6fc;font-size:12px;line-height:1.75;color:var(--ink);overflow-wrap:anywhere}:is(.mbti-report,.via-cross) .mbti-celebrity-card.compact .mbti-celebrity-names>li{background:#fff}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-prompt{font-size:12px;line-height:1.95;color:var(--muted);border-left:2px solid #d6ddf5;padding-left:11px;margin:17px 0 0}@media(max-width:350px){:is(.mbti-report,.via-cross) .mbti-celebrity-card{padding:19px 15px}:is(.mbti-report,.via-cross) .mbti-celebrity-card.compact{padding:16px 12px}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-names>li{font-size:11px;padding:9px 6px}}
.assessment-explore-teaser{width:100%;display:flex;align-items:center;justify-content:space-between;gap:15px;text-align:left;border:1px solid #e1e7f4;background:#edf1fb;border-radius:19px;padding:22px 20px;margin:22px 0 25px;overflow:hidden}.assessment-explore-copy{position:relative;z-index:1;min-width:0}.assessment-explore-copy>small{display:block;font-size:10px;line-height:1.8;color:#8e9bb6}.assessment-explore-copy>strong{display:block;font-size:23px;font-weight:550;color:#596d98;line-height:1.65;margin:10px 0 13px;letter-spacing:-.5px}.assessment-explore-copy>span{display:block;font-size:10px;line-height:1.9;color:#8495bb}.assessment-explore-copy .icon{display:inline-block;width:11px;height:11px;vertical-align:middle;margin-left:4px}.assessment-type-art{width:75px;min-width:59px;position:relative;height:114px;display:block;color:#9ca8d2}.assessment-type-art b{position:absolute;font-size:12px;letter-spacing:1px;line-height:1;background:#ffffff9c;border:1px solid #e0e6f8;border-radius:11px;padding:13px 10px;font-weight:500;box-shadow:0 8px 20px #96a4d00a}.assessment-type-art b:nth-child(1){top:0;right:-10px;transform:rotate(7deg)}.assessment-type-art b:nth-child(2){top:36px;right:13px;transform:rotate(-7deg);color:#87a4ac;background:#edf8f6}.assessment-type-art b:nth-child(3){bottom:0;right:-11px;transform:rotate(7deg);color:#b1a1ca;background:#f4f0fa}.type-explore-page .type-explore-intro{margin:18px 0 22px}.type-explore-page .type-explore-intro h2{font-size:25px;font-weight:550;line-height:1.7;letter-spacing:-.5px;margin:15px 0 11px}.type-explore-page .type-explore-intro>p{font-size:12px;line-height:1.9;color:#91a0b6}.type-explore-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:21px 0 12px}.type-explore-modes>button{padding:11px;border:1px solid var(--line);border-radius:10px;color:#96a1b7;background:white;font-size:12px}.type-explore-modes>button.selected{background:#eaf0fc;border-color:#c9d4ee;color:#6a7fb6}.type-explore-guidance,.type-explore-note{font-size:10px;color:#96a3b8;line-height:1.95;margin:13px 0 20px}.type-explore-select{font-size:11px;line-height:1.9;color:#8c99b2;display:block}.type-explore-select select{width:100%;display:block;min-height:42px;margin-top:8px;border:1px solid #e0e6f2;background:white;border-radius:10px;padding:9px 11px;color:#7588b1;font-size:12px}.type-explore-groups{display:flex;gap:5px;flex-wrap:wrap;margin:15px 0}.type-explore-groups button{font-size:10px;color:#9ba6ba;background:white;border:1px solid var(--line);border-radius:8px;padding:7px 8px;line-height:1.8}.type-explore-groups button.selected{color:#7184b7;background:#edf1fc;border-color:#d0d9ef}.type-explore-count{font-size:10px;color:#9aa7bb;margin:19px 0 11px}.type-explore-list{display:grid;gap:17px}.type-explore-card{padding:22px 18px;background:white;border:1px solid var(--line);border-radius:17px}.type-explore-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;padding-bottom:17px;border-bottom:1px solid var(--line)}.type-explore-card .type-group-badge{flex-shrink:0;white-space:nowrap;font-size:10px;line-height:1.8}.type-explore-card h3{font-size:23px;font-weight:550;letter-spacing:1px;color:#7488b9;line-height:1.5}.type-explore-card h3>span{font-size:13px;letter-spacing:0;color:#8290a9;margin-left:5px}.type-explore-card header p{font-size:10px;color:#9ca7bb;margin-top:7px;line-height:1.8}.type-explore-card h4{font-size:12px;font-weight:500;line-height:1.9;margin:18px 0 10px;color:#7d9f98}.type-explore-card .type-explore-down h4{color:#9a8cae}.type-explore-card ul{padding-left:16px;margin:0}.type-explore-card li{font-size:12px;line-height:1.95;color:#8694ab;padding-left:2px;margin-bottom:7px;overflow-wrap:anywhere}.type-explore-card .type-explore-up li::marker{color:#a2c3ba}.type-explore-card .type-explore-down li::marker{color:#b5a9c8}.type-explore-card footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:20px}.type-explore-card footer button{font-size:11px;line-height:1.8}.assessment-result-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:19px 0}.assessment-result-links>button{font-size:11px;line-height:1.8;padding:11px 7px;border:1px solid var(--line);border-radius:9px;background:white;color:#8797bb}.type-explore-page button:focus-visible,.type-explore-page select:focus-visible,.assessment-explore-teaser:focus-visible{outline:3px solid #a7b7e1;outline-offset:3px}@media(max-width:350px){.assessment-explore-teaser{padding:19px 16px;gap:8px}.assessment-explore-copy>strong{font-size:21px}.assessment-type-art{width:59px}.type-explore-page .type-explore-intro h2{font-size:23px}.type-explore-card{padding:20px 16px}.type-explore-card h3{font-size:21px}.type-explore-card h3>span{font-size:12px}}
`;
  document.head.append(style);
})();
