import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuiz, buildExam, scoreQuiz, normalizeAnswer } from '../assets/core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chapters = Array.from({ length: 8 }, (_, i) => JSON.parse(fs.readFileSync(path.join(root, `knowledge/chapters/ch${String(i + 1).padStart(2, '0')}.json`), 'utf8')));
const questions = chapters.flatMap(ch => ch.questions);

test('chapter content is complete, linked, and source-grounded', () => {
  for (const [index, chapter] of chapters.entries()) {
    assert.equal(chapter.id, `ch${String(index + 1).padStart(2, '0')}`);
    assert.ok(chapter.topics.length >= 3 && chapter.topics.length <= 6, chapter.id);
    assert.ok(chapter.questions.length >= 10 && chapter.questions.length <= 14, chapter.id);
    const ids = new Set(chapter.topics.map(topic => topic.id));
    for (const topic of chapter.topics) {
      assert.ok(topic.title && topic.summary.length >= 80 && topic.example?.problem && topic.example?.answer, topic.id);
      const bodyLength = topic.summary + topic.concepts.map(x => x.term + x.definition).join('') + topic.steps.join('') + topic.formulas.map(x => x.label + x.expression + x.condition).join('') + topic.pitfalls.join('') + topic.example.problem + topic.example.steps.join('') + topic.example.answer + (topic.code?.text || '');
      assert.ok(bodyLength.length >= 350, `${topic.id}: content is too brief (${bodyLength.length})`);
      assert.ok(topic.concepts.length && topic.steps.length && topic.pitfalls.length, topic.id);
      assert.ok(topic.examEvidence?.level && topic.source?.verified, topic.id);
      assert.ok(topic.source.pdfPages[0] <= topic.source.pdfPages[1], topic.id);
      assert.ok(topic.source.printedPages[0] <= topic.source.printedPages[1], topic.id);
      assert.equal(topic.source.pdfPages[0] - topic.source.printedPages[0], 12, topic.id);
      if (topic.code) assert.ok(topic.code.text.length > 80, topic.id);
    }
    for (const q of chapter.questions) {
      assert.ok(ids.has(q.topicId), q.id);
      assert.match(q.sourceNote, /自编|改编/, q.id);
      assert.ok(q.prompt && q.explanation && q.points > 0 && q.steps.length, q.id);
      if (q.type === 'choice') assert.ok(q.options.length >= 3 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id);
      if (q.type === 'fill') {
        assert.ok(q.blanks.length >= 1, q.id);
        assert.equal(q.points, q.blanks.length * 2, q.id);
      }
    }
  }
  assert.ok(chapters[0].questions.every(q => q.type === 'choice'));
});

test('answer normalization removes spacing and case differences only', () => {
  assert.equal(normalizeAnswer('  O ( n log n ) '), 'o(nlogn)');
  assert.equal(normalizeAnswer('  rear = (rear+1) % m  '), 'rear=(rear+1)%m');
});

test('fill grading accepts per-blank alternatives and leaves open items for self-check', () => {
  const fill = { id: 'fill', type: 'fill', points: 4, blanks: [
    { answer: 'LIFO', alternatives: ['后进先出'] },
    { answer: 'O(n)', alternatives: [] },
  ] };
  const open = { id: 'open', type: 'coding', points: 5 };
  const result = scoreQuiz([fill, open], { fill: ['后进先出', 'o(n)'] }, { open: true });
  assert.equal(result.earned, 9);
  assert.equal(result.maximum, 9);
  assert.deepEqual(result.pending, []);
});

test('random practice respects filters, avoids duplicates, and is reproducible', () => {
  const options = { chapters, types: ['choice'], count: 8, seed: 7123 };
  const a = buildQuiz(options);
  const b = buildQuiz(options);
  assert.deepEqual(a.map(q => q.id), b.map(q => q.id));
  assert.equal(a.length, 8);
  assert.equal(new Set(a.map(q => q.id)).size, a.length);
  assert.ok(a.every(q => q.type === 'choice'));
});

test('100-point mock exam respects every section quota', () => {
  const exam = buildExam(chapters, 90210);
  assert.deepEqual(Object.fromEntries(Object.entries(exam).map(([k, v]) => [k, v.length])), {
    choice: 20, fill: 4, calculation: 4, coding: 2, integrated: 1,
  });
  assert.equal(exam.fill.flatMap(q => q.blanks).length, 10);
  assert.ok(exam.fill.every(q => q.fillKind === 'program'));
  assert.deepEqual(exam.calculation.map(q => q.points), [5, 5, 5, 5]);
  assert.equal(exam.integrated[0].points, 10);
  assert.equal(Object.values(exam).flat().reduce((sum, q) => sum + q.points, 0), 100);
  const ids = Object.values(exam).flat().map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});
import * as core from '../assets/core.mjs';
import { quickSortTrace, bfsTrace, makeProgress, recordAttempt, exportProgress, importProgress } from '../assets/core.mjs';

test('Lomuto trace records correct partition boundaries and sorted result', () => {
  const trace = quickSortTrace([5, 2, 7, 1, 4]);
  assert.deepEqual(trace[0], { low: 0, high: 4, pivot: 4, pivotIndex: 2, values: [2, 1, 4, 5, 7] });
  assert.deepEqual(trace.at(-1).values, [1, 2, 4, 5, 7]);
});

test('BFS marks a vertex before enqueueing it and respects adjacency order', () => {
  const result = bfsTrace({ A: ['B', 'C'], B: ['A', 'D'], C: ['A', 'D'], D: ['B', 'C'] }, 'A');
  assert.deepEqual(result.order, ['A', 'B', 'C', 'D']);
  assert.equal(result.visitedCount, 4);
});

test('learning progress round-trips as validated JSON without duplicate wrong ids', () => {
  let progress = makeProgress();
  progress = recordAttempt(progress, { questionId: 'ch01-q01', chapterId: 'ch01', type: 'choice', correct: false, score: 0, max: 2, at: '2026-11-21T00:00:00.000Z' });
  progress = recordAttempt(progress, { questionId: 'ch01-q01', chapterId: 'ch01', type: 'choice', correct: true, score: 2, max: 2, at: '2026-11-21T00:01:00.000Z' });
  progress = recordAttempt(progress, { questionId: 'ch01-q02', chapterId: 'ch01', type: 'choice', correct: false, score: 0, max: 2, at: '2026-11-21T00:02:00.000Z' });
  const restored = importProgress(exportProgress(progress));
  assert.deepEqual(restored.wrong, ['ch01-q02']);
  assert.equal(restored.attempts.length, 3);
  assert.throws(() => importProgress('{"version": 500, "html":"<script>alert(1)</script>"}'), /Unsupported progress file/);
});

test('KMP traces one-based matches and keeps the text index fixed on fallback', () => {
  const result = core.kmpTrace('ababaacababac', 'ababac');
  assert.equal(result.position, 8);
  assert.deepEqual(result.next, [0, 1, 1, 2, 3, 4]);
  const fallback = result.steps.find(step => step.action === 'fallback' && step.j === 6);
  assert.equal(fallback.nextI, fallback.i);
  assert.equal(fallback.nextJ, 4);
  assert.ok(result.steps.some(step => step.action === 'advance' && step.j === 0));
  assert.equal(core.kmpTrace('你好你好呀', '好呀').position, 4);
  assert.equal(core.kmpTrace('a', 'ab').position, 0);
  assert.equal(core.kmpTrace('', 'a').position, 0);
  assert.throws(() => core.kmpTrace('a', ''), RangeError);
});


test('Huffman example agrees with an independent merge-cost calculation', () => {
  const weights = [2, 3, 7, 9];
  let mergeCost = 0;
  while (weights.length > 1) {
    weights.sort((a, b) => a - b);
    const combined = weights.shift() + weights.shift();
    mergeCost += combined;
    weights.push(combined);
  }
  assert.equal(mergeCost, 38);
  const example = chapters[4].topics.find(topic => topic.id === 'ch05-huffman').example;
  const question = chapters[4].questions.find(q => q.id === 'ch05-q09');
  assert.match(example.answer, /WPL[=＝]38/);
  assert.match(question.answer, /38/);
  assert.doesNotMatch(example.steps.join('') + question.steps.join('') + question.explanation, /47|9×2|3、3、2、2/);
});

test('search fills accept the values requested by their prompts', () => {
  const binary = chapters[6].questions.find(q => q.id === 'ch07-q02');
  const bst = chapters[6].questions.find(q => q.id === 'ch07-q07');
  const result = scoreQuiz([binary, bst], {
    [binary.id]: ['mid+1', 'mid-1'],
    [bst.id]: ['左', '空'],
  });
  assert.equal(result.earned, 8);
});
