// Prototype: 16 型名人图鉴对照, editorial reference copy based on the original type list.
(() => {
const T=[
 {"c":"INTJ","n":"建筑师","a":"心里有蓝图的人","g":"NT","up":["长于规划","独立思考","目标专注","善于分析"],"dn":["在意不易说出口","信任建立需要时间","计划变动时需适应","热场时较费力"]},
 {"c":"INTP","n":"逻辑学家","a":"喜欢追问为什么的人","g":"NT","up":["善于追问","擅长拆解问题","愿意修正观点","思路独立"],"dn":["想法多时易延后行动","思考时容易忽略回应","想法落地需进一步尝试","易被重复事务消耗"]},
 {"c":"ENTJ","n":"指挥官","a":"愿意带大家向前的人","g":"NT","up":["善于组织","目标明确","敢于决策","擅长统筹"],"dn":["推进快时易漏听意见","易忽略同伴节奏","有时先解决、后倾听","容易承担过多"]},
 {"c":"ENTP","n":"辩论家","a":"总能想到另一种办法的人","g":"NT","up":["善于多角度思考","应变灵活","创意丰富","善于交流"],"dn":["新点子易打断收尾","讨论投入时易忽略感受","创新时易漏掉细节","兴趣起伏时难持续"]},
 {"c":"INFJ","n":"提倡者","a":"认真在意意义的人","g":"NF","up":["善于理解他人","重视意义","关系投入","言行一致"],"dn":["照顾他人后容易疲惫","理想与眼前易有落差","容易把感受藏太深","摩擦后表达需要时间"]},
 {"c":"INFP","n":"调停者","a":"珍惜内心真诚的人","g":"NF","up":["真诚坚定","想象丰富","善于倾听","尊重差异"],"dn":["避冲突时易忽略自己","感受多时易混淆事实","理想落地需要小步骤","现实落差时易自我否定"]},
 {"c":"ENFJ","n":"主人公","a":"愿意看见别人潜力的人","g":"NF","up":["善于凝聚共识","愿意支持他人","主动关心","擅长协调"],"dn":["替别人操心易耗尽精力","怕失望时难拒绝","他人评价容易影响自己","追求和睦时易藏分歧"]},
 {"c":"ENFP","n":"竞选者","a":"对可能保持热情的人","g":"NF","up":["热情有感染力","联想丰富","善于结识他人","乐于尝试"],"dn":["新鲜事多时易分心","容易拖到截止前","热情时容易答应过多","情绪中易仓促决定"]},
 {"c":"ISTJ","n":"物流师","a":"把答应的事放在心上的人","g":"SJ","up":["重视承诺","细致耐心","稳定投入","做事有条理"],"dn":["变化突来时需要适应","易依赖熟悉做法","在意不易说出口","易过度关注细节"]},
 {"c":"ISFJ","n":"守卫者","a":"把关心放进小事里的人","g":"SJ","up":["体贴周到","重视信任","主动补位","观察细致"],"dn":["容易忽略自己的需要","答应时易超出余力","不舒服时容易忍着","努力不易说出口"]},
 {"c":"ESTJ","n":"总经理","a":"让事情有条有理的人","g":"SJ","up":["组织有序","执行力强","愿意担责","规则清晰"],"dn":["易坚持熟悉的方法","流程受阻时调整较慢","表达直接时易忽略感受","新思路面前需更多耐心"]},
 {"c":"ESFJ","n":"执政官","a":"让人感到被惦记的人","g":"SJ","up":["主动关心","善于协作","重视关系","认真履约"],"dn":["容易受他人看法影响","维持和气时易延后沟通","照顾多人时易疲惫","不易说出不同感受"]},
 {"c":"ISTP","n":"鉴赏家","a":"喜欢亲手弄明白的人","g":"SP","up":["临场冷静","善于动手","独立探索","重视实效"],"dn":["心里在意但不常表达","长远安排需多留意","承诺前较为谨慎","独处时易少沟通"]},
 {"c":"ISFP","n":"探险家","a":"认真感受生活的人","g":"SP","up":["包容温和","感受细腻","审美敏锐","尊重自由"],"dn":["避冲突时易忽略需要","跟随感受时易少想未来","重要决定容易迟疑","感受不易说出口"]},
 {"c":"ESTP","n":"企业家","a":"愿意先去试试的人","g":"SP","up":["行动迅速","观察敏锐","敢于挑战","表达有活力"],"dn":["急行动时易忽略后果","远期目标容易模糊","收尾后易略过复盘","热情退后较难持续"]},
 {"c":"ESFP","n":"表演者","a":"愿意分享生活热度的人","g":"SP","up":["乐于分享","投入当下","善于连接他人","回应灵活"],"dn":["投入当下易少想以后","多种兴趣较难坚持","沉重话题较难开口","消费与答应时易冲动"]}
];
  // User-provided 16-type celebrity list: reference material, not confirmed test results.
  const celebrityReferences = {
    INTJ: { figure: {"name": "埃隆·马斯克", "portrait": "assets/type-portraits/INTJ.jpg", "author": "Gage Skidmore", "license": "CC BY-SA 4.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Elon_Musk_-_54820081119_(3x4_cropped,_Rule_of_thirds).jpg", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"}, names: ['埃隆·马斯克', '尼采', '克里斯托弗·诺兰', '米歇尔·奥巴马'], prompt: '如果你也习惯先看长远，不妨把心中的蓝图拆成今天能走的一小步。' },
    INTP: { figure: {"name": "爱因斯坦", "portrait": "assets/type-portraits/INTP.jpg", "author": "Oren Jack Turner", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Albert_Einstein_Head_cleaned.jpg", "licenseUrl": ""}, names: ['比尔·盖茨', '爱因斯坦', '牛顿', '笛卡尔'], prompt: '如果追问“为什么”让你着迷，给好奇心留些空间，也试着让一个想法落地。' },
    ENTJ: { figure: {"name": "史蒂夫·乔布斯", "portrait": "assets/type-portraits/ENTJ.jpg", "author": "Matthew Yohe", "license": "CC BY-SA 3.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Steve_Jobs_Headshot_2010_(cropped_6).jpg", "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"}, names: ['史蒂夫·乔布斯', '戈登·拉姆齐', '撒切尔夫人', '富兰克林·罗斯福'], prompt: '如果你总想推动事情向前，试着带上身边人的声音，让目标成为一起走的方向。' },
    ENTP: { figure: {"name": "马克·吐温", "portrait": "assets/type-portraits/ENTP.jpg", "author": "A.F. Bradley, New York", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Mark_Twain_by_AF_Bradley_(cropped_2).jpg", "licenseUrl": ""}, names: ['马克·吐温', '爱迪生', '汤姆·汉克斯', '萨莎·拜伦·科恩'], prompt: '如果新点子总让你兴奋，挑一个最想试的，让好奇心变成一次小小的行动。' },
    INFJ: { figure: {"name": "纳尔逊·曼德拉", "portrait": "assets/type-portraits/INFJ.jpg", "author": "Kingkongphoto & www.celebrity-photos.com from Laurel", "license": "CC BY-SA 2.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Nelson_Mandela_1994.jpg", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"}, names: ['马丁·路德·金', '纳尔逊·曼德拉', '特蕾莎修女', 'Lady Gaga'], prompt: '如果你在意意义，也常体察他人的感受，照顾别人时，也给自己的需要留一个位置。' },
    INFP: { figure: {"name": "莎士比亚", "portrait": "assets/type-portraits/INFP.jpg", "author": "Attributed to John Taylor", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:William_Shakespeare_by_John_Taylor,_edited.jpg", "licenseUrl": ""}, names: ['莎士比亚', 'J. R. R. 托尔金', '约翰尼·德普', '朱莉娅·罗伯茨'], prompt: '如果真诚与想象让你产生共鸣，试着用一段文字或一个小作品，表达你珍视的事。' },
    ENFJ: { figure: {"name": "贝拉克·奥巴马", "portrait": "assets/type-portraits/ENFJ.jpg", "author": "Official White House Photo by Pete Souza", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:President_Barack_Obama.jpg", "licenseUrl": ""}, names: ['贝拉克·奥巴马', '奥普拉·温弗瑞', '本·阿弗莱克', '詹妮弗·劳伦斯'], prompt: '如果陪伴他人成长让你有力量，也别忘了为自己保留休息和被支持的空间。' },
    ENFP: { figure: {"name": "罗宾·威廉姆斯", "portrait": "assets/type-portraits/ENFP.jpg", "author": "Kingkongphoto & www.celebrity-photos.com from Laurel, Maryland, USA", "license": "CC BY-SA 2.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Robin_Williams_1996_(cropped)_2.jpg", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"}, names: ['罗宾·威廉姆斯', '威尔·史密斯', '小罗伯特·唐尼', '昆汀·塔伦蒂诺'], prompt: '如果新鲜的可能性让你眼睛发亮，选一件此刻最在意的事，把热情多留给它一点。' },
    ISTJ: { figure: {"name": "安格拉·默克尔", "portrait": "assets/type-portraits/ISTJ.jpg", "author": "Raimond Spekking", "license": "CC BY-SA 4.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Angela_Merkel_2019_cropped.jpg", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"}, names: ['乔治·华盛顿', '安格拉·默克尔', '娜塔莉·波特曼', '安东尼·霍普金斯'], prompt: '如果踏实与守诺让你安心，请看见自己的可靠，也允许计划偶尔有一点弹性。' },
    ISFJ: { figure: {"name": "伊丽莎白二世", "portrait": "assets/type-portraits/ISFJ.jpg", "author": "Donald McKague", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Queen_Elizabeth_II_official_portrait_for_1959_tour_(retouched)_(cropped)_(3-to-4_aspect_ratio).jpg", "licenseUrl": ""}, names: ['碧昂丝', '伊丽莎白二世', '安妮·海瑟薇', '凯特·米德尔顿'], prompt: '如果你常记得别人的需要，也试着说出自己的期待。温柔同样可以有清晰的边界。' },
    ESTJ: { figure: {"name": "约翰·洛克菲勒", "portrait": "assets/type-portraits/ESTJ.jpg", "author": "Published by Scientific American Compiling Dep't, New York. 1907.", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Portrait_of_J._D._Rockefeller.jpg", "licenseUrl": ""}, names: ['Judy 法官', '约翰·洛克菲勒', '弗兰克·辛纳屈', '林登·约翰逊'], prompt: '如果把事情安排妥当让你有成就感，保留这份执行力，也给不同的做法一次机会。' },
    ESFJ: { figure: {"name": "泰勒·斯威夫特", "portrait": "assets/type-portraits/ESFJ.png", "author": "iHeartRadioCA", "license": "CC BY 3.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_(3).png", "licenseUrl": "https://creativecommons.org/licenses/by/3.0"}, names: ['泰勒·斯威夫特', '詹妮弗·洛佩兹', '比尔·克林顿', '史蒂夫·哈维'], prompt: '如果你珍惜人与人之间的温暖，在照顾关系的同时，也听一听自己真实的想法。' },
    ISTP: { figure: {"name": "迈克尔·乔丹", "portrait": "assets/type-portraits/ISTP.jpg", "author": "Zach Catanzareti Photo", "license": "CC BY 2.0", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Michael_jordan_admad_rashad_(51276390562)_(cropped).jpg", "licenseUrl": "https://creativecommons.org/licenses/by/2.0"}, names: ['迈克尔·乔丹', '克林特·伊斯特伍德', '汤姆·克鲁斯', '丹尼尔·克雷格'], prompt: '如果动手解决问题让你自在，就从一个小尝试开始，也让身边的人听见你的想法。' },
    ISFP: { figure: {"name": "迈克尔·杰克逊", "portrait": "assets/type-portraits/ISFP.jpg", "author": "Matthew Rolston; Distributed by Epic Records", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Michael_Jackson_1983_(3x4_cropped)_(contrast).jpg", "licenseUrl": ""}, names: ['迈克尔·杰克逊', '艾薇儿', '布兰妮·斯皮尔斯', 'Lana Del Rey'], prompt: '如果你容易被美好细节打动，可以把感受化成表达，也温柔而清楚地说出自己的需要。' },
    ESTP: { figure: {"name": "海明威", "portrait": "assets/type-portraits/ESTP.jpg", "author": "Lloyd Arnold", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:ErnestHemingway.jpg", "licenseUrl": ""}, names: ['海明威', '麦当娜', '布鲁斯·威利斯', '艾迪·墨菲'], prompt: '如果行动与尝试让你充满活力，出发前多看一步，让勇气有一个稳稳的落点。' },
    ESFP: { figure: {"name": "玛丽莲·梦露", "portrait": "assets/type-portraits/ESFP.jpg", "author": "Bert Parry", "license": "Public domain", "sourceUrl": "https://commons.wikimedia.org/wiki/File:Monroecirca1953.jpg", "licenseUrl": ""}, names: ['玛丽莲·梦露', '阿黛尔', '埃尔顿·约翰', '杰米·福克斯'], prompt: '如果分享快乐让你自然发光，也为安静的自己留些时间，找到能长久滋养你的事。' }
  };
  const current = () => state.typeExplore || (state.typeExplore = { group: 'all', filter: 'all' });
  const groups = { NT: '分析组', NF: '理想组', SJ: '守护组', SP: '探索组' };
  const button = (text, action, cls = 'primary', extra = '') => `<button class="${cls}" data-explore-action="${action}" ${extra}>${text}</button>`;
  globalThis.mbtiCelebrityCard = (code, compact = false) => {
    const reference = celebrityReferences[code];
    if (!reference) return '';
    return `<aside class="mbti-celebrity-card${compact ? ' compact' : ''}" data-celebrity-type="${code}" aria-label="${code} 名人"><ul class="mbti-celebrity-names" aria-label="${code} 名人参考">${reference.names.map(name => `<li>${esc(name)}</li>`).join('')}</ul><p class="mbti-celebrity-prompt">${esc(reference.prompt)}</p></aside>`;
  };
  globalThis.assessmentExploreTeaser = () => `<button class="assessment-explore-teaser" data-go="mbti-types"><span class="assessment-explore-copy"><small>无需答题</small><strong>你的偶像是哪一型？</strong><span>16 型名人图鉴，找找共鸣 ${icon('arrow')}</span></span><svg class="assessment-type-art" viewBox="0 0 120 110" aria-hidden="true"><use href="#art-types"/></svg></button>`;
  globalThis.openMbtiType = code => {
    current().filter = T.some(type => type.c === code) ? code : 'all'; current().group = 'all'; go('mbti-types');
  };
  const deckTypes = () => T.filter(type => current().group === 'all' || type.g === current().group);
  const selectedType = () => deckTypes().find(type => type.c === current().filter) || deckTypes()[0];
  const slotStyle = offset => `--shift:${offset * 66}%;--lift:${Math.abs(offset) * 9}px;--yaw:${offset * -12}deg;--roll:${offset * 2}deg;--scale:${1 - Math.min(Math.abs(offset), 3) * .095};z-index:${10 - Math.abs(offset)}`;
  function slot(index, selected, count) {
    let offset = (index - selected + count) % count;
    if (offset > count / 2) offset -= count;
    return offset;
  }
  function typeDetails(type) {
    return `<header class="type-detail-heading"><h3 id="type-detail-heading">${type.c} 优缺点</h3><span>${type.n}</span></header><div class="type-traits"><section class="type-traits-block type-traits-up" aria-labelledby="type-strengths-heading"><h4 id="type-strengths-heading">优点</h4><ul>${type.up.map(text => `<li><span class="type-trait-mark" aria-hidden="true"></span><p>${esc(text)}</p></li>`).join('')}</ul></section><section class="type-traits-block type-traits-down" aria-labelledby="type-blindspots-heading"><h4 id="type-blindspots-heading">缺点</h4><ul>${type.dn.map(text => `<li><span class="type-trait-mark" aria-hidden="true"></span><p>${esc(text)}</p></li>`).join('')}</ul></section></div>`;
  }
  function pageContent() {
    const v = current(), visible = deckTypes(), chosen = selectedType(), index = visible.indexOf(chosen);
    v.filter = chosen.c;
    const url = new URL(location.href); url.searchParams.set('explore-type', chosen.c); history.replaceState({}, '', url);
    return `<section class="type-explore-page">${head('16 型名人图鉴', 'discover', '参考阅读')}<div class="type-explore-heading"><h2>从名人认识 16 型</h2><p>左右滑动，查看人物与优缺点。</p></div>
      <nav class="type-explore-groups" aria-label="按类型分组">${button('全部 16 型', 'group', v.group === 'all' ? 'selected' : '', `data-group="all" aria-pressed="${v.group === 'all'}"`)}${Object.entries(groups).map(([code, name]) => button(name, 'group', v.group === code ? 'selected' : '', `data-group="${code}" aria-pressed="${v.group === code}"`)).join('')}</nav>
      <div class="type-deck" id="type-deck" role="region" aria-roledescription="卡片轮播" aria-label="MBTI 类型，左右滑动或使用下方按钮切换">${visible.map((type, i) => { const offset = slot(i, index, visible.length); return `<button type="button" class="type-deck-card type-family-${type.g}${offset === 0 ? ' is-selected' : ''}${Math.abs(offset) > 2 ? ' is-away' : ''}" data-explore-action="select" data-type-code="${type.c}" data-code="${type.c}" style="${slotStyle(offset)}" aria-pressed="${offset === 0}" aria-label="选择 ${type.c} ${type.n}" tabindex="${offset === 0 ? 0 : -1}" ${Math.abs(offset) > 2 ? 'aria-hidden="true" inert' : ''}><span class="type-card-group">${groups[type.g]} <span>${type.g}</span></span><strong class="type-card-code">${type.c}</strong><span class="type-card-name">${type.n}</span><img class="type-card-portrait" src="${celebrityReferences[type.c].figure.portrait}" alt="${esc(celebrityReferences[type.c].figure.name)}的肖像" width="130" height="142"><span class="type-card-alias">${esc(celebrityReferences[type.c].figure.name)}<small>人物联想</small></span><span class="type-card-selection"><svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>当前选择</span></button>`; }).join('')}</div>
      <div class="type-deck-controls">${button(icon('back'), 'previous', 'type-deck-arrow', 'aria-label="上一个类型" aria-controls="type-deck"')}<p id="type-deck-status" role="status" aria-live="polite" aria-atomic="true"><strong>${chosen.c} · ${chosen.n}</strong><span>${String(index + 1).padStart(2, '0')} / ${visible.length} · 左右滑动切换</span></p>${button(icon('next'), 'next', 'type-deck-arrow', 'aria-label="下一个类型" aria-controls="type-deck"')}</div>
      <details class="type-quick-index"><summary>按四字母类型查找 ${icon('cards')}</summary><div>${T.map(type => button(type.c, 'select', type.c === chosen.c ? 'selected' : '', `data-code="${type.c}" aria-pressed="${type.c === chosen.c}"`)).join('')}</div></details>
      <section id="type-detail" class="type-detail type-family-${chosen.g}" aria-labelledby="type-detail-heading">${typeDetails(chosen)}</section>
      <p class="type-explore-guidance">想了解自己的类型？试试 MBTI 自评。</p><div class="type-explore-actions">${button('开始 MBTI 自评', 'test')}${button('对照 ' + chosen.c + ' 的 VIA 优势', 'cross', 'secondary', `id="type-cross-link" data-code="${chosen.c}"`)}</div><p class="type-explore-note">类型与人物仅作参考，非本人测评结果。</p><details class="type-photo-source"><summary>肖像来源</summary>${Object.entries(celebrityReferences).map(([code, ref]) => `<p><a href="${ref.figure.sourceUrl}" target="_blank" rel="noopener noreferrer">${code} ${esc(ref.figure.name)}</a> · ${esc(ref.figure.author)} · ${ref.figure.licenseUrl ? `<a href="${ref.figure.licenseUrl}" target="_blank" rel="noopener noreferrer">${esc(ref.figure.license)}</a>` : esc(ref.figure.license)} · 原图未改动，按展示框裁切</p>`).join('')}</details></section>`;
  }
  function selectType(code, focus = false) {
    const type = T.find(item => item.c === code); if (!type) return;
    if (!deckTypes().includes(type)) { current().group = 'all'; current().filter = code; render({ keepScroll: true }); return; }
    current().filter = code;
    const visible = deckTypes(), index = visible.indexOf(type);
    document.querySelectorAll('[data-type-code]').forEach((card, i) => {
      const offset = slot(i, index, visible.length), away = Math.abs(offset) > 2;
      card.style.cssText = slotStyle(offset);
      card.classList.toggle('is-selected', offset === 0); card.classList.toggle('is-away', away);
      card.setAttribute('aria-pressed', String(offset === 0)); card.tabIndex = offset === 0 ? 0 : -1;
      card.toggleAttribute('inert', away); if (away) card.setAttribute('aria-hidden', 'true'); else card.removeAttribute('aria-hidden');
      if (offset === 0 && focus) card.focus({ preventScroll: true });
    });
    $('#type-deck-status').innerHTML = `<strong>${type.c} · ${type.n}</strong><span>${String(index + 1).padStart(2, '0')} / ${visible.length} · 左右滑动切换</span>`;
    const detail = $('#type-detail'); detail.className = `type-detail type-family-${type.g}`; detail.innerHTML = typeDetails(type);
    const cross = $('#type-cross-link'); cross.dataset.code = code; cross.textContent = `对照 ${code} 的 VIA 优势`;
    document.querySelectorAll('.type-quick-index button').forEach(button => { const active = button.dataset.code === code; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    const url = new URL(location.href); url.searchParams.set('explore-type', code); history.replaceState(history.state, '', url);
    $('#state-panel').textContent = typeExploreReviewState();
  }
  function moveType(direction, focus = false) {
    const visible = deckTypes(), index = visible.indexOf(selectedType());
    selectType(visible[(index + direction + visible.length) % visible.length].c, focus);
  }
  renderers['mbti-types'] = pageContent;
  pageMeta.push(['mbti-types', '16 型名人图鉴', '参考阅读', '从提供的 16 型资料中找共鸣，再进入 MBTI 或 VIA 的实际流程。', ['保留 16 型各四项优点与四项盲点，不当作测评结果。', '可左右滑动切换类型，优点与盲点同卡展示。']]);
  reviewGroups.find(group => group.id === 'discover').pages.splice(1, 0, 'mbti-types');
  reviewLabels['mbti-types'] = '16 型名人图鉴';
  globalThis.typeExploreReviewState = () => {
    $('#scenarios').innerHTML = button('浏览全部 16 型', 'all', 'scenario') + goButton('MBTI 测评介绍', 'intro', 'scenario') + goButton('VIA 性格优势介绍', 'via-intro', 'scenario');
    return `参考内容：16 型优点与盲点\n类型：${current().filter}\n分组：${current().group}\n浏览不会生成类型结论或测评完成记录\n测评入口：MBTI 40 题、VIA 72 题`;
  };
  globalThis.assessmentReviewState = () => {
    $('#scenarios').innerHTML = goButton('MBTI 测评介绍', 'intro', 'scenario') + goButton('VIA 性格优势介绍', 'via-intro', 'scenario') + goButton('16 型名人图鉴', 'mbti-types', 'scenario') + goButton('VIA × MBTI 对照', 'via-mbti', 'scenario');
    return `当前自测：MBTI 与 VIA 性格优势\nMBTI：${mbtiAnsweredCount()} / 40 题\nVIA：${viaAnsweredCount()} / 72 题\n已完成问卷：${assessmentResultCount()} 项\n参考阅读：16 型名人图鉴、VIA × MBTI 对照\n资料与样例不计作完成记录\n当前自测目录：9 个页面\n原型输入仅在当前页面内存中保留`;
  };
  let gesture = null, suppressClickUntil = 0;
  document.addEventListener('pointerdown', event => {
    const deck = event.target.closest('.type-deck');
    if (!deck || page !== 'mbti-types' || !event.isPrimary || event.button !== 0) return;
    gesture = { deck, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, start: performance.now(), horizontal: false, vertical: false };
  });
  document.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId || !gesture.deck.isConnected) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.horizontal && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) gesture.vertical = true;
    if (gesture.vertical) return;
    if (!gesture.horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      gesture.horizontal = true; gesture.deck.setPointerCapture(event.pointerId); gesture.deck.classList.add('is-dragging');
    }
    if (!gesture.horizontal) return;
    event.preventDefault(); gesture.dx = dx;
    gesture.deck.style.setProperty('--drag', `${Math.max(-160, Math.min(160, dx))}px`);
  }, { passive: false });
  function finishGesture(event, cancelled = false) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const g = gesture; gesture = null;
    g.deck.classList.remove('is-dragging'); g.deck.style.removeProperty('--drag');
    if (g.deck.hasPointerCapture(event.pointerId)) g.deck.releasePointerCapture(event.pointerId);
    if (g.horizontal || g.vertical) suppressClickUntil = performance.now() + 300;
    if (cancelled || !g.horizontal || !g.deck.isConnected || page !== 'mbti-types') return;
    const velocity = Math.abs(g.dx) / Math.max(1, performance.now() - g.start);
    if (Math.abs(g.dx) >= 45 || (Math.abs(g.dx) > 22 && velocity > .5)) moveType(g.dx < 0 ? 1 : -1);
  }
  document.addEventListener('pointerup', event => finishGesture(event));
  document.addEventListener('pointercancel', event => finishGesture(event, true));
  document.addEventListener('keydown', event => {
    if (page !== 'mbti-types' || !event.target.closest('.type-explore-page') || event.target.matches('input,textarea,select,[contenteditable]')) return;
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const focus = !!event.target.closest('[data-type-code]');
    if (event.key === 'Home' || event.key === 'End') { const list = deckTypes(); selectType(list[event.key === 'Home' ? 0 : list.length - 1].c, focus); }
    else moveType(event.key === 'ArrowRight' ? 1 : -1, focus);
  }, true);
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-explore-action]'); if (!target) return;
    if (target.closest('.type-deck') && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    event.preventDefault(); event.stopImmediatePropagation();
    const action = target.dataset.exploreAction;
    if (action === 'select') {
      const fromIndex = !!target.closest('.type-quick-index');
      selectType(target.dataset.code);
      if (fromIndex) {
        $('.type-quick-index').open = false;
        $('#type-deck').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
    else if (action === 'previous' || action === 'next') moveType(action === 'next' ? 1 : -1);
    else if (action === 'group') { current().group = target.dataset.group; current().filter = selectedType().c; render({ keepScroll: true }); }
    else if (action === 'all') { current().group = 'all'; current().filter = 'all'; render(); }
    else if (action === 'test') { state.tool = 'mbti'; go('intro'); }
    else if (action === 'reports') { state.reportFilter = 'free'; go('reports'); }
    else if (action === 'type') openMbtiType(target.dataset.code);
    else if (action === 'cross') openViaComparison(target.dataset.code);
  }, true);
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-explore-filter]')) return;
    current().group = 'all'; selectType(event.target.value);
  });
  const requested = new URLSearchParams(location.search).get('explore-type');
  if (T.some(type => type.c === requested)) current().filter = requested;
  const style = document.createElement('style');
  style.textContent = `
:is(.mbti-report,.via-cross) .mbti-celebrity-card{background:#fff;border:1px solid var(--line);border-radius:17px;padding:21px 18px;margin:20px 0;color:var(--ink);min-width:0}:is(.mbti-report,.via-cross) .mbti-celebrity-card.compact{background:var(--canvas);padding:18px 14px;margin:19px 0 16px}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-names{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-names>li{min-width:0;display:flex;align-items:center;justify-content:center;text-align:center;min-height:49px;padding:10px 8px;margin:0;border:1px solid var(--line);border-radius:10px;background:#f4f6fc;font-size:12px;line-height:1.75;color:var(--ink);overflow-wrap:anywhere}:is(.mbti-report,.via-cross) .mbti-celebrity-card.compact .mbti-celebrity-names>li{background:#fff}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-prompt{font-size:12px;line-height:1.95;color:var(--muted);border-left:2px solid #d6ddf5;padding-left:11px;margin:17px 0 0}@media(max-width:350px){:is(.mbti-report,.via-cross) .mbti-celebrity-card{padding:19px 15px}:is(.mbti-report,.via-cross) .mbti-celebrity-card.compact{padding:16px 12px}:is(.mbti-report,.via-cross) .mbti-celebrity-card .mbti-celebrity-names>li{font-size:11px;padding:9px 6px}}
.assessment-explore-teaser{width:100%;display:flex;align-items:center;justify-content:space-between;gap:15px;text-align:left;border:1px solid #e1e7f4;background:#edf1fb;border-radius:19px;padding:22px 20px;margin:22px 0 25px;overflow:hidden}.assessment-explore-copy{position:relative;z-index:1;min-width:0}.assessment-explore-copy>small{display:block;font-size:10px;line-height:1.8;color:#8e9bb6}.assessment-explore-copy>strong{display:block;font-size:23px;font-weight:550;color:#596d98;line-height:1.65;margin:10px 0 13px;letter-spacing:-.5px}.assessment-explore-copy>span{display:block;font-size:10px;line-height:1.9;color:#8495bb}.assessment-explore-copy .icon{display:inline-block;width:11px;height:11px;vertical-align:middle;margin-left:4px}.assessment-type-art{width:75px;min-width:59px;position:relative;height:114px;display:block;color:#9ca8d2}.assessment-type-art b{position:absolute;font-size:12px;letter-spacing:1px;line-height:1;background:#ffffff9c;border:1px solid #e0e6f8;border-radius:11px;padding:13px 10px;font-weight:500;box-shadow:0 8px 20px #96a4d00a}.assessment-type-art b:nth-child(1){top:0;right:-10px;transform:rotate(7deg)}.assessment-type-art b:nth-child(2){top:36px;right:13px;transform:rotate(-7deg);color:#87a4ac;background:#edf8f6}.assessment-type-art b:nth-child(3){bottom:0;right:-11px;transform:rotate(7deg);color:#b1a1ca;background:#f4f0fa}.type-explore-page .type-explore-intro{margin:18px 0 22px}.type-explore-page .type-explore-intro h2{font-size:25px;font-weight:550;line-height:1.7;letter-spacing:-.5px;margin:15px 0 11px}.type-explore-page .type-explore-intro>p{font-size:12px;line-height:1.9;color:#91a0b6}.type-explore-guidance,.type-explore-note{font-size:10px;color:#96a3b8;line-height:1.95;margin:13px 0 20px}.type-explore-select{font-size:11px;line-height:1.9;color:#8c99b2;display:block}.type-explore-select select{width:100%;display:block;min-height:42px;margin-top:8px;border:1px solid #e0e6f2;background:white;border-radius:10px;padding:9px 11px;color:#7588b1;font-size:12px}.type-explore-groups{display:flex;gap:5px;flex-wrap:wrap;margin:15px 0}.type-explore-groups button{font-size:10px;color:#9ba6ba;background:white;border:1px solid var(--line);border-radius:8px;padding:7px 8px;line-height:1.8}.type-explore-groups button.selected{color:#7184b7;background:#edf1fc;border-color:#d0d9ef}.type-explore-count{font-size:10px;color:#9aa7bb;margin:19px 0 11px}.type-explore-list{display:grid;gap:17px}.type-explore-card{padding:22px 18px;background:white;border:1px solid var(--line);border-radius:17px}.type-explore-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;padding-bottom:17px;border-bottom:1px solid var(--line)}.type-explore-card .type-group-badge{flex-shrink:0;white-space:nowrap;font-size:10px;line-height:1.8}.type-explore-card h3{font-size:23px;font-weight:550;letter-spacing:1px;color:#7488b9;line-height:1.5}.type-explore-card h3>span{font-size:13px;letter-spacing:0;color:#8290a9;margin-left:5px}.type-explore-card header p{font-size:10px;color:#9ca7bb;margin-top:7px;line-height:1.8}.type-explore-card h4{font-size:12px;font-weight:500;line-height:1.9;margin:18px 0 10px;color:#7d9f98}.type-explore-card .type-explore-down h4{color:#9a8cae}.type-explore-card ul{padding-left:16px;margin:0}.type-explore-card li{font-size:12px;line-height:1.95;color:#8694ab;padding-left:2px;margin-bottom:7px;overflow-wrap:anywhere}.type-explore-card .type-explore-up li::marker{color:#a2c3ba}.type-explore-card .type-explore-down li::marker{color:#b5a9c8}.type-explore-card footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:16px;margin-top:20px}.type-explore-card footer button{font-size:11px;line-height:1.8}.assessment-result-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:19px 0}.assessment-result-links>button{font-size:11px;line-height:1.8;padding:11px 7px;border:1px solid var(--line);border-radius:9px;background:white;color:#8797bb}.type-explore-page button:focus-visible,.type-explore-page select:focus-visible,.assessment-explore-teaser:focus-visible{outline:3px solid #a7b7e1;outline-offset:3px}@media(max-width:350px){.assessment-explore-teaser{padding:19px 16px;gap:8px}.assessment-explore-copy>strong{font-size:21px}.assessment-type-art{width:59px}.type-explore-page .type-explore-intro h2{font-size:23px}.type-explore-card{padding:20px 16px}.type-explore-card h3{font-size:21px}.type-explore-card h3>span{font-size:12px}}
`;
  document.head.append(style);
})();
