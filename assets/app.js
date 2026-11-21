(() => {
'use strict';
const D=window.REVISION_DATA,C=window.ReviewCore,$=s=>document.querySelector(s),app=$('#app'),labels={choice:'选择',fill:'填空',calculation:'计算',coding:'算法',integrated:'综合'},evidence={explicit:'纪要明确提及',emphasis:'纪要强调',likely:'纪要判断',suggestion:'复习建议'};
const chapters=D?.chapters||[],cm=new Map(chapters.map(x=>[x.id,x])),qm=new Map(chapters.flatMap(c=>c.questions.map(q=>[q.id,{...q,chapterId:c.id,chapterTitle:c.title}])));
const S={view:'overview',chapter:null,query:'',lab:'quick',trace:null,quiz:null,progress:load(),importMessage:''};
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function load(){try{let x=localStorage.getItem('ds-final-review-progress-v1');return x?C.importProgress(x):C.makeProgress()}catch{return C.makeProgress()}}
function save(){try{localStorage.setItem('ds-final-review-progress-v1',C.exportProgress(S.progress))}catch{}}
function nav() {
  const activeView = S.view === 'quiz'
    ? { mock: 'mock', wrong: 'wrong' }[S.quiz?.kind] || 'practice'
    : S.view === 'chapter' ? 'chapters' : S.view;
  document.querySelectorAll('nav [data-view]').forEach(button => {
    const active = button.dataset.view === activeView;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#wrong-count').textContent = S.progress.wrong.filter(id => qm.has(id)).length;
}
function show(v){S.view=v;draw();window.scrollTo({top:0,behavior:'smooth'})}
function shell(title,kicker,desc,html){app.innerHTML=`<div class="page-wrap">${kicker?`<div class="eyebrow">${esc(kicker)}</div>`:''}<h1>${esc(title)}</h1>${desc?`<p class="lede">${esc(desc)}</p>`:''}${html}</div>`;app.setAttribute('aria-busy','false');nav()}
function sect(t,n=''){return `<div class="section-head"><div><h2>${esc(t)}</h2>${n?`<p>${esc(n)}</p>`:''}</div></div>`}
function stats(){let a=S.progress.attempts;return {done:new Set(a.map(x=>x.questionId)).size,rate:a.length?Math.round(a.filter(x=>x.correct).length/a.length*100):0}}
function pct(ch){let ids=ch.topics.map(t=>t.id);return ids.length?Math.round(ids.filter(x=>S.progress.mastered.includes(x)).length/ids.length*100):0}
function chapterCard(c){return `<button class="chapter-card" data-action="chapter" data-id="${esc(c.id)}"><span class="chapter-number">${String(c.number).padStart(2,'0')}</span><span class="chapter-copy"><strong>${esc(c.title)}</strong><small>${c.topics.length}个主题 · ${c.questions.length}道练习</small></span><span class="chapter-progress">${pct(c)}%</span></button>`}
function overview(){let st=stats(),nt=chapters.reduce((n,c)=>n+c.topics.length,0),nq=chapters.reduce((n,c)=>n+c.questions.length,0);shell('数据结构期末复习','','查看教材知识点、算法步骤和自编习题。网页可离线使用。',`
<section class="hero"><div><h2>选择复习方式</h2><p class="lede">按章查看例题和代码，或按题型挑选一组练习。</p><div class="button-row"><button class="button light" data-view="chapters">浏览章节 →</button><button class="button secondary" data-view="practice">开始随机练习</button></div></div><div class="hero-mark"><strong>8 × 5</strong><span>8个章节 · 5类练习<br>选择、填空、计算、算法与综合</span></div></section>
<div class="stats-grid"><div class="stat-card"><span class="stat-label">章节覆盖</span><span class="stat-value">8<small>章</small></span></div><div class="stat-card"><span class="stat-label">知识主题</span><span class="stat-value">${nt}<small>个</small></span></div><div class="stat-card"><span class="stat-label">已练题目</span><span class="stat-value">${st.done}<small>/${nq}</small></span></div><div class="stat-card"><span class="stat-label">累计正确率</span><span class="stat-value">${st.rate}<small>%</small></span></div></div>
${sect('章节地图','查看知识点、教材页码和配套练习。')}<div class="chapter-grid">${chapters.map(chapterCard).join('')}</div>
${sect('建议的复习节奏','优先级表示训练顺序，不是分值预测。')}<div class="grid-two"><article class="panel"><h3>先练关键算法</h3><ul><li>串匹配：BF、KMP与next/nextval约定</li><li>二叉树：遍历、建树与哈夫曼WPL</li><li>图：最小生成树、最短路径和概念</li><li>折半查找与排序：过程、边界和代码</li></ul></article><article class="panel"><h3>再检验薄弱点</h3><ul><li>按章节或题型随机练习</li><li>错题自动收录，答对后自动移除</li><li>模拟卷按训练用100分结构组卷</li><li>学习记录保存在当前浏览器，可导出</li></ul></article></div><div class="note-card" style="margin-top:15px"><span class="note-icon">ⓘ</span><span><b>范围说明：</b>依据用户提供的考试纪要整理。分值冲突与概率措辞保留注记；自编题不是教材原题、历年真题或押题。</span></div>`)}
function chaptersView() {
  const cards = (query) => {
    const keyword = query.trim().toLowerCase();
    const matches = chapters.filter(chapter => {
      const fullText = [chapter.title, chapter.summary, ...chapter.examFocus, ...chapter.topics.map(topic =>
        [topic.title, topic.summary, ...topic.concepts.map(concept => concept.term)].join(' '))].join(' ');
      return fullText.toLowerCase().includes(keyword);
    });
    return matches.length ? matches.map(chapterCard).join('') : '<div class="empty-state">没有找到相关章节。试试主题名称或术语。</div>';
  };
  shell('章节知识', 'CHAPTER GUIDE', '查看各章节的知识点和配套练习。', `
    <div class="toolbar" style="margin-top:20px"><input id="chapter-search" class="input search" type="search" placeholder="搜索哈夫曼、折半、希尔等主题" value="${esc(S.query)}" aria-label="搜索章节知识"></div>
    <div id="chapter-list" class="chapter-grid" style="margin-top:14px">${cards(S.query)}</div>`);
  $('#chapter-search').addEventListener('input', event => {
    S.query = event.target.value;
    $('#chapter-list').innerHTML = cards(S.query);
  });
}
function topicCard(ch,t){let p=t.source.printedPages,f=t.source.pdfPages,qs=ch.questions.filter(q=>q.topicId===t.id),pri=t.priority==='focus'?'重点训练':t.priority==='foundation'?'基础概念':'章节备查',cls=t.priority==='focus'?'pill':t.priority==='foundation'?'pill amber':'pill blue';return `<article class="topic-card"><div class="topic-title-row"><h3>${esc(t.title)}</h3><span class="${cls}">${pri}</span><span class="pill blue">${esc(evidence[t.examEvidence.level]||'范围注记')}</span></div><p class="topic-summary">${esc(t.summary)}</p><div class="topic-body"><div><h4>概念与操作步骤</h4><ul>${t.concepts.map(c=>`<li><b>${esc(c.term)}：</b>${esc(c.definition)}</li>`).join('')}</ul><ol style="margin-top:8px">${t.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${t.formulas.length?`<h4 style="margin-top:13px">公式与条件</h4><ul>${t.formulas.map(f=>`<li><b>${esc(f.label)}：</b><code>${esc(f.expression)}</code> — ${esc(f.condition)}</li>`).join('')}</ul>`:''}</div><div><div class="example-box"><h4>例题 · ${esc(t.example.title)}</h4><p><b>题目：</b>${esc(t.example.problem)}</p><ol>${t.example.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p><strong>结论：</strong>${esc(t.example.answer)}</p></div><h4>容易出错</h4><ul>${t.pitfalls.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${t.code?`<h4>${esc(t.code.label)}</h4><pre class="topic-code">${esc(t.code.text)}</pre><ul>${t.code.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</div></div><div class="source-line">教材：${esc(t.source.section)} · 印刷页${p[0]}–${p[1]}（PDF第${f[0]}–${f[1]}页）<br>范围：${esc(t.examEvidence.note)}<br>${esc(t.example.sourceNote)}</div><div class="topic-actions"><button class="button small secondary" data-action="master" data-id="${esc(t.id)}">${S.progress.mastered.includes(t.id)?'✓ 已掌握 · 取消':'标记已掌握'}</button>${qs.length?`<button class="button small" style="margin-left:8px" data-action="topic-quiz" data-ch="${ch.id}" data-topic="${t.id}">练本主题 ${qs.length} 题 →</button>`:''}</div></article>`}
function chapterView(){let ch=cm.get(S.chapter);if(!ch)return show('chapters');shell(`第${ch.number}章 · ${ch.title}`,'CHAPTER '+String(ch.number).padStart(2,'0'),ch.summary,`<div class="button-row" style="margin-top:17px"><button class="button secondary small" data-view="chapters">← 返回章节</button><button class="button small" data-action="chapter-quiz" data-id="${ch.id}">本章随机练习</button></div>${ch.examFocus?.length?`<div class="panel" style="margin-top:16px"><h3>考试范围提示</h3><ul>${ch.examFocus.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}<div class="topic-list">${ch.topics.map(t=>topicCard(ch,t)).join('')}</div>${sect('本章题型分布','训练题数不等于实际考试题数。')}<div class="mock-table">${Object.entries(labels).map(([k,v])=>`<div class="mock-item"><strong>${ch.questions.filter(q=>q.type===k).length}</strong><small>${v}</small></div>`).join('')}</div>`)}
function practiceView(){let ty=Object.entries(labels).map(([k,v])=>`<label class="checkbox-label"><input name="type" type="checkbox" value="${k}" ${['choice','fill'].includes(k)?'checked':''}>${v}</label>`).join(''),opts=chapters.map(c=>`<option value="${c.id}">第${c.number}章 · ${esc(c.title)}</option>`).join('');shell('练习，让理解可见。','PRACTICE MODE','选择章节与题型，从自编题库随机抽题。选择和填空自动判分；开放题请展开答案自评。',`<form id="practice-form" class="panel" style="margin-top:21px"><div class="grid-two"><label><span class="stat-label">章节范围</span><select class="select" name="chapter" style="width:100%;margin-top:7px"><option value="">全书随机</option>${opts}</select></label><label><span class="stat-label">抽题数量</span><select class="select" name="count" style="width:100%;margin-top:7px"><option>10</option><option>15</option><option>20</option><option>30</option></select></label></div><div style="margin-top:17px"><span class="stat-label">题型</span><div class="checkbox-row" style="margin-top:9px">${ty}</div></div><div class="button-row"><button class="button">生成练习 →</button></div></form>${sect('题库概览','章节和题型数量。')}<div class="panel"><table class="scope-table"><thead><tr><th>章节</th>${Object.values(labels).map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${chapters.map(c=>`<tr><td>第${c.number}章 · ${esc(c.title)}</td>${Object.keys(labels).map(k=>`<td>${c.questions.filter(q=>q.type===k).length}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)}
function solutionDetails(question) {
  const selected = question.answer;
  const reference = question.type === 'choice'
    ? String.fromCharCode(65 + selected) + '. ' + question.options[selected]
    : selected;
  const sample = question.type === 'coding' && question.code
    ? `<pre class="topic-code">${esc(question.code)}</pre>`
    : '';
  return `<details class="answer-details"><summary>展开参考答案与解题步骤</summary>
    <div class="answer-content">
      <p><b>参考答案</b></p><div class="answer-text">${esc(reference)}</div>${sample}
      <ol>${question.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
      <p>${esc(question.explanation)}</p><p>${esc(question.sourceNote)}</p>
    </div>
  </details>`;
}

function qcard(question, index) {
  const { id, type, points, chapterTitle, chapterId, difficulty, prompt } = question;
  const selected = S.quiz.answers[id];
  const detail = S.quiz.result?.details.find(item => item.questionId === id);
  const locked = detail && detail.correct !== null ? 'disabled' : '';
  let response;
  if (type === 'choice') {
    response = `<div class="option-list">${question.options.map((option, i) => `
      <label class="option"><input type="radio" name="a-${id}" value="${i}" ${selected === i ? 'checked' : ''} ${locked}>
      <span><b>${String.fromCharCode(65 + i)}.</b> ${esc(option)}</span></label>`).join('')}</div>`;
  } else if (type === 'fill') {
    response = `<pre class="topic-code">${esc(question.code)}</pre>${question.blanks.map((blank, i) => `
      <div class="fill-row"><span class="fill-number">${i + 1}</span>
      <input class="input" name="f-${id}-${i}" value="${esc(selected?.[i] ?? '')}" placeholder="填写第${i + 1}空" aria-label="${id}第${i + 1}空" ${locked}></div>
      ${blank.hint && !detail && S.quiz.kind !== 'mock' ? `<div class="hint">提示：${esc(blank.hint)}</div>` : ''}`).join('')}`;
  } else {
    const checked = S.quiz.checks[id];
    response = `${solutionDetails(question)}<div class="self-check"><span class="stat-label">对照答案自评</span>
      <label><input type="radio" name="s-${id}" value="true" ${checked === true ? 'checked' : ''} ${locked}>基本答对</label>
      <label><input type="radio" name="s-${id}" value="false" ${checked === false ? 'checked' : ''} ${locked}>还需复习</label>
    </div>`;
  }
  let feedback = '';
  if (detail?.correct === null) {
    feedback = '<div class="result-line pending">对照答案后选择“基本答对”或“还需复习”。</div>';
  } else if (detail) {
    feedback = `<div class="result-line ${detail.correct ? 'good' : 'bad'}">${detail.correct ? '本题已掌握' : '加入错题复习'} · ${detail.score}/${detail.max}分</div>`;
  }
  if (detail && (type === 'choice' || type === 'fill')) response += solutionDetails(question);
  return `<article class="question-card"><div class="question-top"><span class="q-index">Q${String(index + 1).padStart(2, '0')}</span>
    <span class="pill">${labels[type]}</span><span class="pill amber">${points}分</span><span class="pill blue">${esc(difficulty)}</span>
    <span class="stat-label">${esc(chapterTitle || cm.get(chapterId)?.title || '')} · ${esc(id)}</span></div>
    <p class="question-prompt">${esc(prompt)}</p>${response}${feedback}</article>`;
}
function quizView() {
  if (!S.quiz) return show('practice');
  const { items, sections, result, title, kind } = S.quiz;
  const body = sections
    ? Object.entries(sections).map(([type, questions]) => `<h2 style="margin-top:24px">${labels[type]} <span class="pill">${questions.reduce((sum, q) => sum + q.points, 0)}分</span></h2>${questions.map(q => qcard(q, items.findIndex(item => item.id === q.id))).join('')}`).join('')
    : items.map(qcard).join('');
  const score = result ? `<div class="quiz-score"><strong>${result.earned} / ${result.maximum}</strong> <small>已计分 · ${result.incorrect.length}道待复习</small>
    <p style="margin:8px 0">${result.pending.length ? `还有 ${result.pending.length} 道开放题待自评。依次对照答案，再提交剩余自评。` : '本次作答已计入学习记录。'}</p></div>` : '';
  const submit = !result || result.pending.length
    ? `<button class="button">${result ? '提交剩余自评' : '交卷并查看得分'}</button>`
    : '';
  const desc = kind === 'mock'
    ? '模拟卷按纪要分值组织。选择题采用训练用题量，开放题由你对照答案自评。'
    : `${items.length} 道题 · 开放题由你对照参考步骤自评。`;
  shell(title, 'YOUR PRACTICE', desc, `${score}<form id="quiz-form">${body}<div class="button-row">${submit}<button class="button secondary" type="button" data-action="new-quiz">再来一组</button></div></form>`);
}
function startQuiz(items,title,kind='practice',sections=null){if(!items.length){alert('该范围暂无可用题目。');return}items=items.map(q=>({...q,chapterId:q.chapterId||q.id.slice(0,4),chapterTitle:q.chapterTitle||cm.get(q.chapterId||q.id.slice(0,4))?.title||''}));S.quiz={title,kind,items,sections,answers:{},checks:{},result:null};show('quiz')}
function mockView(){shell('100 分模拟卷','MOCK EXAM · PRACTICE SET','按训练方案随机组卷，总分100分；只用于自测覆盖，不表示实际考试题量、比例或原题。',`<div class="mock-table">${[['40','选择 · 20题'],['20','程序填空 · 10空'],['20','计算 · 4题'],['10','算法 · 2题'],['10','综合 · 1题']].map(x=>`<div class="mock-item"><strong>${x[0]}</strong><small>${x[1]}</small></div>`).join('')}</div><div class="note-card"><span class="note-icon">ⓘ</span><span>选择与填空自动评分。开放题请展开答案自评；等权或算法版本差异会注明。实际题型题数尚未核实。</span></div><div class="panel" style="margin-top:15px"><h3>开考前检查</h3><ul><li>建议预留45–60分钟，不查答案完成客观题。</li><li>填空共10空，每空2分，检查边界条件。</li><li>开放题按步骤和前提逐项核对。</li></ul><div class="button-row"><button class="button" data-action="mock">生成随机模拟卷 →</button></div></div>`)}
function wrongView() {
  const questions = S.progress.wrong.map(id => qm.get(id)).filter(Boolean);
  const attempts = S.progress.attempts.slice(-12).reverse();
  const cards = questions.length ? questions.map(q => `<article class="question-card">
    <div class="question-top"><span class="pill">${labels[q.type]}</span><span class="stat-label">${esc(q.chapterTitle)} · ${esc(q.id)}</span></div>
    <p class="question-prompt">${esc(q.prompt)}</p>${solutionDetails(q)}</article>`).join('') : '<div class="empty-state">当前没有待复习题目。</div>';
  const records = attempts.length ? `<table class="scope-table"><thead><tr><th>题目</th><th>题型</th><th>结果</th><th>得分</th><th>时间</th></tr></thead><tbody>
    ${attempts.map(a => `<tr><td>${esc(a.questionId)}</td><td>${esc(labels[a.type] || a.type)}</td><td>${a.correct ? '正确' : '再复习'}</td>
    <td>${a.score}/${a.max}</td><td>${esc((a.at || '').replace('T', ' ').slice(0, 16))}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty-state">还没有作答记录。</div>';
  shell('错题与记录', 'REVIEW LOG', `${S.progress.attempts.length} 次作答 · ${questions.length} 道待复习 · ${S.progress.mastered.length} 个主题标为已掌握`, `
    <div class="button-row"><button class="button" data-action="retry" ${questions.length ? '' : 'disabled'}>错题重练 →</button>
    <button class="button secondary" data-action="export">导出记录</button><label class="button secondary" for="progress-file">导入记录</label>
    <input id="progress-file" type="file" accept="application/json,.json" hidden></div>
    <p class="stat-label">导入备份会替换当前学习记录。</p><div role="status">${esc(S.importMessage)}</div>
    ${sect('待复习题目', questions.length ? '答对后自动移出错题列表。' : '')}${cards}
    ${sect('最近作答', '仅记录题号、得分与时间。')}<div class="panel" style="overflow:auto">${records}</div>`);
}
function traceHtml(){let r=S.trace;if(!r)return '<div class="empty-state">运行演示后在这里查看步骤。</div>';if(r.kind==='kmp')return renderKmpTrace(r);if(r.kind==='bfs')return r.steps.map((s,i)=>`<div class="trace-step"><strong>第${i+1}步 · 出队${esc(s.vertex)}</strong><div>新发现：${s.discovered.length?s.discovered.map(esc).join('、'):'无'}<br>队列：${s.queue.length?s.queue.map(esc).join(' → '):'空'}</div></div>`).join('')+`<div class="panel"><b>BFS序列：</b>${r.order.map(esc).join(' → ')}${r.visitedCount<r.total?`<p>从此起点可达${r.visitedCount}个顶点，其余顶点从这个起点不可达。</p>`:''}</div>`;return r.trace.map((s,i)=>`<div class="trace-step"><strong>分区${i+1}</strong><div>区间[${s.low}, ${s.high}] · 枢轴${s.pivot} → 下标${s.pivotIndex}<div class="trace-values" style="margin-top:7px">${s.values.map(v=>`<span>${esc(v)}</span>`).join('')}</div></div></div>`).join('')+`<div class="panel"><b>排序结果：</b><div class="trace-values" style="margin-top:9px">${r.sorted.map(v=>`<span>${esc(v)}</span>`).join('')}</div><p>闭区间、末元素枢轴Lomuto版本；与教材其他快排版本过程可能不同。</p></div>`}
function labView() {
  const modes = { quick: '快速排序 · Lomuto', bfs: '图遍历 · BFS', kmp: '串匹配 · KMP' };
  const controls = {
    quick: `<label class="stat-label" for="lab-input">数字序列，用逗号分隔</label>
      <input class="input" id="lab-input" value="5, 2, 7, 1, 4" style="width:100%;margin-top:7px" required>`,
    bfs: `<label class="stat-label" for="lab-input">邻接表 JSON，数组顺序决定访问次序</label>
      <textarea class="input" id="lab-input" style="width:100%;height:100px;margin-top:7px" required>{"A":["B","C"],"B":["A","D"],"C":["A","D"],"D":["B","C"]}</textarea>
      <label class="stat-label" for="lab-start" style="display:block;margin-top:10px">起点</label>
      <input id="lab-start" class="input" value="A" style="margin-top:5px" required>`,
    kmp: `<label class="stat-label" for="lab-input">主串</label>
      <input class="input" id="lab-input" value="ababaacababac" style="width:100%;margin-top:7px" required>
      <label class="stat-label" for="lab-pattern" style="display:block;margin-top:10px">模式串</label>
      <input class="input" id="lab-pattern" value="ababac" style="width:100%;margin-top:5px" required>
      <p class="stat-label">从 1 开始编号，next[1] = 0。匹配区分大小写。</p>`,
  };
  const buttons = Object.entries(modes).map(([kind, name]) => `<button class="button ${S.lab === kind ? '' : 'secondary'}" aria-pressed="${S.lab === kind}" data-action="lab-kind" data-kind="${kind}">${name}</button>`).join('');
  shell('算法演练', 'ALGORITHM LAB', '输入数据，查看算法每一步的状态变化。', `
    <div class="button-row">${buttons}</div>
    <form id="lab-form" class="panel" style="margin-top:15px">${controls[S.lab]}
      <div class="button-row"><button class="button">运行演示</button></div>
      <p id="lab-error" role="alert" class="stat-label" hidden></p>
    </form>
    <div id="lab-output" class="lab-output" aria-live="polite">${traceHtml()}</div>`);
}

function renderKmpTrace(result) {
  const conclusion = result.position ? '从主串第 ' + result.position + ' 个字符开始匹配' : '未找到匹配';
  const next = result.next.map((value, i) => `<span>next[${i + 1}]=${value}</span>`).join('');
  const steps = result.steps.map((step, i) => {
    const description = step.action === 'advance'
      ? 'j=0，主串与模式串下标同时前进'
      : step.action === 'match'
        ? '两个字符相同，同时前进'
        : '字符不同，主串下标不变，模式串按 next 回退';
    const pair = step.j === 0 ? '' : `<br>比较“${esc(step.textChar)}”与“${esc(step.patternChar)}”`;
    return `<div class="trace-step"><strong>第 ${i + 1} 步</strong><div>(i, j) = (${step.i}, ${step.j}) → (${step.nextI}, ${step.nextJ})${pair}<br>${description}</div></div>`;
  }).join('');
  return `<div class="panel"><h3>${conclusion}</h3><p>next 表</p><div class="trace-values">${next}</div></div>${steps}`;
}
const scopeRows=[['1 绪论','数据、数据元素、抽象数据类型与算法分析。','算法性质和复杂度是基础；按章节自编选择练习。'],['2 线性表','顺序表插入/查找与单链表头插、尾插。','程序训练标明下标和带/不带头结点。'],['3 栈和队列','LIFO、FIFO；顺序栈与循环队列操作。','循环队列留一空位时，空front==rear，满(rear+1)%M==front。'],['4 串、数组和广义表','BF/KMP与next约定、数组地址、广义表辨析。','广义表优先选择题；是否只考选择待核实。'],['5 树和二叉树','遍历与充分序列建树；哈夫曼树和WPL。','输入足以唯一确定树；哈夫曼并列接受等价最优树。'],['6 图','遍历、最小生成树、最短路径。','纪要对综合应用含条件句，不标成必考。'],['7 查找','折半查找及代码；二叉排序树构造。','边界使用闭区间，重复键策略单独说明。'],['8 排序','插入、希尔、冒泡、快速；堆与归并基础。','希尔增量、快排分区方法显式给出。']];
function scopeView(){shell('考试范围与教材依据','SCOPE & SOURCES','各主题附有教材节号与页码，复习顺序参照考试纪要。',`<div class="note-card" style="margin-top:18px"><span class="note-icon">ⓘ</span><span>纪要正文与饼图将选择题列为 40 分，概览图列为 20 分。模拟卷采用 40 分，正式分值待确认。</span></div><div class="panel" style="margin-top:15px;overflow:auto"><table class="scope-table"><thead><tr><th>章节</th><th>复习重点</th><th>口径</th></tr></thead><tbody>${scopeRows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="grid-two" style="margin-top:14px"><article class="panel"><h3>纪要与教材对照</h3><ul><li>留一空位的循环队列用 <code>front == rear</code> 判空，用 <code>(rear + 1) % M == front</code> 判满。见教材 §3.5.2，印刷第79页。</li><li>教材顺序栈的 <code>top</code> 指向下一空位，<code>top == base</code> 时为空。见教材 §3.3.2，印刷第66页。</li></ul></article><article class="panel"><h3>训练题来源</h3><p>题库采用自编练习。知识点同时列出教材印刷页和 PDF 物理页，正文相差 12 页。正式题量和考试日期以老师通知为准。</p></article></div>`)}
function draw(){if(!D?.chapters?.length){app.innerHTML='<div class="empty-state">缺少题库，请运行构建脚本生成 dist。</div>';return}({overview,chapters:chaptersView,chapter:chapterView,practice:practiceView,quiz:quizView,mock:mockView,wrong:wrongView,lab:labView,scope:scopeView}[S.view]||overview)();nav()}
const themeToggle=$('#theme-toggle');
const themeStorageKey='ds-final-review-theme-v1';
let savedTheme=null;
try{savedTheme=localStorage.getItem(themeStorageKey)}catch{}
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let hasSavedTheme=savedTheme==='dark'||savedTheme==='light';
function setTheme(theme,persist=false){
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  if(themeToggle){themeToggle.setAttribute('aria-pressed',String(dark));themeToggle.title=dark?'切换为浅色主题':'切换为暗色主题';themeToggle.innerHTML=`<span aria-hidden="true">${dark?'☀':'☾'}</span>`}
  $('meta[name="theme-color"]')?.setAttribute('content',dark?'#111714':'#f4f5f1');
  if(persist)try{localStorage.setItem(themeStorageKey,dark?'dark':'light')}catch{}
}
if(themeToggle){
  setTheme(hasSavedTheme?savedTheme:systemTheme.matches?'dark':'light');
  if(!hasSavedTheme)systemTheme.addEventListener('change',event=>{if(!hasSavedTheme)setTheme(event.matches?'dark':'light')});
  themeToggle.addEventListener('click',()=>{hasSavedTheme=true;setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true)});
}
document.addEventListener('click',e=>{let n=e.target.closest('[data-view]');if(n){show(n.dataset.view);return}let b=e.target.closest('[data-action]');if(!b)return;let a=b.dataset.action;if(a==='chapter'){S.chapter=b.dataset.id;show('chapter')}else if(a==='chapter-quiz'){let c=cm.get(b.dataset.id);startQuiz(C.shuffle(c.questions),`第${c.number}章 · ${c.title}练习`)}else if(a==='topic-quiz'){let c=cm.get(b.dataset.ch);startQuiz(c.questions.filter(q=>q.topicId===b.dataset.topic),`${c.title} · 主题练习`)}else if(a==='master'){let id=b.dataset.id;S.progress.mastered=S.progress.mastered.includes(id)?S.progress.mastered.filter(x=>x!==id):[...S.progress.mastered,id];save();draw()}else if(a==='mock'){try{let sec=C.buildExam(chapters,Date.now());Object.values(sec).flat().forEach(q=>{q.chapterId=q.id.slice(0,4);q.chapterTitle=cm.get(q.chapterId)?.title||''});startQuiz(Object.values(sec).flat(),'100分模拟练习','mock',sec)}catch(x){alert(x.message)}}else if(a==='new-quiz')show(S.quiz.kind==='mock'?'mock':S.quiz.kind==='wrong'?'wrong':'practice');else if(a==='retry'){let qs=S.progress.wrong.map(id=>qm.get(id)).filter(Boolean);startQuiz(qs,'错题重练','wrong')}else if(a==='export'){let u=URL.createObjectURL(new Blob([C.exportProgress(S.progress)],{type:'application/json'})),x=document.createElement('a');x.href=u;x.download='data-structures-review-progress.json';x.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}else if(a==='lab-kind'){S.lab=b.dataset.kind;S.trace=null;draw()}});
function gradeCurrentQuiz(form) {
  const quiz = S.quiz;
  const data = new FormData(form);
  const answers = { ...quiz.answers };
  const checks = { ...quiz.checks };
  const candidateIds = new Set(quiz.result ? quiz.result.pending : quiz.items.map(q => q.id));
  for (const question of quiz.items) {
    const { id, type } = question;
    if (!candidateIds.has(id)) continue;
    if (type === 'choice') {
      const value = data.get(`a-${id}`);
      if (value !== null) answers[id] = Number(value);
    } else if (type === 'fill') {
      answers[id] = question.blanks.map((_, i) => data.get(`f-${id}-${i}`) ?? '');
    } else {
      const value = data.get(`s-${id}`);
      if (value !== null) checks[id] = value === 'true';
    }
  }
  const result = C.scoreQuiz(quiz.items, answers, checks);
  Object.assign(quiz, { answers, checks, result });
  for (const detail of result.details) {
    if (detail.correct === null || !candidateIds.has(detail.questionId)) continue;
    const question = qm.get(detail.questionId);
    S.progress = C.recordAttempt(S.progress, {
      questionId: question.id, chapterId: question.chapterId, type: question.type,
      correct: detail.correct, score: detail.score, max: detail.max,
    });
  }
  save();
  quizView();
}

function runLab() {
  const raw = $('#lab-input').value;
  const error = $('#lab-error');
  try {
    if (S.lab === 'quick') {
      const tokens = raw.split(/[,，]/).map(token => token.trim());
      const values = tokens.map(Number);
      if (tokens.length > 40 || tokens.some(token => !token) || values.some(value => !Number.isFinite(value))) {
        throw new Error('请输入 1 至 40 个数字，数字之间用逗号分隔。');
      }
      const trace = C.quickSortTrace(values);
      S.trace = { kind: 'quick', trace, sorted: trace.at(-1)?.values ?? values };
    } else if (S.lab === 'kmp') {
      const pattern = $('#lab-pattern').value;
      if (Array.from(raw).length > 120 || Array.from(pattern).length > 40 || !pattern) {
        throw new Error('主串最多 120 个字符，模式串需包含 1 至 40 个字符。');
      }
      S.trace = { ...C.kmpTrace(raw, pattern), kind: 'kmp' };
    } else {
      let graph;
      try { graph = JSON.parse(raw); } catch { throw new Error('请输入合法的邻接表 JSON。'); }
      if (!graph || typeof graph !== 'object' || Array.isArray(graph)) throw new Error('邻接表必须是 JSON 对象。');
      const vertices = Object.keys(graph);
      if (!vertices.length || vertices.length > 80 || vertices.some(vertex => !vertex || vertex.length > 40)) {
        throw new Error('请定义 1 至 80 个顶点，顶点名需要包含 1 至 40 个字符。');
      }
      if (Object.values(graph).some(row => !Array.isArray(row) || row.length > 80 || row.some(v => typeof v !== 'string' || !Object.hasOwn(graph, v)))) {
        throw new Error('每个顶点的邻接项都必须是数组，且只能引用已定义的顶点。');
      }
      const start = $('#lab-start').value.trim();
      if (!Object.hasOwn(graph, start)) throw new Error('起点不在邻接表中。');
      S.trace = { ...C.bfsTrace(graph, start), kind: 'bfs', total: vertices.length };
    }
    error.textContent = '';
    error.hidden = true;
  } catch (problem) {
    S.trace = null;
    error.textContent = problem.message;
    error.hidden = false;
  }
  $('#lab-output').innerHTML = traceHtml();
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id === 'practice-form') {
    event.preventDefault();
    const data = new FormData(form);
    const types = data.getAll('type');
    if (!types.length) return alert('请至少选择一种题型。');
    const chapterId = data.get('chapter') || null;
    const chapter = cm.get(chapterId);
    const items = C.buildQuiz({ chapters, chapterId, types, count: Number(data.get('count')) });
    startQuiz(items, chapter ? chapter.title + '专项练习' : '随机题型练习');
  } else if (form.id === 'quiz-form') {
    event.preventDefault();
    gradeCurrentQuiz(form);
  } else if (form.id === 'lab-form') {
    event.preventDefault();
    runLab();
  }
});
document.addEventListener('change', async event => {
  if (event.target.id !== 'progress-file') return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Progress file is too large');
    S.progress = C.importProgress(await file.text());
    save();
    S.importMessage = '学习记录已导入。';
  } catch {
    S.importMessage = '无法读取学习记录，请选择本复习站导出的 JSON 备份。';
  }
  if (S.view === 'wrong') wrongView();
});
draw();
})();
