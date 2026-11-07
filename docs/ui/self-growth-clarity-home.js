/* Prototype: one homepage direction, enabled only with ?home-style=clarity. */
(() => {
  if (new URLSearchParams(location.search).get('home-style') !== 'clarity') return;

  const stages = [['fact', '事实'], ['feeling', '感受'], ['next', '下一步']];
  const requestedStage = new URLSearchParams(location.search).get('clarity-stage');
  let stage = stages.some(item => item[0] === requestedStage) ? requestedStage : 'fact';
  let feeling = '失落';
  let nextStep = '找个合适的时机，补充我的想法。';
  const feelings = ['失落', '有点生气', '困惑'];
  const nextSteps = ['找个合适的时机，补充我的想法。', '先把想说的话，写下来。'];
  const homeReview = pageMeta.find(item => item[0] === 'home');
  homeReview[3] = '品牌方向小样：让一张可操作的清晰卡成为首页主视觉。';
  homeReview[4] = ['点选事实、感受和下一步，体验同一片段的三种视角。', '虚构示例与个人输入分开，不会代填你的记录。', '主操作与其他入口接回现有原型流程。'];

  document.querySelector('.symbols defs').insertAdjacentHTML('beforeend',
    '<symbol id="i-clarity-brand" viewBox="0 0 32 32"><path d="M8 5h14a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 11h10M10 16h7M10 21h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m19 19 3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>');

  function panel() {
    if (stage === 'fact') return `
      <p class="clarity-scene">开会时，我还没说完，<br>话题就换了。</p>
      <p class="clarity-insight">这是发生的事。<br>对方为什么这样做，我们还不知道。</p>`;
    if (stage === 'feeling') return `
      <p class="clarity-panel-title">这件事，让我感到</p>
      <div class="clarity-feelings" role="group" aria-label="选择示例中的感受">${feelings.map(item => `<button type="button" data-clarity-feeling="${item}" aria-pressed="${feeling === item}">${item}</button>`).join('')}</div>
      <p class="clarity-insight">感受可以先被看见，<br>不用急着判断对错。</p>`;
    return `
      <p class="clarity-panel-title">从自己能决定的事开始</p>
      <div class="clarity-next-options" role="group" aria-label="选择示例中的下一步">${nextSteps.map(item => `<button type="button" data-clarity-next="${item}" aria-pressed="${nextStep === item}"><span class="clarity-choice-mark" aria-hidden="true"></span><span>${item}</span></button>`).join('')}</div>`;
  }

  renderers.home = () => `
    <section class="clarity-home" aria-label="清晰卡首页小样">
      <header class="clarity-opening">
        <h1>把一件事，<br>分开看一看。</h1>
        <p>发生了什么，我有什么感受，<br>接下来想怎么做。</p>
      </header>

      <section class="clarity-sheet" aria-label="事实、感受与下一步的交互示例">
        <div class="clarity-stage-tabs" role="tablist" aria-label="从三个角度看一件事">${stages.map(([id, label]) => `<button type="button" role="tab" id="clarity-tab-${id}" data-clarity-stage="${id}" aria-selected="${stage === id}" aria-controls="clarity-demo-panel" tabindex="${stage === id ? 0 : -1}">${label}</button>`).join('')}</div>
        <div id="clarity-demo-panel" class="clarity-demo-panel" role="tabpanel" aria-labelledby="clarity-tab-${stage}" tabindex="0">${panel()}</div>
        <div class="clarity-sheet-footer"><span>虚构片段，仅供体验</span><button type="button" class="clarity-cycle" data-clarity-advance aria-label="切换到${stages[(stages.findIndex(item => item[0] === stage) + 1) % stages.length][1]}">${icon('next')}</button></div>
      </section>

      <button type="button" class="clarity-start" data-go="relationship">写下我的这件事</button>
      <button type="button" class="clarity-talk" data-go="chat">还没想好，先说一说</button>

      <nav class="clarity-other-ways" aria-label="其他探索入口">
        <button type="button" data-go="discover"><span><strong>认识自己的偏好与优势</strong><small>MBTI 与 VIA 自评</small></span>${icon('next')}</button>
        <button type="button" data-go="diary"><span><strong>留住今天的一个片刻</strong><small>写一条觉察日记</small></span>${icon('next')}</button>
        <button type="button" data-go="reports"><span><strong>我的结果与报告</strong><small>回看之前的发现</small></span>${icon('next')}</button>
      </nav>
    </section>`;

  function updatePanel({ focusTab = false } = {}) {
    const tabs = document.querySelectorAll('[data-clarity-stage]');
    tabs.forEach(tab => {
      const selected = tab.dataset.clarityStage === stage;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });
    const target = document.querySelector('#clarity-demo-panel');
    target.setAttribute('aria-labelledby', `clarity-tab-${stage}`);
    target.innerHTML = panel();
    const advance = document.querySelector('[data-clarity-advance]');
    advance.setAttribute('aria-label', `切换到${stages[(stages.findIndex(item => item[0] === stage) + 1) % stages.length][1]}`);
    const url = new URL(location.href);
    url.searchParams.set('clarity-stage', stage);
    history.replaceState(history.state, '', url);
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-clarity-stage], [data-clarity-feeling], [data-clarity-next], [data-clarity-advance]');
    if (!control || page !== 'home') return;
    event.preventDefault();
    event.stopPropagation();
    if (control.hasAttribute('data-clarity-stage')) {
      stage = control.dataset.clarityStage;
      updatePanel();
    } else if (control.hasAttribute('data-clarity-advance')) {
      stage = stages[(stages.findIndex(item => item[0] === stage) + 1) % stages.length][0];
      updatePanel();
    } else {
      if (control.hasAttribute('data-clarity-feeling')) feeling = control.dataset.clarityFeeling;
      else nextStep = control.dataset.clarityNext;
      control.parentElement.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === control)));
    }
  }, true);

  document.addEventListener('keydown', event => {
    const control = event.target.closest('[data-clarity-stage]');
    if (!control) {
      if (event.target.closest('.clarity-home') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) event.stopPropagation();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const index = stages.findIndex(item => item[0] === stage);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + stages.length) % stages.length;
    stage = stages[next][0];
    updatePanel({ focusTab: true });
  }, true);
})();
