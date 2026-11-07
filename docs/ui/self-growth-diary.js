// 觉察日记 UI 评审扩展：沿用现有 A 版，所有输入仅在当前原型页内存中保留。
(() => {
  const dimensions = [
    { id: 'emotion', label: '情绪与身体', color: '#8b9fcb', prompt: '此刻是什么情绪？身体的哪个地方最有感觉？' },
    { id: 'relationship', label: '关系', color: '#c18ca5', prompt: '今天和谁相处时，我更自在，或有些紧绷？' },
    { id: 'needs', label: '价值与需要', color: '#86aaa2', prompt: '在这件事里，我真正在意和需要的是什么？' },
    { id: 'action', label: '行动模式', color: '#c2a17b', prompt: '我做了什么？下次想保留或试着改变哪一小步？' },
    { id: 'thinking', label: '思维方式', color: '#a291bb', prompt: '脑海里反复出现哪句话？它是事实，还是我的猜测？' },
    { id: 'meaning', label: '方向与意义', color: '#8da978', prompt: '今天哪个片刻，让我靠近了想过的生活？' }
  ];
  const moods = [['light', '轻快', '#e3b77d'], ['calm', '平静', '#8ab6ac'], ['mixed', '复杂', '#a89bc4'], ['tired', '疲惫', '#9baac4'], ['low', '低落', '#9c9db7']];
  const examples = [
    { id: 'example-3', date: '2026-10-30', mood: 'calm', content: '傍晚没有继续刷手机，出门走了二十分钟。慢慢走着，呼吸也松下来了。我想要的生活里，应该有一些这样不赶路的时刻。', dimensions: ['emotion', 'action', 'meaning'] },
    { id: 'example-2', date: '2026-10-29', mood: 'mixed', content: '又想起昨天没说出口的意见。我发现自己总觉得“拒绝别人就会让人失望”。这只是我的猜测。下次想试着先说：我需要一点时间考虑。', dimensions: ['emotion', 'needs', 'thinking', 'action'] },
    { id: 'example-1', date: '2026-10-28', mood: 'tired', content: '讨论方案时，我又抢着说“都可以”。回到座位才发现肩膀一直绷着。其实我希望自己的意见也被听见。', dimensions: ['emotion', 'relationship', 'needs'] }
  ];
  const today = () => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const emptyDraft = () => ({ id: '', date: today(), mood: '', content: '', dimensions: [], lines: { event: '', feeling: '', insight: '' }, freeContent: '' });
  function diary() {
    if (!state.diary) state.diary = { entries: [], draft: emptyDraft(), example: true, branch: 'emotion', detail: '', error: '' };
    const draft=state.diary.draft;
    if(!draft.lines){draft.lines={event:'',feeling:'',insight:''};draft.freeContent=draft.content||'';}
    draft.freeContent??='';
    return state.diary;
  }
  const entries = () => diary().example ? examples : diary().entries;
  const mood = entry => moods.find(item => item[0] === entry.mood) || ['', '未标注心情', 'var(--muted)'];
  const dateLabel = date => `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日`;
  const button = (text, action, cls = 'primary', extra = '') => `<button class="${cls}" data-diary-action="${action}" ${extra}>${text}</button>`;
  const tags = entry => `<div class="awareness-tags">${dimensions.filter(item => entry.dimensions.includes(item.id)).map(item => `<span>${item.label}</span>`).join('') || '<span>未标注维度</span>'}</div>`;
  const previewNote = '<p class="awareness-preview-note">体验版 · 记录仅在本页内存中暂存，刷新清除。日记不会上传，尚未接入 AI。</p>';
  const tabs = active => `<nav class="awareness-tabs" aria-label="觉察日记栏目">${[['diary', '觉察树'], ['diary-journal', '我的日记'], ['diary-letter', '一封回信']].map(([id, title]) => `<button data-go="${id}" class="${active === id ? 'selected' : ''}" ${active === id ? 'aria-current="page"' : ''}>${title}</button>`).join('')}</nav>`;
  const viewSwitch = () => `<div class="awareness-view-switch"><span>${diary().example ? '正在看虚构示例' : '我的本次记录'}</span>${button(diary().example ? '回到我的记录' : '看看示例', 'toggle-example', 'text-link')}</div>`;
  const inspirationCard = (prompt, editable = false) => prompt ? `<aside class="awareness-inspiration"><div><span>${esc(prompt.source)}</span><p>${esc(prompt.question)}</p></div>${editable ? button('×', 'dismiss-prompt', 'awareness-inspiration-close', 'type="button" aria-label="收起观察提示"') : ''}</aside>` : '';
  const shell = (content, title = '觉察日记', back = 'home') => `<section class="awareness-page">${head(title, back, '体验版')}${previewNote}${content}</section>`;
  const heading = active => `<h2 class="awareness-heading">三行觉察</h2><p class="awareness-subtitle">记录事实、感受和理解。</p>${tabs(active)}`;

  function treeSvg(counts) {
    const shapes = [
      ['M181 253 Q139 253 80 215', 80, 215, -52], ['M182 268 Q241 264 288 224', 288, 224, 44],
      ['M179 204 Q118 192 63 146', 63, 146, -50], ['M181 213 Q249 199 299 155', 299, 155, 46],
      ['M181 180 Q144 142 124 82', 124, 82, -28], ['M180 179 Q211 119 234 63', 234, 63, 25]
    ];
    const leaves = [[0, -8, -36], [16, 7, 45], [-16, 18, -55], [13, 31, 48], [-16, 42, -50], [9, 53, 42], [-11, 63, -48]];
    return `<svg viewBox="0 0 360 340" class="awareness-tree-art" role="img" aria-label="六维觉察树，枝叶表示已标注的记录数量"><ellipse cx="182" cy="314" rx="66" ry="9" fill="#e9eef3"/><path d="M177 314 Q183 273 179 238 Q184 208 180 174" fill="none" stroke="#a3adb5" stroke-width="10" stroke-linecap="round"/><path d="M178 307 Q159 316 144 313 M183 309 Q204 319 221 314" fill="none" stroke="#a3adb5" stroke-width="4" stroke-linecap="round"/>${dimensions.map((item, index) => {
      const [path, x, y, angle] = shapes[index], count = counts[index];
      return `<path d="${path}" fill="none" stroke="${count ? item.color : '#cdd6dd'}" stroke-width="${count ? 4.5 : 2.5}" stroke-linecap="round"/>${count ? `<g transform="translate(${x} ${y}) rotate(${angle})">${leaves.slice(0, Math.min(7, count * 2 + 1)).map(([lx, ly, rotate], i) => `<ellipse cx="${lx}" cy="${ly}" rx="9" ry="17" transform="rotate(${rotate} ${lx} ${ly})" fill="${item.color}" opacity="${i % 2 ? '.65' : '.88'}"/>`).join('')}</g>` : `<circle cx="${x}" cy="${y}" r="3.5" fill="#d7dfe5"/>`}`;
    }).join('')}</svg>`;
  }

  function treePage() {
    const d = diary(), rows = entries(), counts = dimensions.map(item => rows.filter(entry => entry.dimensions.includes(item.id)).length);
    const selected = dimensions.find(item => item.id === d.branch) || dimensions[0];
    const selectedCount = counts[dimensions.indexOf(selected)];
    return shell(`${heading('diary')}${viewSwitch()}<div class="awareness-tree-card"><div class="between top-align"><div><h3>${rows.length ? '每一次觉察，都有意义。' : '从一次觉察开始。'}</h3><p>${d.example ? '这棵树来自 3 篇虚构日记' : rows.length ? '从记录中理解自己的感受、需要与选择' : '了解自己，从真实的感受开始'}</p></div><div class="awareness-day-count"><b>${new Set(rows.map(entry => entry.date)).size}</b><span>天${d.example ? '示例' : '记录'}</span></div></div><div class="awareness-tree-stage">${treeSvg(counts)}${dimensions.map((item, index) => `<button class="awareness-branch awareness-branch--${item.id} ${d.branch === item.id ? 'selected' : ''}" data-diary-action="branch" data-id="${item.id}" aria-label="${item.label}，${counts[index]}篇记录"><span>${item.label}</span><small style="color:${counts[index] ? item.color : '#9ba6b7'}">${counts[index] ? counts[index] + ' 篇' : '待探索'}</small></button>`).join('')}</div><p class="awareness-tree-caption">枝叶来自你选择的觉察维度。记录多少，不代表好坏。</p></div><div class="awareness-focus"><div class="between"><h3><i style="background:${selected.color}"></i>${selected.label}</h3><small>${selectedCount ? selectedCount + ' 篇记录' : '还没写到这里，也没关系'}</small></div><p>${selected.prompt}</p>${button('从这个角度写一点', 'write-branch', 'text-link')}</div>${button(d.draft.content ? '继续我的三行觉察' : '写下今天的三行觉察', 'write')}<p class="footer-note">理解自己，再选择如何改变。</p>`);
  }

  const linePrompts=[['event','今天，哪件事让我有感觉？','记一件具体的事，先不急着评价。'],['feeling','我有什么感受，真正在意什么？','一个情绪、一种需要，用自己的话写。'],['insight','我对自己有了什么新发现？','一点新理解，也可以是暂时还不确定的地方。']];
  function composeDraft(draft){
    const names={event:'发生的事',feeling:'感受与在意',insight:'新的发现'};
    const parts=Object.entries(draft.lines).filter(([,value])=>value.trim()).map(([key,value])=>`${names[key]}：${value.trim()}`);
    return [...parts,draft.freeContent.trim()].filter(Boolean).join('\n\n');
  }
  function entryBody(entry){
    if(!entry.lines||!Object.values(entry.lines).some(value=>value.trim()))return `<p class="awareness-entry-body">${esc(entry.content)}</p>`;
    return `<div class="awareness-entry-body awareness-entry-lines">${linePrompts.filter(([key])=>entry.lines[key]?.trim()).map(([key,title])=>`<section><h3>${title}</h3><p>${esc(entry.lines[key])}</p></section>`).join('')}${entry.freeContent?`<section><h3>补充的记录</h3><p>${esc(entry.freeContent)}</p></section>`:''}</div>`;
  }
  function writePage() {
    const d=diary(),draft=d.draft;d.example=false;
    const freeMarkup=`<details class="awareness-free-extra" ${draft.freeContent?'open':''}><summary>${draft.freeContent?'原有正文已保留，可继续补充':'想多写一点？展开自由记录'}</summary><textarea id="awareness-content" aria-label="补充的自由记录" data-diary-field="freeContent" maxlength="2000" placeholder="写下想补充的内容，也可以只保留上面的三行。">${esc(draft.freeContent)}</textarea></details>`;
    return shell(`<header class="awareness-light-intro"><h2>写下来，慢慢听自己说。</h2><p>三行提示，写一句也算完成。</p></header>${inspirationCard(draft.inspiration,true)}<div class="awareness-three-lines">${linePrompts.map(([key,title,placeholder],index)=>`<label class="awareness-line-field"><span><i>${index+1}</i>${title}</span><textarea rows="2" id="awareness-line-${key}" data-diary-line="${key}" maxlength="600" placeholder="${placeholder}">${esc(draft.lines[key])}</textarea></label>`).join('')}</div>${draft.freeContent?freeMarkup:''}<small class="awareness-light-word-count" id="awareness-word-count">${draft.content.length} / 2000 字</small>${d.error?`<p class="notice error" role="alert">${esc(d.error)}</p>`:''}${button(draft.id?'保存这次调整':'保存这次觉察','save')}${!draft.freeContent?freeMarkup:''}<details class="awareness-light-options"><summary>补充心情、日期与觉察维度</summary><label class="awareness-date"><span>记录日期</span><input type="date" aria-label="记录日期" data-diary-field="date" value="${esc(draft.date)}" max="${today()}"></label><h3>此刻的感受</h3><div class="awareness-moods">${moods.map(([id,title,color])=>button(`<i style="background:${color}"></i><span>${title}</span>`,'mood',`awareness-mood ${draft.mood===id?'selected':''}`,`data-id="${id}" aria-label="${title}" aria-pressed="${draft.mood===id}"`)).join('')}</div><h3>这次想标注的觉察维度</h3><div class="awareness-dimensions">${dimensions.map(item=>button(`<span>${item.label}</span><span>${draft.dimensions.includes(item.id)?'✓':'+'}</span>`,'dimension',`awareness-dimension ${draft.dimensions.includes(item.id)?'selected':''}`,`data-id="${item.id}" aria-pressed="${draft.dimensions.includes(item.id)}"`)).join('')}</div></details>${goButton('先放一放，保留草稿','home','quiet-button')}`,draft.id?'补充我的觉察':'三行觉察','home');
  }

  function journalPage() {
    const rows = entries();
    return shell(`${heading('diary-journal')}${viewSwitch()}${rows.length ? `<div class="awareness-entry-list">${rows.map(entry => button(`<div class="between"><h3>${dateLabel(entry.date)}</h3><span class="awareness-entry-mood"><i style="background:${mood(entry)[2]}"></i>${mood(entry)[1]}</span></div><p>${esc(entry.content.length > 66 ? entry.content.slice(0, 66) + '…' : entry.content)}</p>${tags(entry)}`, 'entry', 'awareness-entry-row', `data-id="${entry.id}"`)).join('')}</div><p class="footer-note">${diary().example ? '这 3 篇日记仅用于展示，不计入你的记录。' : '已经留住 ' + rows.length + ' 个片刻。随时回来，再看看自己。'}</p>` : `<div class="awareness-empty">${icon('leaf')}<h3>还没有日记</h3><p>理解情绪与需要，<br>让下一步更有方向。</p></div>`}${button(diary().draft.content ? '继续刚才的草稿' : '写下一篇日记', 'write')}`);
  }

  function entryPage() {
    const d = diary(), rows = entries(), entry = rows.find(item => item.id === d.detail) || rows[0];
    if (!entry) return shell(`<div class="awareness-empty"><h3>还没有留下记录。</h3><p>先写下一点今天的感受吧。</p></div>${button('写下一篇日记', 'write')}`, '一个真实的片刻', 'diary-journal');
    return shell(`<article class="awareness-entry-detail"><span class="tag ${d.example ? 'gray' : 'aqua'}">${d.example ? '虚构示例' : '我的本次记录'}</span><h2>${dateLabel(entry.date)}</h2><div class="awareness-entry-mood"><i style="background:${mood(entry)[2]}"></i>${mood(entry)[1]}</div>${entryBody(entry)}${tags(entry)}${inspirationCard(entry.inspiration)}${d.example ? '<p class="footer-note">这是虚构日记，供你审核回看体验。</p>' : button('再补充一点', 'edit', 'secondary', `data-id="${entry.id}"`)}</article>${!d.example?button('设定微行动','micro','primary',`data-id="${esc(entry.id)}"`)+goButton('今天先记到这里','home','quiet-button'):''}${goButton('回到日记列表', 'diary-journal', 'secondary')}`, '一个真实的片刻', 'diary-journal');
  }

  function letterPage() {
    const paragraphs = [
      '亲爱的你：',
      '在这三篇示例日记里，有一个很小、却值得停下来看的片刻：你说了“都可以”，身体却没有跟着放松。肩膀的紧绷，或许在提醒你——你也有一些希望被听见的意见。',
      '接着，你写下了那句反复出现的念头：“拒绝别人就会让人失望。”你没有急着把它当作事实，而是开始问：这是不是我的一种猜测？这个停顿，本身就是一次新的觉察。',
      '从这些片段里，可以提出一个待验证的猜想：有时候，你可能会先照顾他人的期待，晚一点才发现自己的需要。但几篇日记不足以概括一个人；这也可能只是某个忙碌的工作日。你可以保留不认同的部分。',
      '如果愿意，下次不必一下子做到坚定拒绝。先试试你已经写下的那句话：“我需要一点时间考虑。”说完，留意身体有没有松一点，也看看对方实际上怎样回应。',
      '还有那二十分钟的散步。你在不赶路的时候，重新感觉到了呼吸。这或许可以成为明天的一小步：给自己留十分钟，不完成什么，只感受此刻。',
      '树枝记录的是你写到了什么。没有长出叶子的地方，也不意味着你做得不够好。等你愿意的时候，再从一个新的角度看看自己。',
      '愿你慢慢听见自己的声音，也允许自己慢慢改变。'
    ];
    return shell(`${heading('diary-letter')}<p class="awareness-letter-notice">回信示例 · 使用 3 篇虚构日记展示，尚未分析你的记录。</p><article class="awareness-letter"><div class="awareness-letter-icon">${icon('leaf')}</div><h2>写给慢慢<br>听见自己的你</h2><p class="awareness-letter-source">示例日记：10 月 28 日 — 10 月 30 日</p><div>${paragraphs.map(text => `<p class="awareness-letter-paragraph">${text}</p>`).join('')}</div><footer>把一点温柔，留给自己。<small>觉察日记 · 回信示例</small></footer></article>${button('看看这封信对应的示例日记', 'letter-sources', 'secondary')}<p class="footer-note">真实回信将在后续接入 AI 后开放。<br>你始终可以保留不同的理解。</p>`);
  }

  pageMeta.splice(pageMeta.findIndex(item => item[0] === 'discover') + 1, 0,
    ['diary', '觉察日记 · 觉察树', '本次新增', '每天几分钟，留住真实片刻，让六个觉察维度慢慢长出枝叶。', ['第三个底部入口，位于自测右侧；也可从首页直接开始记录。', '可切换虚构示例与本轮个人记录；枝叶只表示主动标注的记录数。']],
    ['diary-write', '觉察日记 · 写下此刻', '本次新增', '默认三行觉察，一句也可保存；自由正文、日期、心情与维度按需补充。', ['可输入、暂存草稿、保存和编辑，返回不会丢失本轮草稿。', '仅内存演示，不上传、不写本机存储；刷新后清除。']],
    ['diary-journal', '觉察日记 · 日记回看', '本次新增', '按日期回看留住的片刻，让每一天都可以被温柔地重新理解。', ['列表可打开详情，自己的日记可以继续补充。', '示例与个人记录隔离，不把虚构日记计入个人统计。']],
    ['diary-entry', '觉察日记 · 一个片刻', '本次新增', '完整阅读一篇日记，保留当时的心情与觉察维度。', ['个人记录可编辑后覆盖原篇，不额外增加树枝计数。', '虚构示例明确标注，编辑入口只用于本轮个人记录。']],
    ['diary-letter', '觉察日记 · 一封回信', '本次新增', '以书信展示观察习惯、提出待验证猜想和一个小行动的阅读体验。', ['回信明确为虚构日记的示例，不伪装成对私人日记的分析。', '可回看对应的三篇示例；真实 AI 留待后续接入。']]
  );
  Object.assign(renderers, { diary: treePage, 'diary-write': writePage, 'diary-journal': journalPage, 'diary-entry': entryPage, 'diary-letter': letterPage });
  globalThis.diaryReviewState = () => {
    const d = diary();
    $('#scenarios').innerHTML = [['show-example', '示例树'], ['show-own', '我的当前记录'], ['write', '写一篇'], ['letter', '回信示例']].map(([action, title]) => button(title, action, 'scenario')).join('');
    return `当前展示：${d.example ? '虚构示例' : '本轮个人记录'}\n个人日记：${d.entries.length} 篇\n示例日记：3 篇（独立展示）\n未保存草稿：${d.draft.content ? d.draft.content.length + ' 字' : '暂无'}\n真实 AI：未接入\n输入只留在本页内存，刷新清除`;
  };

  function startWriting() { diary().example = false; diary().error = ''; go('diary-write'); }
  globalThis.diaryHomeSnapshot = () => {
    const d = diary(), draft = d.draft;
    const summarize = entry => entry ? { id: entry.id, date: entry.date, content: entry.content.slice(0, 100), mood: mood(entry)[1], inspiration: entry.inspiration } : null;
    return {
      count: d.entries.length,
      hasDraft: !!(draft.content.length || draft.id || draft.dimensions.length || !!draft.mood || draft.date !== today() || draft.inspiration),
      draftLength: draft.content.length,
      today: summarize(d.entries.find(entry => entry.date === today())),
      latest: summarize(d.entries[0])
    };
  };
  globalThis.openDiaryFromHome = ({ prompt, entryId, browse = false } = {}) => {
    const d = diary(); d.example = false; d.error = '';
    if (entryId) {
      if (!d.entries.some(entry => entry.id === entryId)) { go('diary-journal'); return; }
      d.detail = entryId; go('diary-entry'); return;
    }
    if (browse) { go('diary-journal'); return; }
    if (prompt) d.draft.inspiration = { source: prompt.source, question: prompt.question };
    startWriting();
  };
  globalThis.openMicroFromDiary=id=>{const entry=diary().entries.find(item=>item.id===id);if(entry)startMicroFromDiary(entry);else openDiaryFromHome({browse:true});};
  function editEntry(id) {
    const entry = diary().entries.find(item => item.id === id);
    if (!entry) return;
    diary().draft = { ...entry, dimensions: [...entry.dimensions], lines: entry.lines?{...entry.lines}:undefined };
    startWriting();
  }
  let sequence = 0;
  document.addEventListener('click', event => {
    const target = event.target.closest('button[data-diary-action]');
    if (!target || !target.isConnected || target.disabled) return;
    const action = target.dataset.diaryAction, d = diary();
    if(action==='micro'){const entry=d.entries.find(item=>item.id===target.dataset.id);if(entry&&!d.example)startMicroFromDiary(entry);}
    else if (action === 'write') startWriting();
    else if (action === 'dismiss-prompt') { delete d.draft.inspiration; render({ keepScroll: true }); $('#awareness-line-event').focus({ preventScroll: true }); }
    else if (action === 'branch') { d.branch = target.dataset.id; render({ keepScroll: true }); }
    else if (action === 'write-branch') { d.draft.dimensions = [...new Set([...d.draft.dimensions, d.branch])]; startWriting(); }
    else if (action === 'toggle-example') { d.example = !d.example; d.detail = ''; render({ keepScroll: true }); }
    else if (action === 'show-example' || action === 'show-own') { d.example = action === 'show-example'; d.detail = ''; go('diary'); }
    else if (action === 'letter') go('diary-letter');
    else if (action === 'letter-sources') { d.example = true; d.detail = ''; go('diary-journal'); }
    else if (action === 'entry') { d.detail = target.dataset.id; go('diary-entry'); }
    else if (action === 'mood') { d.draft.mood = target.dataset.id; render({ keepScroll: true }); }
    else if (action === 'dimension') {
      const id = target.dataset.id;
      d.draft.dimensions = d.draft.dimensions.includes(id) ? d.draft.dimensions.filter(item => item !== id) : [...d.draft.dimensions, id];
      render({ keepScroll: true });
    } else if (action === 'edit') {
      const id = target.dataset.id;
      if (d.draft.content.trim() && d.draft.id !== id) sheet('打开这篇记录？', '<p>打开后会替换当前未保存的草稿。</p>', button('继续当前草稿', 'keep-draft') + button('替换草稿，打开记录', 'confirm-edit', 'secondary', `data-id="${id}"`));
      else editEntry(id);
    } else if (action === 'keep-draft') { closeSheet(); startWriting(); }
    else if (action === 'confirm-edit') { closeSheet(); editEntry(target.dataset.id); }
    else if (action === 'save') {
      const content = d.draft.content.trim(), date = d.draft.date;
      if (!content || content.length > 2000 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date + 'T12:00:00').getDate() !== Number(date.slice(8)) || date > today()) {
        d.error = !content ? '先写下一点今天的感受，再保存吧。' : content.length > 2000 ? '这篇记录超过 2000 字，请精简后保存。' : '请选择今天或之前的有效日期。';
        render({ keepScroll: true });
        return;
      }
      const entry = { ...d.draft, content, lines: {...d.draft.lines}, freeContent: d.draft.freeContent, dimensions: [...d.draft.dimensions], id: d.draft.id || `diary-${Date.now()}-${++sequence}` };
      const index = d.entries.findIndex(item => item.id === entry.id);
      if (index < 0) d.entries.unshift(entry); else d.entries[index] = entry;
      d.entries.sort((a, b) => b.date.localeCompare(a.date));
      d.example = false; d.detail = entry.id; d.draft = emptyDraft(); d.error = '';
      go('diary-entry'); toast('已留在本轮体验中，刷新后清除');
    }
  });
  function updateDraft(event) {
    const target=event.target;if(page!=='diary-write'||!target.isConnected)return;
    const draft=diary().draft,line=target.dataset.diaryLine,field=target.dataset.diaryField;
    if(['event','feeling','insight'].includes(line)){draft.lines[line]=target.value;draft.content=composeDraft(draft);}
    else if(field==='freeContent'){draft.freeContent=target.value;draft.content=composeDraft(draft);}
    else if(field==='date')draft.date=target.value;
    else return;
    $('#awareness-word-count').textContent=`${draft.content.length} / 2000 字`;
    $('#state-panel').textContent=diaryReviewState();
  }
  document.addEventListener('input', updateDraft);
  document.addEventListener('change', updateDraft);

  const style = document.createElement('style');
  style.textContent = `
.awareness-page .awareness-preview-note{font-size:10px;line-height:1.8;color:#7a8599;background:#eef2f9;padding:10px 12px;border-radius:10px;margin:2px 0 17px}
.awareness-page .awareness-heading{font-size:23px;line-height:1.6;letter-spacing:-.7px;font-weight:550;margin:16px 0 6px}
.awareness-page .awareness-subtitle{font-size:12px;line-height:1.8;color:var(--muted)}
.awareness-page .awareness-tabs{display:flex;gap:24px;border-bottom:1px solid #e1e7f1;margin:16px 0 13px}
.awareness-page .awareness-tabs button{font-size:12px;color:var(--muted);padding:11px 0;border-bottom:2px solid transparent;margin-bottom:-1px}
.awareness-page .awareness-tabs button.selected{color:var(--brand);border-color:var(--brand);font-weight:600}
.awareness-page .awareness-view-switch{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted);margin:12px 0}
.awareness-page .awareness-tree-card{background:white;border:1px solid var(--line);border-radius:19px;padding:15px 13px 13px}
.awareness-page .awareness-tree-card h3{font-size:15px;font-weight:550;line-height:1.7}
.awareness-page .awareness-tree-card .between p{font-size:10px;color:var(--muted);line-height:1.8;margin-top:3px}
.awareness-page .awareness-day-count{text-align:center;display:flex;flex-direction:column;color:#85979f;line-height:1.2}
.awareness-page .awareness-day-count b{font-size:25px;font-weight:500}.awareness-page .awareness-day-count span{font-size:9px;margin-top:5px;color:var(--muted)}
.awareness-page .awareness-tree-stage{position:relative;height:285px;margin:12px -4px 0}
.awareness-page .awareness-tree-art{position:absolute;inset:0;height:100%;width:100%}
.awareness-page .awareness-branch{position:absolute;padding:4px 5px;border-radius:7px;background:#ffffffec;border:1px solid transparent;font-size:10px;line-height:1.7;color:#65738a;min-width:56px}
.awareness-page .awareness-branch small{display:block;font-size:9px}.awareness-page .awareness-branch.selected{border-color:#dde5f0;background:#f5f8fc}
.awareness-page .awareness-branch--emotion{left:0;top:67%}.awareness-page .awareness-branch--relationship{right:0;top:70%}
.awareness-page .awareness-branch--needs{left:0;top:34%}.awareness-page .awareness-branch--action{right:0;top:36%}
.awareness-page .awareness-branch--thinking{left:10%;top:0}.awareness-page .awareness-branch--meaning{right:4%;top:0}
.awareness-page .awareness-tree-caption{color:var(--muted);font-size:9px;line-height:1.8;text-align:center}
.awareness-page .awareness-focus{padding:17px 2px 19px;margin-bottom:18px;border-bottom:1px solid var(--line)}
.awareness-page .awareness-focus h3{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:500}.awareness-page .awareness-focus small{font-size:9px;color:var(--muted)}
.awareness-page .awareness-focus h3 i,.awareness-page .awareness-entry-mood i{display:block;width:7px;height:7px;border-radius:50%;flex-shrink:0}
.awareness-page .awareness-focus p{font-size:12px;line-height:1.9;color:#65738a;margin:11px 0 8px}
.awareness-page .awareness-write-intro{font-size:19px;line-height:1.7;margin:17px 0}
.awareness-page .awareness-date{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#687891;border-bottom:1px solid var(--line);padding-bottom:12px}
.awareness-page .awareness-date input{font-size:12px;color:var(--brand);border:0;background:transparent;max-width:145px;min-width:0}
.awareness-page .awareness-field-title{font-size:13px;font-weight:500;margin:19px 0 10px}.awareness-page .awareness-field-title small{display:block;font-size:10px;color:var(--muted);font-weight:400;margin-top:4px}
.awareness-page .awareness-moods{display:flex;gap:7px;margin:11px 0 16px}
.awareness-page .awareness-mood{display:flex;flex:1;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:#78859b;background:white;border:1px solid var(--line);border-radius:10px;padding:10px 2px}
.awareness-page .awareness-mood.selected{border-color:#afbce5;background:#eef1ff;color:#5e70b5}
.awareness-page .awareness-mood i{width:16px;height:16px;border-radius:50%;box-shadow:inset 0 0 0 3px #ffffff55}
.awareness-page .awareness-writing-paper{background:white;border:1px solid #e0e6f0;border-radius:13px;padding:13px}
.awareness-page .awareness-writing-paper textarea{width:100%;height:180px;min-height:140px;resize:vertical;border:0;background:transparent;font-size:14px;line-height:1.95;color:var(--ink);display:block;padding:0}
.awareness-page .awareness-writing-paper textarea::placeholder{color:#9aa6ba}.awareness-page .awareness-writing-paper small{display:block;text-align:right;color:#98a3b6;font-size:10px;margin-top:8px}
.awareness-page .awareness-dimensions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.awareness-page .awareness-dimension{display:flex;justify-content:space-between;align-items:center;width:100%;font-size:12px;color:#7a869b;border:1px solid #e1e7f1;background:white;border-radius:10px;padding:11px 12px}
.awareness-page .awareness-dimension.selected{background:#eef4f2;border-color:#bfd8d1;color:#5e8e83}
.awareness-page .awareness-writing-prompt{font-size:11px;color:var(--muted);line-height:1.85;margin:15px 0 19px}
.awareness-page .awareness-entry-list{border-top:1px solid var(--line)}
.awareness-page .awareness-entry-row{width:100%;padding:19px 2px;text-align:left;border-bottom:1px solid #e1e7f1}
.awareness-page .awareness-entry-row h3{font-size:14px;font-weight:500}.awareness-page .awareness-entry-row>p{font-size:13px;color:#65738a;line-height:1.9;margin:11px 0;overflow-wrap:anywhere}
.awareness-page .awareness-entry-mood{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px}
.awareness-page .awareness-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.awareness-page .awareness-tags span{font-size:10px;color:#7c8ba2;background:#edf1f7;padding:3px 7px;border-radius:5px}
.awareness-page .awareness-empty{text-align:center;padding:53px 10px}.awareness-page .awareness-empty>.icon{margin:0 auto 20px;width:36px;height:36px;color:#99b4a9}
.awareness-page .awareness-empty h3{font-size:21px;font-weight:500}.awareness-page .awareness-empty p{font-size:12px;line-height:1.9;color:var(--muted);margin-top:13px}
.awareness-page .awareness-entry-detail{background:white;border:1px solid var(--line);padding:21px 17px;border-radius:16px;margin-top:18px}
.awareness-page .awareness-entry-detail h2{font-size:23px;line-height:1.6;font-weight:500;margin:18px 0 7px}
.awareness-page .awareness-entry-body{font-size:15px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere;margin:21px 0}
.awareness-page .awareness-letter-notice{color:#897b9d;font-size:10px;line-height:1.9;margin:17px 0}
.awareness-page .awareness-letter{position:relative;background:white;border:1px solid #e3e7f0;border-radius:5px 5px 17px 17px;padding:25px 20px;margin-bottom:20px}
.awareness-page .awareness-letter:before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#bdc8da;border-radius:5px 5px 0 0}
.awareness-page .awareness-letter-icon .icon{height:25px;width:25px;color:#8fa8aa;margin:auto}
.awareness-page .awareness-letter h2{text-align:center;font-size:23px;line-height:1.65;font-weight:500;letter-spacing:.5px;margin:16px 0 13px}
.awareness-page .awareness-letter-source{font-size:10px;text-align:center;color:#9aa5b5;margin-bottom:25px}
.awareness-page .awareness-letter-paragraph{font-size:14px;line-height:2.1;color:#536079;margin-bottom:18px}
.awareness-page .awareness-letter footer{text-align:right;font-size:12px;line-height:1.9;color:#6b7e96;margin-top:27px}.awareness-page .awareness-letter footer small{display:block;font-size:10px;color:#9aa5b5}
`;
  document.head.append(style);
})();
