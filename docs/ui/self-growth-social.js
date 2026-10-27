/* Local UI prototype: curiosity -> public evidence -> self-assessment -> optional poster -> direct entry.
   No live celebrity typing, voting totals, real sharing, or WeChat code issuance is simulated as production. */
const CLASSIC_TRAIT_ITEMS = [
  {number:1,zh:'我是聚会中活跃气氛的人。',original:'Am the life of the party.'},
  {number:2,zh:'我不太关心他人。',original:'Feel little concern for others.'},
  {number:3,zh:'我做事总是提前准备好。',original:'Am always prepared.'},
  {number:4,zh:'我很容易感到压力。',original:'Get stressed out easily.'},
  {number:15,zh:'我的想象力很丰富。',original:'Have a vivid imagination.'},
  {number:6,zh:'我平时不太爱说话。',original:"Don't talk a lot."}
];
const CLASSIC_SOURCE='https://www.ipip.ori.org/New_IPIP-50-item-scale.htm';
const MUSK_SOURCE='https://www.tesla.com/secret-master-plan';
function socialDefaults(){
  const p=new URLSearchParams(location.search);
  const incoming={entry:['mbti','traits','strengths','voices'].includes(p.get('entry'))?p.get('entry'):'mbti',campaign:['personal-v1','voices-v1'].includes(p.get('campaign'))?p.get('campaign'):'musk-v1',kind:['challenge','result','strength','comfort'].includes(p.get('kind'))?p.get('kind'):'challenge',voice:['jobs','federer','bezos'].includes(p.get('voice'))?p.get('voice'):'jobs',pick:['INFP','INTJ','ENTP','uncertain'].includes(p.get('pick'))?p.get('pick'):null};
  return {voiceId:incoming.voice,voiceMood:'全部',voiceNotes:{jobs:'',federer:'',bezos:''},savedVoices:[],voiceDecision:'',autoNext:true,experienceMode:'guided',experienceIndex:0,experiencePrompt:'协作顺利的一次',socialVote:null,posterKind:p.get('screen')==='share'?incoming.kind:'challenge',posterName:'探索中的我',shareEntry:p.get('screen')==='share'?incoming.entry:'mbti',incoming,...(p.get('screen')==='invite'?{results:{},answers:{mbti:[],traits:[],strengths:[]}}:{})};
}
function rocketArt(cls=''){
  return `<svg class="rocket-art ${cls}" viewBox="0 0 160 160" aria-hidden="true"><ellipse cx="78" cy="135" rx="51" ry="7" fill="#c9d6ed" opacity=".4"/><circle cx="82" cy="77" r="54" fill="#edf1ff"/><path d="M70 110 56 125l-2-25M102 85l18 4-13 18" fill="#a2b9e8"/><path d="M63 108c2-34 23-64 61-73-2 37-24 65-49 79Z" fill="white" stroke="#a9bde7" stroke-width="2"/><circle cx="99" cy="62" r="10" fill="#c2d8f3"/><path d="m67 110-11 19 20-13" fill="#d8b2d4"/><path d="m43 47 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm82 61 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#b7a3d6"/><circle cx="37" cy="90" r="3" fill="#aed6d1"/><circle cx="115" cy="23" r="3" fill="#d8b2d4"/></svg>`;
}
function topicTeaser(){
  return `<button class="topic-teaser" data-go="celebrity"><span class="topic-teaser-copy"><span class="tag white">名人观察 · 先凭直觉猜一猜</span><strong>马斯克更像<br>INFP，还是 INTJ？</strong><span>看公开言行线索，也认识自己的偏好 ${icon('arrow')}</span></span>${rocketArt()}</button>`;
}
function celebrityGuess(){
  return `${head('名人观察','discover','公开资料')}<div class="celebrity-cover"><span class="tag white">从一个熟悉的人，打开一个新话题</span><h2>马斯克更像<br>哪一种偏好？</h2><p>先凭直觉选一个。<br>再看看，公开资料能告诉我们什么。</p>${rocketArt()}</div><p class="tiny" style="margin:15px 0 12px">类型是讨论假设，非本人测评结果。</p><div class="celebrity-options">${[['INFP','更在意愿景与个人价值'],['INTJ','更重视长期构想与系统规划'],['ENTP','喜欢探索可能性与挑战既有做法'],['uncertain','公开表现还不足以判断']].map(([id,t])=>`<button class="guess-option ${state.socialVote===id?'selected':''}" data-guess="${id}"><span class="guess-key">${id==='uncertain'?'？':id}</span><span>${t}</span><span class="chevron">${icon('next')}</span></button>`).join('')}</div><p class="footer-note">四字母类型不等于一个人的全部。<br>你的选择将用于本次讨论，不计入你的测评分数。</p>${goButton('我想先测测自己','intro','secondary')}`;
}
function celebrityInsight(){
  const vote=state.socialVote||state.incoming.pick;
  return `${head('把猜想放回线索里','celebrity','名人观察')}<span class="tag aqua">${vote?`你的猜想：${vote==='uncertain'?'还不能确定':vote}`:'先看看公开材料'}</span><h2 class="portrait-title">愿景、计划与行动，<br>你看到了哪一面？</h2><p class="small">我们从一篇马斯克署名的公开文章出发，讨论他的工作表达方式。</p><section class="card" style="margin-top:20px"><div class="between"><h3 class="title-sm">一条可以核对的线索</h3><span class="tag gray">公开事实</span></div><p class="small" style="margin-top:12px">在 2006 年的特斯拉总体规划中，他描述了从高价跑车出发、再逐步支持更可负担车型的分阶段路径，并把它放在长期能源目标中。</p><button class="source-pill" data-action="musk-source">${icon('cards')}Tesla 署名文章 · 2006.08.02 ${icon('next')}</button></section><section class="card"><h3 class="title-sm">这条线索，可以怎么理解？</h3><div class="observation-row"><span class="tag">一种解读</span><p>他会把长远设想与具体步骤放在一起表达。</p></div><div class="observation-row"><span class="tag pink">仍有其他解释</span><p>公开的商业规划也受工作角色、团队与传播场景影响，不能直接换算成他的 MBTI 类型。</p></div><p class="tiny" style="margin-top:13px">公开表达呈现了一个工作场景，也给不同解释留出空间。</p></section><section class="self-bridge"><span class="feature-icon aqua">${icon('leaf')}</span><h3>把这个问题，带回自己。</h3><p>你做决定时，更在意什么？<br>从自己的真实选择里找线索。</p><button class="primary" data-action="start-own-preferences">免费看看我的性格偏好</button><button class="quiet-button" data-action="start-classic-traits">也可以先体验经典性格题</button></section><button class="secondary" data-action="topic-share">生成一张“你会怎么选”海报</button><p class="footer-note">朋友点开后先看到这个话题，也能直接开始自测。<br>基础结果直接免费查看，分享由你决定。</p>`;
}
function renderAssessmentQuestion(){
  const i=state.index,total=questions[state.tool].length,isClassic=state.tool==='traits';
  const labels=isClassic?['非常不符合','比较不符合','说不清／居中','比较符合','非常符合']:['很不同意','不太同意','说不清／居中','比较同意','很同意'];
  return `${head(tools[state.tool].short,'discover',isClassic?'经典条目':'演示题')}<div class="between"><span class="tiny">${isClassic?'IPIP-50 条目体验':'按最近一段时间的自己来选'}</span><span class="tag gray">${i+1} / ${total}</span></div><div class="progress" style="margin-top:12px"><span style="width:${i/total*100}%"></span></div><p class="question-meta">不必选更理想的自己，选更接近真实的那个。</p><h2 class="question-title quick-question-title">${esc(questions[state.tool][i])}</h2><div class="tap-answers" role="group" aria-label="${isClassic?'与自己的符合程度':'认同程度'}">${labels.map((text,index)=>`<button class="tap-answer ${state.selected===index+1?'selected':''}" data-answer="${index+1}" aria-label="${index+1}分，${text}" aria-pressed="${state.selected===index+1}"><span class="tap-answer-key">${index+1}</span><span>${text}</span><span class="answer-check">${state.selected===index+1?'✓':''}</span></button>`).join('')}</div>${state.saveError?'<div class="notice error">刚才的答案已保留，保存失败。可以重试，不用重新选择。</div>'+primary('重试保存并继续','retry-answer'):!state.autoNext?`<div style="margin-top:16px">${primary(i===total-1?'保存并查看结果':'保存并继续','save-answer',state.selected===null)}</div>`:'<p class="auto-next-hint">点选后自动保存，进入下一题</p>'}<div class="question-toolbar"><button data-action="previous-question" ${i===0?'disabled':''}>上一题，修改答案</button><button data-action="pause-test">先暂停，稍后继续</button></div><label class="check-row auto-next-control"><input type="checkbox" id="auto-next" ${state.autoNext?'checked':''}><span>选择后自动下一题</span></label>${isClassic?'<button class="source-pill" data-action="classic-source">'+icon('test')+'经典题目从哪里来？'+icon('next')+'</button><p class="footer-note">本轮选取 6 道经典条目做中文交互演示。<br>完整版与中文适配需按正式测评版本确认。</p>':'<p class="footer-note">这是 6 道交互演示题。<br>正式题目采用确认后的测评工具版本。</p>'}`;
}
function guidedExperienceCard(e,i){
  return `<section class="experience-card"><div class="between"><div class="row"><span class="experience-index">${i+1}</span><h3 class="title-sm">${i===0?'一件你做得不错的事':'另一个不同的片段'}</h3></div><span class="tag gray">本人陈述</span></div><p class="tiny" style="margin-top:9px">先写三句短话，不用写成长文章。</p>${field(`experiences.${i}.event`,'当时发生了什么？','例如：大家对同一项任务理解不一致。',e.event)}${field(`experiences.${i}.action`,'你具体做了什么？','一句话写自己的行动就可以。',e.action)}${field(`experiences.${i}.result`,'后来怎么样了？','写下一个看得到的变化或结果。',e.result)}<details class="energy-details" ${e.energy?'open':''}><summary>再记一点能量感受 · 选填</summary><div class="chips">${['很投入','有成就感','有点费力','经常被打断'].map(t=>`<button class="chip ${e.energy.split('；').includes(t)?'selected':''}" data-energy="${t}" data-exp-index="${i}">${t}</button>`).join('')}</div>${field(`experiences.${i}.energy`,'哪些部分让你有能量，哪些比较费力？','也可以点上面的词，再补充一句。',e.energy)}</details></section>`;
}
function renderGuidedExperiences(){
  const guided=state.experienceMode==='guided',i=state.experienceIndex;
  return `${head('把优势放回真实经历','portrait')}<h2 class="page-title">从一件小事说起，<br>就已经很好。</h2><p class="lead">不是简历，也不需要漂亮的成就。<br>回想一次你帮到了人、学会了什么或把事情理清的片段。</p><div class="experience-view-tabs"><button data-exp-mode="guided" class="${guided?'selected':''}">一次写一段</button><button data-exp-mode="all" class="${!guided?'selected':''}">一起编辑</button></div>${guided?`<div class="experience-stepper">${[0,1].map(n=>`<button data-exp-step="${n}" class="${i===n?'selected':''}"><span>${n+1}</span>第 ${n+1} 段经历</button>`).join('')}</div><div class="chips prompt-chips">${['协作顺利的一次','帮到别人的一刻','学会一件新事'].map(t=>`<button class="chip ${state.experiencePrompt===t?'selected':''}" data-exp-prompt="${t}">${t}</button>`).join('')}</div><p class="tiny" style="margin-top:10px">${state.experiencePrompt==='协作顺利的一次'?'想一想：有哪次事情经过你的参与，变得更清楚或更顺利？':state.experiencePrompt==='帮到别人的一刻'?'想一想：有谁因为你的帮助，更明白了一件事或少走了一点弯路？':'想一想：你最近学会了什么，又把它用在了哪里？'}</p>${guidedExperienceCard(state.experiences[i],i)}`:state.experiences.map(guidedExperienceCard).join('')}${!guided||i===1?'<div class="field-label">现在，你最想用在哪些地方？</div><div class="chips">'+['沟通','协作','工作安排','学习'].map(g=>`<button class="chip ${state.goals.includes(g)?'selected':''}" data-goal="${g}">${g}</button>`).join('')+'</div>':''}${state.formError?`<div class="notice error">${esc(state.formError)}</div>`:''}<div style="margin-top:23px">${guided&&i===0?primary('这段先写到这里，下一段','next-experience'):primary('整理经历，下一步确认','prepare-experiences')}</div>${guided&&i===1?'<button class="quiet-button" data-exp-step="0">返回看看第一段</button>':''}<button class="quiet-button" data-action="fill-examples">先用示例经历体验一下</button>`;
}
function codePlaceholder(){return `<svg class="code-placeholder" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="32" fill="none" stroke="#d6ddef" stroke-width="2" stroke-dasharray="2 7"/><rect x="20" y="20" width="36" height="36" rx="12" fill="#e8edfb"/><text x="38" y="44" text-anchor="middle" fill="#6577dc" font-size="19" font-family="sans-serif">清</text></svg>`}
function posterContent(){
  if(state.posterKind==='comfort'){const v=currentVoice();return {eyebrow:'把一点温柔，送给此刻的你',title:v.posterTitle,description:'“'+v.quote+'” —— '+v.name+'（'+v.quoteLabel+'）',tags:['给自己留一小步'],cta:'读读这段故事，借一点力量',footer:v.name+' · '+v.sourceLabel+' · '+v.quoteLabel};}
  if(state.posterKind==='challenge')return {eyebrow:'名人观察 · 邀你猜一猜',title:'马斯克更像\nINFP，还是 INTJ？',description:state.socialVote?`我选了${state.socialVote==='uncertain'?'“还不能确定”':state.socialVote}。你会怎么选？`:'先凭直觉选一个，再看看公开资料线索。',tags:['公开言行讨论','类型为推测'],cta:'来选一个，也测测自己',footer:'公开资料观察 · 类型为讨论假设'};
  if(state.posterKind==='result')return {eyebrow:'认识自己的一个小发现',title:state.share.type&&state.results.mbti?typeCode()+'\n按自己的节奏表达。':'遇见，\n更好的你自己。',description:'我开始留意，哪些选择让我有能量，哪些方式更适合自己。',tags:state.share.strength?['理解他人','梳理信息','持续学习']:[],cta:'也来免费认识自己',footer:'原型结果样例 · 不定义能力与职业'};
  return {eyebrow:'我的优势，我想这样用',title:'把复杂的事，\n慢慢理清楚。',description:'先看见自己的优势，再把一个小练习带回真实生活。',tags:state.share.strength?['一次具体经历','一个可以尝试的行动']:[],cta:'发现你值得发展的优势',footer:'原型优势样例 · 从真实经历找依据'};
}
function shareLandingConfig(){return {entry:state.shareEntry,campaign:state.posterKind==='comfort'?'voices-v1':state.posterKind==='challenge'?'musk-v1':'personal-v1',voice:state.voiceId,kind:state.posterKind,pick:state.posterKind==='challenge'?state.socialVote:null}}
function shareLandingUrl(){const c=shareLandingConfig();const u=new URL('self-growth-prototype.html',location.href);u.searchParams.set('screen','invite');u.searchParams.set('entry',c.entry);u.searchParams.set('campaign',c.campaign);u.searchParams.set('kind',c.kind);if(c.kind==='comfort')u.searchParams.set('voice',c.voice);if(c.pick)u.searchParams.set('pick',c.pick);return u.href}
function renderGrowthShare(){
  const p=posterContent();
  return `${head('把这个发现，分享出去','discover')}<div class="poster-tabs">${[['comfort','一句力量'],['challenge','轻松猜想'],['result','我的偏好'],['strength','我的优势']].map(([id,t])=>`<button data-poster-kind="${id}" class="${state.posterKind===id?'selected':''}">${t}</button>`).join('')}</div><article class="growth-poster ${state.posterKind}" id="growth-poster"><div class="poster-topline">关系清晰卡 <span>给自己一点探索的空间</span></div><span class="poster-eyebrow">${p.eyebrow}</span><h2>${esc(p.title).replace('\n','<br>')}</h2>${state.posterKind==='challenge'?rocketArt():mascot()}<p class="poster-description">${p.description}</p><div class="tags">${p.tags.map(t=>`<span class="tag white">${t}</span>`).join('')}</div>${['result','strength'].includes(state.posterKind)&&state.share.experience?`<div class="poster-private-snippet"><span>我主动选择分享的经历</span>${esc(actualExp()[0].event)}</div>`:''}<div class="poster-sender">${esc(state.posterName||'探索中的我')} · 想听听你的看法</div><div class="poster-code-row"><button class="code-target" data-action="simulate-recipient" aria-label="模拟扫码，打开朋友收到的页面">${codePlaceholder()}<span>小程序码预留位</span></button><div><strong>${p.cta}</strong><p>正式接入后，扫码直达对应功能<br><button data-action="simulate-recipient">先体验朋友点开后的页面 ${icon('arrow')}</button></p></div></div><p class="poster-truth">${p.footer}<br>交互原型 · 码位为示意，暂不可真实扫码</p></article><label class="field"><span>这张卡，想署个什么名？ · 选填</span><input data-store="posterName" value="${esc(state.posterName)}" maxlength="16" placeholder="探索中的我"></label><div class="field-label">朋友点开后，从哪里开始？</div><div class="chips">${[...(state.posterKind==='comfort'?[['voices','这段故事']]:[]),['mbti','认识自己'],['traits','性格小探索'],['strengths','看看优势']].map(([id,t])=>`<button class="chip ${state.shareEntry===id?'selected':''}" data-share-entry="${id}">${t}</button>`).join('')}</div>${['result','strength'].includes(state.posterKind)?`<div style="margin-top:17px">${[['type','展示人格偏好'],['strength','展示优势主题'],['experience','加入我选择的经历摘要']].map(([k,t])=>`<label class="check-row"><input type="checkbox" data-share="${k}" ${state.share[k]?'checked':''}><span>${t}</span></label>`).join('')}</div>`:''}<div class="button-pair"><button class="primary" data-action="save-poster">保存海报 PNG</button><button class="secondary" data-action="forward-preview">转发给朋友</button></div><p class="footer-note">保存和分享由你选择，免费结果始终可看。<br>当前可保存真实 PNG；微信转发与正式小程序码为接入预览。</p>`;
}
function inviteLanding(){
  const c=state.incoming;if(c.kind==='comfort'||c.entry==='voices'){const v=VOICE_STORIES[c.voice]||VOICE_STORIES.jobs;return `${head('朋友送来的一点力量','voices','给此刻的你')}<div class="invite-hero comfort-invite"><span class="tag white">有人想把这句话，轻轻送给你</span><h2>${esc(v.quote)}</h2><p>—— ${v.name}（${v.quoteLabel}）</p>${mascot()}</div><section class="invite-start"><h3>如果今天有点难，先在这里坐一会儿。</h3><p>读读他走过的那段路，再给自己留一小步。<br>不急着填写什么，也可以先静静看一看。</p>${primary(c.entry==='voices'?'读读这段经历':'开始我的小探索','start-invited')}</section>${goButton('也想和自己更近一点','discover','secondary')}`};const topic=c.kind==='challenge',t=tools[c.entry];
  return `${head(topic?'朋友邀你来猜一猜':'朋友分享的一个小发现','discover','朋友分享')}<div class="invite-hero"><span class="tag white">${topic?'来自朋友的名人观察卡':'从认识自己开始'}</span><h2>${topic?'马斯克更像\nINFP，还是 INTJ？':'你的偏好与优势，\n也值得被看见。'}</h2>${topic?rocketArt():mascot()}<p>${topic&&c.pick?`朋友选了${c.pick==='uncertain'?'“还不能确定”':c.pick}，想听听你的想法。`:'从一个轻入口，慢慢看见更丰富的自己。'}</p></div>${topic?'<p class="tiny" style="margin:12px 0 18px">公开言行讨论，类型为推测。没有已证实的人格答案。</p>':''}<section class="invite-start"><span class="feature-icon ${t.color}">${icon('test')}</span><h3>${t.name}</h3><p>${t.desc}</p><div class="tags"><span class="tag aqua">基础结果免费</span><span class="tag gray">${c.entry==='traits'?'经典条目交互体验':'6 题交互演示'}</span></div>${primary('开始我的小探索','start-invited')+'<button class="quiet-button" data-action="invited-intro">先看看介绍与免费内容</button>'}</section>${topic?goButton('先参与这个名人话题','celebrity','secondary'):goButton('先看看全部自测','discover','secondary')}<p class="footer-note">从这张卡直接开始，不必先填写经历。<br>完成后可直接查看基础结果，再决定要不要继续探索。</p>`;
}
function beginRecipientPreview(){
  const incoming=shareLandingConfig(),u=new URL(shareLandingUrl());
  state=defaults();state.results={};state.answers={mbti:[],traits:[],strengths:[]};state.incoming=incoming;state.index=0;
  history.replaceState(null,'',u);closeSheet();go('invite');
}
function handleSocialClick(b){
  if(handleWarmClick(b))return true;
  if(b.dataset.guess){state.socialVote=b.dataset.guess;go('celebrity-insight');return true}
  if(b.dataset.posterKind){state.posterKind=b.dataset.posterKind;if(state.posterKind==='comfort')state.shareEntry='voices';else if(state.shareEntry==='voices')state.shareEntry='mbti';render({keepScroll:true});return true}
  if(b.dataset.shareEntry){state.shareEntry=b.dataset.shareEntry;render({keepScroll:true});return true}
  if(b.dataset.expMode){state.experienceMode=b.dataset.expMode;state.formError='';render();return true}
  if(b.dataset.expStep!==undefined){state.experienceIndex=Number(b.dataset.expStep);state.formError='';render();return true}
  if(b.dataset.expPrompt){state.experiencePrompt=b.dataset.expPrompt;render({keepScroll:true});return true}
  if(b.dataset.energy){const i=Number(b.dataset.expIndex),t=b.dataset.energy;const words=state.experiences[i].energy.split('；').filter(Boolean);toggle(words,t);state.experiences[i].energy=words.join('；');state.confirmed=false;render({keepScroll:true});return true}
  return false;
}
function handleSocialAction(a){
  if(handleWarmAction(a))return true;
  if(a==='start-own-preferences'){state.tool='mbti';go('intro')}
  else if(a==='start-classic-traits'){state.tool='traits';go('intro')}
  else if(a==='topic-share'){state.posterKind='challenge';state.shareEntry='mbti';go('share')}
  else if(a==='simulate-recipient'){beginRecipientPreview()}
  else if(a==='start-invited'){if(state.incoming.entry==='voices'){state.voiceId=state.incoming.voice;go('voice')}else{state.tool=state.incoming.entry;handleAction('start-test')}}
  else if(a==='invited-intro'){state.tool=state.incoming.entry;go('intro')}
  else if(a==='next-experience'){const e=state.experiences[state.experienceIndex];if(!e.event.trim()||!e.action.trim()||!e.result.trim()){state.formError='先补齐这一段的情境、行动和结果。每项一句话就可以。';render({keepScroll:true});return true}state.experienceIndex=1;state.formError='';render()}
  else if(a==='classic-source')sheet('经典题目，从哪里来？',`<p>这组性格特质交互题选自 IPIP-50 大五人格条目，原始条目公开可查。本轮采用 6 道中文适配条目演示答题，不据此输出正式 50 题分数。</p><p>正式接入时固定完整题目版本、中文表述和计分规则。AI 用于解释，题目与计分由测评规则提供。</p><a class="source-pill" href="${CLASSIC_SOURCE}" target="_blank" rel="noreferrer">查看 IPIP 原始条目与说明 ${icon('next')}</a>`,primary('继续体验','close-sheet'));
  else if(a==='musk-source')sheet('这条观察的公开来源',`<p>Elon Musk，2006 年 8 月 2 日，Tesla 署名文章。本文描述长期能源目标与分阶段车型规划，可作为讨论工作表达方式的材料。</p><p>这篇材料没有提供他的 MBTI 测评结果。页面里的类型选择属于用户猜想。</p><a class="source-pill" href="${MUSK_SOURCE}" target="_blank" rel="noreferrer">查看 Tesla 原文 ${icon('next')}</a>`,primary('回到讨论','close-sheet'));
  else if(a==='save-poster'){saveGrowthPoster().then(()=>toast('已生成 PNG 海报，码位为原型示意'))}
  else if(a==='forward-preview'){const p=posterContent();sheet('朋友会收到这样一张卡',`<div class="friend-share-card"><div>${rocketArt()}</div><strong>${esc(p.title).replace('\n',' ')}</strong><p>关系清晰卡 · ${shareTargetLabel()}</p></div><p style="margin-top:16px">正式版通过微信的转发能力打开对应功能。本轮先模拟接收方的页面与路径，不发送任何消息。</p>`,primary('模拟朋友点开','simulate-recipient')+'<button class="quiet-button" data-action="close-sheet">返回海报</button>')}
  else return false;
  return true;
}
async function saveGrowthPoster(){
  const p=posterContent(),canvas=document.createElement('canvas');canvas.width=900;canvas.height=1380;const c=canvas.getContext('2d');
  const round=(x,y,w,h,r,fill)=>{c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()};
  const text=(v,x,y,size=28,color='#28334b',weight=400)=>{c.fillStyle=color;c.font=`${weight} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;c.fillText(v,x,y)};
  const wrap=(v,x,y,width,size=29,line=48,color='#687991',limit=6)=>{c.fillStyle=color;c.font=`400 ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;let row='',rows=0;for(const ch of v){if(c.measureText(row+ch).width>width&&row){c.fillText(row,x,y);y+=line;row=ch;if(++rows>=limit-1){row+='…';break}}else row+=ch}if(row)c.fillText(row,x,y);return y+line};
  const g=c.createLinearGradient(0,0,900,1380);g.addColorStop(0,state.posterKind==='comfort'?'#fcf0f3':state.posterKind==='strength'?'#e2f2ef':'#e7edff');g.addColorStop(1,'#fafbff');c.fillStyle=g;c.fillRect(0,0,900,1380);
  text('关系清晰卡',66,89,30,'#5f73b8',550);text('给自己一点探索的空间',574,87,19,'#8d9ab3');
  round(66,142,490,49,10,'#ffffffa8');text(p.eyebrow,84,175,23,'#7585b4');
  const titles=p.title.split('\n');titles.forEach((line,i)=>text(line,66,286+i*91,65,'#28334b',550));
  const source=state.posterKind==='challenge'?rocketArt().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '):'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">'+document.getElementById('art-companion').innerHTML+'</svg>';
  const artUrl=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'})),picture=new Image();
  await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=()=>reject(new Error('海报插画加载失败'));picture.src=artUrl});
  c.drawImage(picture,state.posterKind==='challenge'?596:608,331,245,245);URL.revokeObjectURL(artUrl);
  wrap(p.description,66,625,758,29,49);let tx=66;for(const tag of p.tags){const w=tag.length*24+34;round(tx,727,w,49,9,'#ffffffbb');text(tag,tx+17,760,23,'#7085b8');tx+=w+13}
  if(['result','strength'].includes(state.posterKind)&&state.share.experience){round(66,803,768,128,12,'#ffffff99');text('我主动选择分享的经历',87,836,21,'#8a99b3');wrap(actualExp()[0].event,87,875,716,23,36,'#71839e',2)}
  text((state.posterName||'探索中的我').slice(0,16)+' · 想听听你的看法',66,987,25,'#8291aa');
  round(52,1035,796,219,20,'#ffffffdd');round(76,1062,157,155,14,'#f2f5fc');round(112,1090,83,75,22,'#e3eafa');text('清',135,1143,40,'#6577dc');text('码位示意',105,1194,20,'#8b98af');
  text(p.cta,269,1097,31,'#536895',550);text('正式接入后，扫码直达对应功能',269,1144,23,'#8090aa');text('交互原型 · 暂不可真实扫码',269,1193,21,'#9aa5ba');
  wrap(p.footer,66,1290,768,22,30,'#929eb5',2);text('本地 UI 原型演示',66,1350,21,'#a0abc0');
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`关系清晰卡-${state.posterKind}-原型海报.png`;a.click();
}

const VOICE_STORIES={
  jobs:{name:'史蒂夫·乔布斯',initial:'乔',moods:['有点迷茫','想重新开始'],title:'重新开始，也可以轻一点。',quote:'重新做初学者的轻盈。',english:'the lightness of being a beginner again',quoteLabel:'节译',sourceLabel:'斯坦福大学毕业演讲 · 2005.06.12',source:'https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says',story:'在斯坦福演讲里，他回顾离开苹果后的失落和茫然。后来，他发现自己仍然热爱正在做的事，于是重新出发，创办了 NeXT 和 Pixar。',steps:['他先重新确认：自己仍然喜欢做什么。','再把注意力放回创造与尝试，接受重新做初学者。'],takeaway:'暂时放下“我应该已经很厉害”的要求，给自己留一个重新学、重新试的空间。',prompt:'有哪件小事，是你现在仍然愿意试一试的？',posterTitle:'给自己，\n一次重新开始的温柔。'},
  federer:{name:'罗杰·费德勒',initial:'费',moods:['遇到挫折','有点迷茫'],title:'这一分过去，还有下一分。',quote:'这只是一分。',english:'It’s only a point.',quoteLabel:'译',sourceLabel:'达特茅斯学院毕业演讲 · 2024.06.09',source:'https://home.dartmouth.edu/news/2024/06/2024-commencement-address-roger-federer',story:'他在演讲中谈到失利、自我怀疑，以及比赛里反复丢分的经历。他提醒自己，一分结束后，把注意力带回下一分。',steps:['认真投入正在发生的这一分。','结束后，练习把注意力带回下一次可以做的事。'],takeaway:'先给失落一点空间，再把“这一次没做好”和“我整个人都不行”轻轻分开。',prompt:'接下来的一小步，有什么是你还愿意为自己做的？',posterTitle:'这次没做好，\n也值得被温柔对待。'},
  bezos:{name:'杰夫·贝索斯',initial:'贝',moods:['在做选择'],title:'可以调整的选择，先迈一小步。',quote:'多数决策，大概应在掌握七成所需信息时做出。',english:'Most decisions should probably be made with somewhere around 70% of the information you wish you had.',quoteLabel:'译',sourceLabel:'亚马逊 2016 年度致股东信',source:'https://www.aboutamazon.com/news/company-news/2016-letter-to-shareholders',story:'这封信讨论企业里的决策节奏。他把许多可以调整的决定比作“双向门”，提出先行动，再及时发现问题并修正。',steps:['先分清：这个选择以后是否可以调整。','对可以调整的小决定，用小范围尝试去获得新信息。'],takeaway:'把一个大问题缩成一次可调整的小尝试，也许就能看清一点。原话来自企业决策情境，这里借用的是小步验证的思路。',prompt:'如果只试一小步，你愿意先做什么？',posterTitle:'给选择一点空间，\n也给自己一点耐心。'}
};
function currentVoice(){return VOICE_STORIES[state.voiceId]||VOICE_STORIES.jobs}
function warmStart(){return `<div class="warm-start" aria-label="今天想从哪里开始"><button data-action="focus-explore">${icon('leaf')}想更懂自己</button><button data-action="open-gentle-voices">${icon('heart')}最近有点难</button><button data-action="open-decision-voices">${icon('sun')}有个选择想想</button></div>`}
function warmCompanionTeaser(){return `<button class="warm-companion" data-action="open-gentle-voices"><span>${icon('heart')}</span><div><strong>如果今天有点难，借一点力量。</strong><p>看看他们走过的路，也给自己留一小步。</p></div>${icon('next')}</button>`}
function voicesPage(){
  const options=['全部','有点迷茫','遇到挫折','想重新开始','在做选择','留给自己的'];
  const stories=Object.entries(VOICE_STORIES).filter(([id,v])=>state.voiceMood==='全部'||(state.voiceMood==='留给自己的'?state.savedVoices.includes(id):v.moods.includes(state.voiceMood)));
  return `${head('借一点力量','discover','慢慢来')}<div class="voices-welcome"><span class="tag white">给此刻正在努力的你</span><h2>有些路，<br>他们也曾慢慢走过。</h2><p>从一段真实经历里，借一点力量。<br>也许今天，只需要往前一小步。</p>${mascot()}</div><div class="chips voice-moods">${options.map(t=>`<button class="chip ${state.voiceMood===t?'selected':''}" data-voice-mood="${t}">${t}</button>`).join('')}</div>${stories.map(([id,v])=>`<button class="voice-card" data-voice="${id}"><div class="between"><span class="voice-person"><b>${v.initial}</b>${v.name}</span><span class="tag ${id==='federer'?'pink':id==='bezos'?'aqua':''}">${v.moods[0]}</span></div><h3>${v.title}</h3><p class="voice-card-quote">“${v.quote}”</p><div class="between"><span class="tiny">${v.sourceLabel} · ${v.quoteLabel}</span><span class="voice-read">读读这段经历 ${icon('next')}</span></div></button>`).join('')||'<div class="empty">'+icon('heart')+'<h2>给自己慢慢留一点力量。</h2><p>遇见有共鸣的一句话，<br>可以先留在这里，再回来看。</p><button class="primary" data-action="all-voices">先读一段经历</button></div>'}<p class="footer-note">原话与经历可以查看出处。<br>从中借一点思路，下一步仍由你自己决定。</p>`;
}
function voicePage(){
  const v=currentVoice(),saved=state.savedVoices.includes(state.voiceId);
  return `${head('他们走过的路','voices','给此刻的你')}<div class="voice-quote-sheet"><span class="quote-mark">“</span><span class="voice-person"><b>${v.initial}</b>${v.name}</span><h2>${v.quote}</h2><p>${v.sourceLabel} · ${v.quoteLabel}</p></div><section class="voice-story"><h3>他也经历过这样的时刻</h3><p>${v.story}</p><h3>他是怎样继续往前的</h3>${v.steps.map(t=>`<div class="gentle-step">${icon('leaf')}<p>${t}</p></div>`).join('')}</section><section class="gentle-takeaway"><h3>给此刻的你，一个可以借用的思路</h3><p>${v.takeaway}</p></section>${state.voiceId==='bezos'?`<div class="field-label" style="margin-top:22px">眼前这个选择，之后可以调整吗？</div><div class="chips">${[['yes','可以慢慢调整'],['unsure','我还不太确定']].map(([id,t])=>`<button class="chip ${state.voiceDecision===id?'selected':''}" data-voice-decision="${id}">${t}</button>`).join('')}</div>${state.voiceDecision?`<div class="soft-note">${state.voiceDecision==='yes'?'选一个小范围、可调整的尝试，再给自己一个回头看看它的时间。':'先写下最想弄清的一件事。找一个你信任的人聊聊，也可以让问题慢慢清楚一点。'}</div>`:''}`:''}<label class="field voice-note"><span>${v.prompt} <small>选填</small></span><textarea data-store="voiceNotes.${state.voiceId}" placeholder="留下一句话就可以，也可以先静静读一读。" maxlength="500">${esc(state.voiceNotes[state.voiceId]||'')}</textarea></label><div class="button-pair"><button class="primary" data-action="save-voice">${saved?'这句力量，已经留好了':'把这句力量留给自己'}</button><button class="secondary" data-action="voice-share">送给也在努力的朋友</button></div><button class="source-pill" data-action="voice-source">${icon('cards')}看看原话与出处 ${icon('next')}</button><button class="quiet-button" data-go="discover">也想和自己更近一点</button>`;
}
function handleWarmClick(b){
  if(b.dataset.voice){state.voiceId=b.dataset.voice;state.voiceDecision='';go('voice');return true}
  if(b.dataset.voiceMood){state.voiceMood=b.dataset.voiceMood;render({keepScroll:true});return true}
  if(b.dataset.voiceDecision){state.voiceDecision=b.dataset.voiceDecision;render({keepScroll:true});return true}
  return false;
}
function handleWarmAction(a){
  if(a==='focus-explore')document.getElementById('self-tools')?.scrollIntoView({block:'start',behavior:'smooth'});
  else if(a==='open-gentle-voices'){state.voiceMood='全部';go('voices')}
  else if(a==='open-decision-voices'){state.voiceMood='在做选择';go('voices')}
  else if(a==='open-saved-voices'){state.voiceMood='留给自己的';go('voices')}
  else if(a==='all-voices'){state.voiceMood='全部';render()}
  else if(a==='save-voice'){if(!state.savedVoices.includes(state.voiceId))state.savedVoices.push(state.voiceId);render({keepScroll:true});toast('这句话和你的笔记，已留在本次体验里')}
  else if(a==='voice-share'){state.posterKind='comfort';state.shareEntry='voices';go('share')}
  else if(a==='voice-source'){const v=currentVoice();sheet('原话与这段经历的出处',`<p><strong>${v.name}</strong><br>${v.sourceLabel}</p><p>原文片段：<br>“${v.english}”</p><p>页面中的中文引语已标明${v.quoteLabel}；故事为概述。“给此刻的你”的内容是编辑整理的应用提示。</p><a class="source-pill" href="${v.source}" target="_blank" rel="noreferrer">打开原始来源 ${icon('next')}</a>`,primary('回到这段经历','close-sheet'))}
  else return false;
  return true;
}
function shareTargetLabel(){return state.shareEntry==='voices'?'借一点力量':tools[state.shareEntry].short}
