import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('build emits a self-contained offline site and a portable skill', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'pipe' });
  const html = fs.readFileSync('dist/index.html', 'utf8');
  const app = fs.readFileSync('dist/app.js', 'utf8');
  const data = fs.readFileSync('dist/data.js', 'utf8');
  const skill = fs.readFileSync('.agents/skills/data-structures-c/SKILL.md', 'utf8');
  execFileSync(process.execPath, ['--check', 'dist/app.js'], { stdio: 'pipe' });
  assert.match(html, /styles\.css/);
  assert.match(html, /data\.js/);
  assert.match(html, /app\.js/);
  const styles = fs.readFileSync('dist/styles.css');
  const stylesVersion = html.match(/href="styles\.css\?v=([a-f0-9]{12})"/)?.[1];
  const dataVersion = html.match(/src="data\.js\?v=([a-f0-9]{12})"/)?.[1];
  const appVersion = html.match(/src="app\.js\?v=([a-f0-9]{12})"/)?.[1];
  assert.equal(stylesVersion, createHash('sha256').update(styles).digest('hex').slice(0, 12), 'stylesheet URL should be content-versioned');
  assert.equal(dataVersion, createHash('sha256').update(data).digest('hex').slice(0, 12), 'data URL should be content-versioned');
  assert.equal(appVersion, createHash('sha256').update(app).digest('hex').slice(0, 12), 'application URL should be content-versioned');
  assert.match(app, /window\.ReviewCore/);
  assert.match(data, /window\.REVISION_DATA/);
  assert.doesNotMatch(html + app + data, /https?:\/\//);
  const chapterEight = fs.readFileSync('.agents/skills/data-structures-c/chapters/ch08.md', 'utf8');
  const cheatsheet = fs.readFileSync('.agents/skills/data-structures-c/cheatsheet.md', 'utf8');
  assert.doesNotMatch(chapterEight + cheatsheet, /\?{2,}/, 'generated Chinese reference must not contain replacement question-mark runs');
  assert.match(chapterEight, /Lomuto/);
  assert.match(cheatsheet, /^# 复杂度与边界速查/m);
  assert.match(skill, /^---\nname: data-structures-c\ndescription:/);
  for (let n = 1; n <= 8; n++) assert.ok(fs.existsSync(`.agents/skills/data-structures-c/chapters/ch${String(n).padStart(2, '0')}.md`));
});

test('skill references can be searched by Chinese and textbook notation with self-contained context', () => {
  const skillDir = '.agents/skills/data-structures-c';
  const segments = ['chapters/scope.md', 'cheatsheet.md', 'patterns.md', 'glossary.md', ...Array.from({ length: 8 }, (_, i) => 'chapters/ch0' + (i + 1) + '.md')];
  for (const segment of segments) {
    const file = skillDir + '/' + segment;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
    assert.equal(/[\uFFFD\u0000]|\?{2,}/u.test(text), false, file);
  }
  const search = (query) => execFileSync('python', [skillDir + '/scripts/search.py', query, '--limit', '1'], { encoding: 'utf8' });
  assert.match(search('KMP nextval'), /chapters\/ch04\.md/);
  assert.match(search('循环队列'), /chapters\/ch03\.md/);
  assert.match(search('Dijkstra'), /chapters\/ch06\.md/);
  assert.match(search('折半查找'), /chapters\/ch07\.md/);
});
