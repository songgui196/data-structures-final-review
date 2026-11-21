import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import os from 'node:os';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(project);
const qa = await fs.mkdtemp(path.join(os.tmpdir(), 'ds-review-qa-'));
const evidence = path.join(project, 'docs', 'verification');
await fs.mkdir(evidence, { recursive: true });
const site = pathToFileURL(path.resolve('dist/index.html')).href;
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
await fs.access(chrome);
const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
  '--disable-extensions', '--remote-debugging-port=0', '--user-data-dir=' + path.join(qa, 'profile-' + process.pid), 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
const pending = new Map(), errors = [], webRequests = [];
let id = 0;
const retry = async (fn, name) => {
  for (let i = 0; i < 100; i++) {
    try { const value = await fn(); if (value) return value; } catch {}
    await delay(60);
  }
  throw new Error('Timed out: ' + name + '. Page errors: ' + errors.join(' | '));
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const request = ++id;
  const timer = setTimeout(() => { pending.delete(request); reject(new Error('CDP timeout: ' + method)); }, 8000);
  pending.set(request, (message) => {
    clearTimeout(timer);
    if (message.error) reject(new Error(method + ': ' + JSON.stringify(message.error)));
    else resolve(message.result);
  });
  socket.send(JSON.stringify({ id: request, method, params }));
});
const run = async (fn, ...args) => {
  const result = await call('Runtime.evaluate', { expression: '(' + fn + ')(...' + JSON.stringify(args) + ')', returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const click = (selector) => run(s => document.querySelector(s).click(), selector);
const expectText = (substring) => retry(() => run(s => document.querySelector('#app')?.textContent.includes(s), substring), substring);
const load = async () => {
  await call('Page.navigate', { url: site });
  await retry(() => run(() => document.querySelectorAll('#app .chapter-card').length === 8), 'overview cards');
};
const snap = async filename => {
  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(evidence, filename), Buffer.from(data, 'base64'));
};
const resize = (width, height, mobile) => call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
const fits = async name => assert.ok(await run(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow on ' + name);
const storage = 'ds-final-review-progress-v1';

try {
  const port = await retry(async () => Number((await fs.readFile(path.join(qa, 'profile-' + process.pid, 'DevToolsActivePort'), 'utf8')).split('\n')[0]), 'Chrome DevTools');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent' && /^https?:/i.test(message.params.request.url)) webRequests.push(message.params.request.url);
  };
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('DOM.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  await resize(1440, 900, false);
  await load();
  const themeKey = 'ds-final-review-theme-v1';
  assert.equal(await run(() => document.documentElement.dataset.theme), 'dark', 'first visit should follow system dark preference');
  assert.equal(await run(() => document.querySelector('#theme-toggle')?.getAttribute('aria-pressed')), 'true');
  assert.equal(await run(key => localStorage.getItem(key), themeKey), null, 'system preference should not be saved as a manual choice');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  await load();
  assert.equal(await run(() => document.documentElement.dataset.theme), 'light', 'first visit should follow a changed system preference after reload');
  assert.equal(await run(key => localStorage.getItem(key), themeKey), null);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
  await load();
  assert.equal(await run(() => document.documentElement.dataset.theme), 'dark');
  const darkBackground = await run(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(darkBackground, 'rgb(244, 245, 241)', 'dark theme should replace the light page background');
  await click('#theme-toggle');
  assert.equal(await run(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await run(key => localStorage.getItem(key), themeKey), 'light');
  assert.equal(await run(() => document.querySelector('#theme-toggle').getAttribute('aria-pressed')), 'false');
  await snap('desktop-overview.png');
  await load();
  assert.equal(await run(() => document.documentElement.dataset.theme), 'light', 'saved choice should override system preference');
  await click('#theme-toggle');
  assert.equal(await run(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await run(key => localStorage.getItem(key), themeKey), 'dark');
  await snap('dark-overview.png');
  await load();
  assert.equal(await run(() => document.documentElement.dataset.theme), 'dark', 'dark choice should persist after reload');
  await click('#theme-toggle');
  assert.equal(await run(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await run(key => localStorage.getItem(key), themeKey), 'light');
  await load();
  assert.equal(await run(() => document.documentElement.dataset.theme), 'light', 'light choice should persist after reload');
  await run(key => localStorage.setItem(key, JSON.stringify({ version: 1, attempts: [], wrong: ['ch01-q01'] })), storage);
  await load();
  await click('nav [data-view="wrong"]');
  await expectText('ch01-q01');
  await click('[data-action="retry"]');
  await run(() => {
    const q = window.REVISION_DATA.chapters[0].questions[0];
    document.querySelector('input[name="a-' + q.id + '"][value="' + q.answer + '"]').click();
    document.querySelector('#quiz-form').requestSubmit();
  });
  await expectText('2 / 2');
  assert.deepEqual(await run(key => JSON.parse(localStorage.getItem(key)).wrong, storage), []);
  await load();
  assert.ok(await run(() => document.querySelector('#app').textContent.includes('1/')));
  await click('nav [data-view="chapters"]');
  assert.equal(await run(() => {
    const input = document.querySelector('#chapter-search');
    input.value = 'nextval'; input.dispatchEvent(new Event('input'));
    return Array.from(document.querySelectorAll('#chapter-list .chapter-card'), c => c.dataset.id).join();
  }), 'ch04');
  await click('[data-action="chapter"][data-id="ch04"]');
  await click('[data-action="master"]');
  assert.equal(await run(key => JSON.parse(localStorage.getItem(key)).mastered.length, storage), 1);
  await click('nav [data-view="practice"]');
  await run(() => document.querySelector('#practice-form').requestSubmit());
  await expectText('交卷并查看得分');
  await click('nav [data-view="mock"]');
  await expectText('计算 · 4题');
  await click('[data-action="mock"]');
  assert.equal(await run(() => document.querySelectorAll('#quiz-form .question-card').length), 31);
  const testItems = await run(() => {
    const first = document.querySelector('.question-card input[type="radio"]');
    const id = first.name.slice(2);
    const q = window.REVISION_DATA.chapters.flatMap(c => c.questions).find(item => item.id === id);
    first.closest('.question-card').querySelector('input[type="radio"][value="' + q.answer + '"]').click();
    const form = document.querySelector('#quiz-form');
    const open = [...form.querySelectorAll('input[name^="s-"][value="false"]')].map(x => x.name);
    form.requestSubmit();
    return { id, open };
  });
  await expectText('2 / 100');
  assert.ok(await run(() => document.querySelector('.answer-details').textContent.includes('参考答案')));
  const attemptsBefore = await run(key => JSON.parse(localStorage.getItem(key)).attempts.length, storage);
  await run(name => {
    const option = [...document.querySelectorAll('input')].find(x => x.name === name && x.value === 'false');
    if (option.disabled) throw new Error('Pending negative self-check is disabled');
    option.click();
    document.querySelector('#quiz-form').requestSubmit();
  }, testItems.open[0]);
  await expectText('2 / 100');
  assert.equal(await run(key => JSON.parse(localStorage.getItem(key)).attempts.length, storage), attemptsBefore + 1);
  assert.equal(await run((key, openId) => JSON.parse(localStorage.getItem(key)).wrong.includes(openId), storage, testItems.open[0].slice(2)), true);
  await click('nav [data-view="wrong"]');
  await expectText(testItems.open[0].slice(2));
  const exported = await run(async () => {
    let captured;
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { captured = blob; return createObjectURL.call(URL, blob); };
    document.querySelector('[data-action="export"]').click();
    URL.createObjectURL = createObjectURL;
    return JSON.parse(await captured.text());
  });
  assert.equal(exported.mastered.length, 1);
  assert.equal(exported.attempts.length, attemptsBefore + 1);
  const fixture = path.join(qa, 'imported-record.json');
  await fs.writeFile(fixture, JSON.stringify({ version: 1, attempts: [], wrong: ['ch04-q01'] }), 'utf8');
  const importFixture = async (file) => {
    const { root } = await call('DOM.getDocument');
    const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector: '#progress-file' });
    await call('DOM.setFileInputFiles', { nodeId, files: [file] });
  };
  await importFixture(fixture);
  await expectText('ch04-q01');
  assert.deepEqual(await run(key => JSON.parse(localStorage.getItem(key)).wrong, storage), ['ch04-q01']);
  const invalid = path.join(qa, 'invalid-record.json');
  await fs.writeFile(invalid, '{ invalid json', 'utf8');
  await importFixture(invalid);
  await expectText('无法读取学习记录');
  assert.deepEqual(await run(key => JSON.parse(localStorage.getItem(key)).wrong, storage), ['ch04-q01']);
  await click('nav [data-view="mock"]');
  await click('[data-action="mock"]');
  await run(() => {
    const questions = new Map(window.REVISION_DATA.chapters.flatMap(c => c.questions.map(item => [item.id, item])));
    const form = document.querySelector('#quiz-form');
    for (const input of form.elements) {
      if (input.name.startsWith('a-')) {
        input.checked = Number(input.value) === questions.get(input.name.slice(2)).answer;
      } else if (input.name.startsWith('f-')) {
        const end = input.name.lastIndexOf('-');
        input.value = questions.get(input.name.slice(2, end)).blanks[Number(input.name.slice(end + 1))].answer;
      } else if (input.name.startsWith('s-')) {
        input.checked = input.value === 'true';
      }
    }
    form.requestSubmit();
  });
  await expectText('100 / 100');
  await click('nav [data-view="lab"]');
  await run(() => document.querySelector('#lab-form').requestSubmit());
  await expectText('排序结果');
  await click('[data-kind="bfs"]');
  await run(() => document.querySelector('#lab-form').requestSubmit());
  await expectText('A → B → C → D');
  await click('[data-kind="kmp"]');
  await run(() => document.querySelector('#lab-form').requestSubmit());
  await expectText('第 8 个字符');
  await expectText('主串下标不变');
  await click('[data-view="scope"]');
  await expectText('概览图');
  await resize(390, 844, true);
  for (const view of ['overview', 'chapters', 'wrong', 'practice', 'mock', 'lab', 'scope']) {
    const selector = view === 'scope' ? '[data-view="scope"]' : 'nav [data-view="' + view + '"]';
    await click(selector);
    await fits(view);
  }
  for (let chapter = 1; chapter <= 8; chapter++) {
    await click('nav [data-view="chapters"]');
    await run(() => {
      const input = document.querySelector('#chapter-search');
      input.value = ''; input.dispatchEvent(new Event('input'));
    });
    await click('[data-action="chapter"][data-id="ch0' + chapter + '"]');
    await fits('chapter ' + chapter);
  }
  await click('nav [data-view="overview"]');
  await snap('mobile-overview.png');
  await click('nav [data-view="lab"]');
  await click('[data-kind="kmp"]');
  await run(() => document.querySelector('#lab-form').requestSubmit());
  await fits('mobile KMP');
  await snap('mobile-kmp.png');
  assert.deepEqual(errors, [], 'browser errors');
  assert.deepEqual(webRequests, [], 'external HTTP requests');
  console.log(JSON.stringify({ desktop: '1440x900', mobile: '390x844', fileUrl: true, tests: ['search', 'mastery', 'practice', 'mock', 'self-check', 'wrong retry', 'progress load/export/import', 'quick sort/BFS/KMP', 'scope', 'overflow'], browserErrors: errors.length, externalRequests: webRequests.length, screenshots: evidence }, null, 2));
} finally {
  socket?.close();
  browser.kill();
}
