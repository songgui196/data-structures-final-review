export function normalizeAnswer(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s\u200b\ufeff]+/g, '');
}

function mulberry32(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, seed = Date.now()) {
  const out = [...items];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildQuiz({ chapters, chapterId = null, types = ['choice'], count = 10, seed = Date.now() }) {
  const allowed = new Set(types);
  const pool = chapters
    .filter(ch => !chapterId || ch.id === chapterId)
    .flatMap(ch => ch.questions)
    .filter(q => allowed.has(q.type));
  return shuffle(pool, seed).slice(0, Math.max(0, Math.min(count, pool.length)));
}

function selectExactBlanks(pool, blankCount, questionCount, randomPool) {
  const candidates = shuffle(pool, randomPool);
  function search(start, chosen, count) {
    if (chosen.length === questionCount) return count === blankCount ? chosen : null;
    if (chosen.length > questionCount || count >= blankCount) return null;
    for (let i = start; i <= candidates.length - (questionCount - chosen.length); i += 1) {
      const nextCount = count + candidates[i].blanks.length;
      if (nextCount > blankCount) continue;
      const result = search(i + 1, [...chosen, candidates[i]], nextCount);
      if (result) return result;
    }
    return null;
  }
  return search(0, [], 0);
}

function assignPoints(items, pointsForItem) {
  return items.map((item, i) => ({ ...item, points: pointsForItem(item, i) }));
}

export function buildExam(chapters, seed = Date.now()) {
  const questions = chapters.flatMap(ch => ch.questions);
  const pools = Object.fromEntries(['choice', 'fill', 'calculation', 'coding', 'integrated'].map(type => [type, questions.filter(q => q.type === type)]));
  const choice = shuffle(pools.choice, seed + 1).slice(0, 20);
  if (choice.length < 20) throw new Error(`模拟卷选择题不足：需要20道，当前${choice.length}道`);
  const fill = selectExactBlanks(pools.fill.filter(q => q.fillKind === 'program'), 10, 4, seed + 2);
  if (!fill) throw new Error('模拟卷填空题不足：需要4题、合计10空');
  const calculation = shuffle(pools.calculation, seed + 3).slice(0, 4);
  const coding = shuffle(pools.coding, seed + 4).slice(0, 2);
  const integrated = shuffle(pools.integrated, seed + 5).slice(0, 1);
  if (calculation.length < 4) throw new Error('模拟卷需要4道计算题，当前题库题量不足。');
  if (coding.length < 2) throw new Error('模拟卷算法题不足：需要2道');
  if (integrated.length < 1) throw new Error('模拟卷需要1道综合题，当前题库题量不足。');
  return {
    choice: assignPoints(choice, () => 2),
    fill: assignPoints(fill, q => q.blanks.length * 2),
    calculation: assignPoints(calculation, () => 5),
    coding: assignPoints(coding, () => 5),
    integrated: assignPoints(integrated, () => 10),
  };
}

export function scoreQuiz(items, answers = {}, selfChecks = {}) {
  let earned = 0;
  let maximum = 0;
  const pending = [];
  const incorrect = [];
  const details = [];
  for (const q of items) {
    const points = Number(q.points) || 0;
    maximum += points;
    if (q.type === 'choice') {
      const correct = Number.isInteger(answers[q.id]) && answers[q.id] === q.answer;
      const score = correct ? points : 0;
      earned += score;
      if (!correct) incorrect.push(q.id);
      details.push({ questionId: q.id, score, max: points, correct, manual: false });
    } else if (q.type === 'fill') {
      const submitted = Array.isArray(answers[q.id]) ? answers[q.id] : [];
      const each = q.blanks.length ? points / q.blanks.length : 0;
      let score = 0;
      const blankResults = q.blanks.map((blank, i) => {
        const accepted = [blank.answer, ...(blank.alternatives || [])].map(normalizeAnswer);
        const correct = accepted.includes(normalizeAnswer(submitted[i]));
        if (correct) score += each;
        return correct;
      });
      earned += score;
      if (!blankResults.every(Boolean)) incorrect.push(q.id);
      details.push({ questionId: q.id, score, max: points, correct: blankResults.every(Boolean), blanks: blankResults, manual: false });
    } else if (typeof selfChecks[q.id] === 'boolean') {
      const correct = selfChecks[q.id];
      const score = correct ? points : 0;
      earned += score;
      if (!correct) incorrect.push(q.id);
      details.push({ questionId: q.id, score, max: points, correct, manual: true });
    } else {
      pending.push(q.id);
      details.push({ questionId: q.id, score: 0, max: points, correct: null, manual: true });
    }
  }
  return { earned, maximum, pending, incorrect, details };
}

export function quickSortTrace(input) {
  const values = [...input];
  const trace = [];
  function partition(low, high) {
    const pivot = values[high];
    let boundary = low;
    for (let cursor = low; cursor < high; cursor += 1) {
      if (values[cursor] < pivot) {
        [values[boundary], values[cursor]] = [values[cursor], values[boundary]];
        boundary += 1;
      }
    }
    [values[boundary], values[high]] = [values[high], values[boundary]];
    trace.push({ low, high, pivot, pivotIndex: boundary, values: [...values] });
    return boundary;
  }
  function sort(low, high) {
    if (low >= high) return;
    const mid = partition(low, high);
    sort(low, mid - 1);
    sort(mid + 1, high);
  }
  sort(0, values.length - 1);
  return trace;
}

export function kmpTrace(text, pattern) {
  const source = Array.from(text);
  const target = Array.from(pattern);
  if (!target.length) throw new RangeError('模式串不能为空。');

  // Indices follow the textbook convention. Entry 0 is not part of the table.
  const next = Array(target.length + 1).fill(0);
  let prefix = 0;
  for (let position = 1; position < target.length;) {
    if (prefix === 0 || target[position - 1] === target[prefix - 1]) {
      next[++position] = ++prefix;
    } else {
      prefix = next[prefix];
    }
  }

  const steps = [];
  let i = 1;
  let j = 1;
  while (i <= source.length && j <= target.length) {
    const textChar = source[i - 1];
    const patternChar = j === 0 ? null : target[j - 1];
    const action = j === 0 ? 'advance' : textChar === patternChar ? 'match' : 'fallback';
    const nextI = action === 'fallback' ? i : i + 1;
    const nextJ = action === 'fallback' ? next[j] : j + 1;
    steps.push({ i, j, textChar, patternChar, action, nextI, nextJ });
    i = nextI;
    j = nextJ;
  }
  return { position: j > target.length ? i - target.length : 0, next: next.slice(1), steps };
}

export function bfsTrace(adjacency, start) {
  if (!Object.hasOwn(adjacency, start)) return { order: [], visitedCount: 0, steps: [] };
  const visited = new Set([start]);
  const queue = [start];
  const order = [];
  const steps = [];
  while (queue.length) {
    const vertex = queue.shift();
    order.push(vertex);
    const discovered = [];
    for (const neighbor of adjacency[vertex] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
        discovered.push(neighbor);
      }
    }
    steps.push({ vertex, discovered, queue: [...queue] });
  }
  return { order, visitedCount: visited.size, steps };
}

export function makeProgress() {
  return { version: 1, updatedAt: null, attempts: [], wrong: [], mastered: [], favorites: [] };
}

export function recordAttempt(progress, attempt) {
  const next = {
    ...makeProgress(),
    ...(progress && progress.version === 1 ? progress : {}),
    attempts: Array.isArray(progress?.attempts) ? [...progress.attempts] : [],
    wrong: Array.isArray(progress?.wrong) ? [...progress.wrong] : [],
    mastered: Array.isArray(progress?.mastered) ? [...progress.mastered] : [],
    favorites: Array.isArray(progress?.favorites) ? [...progress.favorites] : [],
  };
  const safe = {
    questionId: String(attempt.questionId || '').slice(0, 100),
    chapterId: String(attempt.chapterId || '').slice(0, 20),
    type: String(attempt.type || '').slice(0, 20),
    correct: Boolean(attempt.correct),
    score: Number(attempt.score) || 0,
    max: Number(attempt.max) || 0,
    at: String(attempt.at || new Date().toISOString()).slice(0, 40),
  };
  if (!safe.questionId) return next;
  next.attempts.push(safe);
  if (next.attempts.length > 1000) next.attempts = next.attempts.slice(-1000);
  next.wrong = safe.correct ? next.wrong.filter(id => id !== safe.questionId) : [...new Set([...next.wrong, safe.questionId])];
  next.updatedAt = safe.at;
  return next;
}

export function exportProgress(progress) {
  const safe = {
    version: 1,
    updatedAt: progress?.updatedAt || null,
    attempts: Array.isArray(progress?.attempts) ? progress.attempts.slice(-1000) : [],
    wrong: Array.isArray(progress?.wrong) ? [...new Set(progress.wrong.map(String))].slice(0, 1000) : [],
    mastered: Array.isArray(progress?.mastered) ? [...new Set(progress.mastered.map(String))].slice(0, 1000) : [],
    favorites: Array.isArray(progress?.favorites) ? [...new Set(progress.favorites.map(String))].slice(0, 1000) : [],
  };
  return JSON.stringify(safe, null, 2);
}

export function importProgress(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Invalid progress file');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Invalid progress file'); }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.attempts) || !Array.isArray(parsed.wrong)) throw new Error('Unsupported progress file');
  const cleanIdList = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && x.length <= 100))].slice(0, 1000) : [];
  const attempts = parsed.attempts.slice(-1000).filter(a => a && typeof a.questionId === 'string' && a.questionId.length <= 100).map(a => ({
    questionId: a.questionId,
    chapterId: String(a.chapterId || '').slice(0, 20),
    type: String(a.type || '').slice(0, 20),
    correct: Boolean(a.correct),
    score: Number(a.score) || 0,
    max: Number(a.max) || 0,
    at: String(a.at || '').slice(0, 40),
  }));
  return { version: 1, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt.slice(0, 40) : null, attempts, wrong: cleanIdList(parsed.wrong), mastered: cleanIdList(parsed.mastered), favorites: cleanIdList(parsed.favorites) };
}
