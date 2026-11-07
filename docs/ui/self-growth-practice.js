// Local prototype: can feedback become a rehearsed response, a concrete action, and an honest review?
(() => {
  const stages=['讲清','反馈','练习','行动','复盘'];
  const directions={
    express:{name:'表达需要',angle:'先把对人的评价换成具体经历，再提出一个对方能回应的请求。你可以调整自己的表达；对方的想法和反应，还需要实际沟通来确认。',question:'你最希望对方理解什么？希望对方具体做什么？',pattern:'具体经历 → 我的需要 → 一个可回应的请求',example:'与同事约 10 分钟，说明我希望如何分工',criterion:'说清一个具体请求，并听完对方的回应'},
    choose:{name:'做出选择',angle:'先区分必须满足的条件和暂时未知的信息。不急着一次选对，可以先做一个成本较小、可以调整的尝试。',question:'哪个条件最重要？你可以用什么小尝试，补足一条关键信息？',pattern:'我在意的条件 → 还缺的信息 → 一个可逆的小尝试',example:'联系一位有相关经历的人，确认一个关键条件',criterion:'得到一条与选择有关的信息，并记下它是否改变我的判断'},
    move:{name:'推进一件事',angle:'把想要的结果缩小成一次能启动的动作。先看清依赖条件，再挑出你能掌握的一步，而不是要求自己一次解决全部。',question:'如果只做一步，哪一步最值得先试？开始前还需要什么条件？',pattern:'想推进的目标 → 我能掌握的一步 → 可观察的结果',example:'留出 15 分钟，完成任务的第一份草稿',criterion:'留下一个可以检查的产物，或完成一次明确的沟通'}
  };
  const phase={goal:0,facts:0,feeling:0,interpretation:0,desired:0,insight:1,rehearsal:2,what:3,when:3,criterion:3,backup:3,outcome:4,actual:4,result:4,next:4};
  let serial=0;
  const initial=()=>({id:`practice-${Date.now()}-${++serial}`,step:0,confirmed:-1,goal:'',facts:'',feeling:'',interpretation:'',desired:'',insight:'',rehearsal:'',what:'',when:'',criterion:'',backup:'',outcome:'',actual:'',result:'',next:'',lightView:'plan',reviewEditing:false,error:''});
  // These transitions own no DOM. Editing an earlier input requires confirming the following steps again.
  function update(current,key,value){
    if(!Object.hasOwn(phase,key)||current[key]===value)return current;
    return {...current,[key]:value,confirmed:Math.min(current.confirmed,phase[key]-1),error:''};
  }
  function missing(current,step=current.step){
    const fields=[['goal','facts','desired'],['insight'],['rehearsal'],['what','when','criterion'],current.outcome==='not-started'?['outcome','actual','next']:['outcome','actual','result','next']][step];
    return fields.find(key=>!current[key]?.trim())||'';
  }
  function currentStore(){const data=state.practice||(state.practice={current:initial(),records:[],mode:'light'});data.mode||='light';return data;}
  const session=()=>currentStore().current;
  const planKeys=['goal','facts','feeling','interpretation','desired','insight','rehearsal','what','when','criterion','backup','sourceDiaryId'];
  const reviewKeys=[...Object.keys(phase),'sourceDiaryId'];
  const sameFields=(a,b,keys)=>keys.every(key=>(a[key]||'')===(b[key]||''));
  const hasPlan=(c=session())=>!!(c.what.trim()&&c.when.trim()&&(c.savedPlan?sameFields(c,c.savedPlan,planKeys):c.confirmed>=3));
  const isReviewed=(c=session())=>hasPlan(c)&&currentStore().records.some(record=>record.id===c.id&&sameFields(c,record,reviewKeys));
  const isActive=(c=session())=>Object.keys(phase).some(key=>!!c[key]?.trim());
  const outcomeLabel=value=>({done:'已经尝试',partial:'尝试了一部分','not-started':'尚未开始'}[value]||'本人复盘');
  function commitPlan(){session().savedPlan=Object.fromEntries(planKeys.map(key=>[key,session()[key]||'']));session().lightView='plan';session().error='';}
  function commitReview(){
    const c=session();c.reviewEditing=false;c.error='';
    const record={...c,savedAt:new Date().toISOString()},rows=currentStore().records,index=rows.findIndex(item=>item.id===c.id);
    if(index<0)rows.unshift(record);else rows[index]=record;
    render();toast('这次复盘已保留在本轮体验中');
  }

  const direction=()=>directions[session().goal]||directions.express;
  const button=(text,action,cls='primary',extra='')=>`<button type="button" class="${cls}" data-practice-action="${action}" ${extra}>${text}</button>`;
  const formField=(key,title,placeholder='',optional=false)=>`<label class="practice-field"><span>${title}${optional?'<small>选填</small>':''}</span><textarea data-practice-field="${key}" maxlength="${key==='facts'?800:key==='rehearsal'?900:400}" placeholder="${esc(placeholder)}" ${optional?'':'aria-required="true"'}>${esc(session()[key])}</textarea></label>`;
  const quote=(title,text)=>`<section class="practice-quote"><h3>${title}</h3><p>${esc(text)}</p></section>`;
  const sourceSummary=()=>`<details class="practice-context"><summary>这次想推进的事</summary>${quote('事件经过',session().facts)}${quote('我希望的变化',session().desired)}${session().feeling?quote('我的感受',session().feeling):''}${session().interpretation?quote('我的解释或猜测',session().interpretation):''}</details>`;
  const error=()=>`<p class="practice-error" role="alert" ${session().error?'':'hidden'}>${esc(session().error)}</p>`;
  const heading=(title,description)=>`<header class="practice-step-heading"><p>第 ${session().step+1} 步，共 5 步</p><h2>${title}</h2><p>${description}</p></header>`;
  function history(){
    const rows=currentStore().records.filter(record=>record.id!==session().id);
    return rows.length?`<details class="practice-history"><summary>回看此前 ${rows.length} 次复盘</summary>${rows.map(record=>`<article><h3>${esc(record.desired)}</h3><span>${outcomeLabel(record.outcome)}</span><p>${esc(record.actual)}</p>${record.result?`<p>${esc(record.result)}</p>`:''}<h4>保留或调整的一步</h4><p>${esc(record.next)}</p></article>`).join('')}</details>`:'';
  }
  function scenePage(){
    const c=session();
    return `<div class="practice-intro"><div><h2>梳理这件事</h2><p>从反馈里找线索，在练习中做调整，用一次行动验证。</p></div>${assessmentArt('feedback')}</div><p class="practice-prototype-note">本地体验：按你的输入提供引导式反馈，尚未接入 AI。反馈角度可以认同，也可以修正。</p><h3 class="practice-field-heading">行动目标</h3><div class="practice-directions" role="group" aria-label="选择这次想推进的方向">${Object.entries(directions).map(([id,item])=>`<button type="button" data-practice-goal="${id}" aria-pressed="${c.goal===id}">${item.name}</button>`).join('')}</div>${formField('facts','发生了什么？','从一件具体的事开始。描述动作、场景或对话，暂时分开事实与猜测。')}${formField('desired','你希望发生什么变化？','写下你在意的需要，或想推进的一件事。')}<details class="practice-extra"><summary>补充感受与想法</summary>${formField('feeling','当时，我有什么感受？','例如：紧张、失望、犹豫，也可以用自己的话描述。',true)}${formField('interpretation','我脑中的解释或猜测','哪些尚未经过确认？',true)}</details>${error()}${button('看看可以调整的角度','next')}${history()}`;
  }
  function feedbackPage(){
    const d=direction();
    return `${heading('查看反馈','先核对这件事，再决定什么对你有启发。')}${quote('这次反馈围绕你的目标',session().desired)}${sourceSummary()}<section class="practice-feedback"><h3>反馈建议</h3><p>${d.angle}</p><h4>待确认</h4><p>${d.question}</p></section><p class="practice-evidence-note">这是针对你所选方向的练习提示，不是对你或他人的确定判断。</p>${formField('insight','我认同，或想修正的一点','例如：我还没有说清需要；或者，这个角度不符合我的实际情况，我更在意的是……')}${error()}${button('把这一点放进练习','next')}`;
  }
  function rehearsalPage(){
    return `${heading('练习新回应','写出你愿意尝试的回应或做法，按自己的意思修改。')}${quote('练习目标',session().insight)}<p class="practice-pattern">${direction().pattern}</p>${formField('rehearsal','我的新回应或新做法','用自己的话写，不必套用句式。')}<button type="button" class="practice-text-button" data-practice-action="scaffold" ${session().rehearsal?'hidden':''}>给我一个练习起点</button><div class="practice-check"><h3>读一遍，再检查</h3><ul><li>是否具体到一件事，而不是给自己或别人下结论？</li><li>是否说出了自己在意的需要或条件？</li><li>是否留出了可以回应、尝试或调整的空间？</li></ul></div>${error()}${button('练习之后，定下一步','next')}`;
  }
  function planPage(){
    const c=session();
    if(c.confirmed>=3)return `${heading('我的微行动','计划已经准备好。尝试之后，回来记录实际发生了什么。')}<section class="practice-action-card"><span>我的下一步行动</span><ol><li><span>做什么</span><p>${esc(c.what)}</p></li><li><span>何时开始</span><p>${esc(c.when)}</p></li><li><span>怎样算完成</span><p>${esc(c.criterion)}</p></li>${c.backup?`<li><span>遇到阻力时</span><p>${esc(c.backup)}</p></li>`:''}</ol></section>${button('记录尝试与复盘','review')}${button('调整这一步行动','edit-plan','secondary')}${goButton('回到首页，稍后继续','home','quiet-button')}`;
    return `${heading('设定微行动','选一个由你掌握的小动作。完成标准由你自己确定。')}${quote('练习内容',c.rehearsal)}${formField('what','这一步，我具体做什么？',`例如：${direction().example}`)}${formField('when','什么时候，或在什么场景开始？','例如：明天例会前；下一次讨论分工时。')}${formField('criterion','怎样算完成这一步？',`例如：${direction().criterion}`)}<details class="practice-extra"><summary>为可能的阻力留个备选</summary>${formField('backup','如果遇到阻力，我可以怎样调整？','把动作再缩小一点，或换一个更合适的时机。',true)}</details>${error()}${button('保存这一步行动','save-plan')}`;
  }
  function reviewPage(){
    const c=session();
    if(isReviewed(c)&&!c.reviewEditing)return `<div class="practice-complete-art">${assessmentArt('feedback')}</div><header class="practice-complete-heading"><p>这次复盘已保存</p><h2>复盘记录</h2></header>${quote(c.outcome==='not-started'?'这次停下来的原因':'我实际尝试了什么',c.actual)}${c.result?quote(c.outcome==='not-started'?'遇到的阻力或新发现':'实际发生的结果',c.result):''}<section class="practice-next-insight"><h3>我想保留或调整的一步</h3><p>${esc(c.next)}</p></section>${button('再调整一次复盘','edit-review','secondary')}${button('开启新一轮说一说','new')}${goButton('回到首页','home','quiet-button')}${history()}`;
    return `${heading('三问复盘','如实记录就有价值。尚未开始，也可以看看是什么让你停下。')}${quote('我原本准备做的一步',c.what)}<div class="practice-outcomes" role="group" aria-label="这一步实际进行到哪里">${[['done','已经尝试'],['partial','尝试了一部分'],['not-started','尚未开始']].map(([id,label])=>`<button type="button" data-practice-outcome="${id}" aria-pressed="${c.outcome===id}">${label}</button>`).join('')}</div>${formField('actual',c.outcome==='not-started'?'是什么让我暂时停下？':'我实际尝试了什么？','写一个实际发生的片段。')}${c.outcome!=='not-started'?formField('result','发生了什么？与预想有什么不同？','只记录观察到的回应或结果，也可以写“暂时没有变化”。'):''}${formField('next','下一步，我想保留或调整什么？','一个可以继续尝试的小调整。')}${error()}${button('保存这次复盘','save-review')}`;
  }
  function deepPage(){
    const c=session(),views=[scenePage,feedbackPage,rehearsalPage,planPage,reviewPage];
    return `<section class="practice-page">${head('说一说','home','自我驱动')}<nav class="practice-steps" aria-label="从反馈到行动的五个节点"><ol>${stages.map((name,index)=>`<li><button type="button" data-practice-step="${index}" ${index>Math.min(4,c.confirmed+1)?'disabled':''} ${index===c.step?'aria-current="step"':''}><span>${index+1}</span>${name}</button></li>`).join('')}</ol></nav><div class="practice-stage">${views[c.step]()}</div></section>`;
  };
  globalThis.practiceHomeSnapshot=()=>{
    const c=session(),reviewed=isReviewed(c),ready=hasPlan(c),light=currentStore().mode==='light';
    return {active:isActive(c),step:c.step,stage:light?(reviewed?'复盘':ready?'三问复盘':'微行动'):stages[c.step],planReady:ready&&!reviewed,reviewed,action:c.what,next:c.next,sourceDiaryId:c.sourceDiaryId||'',reviewCount:currentStore().records.length};
  };
  const lightField=(key,title,placeholder='',kind='textarea',optional=false)=>`<label class="practice-field light-field"><span>${title}${optional?'<small>选填</small>':''}</span>${kind==='input'?`<input type="text" maxlength="400" data-practice-field="${key}" value="${esc(session()[key])}" placeholder="${esc(placeholder)}" ${optional?'':'aria-required="true"'}>`:`<textarea rows="2" maxlength="400" data-practice-field="${key}" placeholder="${esc(placeholder)}" ${optional?'':'aria-required="true"'}>${esc(session()[key])}</textarea>`}</label>`;
  function sourceDiary(){
    const entry=session().sourceDiary;
    return entry?`<details class="light-diary-source"><summary>来自我的三行觉察</summary><p>${esc(entry.content)}</p><button type="button" class="practice-text-button" data-practice-action="source-diary">回看这篇觉察</button></details>`:`<button type="button" class="light-awareness-link" data-home-action="write">${icon('leaf')}想先理清感受？写下三行觉察 ${icon('next')}</button>`;
  }
  function lightPlan(){
    const c=session();
    if(hasPlan(c)&&c.lightView!=='edit-plan')return `<header class="light-heading"><h2>我的微行动</h2><p>尝试之后，再回来留一句反馈。</p></header><section class="light-action-card"><span>我的微行动</span><h3>${esc(c.what)}</h3><p><span>开始的时机</span>${esc(c.when)}</p>${c.backup?`<p><span>遇到阻力时</span>${esc(c.backup)}</p>`:''}${c.criterion?`<p><span>我设定的完成标准</span>${esc(c.criterion)}</p>`:''}</section>${button('记录三问复盘','light-review')}${button('调整微行动','light-edit-plan','secondary')}${goButton('回到首页，稍后继续','home','quiet-button')}`;
    return `<header class="light-heading light-heading-art"><div><h2>设定微行动</h2><p>选一个两分钟就能开始的动作。</p></div>${assessmentArt('feedback')}</header>${sourceDiary()}${lightField('what','行动内容','例如：先说“我确认一下安排，再答复你”。')}${lightField('when','开始时机','例如：收到新的任务请求时。','input')}<details class="practice-extra light-extra"><summary>备选动作与完成标准</summary>${lightField('backup','备选动作','例如：先用消息回复一句。','textarea',true)}${lightField('criterion','完成标准','只设一个自己看得见的标准。','textarea',true)}</details>${error()}${button('保存这个微行动','light-save-plan')}<p class="light-helper">保存的是计划。实际有没有尝试，由你在复盘时记录。</p>`;
  }
  function lightReview(){
    const c=session();
    if(!hasPlan(c))return `<div class="light-empty">${assessmentArt('feedback')}<h2>先设定微行动</h2><p>有了微行动，就能回来看看：尝试了什么，发现了什么，下次怎样调整。</p>${button('选一个微行动','light-plan')}</div>${sourceDiary()}`;
    if(isReviewed(c)&&!c.reviewEditing)return `<header class="light-heading"><h2>复盘记录</h2><p>三问复盘已保存</p></header>${quote('这次的微行动',c.what)}<section class="light-review-result">${quote('实际行动',c.actual)}${quote('效果与阻碍',c.result)}${quote('下一步调整',c.next)}</section>${button('调整这次复盘','edit-review','secondary')}${button('开始新一轮微行动','new')}${goButton('回到首页','home','quiet-button')}${history()}`;
    return `<header class="light-heading"><h2>三问复盘</h2><p>每题一句，也可以记录尚未开始的原因。</p></header><div class="light-review-action"><span>这次的微行动</span><p>${esc(c.what)}</p></div>${lightField('actual','1. 这次，实际行动？','哪怕只做了一点，或者还没开始。')}${lightField('result','2. 效果与阻碍？','留下一点真实反馈，不必总结大道理。')}${lightField('next','3. 下次调整什么？','继续有效的一步，或把动作再缩小一点。')}<details class="practice-extra"><summary>补充这次尝试的进度</summary><div class="practice-outcomes" role="group" aria-label="这次实际进行到哪里">${[['done','已经尝试'],['partial','尝试了一部分'],['not-started','尚未开始']].map(([id,label])=>`<button type="button" data-practice-outcome="${id}" aria-pressed="${c.outcome===id}">${label}</button>`).join('')}</div></details>${error()}${button('保存三问复盘','light-save-review')}`;
  }
  function lightPage(){
    const c=session(),review=c.lightView==='review';
    return `<section class="practice-page practice-light">${head('说一说','home','轻量成长')}<nav class="light-flow" aria-label="默认轻量成长流程"><button type="button" data-home-action="write">三行觉察</button><span aria-hidden="true">${icon('next')}</span><button type="button" data-practice-action="light-plan" ${!review?'aria-current="step"':''}>一个微行动</button><span aria-hidden="true">${icon('next')}</span><button type="button" data-practice-action="light-review" ${review?'aria-current="step"':''}>三问复盘</button></nav><div class="practice-stage">${review?lightReview():lightPlan()}</div></section>`;
  }
  globalThis.growthPracticePage=()=>{
    const deep=currentStore().mode==='deep',pageContent=deep?deepPage():lightPage();
    const choice=`<div class="practice-mode-choice"><span>${deep?'五步梳理':'简短练习'}</span><button type="button" data-practice-action="${deep?'mode-light':'mode-deep'}">${deep?'回到简短练习':'展开五步梳理'} ${icon('next')}</button></div>`;
    return pageContent.replace('</header>','</header>'+choice);
  };
  globalThis.openMicroAction=()=>{currentStore().mode='light';session().lightView='plan';go('chat');};
  globalThis.openPracticeReview=()=>{currentStore().mode='light';session().lightView='review';go('chat');};
  globalThis.startMicroFromDiary=entry=>{
    const c=session();
    if(isActive(c)&&!isReviewed(c)&&c.sourceDiaryId!==entry.id){
      sheet('先继续已有的微行动？','<p>当前已有未完成的内容。这篇觉察会留在日记中，已有文字不会被覆盖。</p>',button('继续当前微行动','resume-existing')+button('先回看这篇觉察','back-to-diary','secondary'));return;
    }
    if(isReviewed(c))currentStore().current=initial();
    const next=session();
    if(!isActive(next)){
      next.sourceDiaryId=entry.id;next.sourceDiary={id:entry.id,content:entry.content};
      next.facts=entry.lines?.event||entry.content;next.feeling=entry.lines?.feeling||'';next.insight=entry.lines?.insight||'';
    }
    currentStore().mode='light';next.lightView=hasPlan(next)?'plan':next.lightView||'plan';go('chat');
  };
  const labels={goal:'先选择这次想推进的方向。',facts:'先描述一件具体发生的事。',desired:'写下期望变化。',insight:'写下一点你认同或想修正的反馈。',rehearsal:'先写出一次愿意尝试的新回应或做法。',what:'把下一步写成一个具体动作。',when:'补充开始的时间或场景。',criterion:'写下怎样算完成这一步。',outcome:'先选择这一步实际进行到哪里。',actual:'补充实际尝试的片段，或尚未开始的原因。',result:'记录实际观察到的回应或结果。',next:'留下一步想保留或调整的做法。'};
  function confirmStep(){
    const key=missing(session());
    if(key){session().error=labels[key];render({keepScroll:true});const field=document.querySelector(`[data-practice-field="${key}"]`)||document.querySelector(key==='goal'?'[data-practice-goal]':'[data-practice-outcome]');field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:'instant'});return false;}
    session().confirmed=Math.max(session().confirmed,session().step);session().error='';return true;
  }
  function scaffold(){
    const c=session(),brief=text=>Array.from(text).slice(0,120).join('');
    if(c.rehearsal.trim())return;
    const text=c.goal==='express'?`当「${brief(c.facts)}」发生时，我想让你知道：${brief(c.desired)}。我们可以一起商量一个具体做法吗？`:c.goal==='choose'?`我希望${brief(c.desired)}。这次先验证一个关键条件，再决定是否继续。`:`我想推进的是：${brief(c.desired)}。我先完成一个能掌握的小步骤，再根据结果调整。`;
    currentStore().current=update(c,'rehearsal',text);render({keepScroll:true});document.querySelector('[data-practice-field="rehearsal"]')?.focus({preventScroll:true});
  }
  document.addEventListener('input',event=>{
    const target=event.target;if(page!=='chat'||!target.isConnected||!target.matches('[data-practice-field]'))return;
    currentStore().current=update(session(),target.dataset.practiceField,target.value);
    const message=document.querySelector('.practice-error');if(message){message.hidden=true;message.textContent='';}
    document.querySelectorAll('[data-practice-step]').forEach(button=>button.disabled=Number(button.dataset.practiceStep)>Math.min(4,session().confirmed+1));
    const starter=document.querySelector('[data-practice-action="scaffold"]');if(starter)starter.hidden=!!session().rehearsal;
    $('#state-panel').textContent=practiceReviewState();
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-practice-action],[data-practice-step],[data-practice-goal],[data-practice-outcome]');
    if(!target?.isConnected||target.disabled)return;
    if(['resume-existing','back-to-diary'].includes(target.dataset.practiceAction)){event.preventDefault();event.stopImmediatePropagation();closeSheet();if(target.dataset.practiceAction==='resume-existing'){currentStore().mode='light';go('chat');}return;}
    if(page!=='chat')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(target.dataset.practiceGoal){currentStore().current=update(session(),'goal',target.dataset.practiceGoal);render({keepScroll:true});document.querySelector(`[data-practice-goal="${session().goal}"]`)?.focus({preventScroll:true});return;}
    if(target.dataset.practiceOutcome){currentStore().current=update(session(),'outcome',target.dataset.practiceOutcome);render({keepScroll:true});document.querySelector(`[data-practice-outcome="${session().outcome}"]`)?.focus({preventScroll:true});return;}
    if(target.dataset.practiceStep!==undefined){const next=Number(target.dataset.practiceStep);if(next<=Math.min(4,session().confirmed+1)){session().step=next;session().error='';render();}return;}
    const action=target.dataset.practiceAction;
    if(action==='mode-light'){currentStore().mode='light';session().lightView=isReviewed()?'review':session().lightView||'plan';render();}
    else if(action==='mode-deep'){currentStore().mode='deep';session().step=Math.min(session().step,Math.min(4,session().confirmed+1));render();}
    else if(action==='light-plan'){session().lightView='plan';session().error='';render();}
    else if(action==='light-review'){session().lightView='review';session().error='';render();}
    else if(action==='light-edit-plan'){session().lightView='edit-plan';session().error='';render();}
    else if(action==='source-diary'){if(session().sourceDiaryId)openDiaryFromHome({entryId:session().sourceDiaryId});}
    else if(action==='light-save-plan'){
      const key=['what','when'].find(key=>!session()[key].trim());
      if(key){session().error=labels[key];render({keepScroll:true});document.querySelector(`[data-practice-field="${key}"]`)?.focus({preventScroll:true});return;}
      commitPlan();render();
    }
    else if(action==='light-save-review'){
      const key=['actual','result','next'].find(key=>!session()[key].trim());
      if(!hasPlan()){session().lightView='plan';render();return;}
      if(key){session().error=labels[key];render({keepScroll:true});document.querySelector(`[data-practice-field="${key}"]`)?.focus({preventScroll:true});return;}
      commitReview();
    }
    else if(action==='next'){if(confirmStep()){session().step++;render();}}
    else if(action==='scaffold')scaffold();
    else if(action==='save-plan'){if(confirmStep()){commitPlan();render();}}
    else if(action==='review'){session().step=4;render();}
    else if(action==='edit-plan'){session().confirmed=2;session().step=3;render();}
    else if(action==='edit-review'){session().reviewEditing=true;if(currentStore().mode==='deep'){session().confirmed=3;session().step=4;}session().lightView='review';render();}
    else if(action==='save-review'){
      if(!confirmStep())return;
      commitReview();
    }else if(action==='new'&&isReviewed()){currentStore().current=initial();render();}
  },true);
  const meta=pageMeta.find(item=>item[0]==='chat');
  meta[2]='自我驱动';meta[3]='默认一个微行动与三问复盘；需要时展开讲清、反馈、练习、行动、复盘五节点。';meta[4]=['五个节点都有输入和可继续的下一步。','行动需要明确动作、开始场景与完成标准；保存计划不代表已经执行。','反馈是引导式模板；复盘由本人记录，不伪造 AI 判断或行动结果。'];
  reviewLabels.chat='反馈、练习与行动';
  globalThis.practiceReviewState=()=>{
    const c=session();$('#scenarios').innerHTML=goButton('回到首页','home','scenario')+goButton('觉察日记','diary','scenario');
    if(currentStore().mode==='light')return `当前模式：轻量成长\n微行动：${hasPlan()?'已保存，执行情况由本人记录':'待定下动作与开始场景'}\n三问复盘：${isReviewed()?'已保存':'未保存'}\n关联觉察：${c.sourceDiaryId?'本人已保存的日记':'尚未关联，可独立开始'}\n已保存复盘：${currentStore().records.length} 次\n切换深度模式保留相同字段\n数据仅在当前页内存中`;
    return `自我驱动节点：${stages[c.step]}（${c.step+1}/5）\n已确认至：${c.confirmed<0?'尚未开始':stages[c.confirmed]}\n方向：${directions[c.goal]?.name||'待选择'}\n反馈：引导模板，未接入 AI\n行动：${c.confirmed>=3?'计划已保存，执行情况由本人记录':'待具体化'}\n复盘：${c.confirmed>=4?'本轮已保存':'未保存'}\n已保存复盘：${currentStore().records.length} 次\n数据仅在当前页内存中`;
  };
})();
