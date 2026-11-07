// Homepage prototype: a next step derived from real in-page work, not sample records.
(() => {
  function reflectionPrompt(kind) {
    const via=viaHomeSnapshot();
    if(kind==='via'&&via.complete) return {source:`VIA 本轮自评 · ${via.strengths[0]}`,question:`最近哪件小事，让你用到了「${via.strengths[0]}」？`};
    if(kind==='mbti') return {source:'MBTI 体验观察',question:'今天做决定时，你先考虑了什么？留下一件具体的小事。'};
    if(kind==='via-sample') return {source:'VIA 体验观察',question:'今天哪件小事，让你发挥了自己擅长的能力？'};
    return {source:'今天的观察',question:'今天哪个片刻，让你多认识了自己一点？'};
  }
  function model() {
    const diary=diaryHomeSnapshot(),mbti=mbtiAnsweredCount(),via=viaHomeSnapshot(),practice=practiceHomeSnapshot();
    const mbtiPending=mbti>0&&mbti<40,viaPending=via.answered>0&&!via.complete;
    let next;
    if(diary.hasDraft) next={id:'draft',tone:'mint',status:'有一份觉察草稿',title:'刚才的心里话，<br>留给你慢慢写。',description:diary.draftLength?`已保留 ${diary.draftLength} 字的思考。从停下的那一句，继续听听自己的感受。`:'从选好的观察问题开始，理解自己的感受与需要。',action:'继续觉察日记',attrs:'data-home-action="write"',art:'journal'};
    else if(practice.active&&!practice.reviewed) next={id:'practice',tone:'peach',status:practice.planReady?'我的行动已准备好':'继续上次的练习',title:practice.planReady?'把这一步，<br>带到生活里。':'不用一下变好，<br>先试一点不同。',description:practice.planReady?`你准备尝试：${practice.action}。行动后，回来记录实际结果与新的发现。`:`继续「${practice.stage}」这个节点，把对自己的理解变成可以尝试的行动。`,action:practice.planReady?'查看行动与复盘':'继续反馈与练习',attrs:'data-go="chat"',art:'feedback'};
    else if(mbtiPending||viaPending) {
      const both=mbtiPending&&viaPending;
      next={id:'assessment',tone:'blue',status:'自我探索进行中',title:'更靠近<br>真实的自己。',description:both?`MBTI 已答 ${mbti}/40 题，VIA 已答 ${via.answered}/72 题。继续探索你的偏好与优势。`:mbtiPending?`MBTI 已答 ${mbti}/40 题。继续了解你的思考与选择偏好。`:`VIA 已答 ${via.answered}/72 题。继续发现你可以发挥的内在优势。`,action:both?'选择我的探索方向':mbtiPending?'继续 MBTI 自测':'继续 VIA 自评',attrs:both?'data-go="discover"':mbtiPending?'data-mbti-action="start"':'data-via-action="start"',art:'mbti',progress:both?null:{answered:mbtiPending?mbti:via.answered,total:mbtiPending?40:72}};
    } else if(practice.reviewed&&(!diary.today||!practice.sourceDiaryId||practice.sourceDiaryId===diary.today.id)) next={id:'practice-review',tone:'peach',status:'这次行动复盘已保存',title:'这次的发现，<br>留给下次的你。',description:`你想继续尝试：${practice.next}`,action:'回看反馈与复盘',attrs:'data-go="chat"',art:'feedback'};
    else if(diary.today) next={id:'today',tone:'mint',status:'今天的觉察已记录',title:'听见自己以后，<br>试着回应自己。',description:'你已经留意到自己的感受。选一个愿意试的小动作，让这份理解照顾到真实的生活。',action:'选一个微行动',attrs:`data-home-action="micro" data-id="${esc(diary.today.id)}"`,art:'journal'};

    else if(via.complete||mbti===40) next={id:'reflection',tone:'mint',status:'从探索走向觉察',title:'把你的发现，<br>变成行动。',description:via.complete?`从${via.strengths.slice(0,2).join('、')}出发，记录一次真实经历，发现可以主动发挥的力量。`:'MBTI 体验已完成。用真实经历观察自己的思考与选择，找到下一步行动的线索。',action:'把发现写进日记',attrs:'data-home-action="reflect"',art:'journal'};
    else if(diary.count) next={id:'journal',tone:'mint',status:'为自己留一点时间',title:'今天的你，<br>也值得被关心。',description:'从今天的情绪与选择里，读懂自己的需要，让下一次行动更有方向。',action:'开启今天的觉察',attrs:'data-home-action="write"',art:'journal'};
    else next={id:'new',tone:'blue',status:'',title:'有些心里话，<br>值得被听见。',description:'开心、委屈，或还说不清的感受，都值得留一点位置。三行字，慢慢读懂自己。',action:'写给此刻的自己',attrs:'data-home-action="write"',art:'journal'};
    return {diary,mbti,via,practice,next};
  }
  globalThis.growthHomePage = () => {
    const {diary,mbti,via,practice,next}=model(),zodiac=zodiacHomeSnapshot();
    const date=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
    return `<section class="growth-home"><header class="growth-home-heading"><div><p>${date}</p><h1>更懂自己，更喜欢自己。</h1></div><button type="button" class="growth-home-profile" data-go="profile" aria-label="打开我的空间">${icon('user')}</button></header>
      <section class="growth-next growth-next--${next.tone}" data-home-state="${next.id}" aria-labelledby="growth-next-title"><div class="growth-next-heading"><div>${next.status?`<p class="growth-next-status">${next.status}</p>`:''}<h2 id="growth-next-title">${next.title}</h2></div>${assessmentArt(next.art)}</div><p class="growth-next-description">${esc(next.description)}</p>${next.progress?`<div class="growth-next-progress" role="progressbar" aria-label="作答进度" aria-valuemin="0" aria-valuemax="${next.progress.total}" aria-valuenow="${next.progress.answered}"><span style="width:${next.progress.answered/next.progress.total*100}%"></span></div>`:''}<button type="button" class="growth-next-action" ${next.attrs}>${next.action}</button></section>
      <nav class="growth-cycle" aria-label="探索自己，找到线索；觉察开悟，形成理解；自我驱动，尝试一个小改变；用复盘继续认识自己"><svg class="growth-cycle-connect" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true"><path d="M50 45 150 37 250 29 350 21"/><path class="growth-cycle-arrows" d="m100 37 5 4-4 5m99-17 5 4-4 5m99-17 5 4-4 5"/></svg><ol><li style="--level:0"><button type="button" data-go="discover" aria-label="探索自己，找到线索，打开自测"><span class="growth-cycle-icon">${icon('test')}</span><strong>探索自己</strong><small>找到线索</small></button></li><li style="--level:1"><button type="button" data-home-action="write" aria-label="觉察开悟，形成理解，写下三行觉察"><span class="growth-cycle-icon mint">${icon('leaf')}</span><strong>觉察开悟</strong><small>形成理解</small></button></li><li style="--level:2"><button type="button" data-home-action="micro-plan" aria-label="自我驱动，尝试一个小改变，选择微行动"><span class="growth-cycle-icon peach">${icon('chat')}</span><strong>自我驱动</strong><small>尝试一个<br>小改变</small></button></li><li style="--level:3"><button type="button" data-home-action="review" aria-label="用复盘继续认识自己，打开三问复盘"><span class="growth-cycle-icon review"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span><strong>用复盘</strong><small>继续认识自己</small></button></li></ol></nav>
      <button type="button" class="growth-zodiac-entry zodiac-tone-${zodiac.tone}" data-go="zodiac"><span><strong>12 星座图鉴</strong><p>${zodiac.viewed?`从${zodiac.name}出发，探索自己的另一面。`:'从性格到事业，读读自己的另一面。'}</p><span>翻开星座图鉴 ${icon('next')}</span></span>${zodiacArt(zodiac.id)}</button>
      ${diary.latest?`<section class="growth-recent"><div class="growth-section-heading"><h2>那些更懂自己的时刻</h2><button type="button" data-home-action="journal">回看全部日记 ${icon('next')}</button></div><button type="button" class="growth-recent-entry" data-home-action="entry" data-id="${esc(diary.latest.id)}"><span>${Number(diary.latest.date.slice(5,7))} 月 ${Number(diary.latest.date.slice(8))} 日 · ${esc(diary.latest.mood)}</span><p>${esc(diary.latest.content)}</p>${diary.latest.inspiration?`<small>${esc(diary.latest.inspiration.source)}</small>`:''}</button></section>`:''}
    </section>`;
  };
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-home-action]');if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    const action=target.dataset.homeAction;
    if(action==='write')openDiaryFromHome();
    else if(action==='micro')openMicroFromDiary(target.dataset.id);
    else if(action==='micro-plan')openMicroAction();
    else if(action==='review')openPracticeReview();
    else if(action==='journal')openDiaryFromHome({browse:true});
    else if(action==='entry')openDiaryFromHome({entryId:target.dataset.id});
    else if(action==='reflect')openDiaryFromHome({prompt:reflectionPrompt(viaHasResult()?'via':mbtiHasResult()?'mbti':'daily')});
    else if(action==='reflect-mbti')openDiaryFromHome({prompt:reflectionPrompt('mbti')});
    else if(action==='reflect-via')openDiaryFromHome({prompt:reflectionPrompt(target.dataset.demo==='true'?'via-sample':'via')});
  },true);
  const homeMeta=pageMeta.find(item=>item[0]==='home');
  homeMeta[3]='探索自己、觉察开悟、自我驱动：自测看见偏好与优势，日记理解自己，说一说把反馈变成行动。';
  homeMeta[4]=['首页四段图标递进呈现探索、觉察、微行动与复盘循环。','主操作可继续草稿、自测、反馈练习或已定下的行动。','自测样例、模板反馈与本人记录明确区分。'];
  globalThis.growthHomeReviewState=()=>{
    const {diary,mbti,via,practice,next}=model();
    $('#scenarios').innerHTML=goButton('自测首页','discover','scenario')+`<button class="scenario" data-home-action="write">写一条日记</button>`+goButton('反馈与行动','chat','scenario')+goButton('12 星座图鉴','zodiac','scenario');
    return `首页当前主操作：${next.action}\nMBTI：${mbti}/40 题（结果仍为体验样例）\nVIA：${via.answered}/72 题\n本人日记：${diary.count} 篇（不含虚构示例）\n草稿：${diary.hasDraft?'有，继续保留':'无'}\n自我驱动：${practice.active?practice.stage:'待开始'}；复盘 ${practice.reviewCount} 次\n观察提示：可选，不会代写正文\n数据仅在当前原型内存中`;
  };
})();
