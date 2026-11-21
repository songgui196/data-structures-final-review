import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExam } from '../assets/core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chapterDir = path.join(root, 'knowledge', 'chapters');
const chapters = Array.from({ length: 8 }, (_, i) => {
  const file = path.join(chapterDir, `ch${String(i + 1).padStart(2, '0')}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  if (/[\uFFFD\u0000]|\?{2,}/u.test(raw)) throw new Error(
    'Invalid text encoding or replacement characters in ' + path.basename(file),
  );
  return JSON.parse(raw);
});
const allowedTypes = new Set(['choice', 'fill', 'calculation', 'coding', 'integrated']);
const seenQuestionIds = new Set();
const seenTopicIds = new Set();
for (const [i, ch] of chapters.entries()) {
  const expected = `ch${String(i + 1).padStart(2, '0')}`;
  if (ch.id !== expected || ch.number !== i + 1) throw new Error(`${expected}: chapter id/number mismatch`);
  if (ch.topics.length < 3 || ch.topics.length > 6) throw new Error(`${ch.id}: expected 3–6 topics`);
  if (ch.questions.length < 10 || ch.questions.length > 14) throw new Error(`${ch.id}: expected 10–14 questions`);
  const localTopics = new Set(ch.topics.map(t => t.id));
  for (const t of ch.topics) {
    if (seenTopicIds.has(t.id)) throw new Error(`duplicate topic id ${t.id}`);
    seenTopicIds.add(t.id);
    if (!t.title || t.summary.length < 80 || !t.concepts?.length || !t.steps?.length || !t.pitfalls?.length) throw new Error(`${t.id}: incomplete topic`);
    if (!t.example?.title || !t.example.problem || !t.example.answer || !t.example.steps?.length) throw new Error(`${t.id}: incomplete worked example`);
    if (!t.source?.section || t.source.verified !== 'text') throw new Error(`${t.id}: missing source provenance`);
    const [p0, p1] = t.source.printedPages, [f0, f1] = t.source.pdfPages;
    if (f0 - p0 !== 12 || f1 - p1 !== 12 || f1 < f0) throw new Error(`${t.id}: printed/PDF page mapping mismatch`);
    if (t.code && t.code.text.length < 60) throw new Error(`${t.id}: code sample too short`);
  }
  for (const q of ch.questions) {
    if (seenQuestionIds.has(q.id)) throw new Error(`duplicate question id ${q.id}`);
    seenQuestionIds.add(q.id);
    if (!allowedTypes.has(q.type) || !localTopics.has(q.topicId)) throw new Error(`${q.id}: unknown type or topic link`);
    if (!q.prompt || !q.explanation || !q.answer && q.answer !== 0 || !q.steps?.length || !q.points) throw new Error(`${q.id}: incomplete solution`);
    if (!/自编|改编/.test(q.sourceNote || '')) throw new Error(`${q.id}: missing authored/adapted provenance`);
    if (q.type === 'choice' && (!Array.isArray(q.options) || q.options.length < 3 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)) throw new Error(`${q.id}: invalid choice answer`);
    if (q.type === 'fill' && (!q.blanks?.length || !q.code || q.points !== q.blanks.length * 2)) throw new Error(`${q.id}: invalid fill-point contract`);
    if (q.type === 'coding' && !((typeof q.code === 'string' && q.code.length > 60) || (typeof q.answer === 'string' && q.answer.length > 100))) throw new Error(`${q.id}: coding solution must include a substantive code sample`);
  }
  if (i === 0 && ch.questions.some(q => q.type !== 'choice')) throw new Error('chapter 1 must remain choice-only');
}
const exam = buildExam(chapters, 20261121);
const examScore = Object.values(exam).flat().reduce((n, q) => n + q.points, 0);
if (examScore !== 100) throw new Error(`mock exam totals ${examScore}, expected 100`);

function mkdir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function write(file, content) { mkdir(file); fs.writeFileSync(file, content, 'utf8'); }
function md(value) { return String(value ?? '').replaceAll('|', '\\|'); }
function chapterMarkdown(ch) {
  const parts = [`# 第${ch.number}章 · ${ch.title}`, '', `> ${ch.summary}`, '', '## 考试范围提示', '', ...ch.examFocus.map(x => `- ${x}`), ''];
  for (const t of ch.topics) {
    parts.push(`## ${t.title}`, '', `**复习层级：** ${t.priority}；**依据：** ${t.examEvidence.level}。`, '', t.summary, '', '**核心概念**', '');
    for (const c of t.concepts) parts.push(`- **${c.term}：**${c.definition}`);
    parts.push('', '**操作步骤**', '');
    t.steps.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
    if (t.formulas.length) { parts.push('', '**公式与适用条件**', '', '| 项目 | 公式或结论 | 适用条件 |', '|---|---|---|'); for (const f of t.formulas) parts.push(`| ${md(f.label)} | ${md(f.expression)} | ${md(f.condition)} |`); }
    parts.push('', '**易错点**', '', ...t.pitfalls.map(x => `- ${x}`), '', `### 例题：${t.example.title}`, '', `**题目：**${t.example.problem}`, '', ...t.example.steps.map((s, i) => `${i + 1}. ${s}`), '', `**结论：**${t.example.answer}`, '', `**教材来源：**${t.source.section}；印刷页${t.source.printedPages.join('–')}（PDF第${t.source.pdfPages.join('–')}页）。`, '', `**范围依据：**${t.examEvidence.note}`);
    if (t.code) parts.push('', `### ${t.code.label}`, '', '```c', t.code.text, '```', '', ...t.code.notes.map(x => `- ${x}`));
    parts.push('');
  }
  parts.push('## 自编练习索引', '');
  const questionTypes = { choice: '选择', fill: '填空', calculation: '计算', coding: '编程', integrated: '综合' };
  for (const q of ch.questions) {
    parts.push(`### ${q.id} · ${questionTypes[q.type]}`, '', q.prompt, '');
    if (q.options) parts.push(...q.options.map((option, i) => `- ${String.fromCharCode(65 + i)}. ${option}`), '');
    if (q.type === 'fill') parts.push('~~~c', q.code, '~~~', '');
    const answer = q.type === 'choice' ? `${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}` : q.answer;
    parts.push(`**参考答案**  ${answer}`, '', q.explanation, '', ...q.steps.map((step, i) => `${i + 1}. ${step}`), '');
    if (q.type === 'coding' && q.code) parts.push('~~~c', q.code, '~~~', '');
    parts.push(q.sourceNote, '');
  }
  parts.push('', '> 以上题目为自编训练，不是教材原题、历年真题或教师押题。', '');
  return parts.join('\n');
}

const output = path.join(root, 'dist');
const appSource = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'assets', 'styles.css'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'assets', 'core.mjs'), 'utf8').replace(/^\uFEFF/, '').replace(/^export /gm, '');
const coreExpose = '\nwindow.ReviewCore = { normalizeAnswer, shuffle, buildQuiz, buildExam, scoreQuiz, quickSortTrace, kmpTrace, bfsTrace, makeProgress, recordAttempt, exportProgress, importProgress };\n';
const contentVersion = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const payload = { title: '数据结构期末复习', textbook: '数据结构（C语言版）（第3版）', chapters, scopeRows: [
  { chapter: '1 绪论', focus: '数据、数据元素、抽象数据类型与算法分析。', note: '算法性质和复杂度是基础；按章节自编选择练习。' },
  { chapter: '2 线性表', focus: '顺序表插入/查找与单链表头插、尾插。', note: '程序训练标明下标和带/不带头结点。' },
  { chapter: '3 栈和队列', focus: 'LIFO、FIFO；顺序栈与循环队列操作。', note: '循环队列留一空位时，空front==rear，满(rear+1)%M==front。' },
  { chapter: '4 串、数组和广义表', focus: 'BF/KMP与next约定、数组地址、广义表辨析。', note: '广义表优先选择题；是否只考选择待核实。' },
  { chapter: '5 树和二叉树', focus: '遍历与充分序列建树；哈夫曼树和WPL。', note: '输入足以唯一确定树；哈夫曼并列接受等价最优树。' },
  { chapter: '6 图', focus: '遍历、最小生成树、最短路径。', note: '纪要对综合应用含条件句，不标成必考。' },
  { chapter: '7 查找', focus: '折半查找及代码；二叉排序树构造。', note: '边界使用闭区间，重复键策略单独说明。' },
  { chapter: '8 排序', focus: '插入、希尔、冒泡、快速；堆与归并基础。', note: '希尔增量、快排分区方法显式给出。' },
] };
const dataContent = `window.REVISION_DATA = ${JSON.stringify(payload)};\n`;
const appContent = `${coreSource}${coreExpose}\n${appSource}`;
const dataVersion = contentVersion(dataContent);
const appVersion = contentVersion(appContent);
const stylesVersion = contentVersion(stylesSource);
const html = fs.readFileSync(path.join(root, 'assets', 'index.html'), 'utf8')
  .replace('href="styles.css"', `href="styles.css?v=${stylesVersion}"`)
  .replace('src="data.js"', `src="data.js?v=${dataVersion}"`)
  .replace('src="app.js"', `src="app.js?v=${appVersion}"`);
write(path.join(output, 'index.html'), html);
write(path.join(output, 'styles.css'), stylesSource);
write(path.join(output, 'data.js'), dataContent);
write(path.join(output, 'app.js'), appContent);

const skill = path.join(root, '.agents', 'skills', 'data-structures-c');
const terms = new Map();
const patterns = [];
const formulaRows = [];
for (const ch of chapters) for (const t of ch.topics) {
  for (const c of t.concepts) if (!terms.has(c.term)) terms.set(c.term, c.definition);
  patterns.push(`## ${t.title}（第${ch.number}章）`, '', t.summary, '', ...t.steps.map((s,i)=>`${i+1}. ${s}`), '');
  for (const f of t.formulas) formulaRows.push(`| ${md(f.label)} | ${md(f.expression)} | ${md(f.condition)} |`);
}
const allTopics = chapters.flatMap(ch => ch.topics.map(t => ({ chapter: ch.number, title: t.title, id: t.id }))).sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
const indexLines = allTopics.map(t=>`- **${t.title}** → ch${String(t.chapter).padStart(2,'0')}`);
write(path.join(skill,'SKILL.md'), `---\nname: data-structures-c\ndescription: Use when studying Chinese-language data structures, tracing textbook algorithms, reviewing chapters 1–8, or solving linked-list, stack, queue, string-matching, tree, graph, search, and sorting exercises.\n---\n\n# 数据结构（C语言版）· 学习与解题\n\n## 用途\n\n依据《数据结构（C语言版）（第3版）》构建的中文复习参考。先辨明逻辑结构与存储约定，再按步骤演算；涉及考试范围时，区分教材事实与复习纪要中的概率性判断。\n\n## 使用方式\n\n- 解题时打开对应章节，按题目约定选择过程和算法版本。\n- 练习时选择对应题型，先展示题面与选项，讲解时再给答案、过程和出处。\n- 询问考试范围时，查阅纪要的分值差异与证据等级。\n\n## 解题约定\n\n1. 复述题目给出的下标起点、结点表示、队列/栈边界、排序方向和图的有向性。\n2. 对算法逐步记录状态变化；不要只给结论。\n3. 先验证前提：折半表有序且可随机访问；Dijkstra边权非负；最小生成树输入连通无向图。\n4. 对并列权值、重复关键字、遍历邻接顺序和快排分区版本，遵循题面或说明等价答案。\n5. 本书算法描述采用类C；只有明确标为标准C的代码才声称可直接编译。\n6. 题库内容为自编练习，不等于教材原题、历年真题或押题。考试纪要和分值冲突见 [考试范围与口径](chapters/scope.md)。\n\n## 章节索引\n\n${chapters.map(ch=>`- [第${ch.number}章 ${ch.title}](chapters/ch${String(ch.number).padStart(2,'0')}.md) — ${ch.topics.map(t=>t.title).join('、')}`).join('\n')}\n\n## 主题索引\n\n${indexLines.join('\n')}\n\n## 速查参考\n\n从章节索引打开对应参考。只知道关键词时，可在技能目录运行 \`python scripts/search.py "KMP nextval"\`，再按返回的相对路径读取。\n\n- [术语表](glossary.md)\n- [算法模式](patterns.md)\n- [复杂度与公式速查](cheatsheet.md)\n- [考试范围和纠错记录](chapters/scope.md)\n\n## 范围与局限\n\n参考为学习整理稿，教材页码附于各主题。遇到教材代码、图示或习题具体问法，应优先核对纸本/PDF原页。教师尚未确认的考试条件不会当作确定事实。\n`);
const scope = fs.readFileSync(path.join(root, 'docs', '考试范围与知识库建设依据.md'), 'utf8');
write(path.join(skill, 'chapters', 'scope.md'), scope.split(/^## 当前产物状态/m)[0].trimEnd() + '\n');
write(path.join(skill, 'scripts', 'search.py'), fs.readFileSync(path.join(root, 'scripts', 'search.py'), 'utf8'));
for (const ch of chapters) write(path.join(skill,'chapters',`ch${String(ch.number).padStart(2,'0')}.md`),chapterMarkdown(ch));
write(path.join(skill,'glossary.md'), `# 术语表\n\n${[...terms.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-CN')).map(([term,def])=>`- **${term}：**${def}`).join('\n')}\n`);
write(path.join(skill,'patterns.md'), `# 算法与解题模式\n\n${patterns.join('\n')}\n`);
write(path.join(skill,'cheatsheet.md'), `# 复杂度与边界速查

## 公式与复杂度

| 项目 | 公式或结论 | 适用条件 |
|---|---|---|
${formulaRows.join('\n')}

## 易混约定

- 教材顺序栈的 top 指向下一空位，top==base 时为空。
- 留一空位的循环队列：front==rear 时为空，(rear+1)%M==front 时为满，有效容量为 M−1。
- 教材 KMP 使用从 1 开始的字符下标，next[1]=0。失配时只回退模式串指针。
- BFS 在顶点入队时标记，访问次序取决于邻接顺序。
- 快排推演先说明枢轴、等值处理和分区方式。
`);
console.log(JSON.stringify({result:'PASS',chapters:chapters.length,topics:seenTopicIds.size,questions:seenQuestionIds.size,mockPoints:examScore,website:path.relative(root,output),skill:path.relative(root,skill)},null,2));
