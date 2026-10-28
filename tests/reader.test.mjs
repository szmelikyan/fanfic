// Rejected fics: matched by title or by link, per reader, against a temporary data folder.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let dir;
const run = (...args) => JSON.parse(execFileSync('node', [path.join(ROOT, 'reader.mjs'), ...args], { env: { ...process.env, FANFIC_DATA: dir }, encoding: 'utf8' }));
before(() => { dir = mkdtempSync(path.join(tmpdir(), 'fanfic-reader-')); });
after(() => rmSync(dir, { recursive: true, force: true }));

test('a rejected fic is blocked by its title or its link, for this reader only', () => {
  run('reject', 'Первый фик', '--reason', 'read', '--url', 'https://archiveofourown.org/works/1?view_adult=true', '--reader', 'Тест');
  run('reject', 'Второй', '--reason', 'not_interested', '--note', 'скучно', '--reader', 'Тест');
  const r = run('filter', 'первый фик', 'https://www.archiveofourown.org/works/1/', 'Второй', 'Третий', '--reader', 'Тест');
  assert.deepEqual(r.offer, ['Третий']);
  assert.deepEqual(r.blocked.map((b) => b.blocked), ['прочитано', 'прочитано', 'не хочет читать: скучно']);
  assert.deepEqual(run('filter', 'Второй').offer, ['Второй'], 'the default reader is untouched');
  run('unreject', 'https://archiveofourown.org/works/1', '--reader', 'Тест');
  assert.deepEqual(run('rejected', '--reader', 'Тест').fics.map((f) => f.title), ['Второй']);
});
