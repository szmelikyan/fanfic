#!/usr/bin/env node
// Copies this reader's data (data/reader/, data/readers/, config/config.json) into the
// private data repository from config `backup` and commits and pushes it there.
// The downloaded page cache (data/cache/) is not copied: it is fetched again.
//
//   node backup.mjs      config: "backup": { "repo": "~/fanfic-data", "dir": "<reader folder in it>" }
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { ROOT, DATA, loadConfig, out, fail } from './lib/paths.mjs';

const config = await loadConfig();
const { repo: repoPath, dir } = config.backup ?? {};
if (!repoPath || !dir) fail('no "backup" in config/config.json — e.g. { "repo": "~/fanfic-data", "dir": "<reader>" }');
const repo = path.resolve(repoPath.replace(/^~(?=\/|$)/, homedir()));
if (!existsSync(path.join(repo, '.git'))) fail(`${repo} is not a git repository`);

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const target = path.join(repo, dir);
const copy = (from, to) => {
  if (!existsSync(from)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  execFileSync('rsync', ['-a', '--delete', from, to]);
};
copy(path.join(DATA, 'reader') + '/', path.join(target, 'data', 'reader') + '/');
copy(path.join(DATA, 'readers') + '/', path.join(target, 'data', 'readers') + '/');
copy(path.join(ROOT, 'config', 'config.json'), path.join(target, 'config', 'config.json'));

// Only this reader's folder: another reader's backup may be running in the same repository.
git('add', '-A', '--', dir);
const changed = git('diff', '--cached', '--name-only', '--', dir).split('\n').filter(Boolean);
const result = { repo, dir, changed: changed.length, pushed: false };
if (changed.length) git('commit', '-q', '-m', `${config.reader_name || dir}: данные на ${new Date().toISOString().slice(0, 10)}`, '--', dir);
if (git('remote')) {
  try {
    git('pull', '-q', '--rebase', '--autostash');
    git('push', '-q');
    result.pushed = true;
  } catch (e) {
    result.error = String(e.stderr || e.message).trim();
  }
}
out(result);
if (result.error) process.exit(1);
