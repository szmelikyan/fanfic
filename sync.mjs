#!/usr/bin/env node
// Keeps the scripts and instructions the same across the readers' copies of the project:
// pulls the committed state of every copy listed in config `sync_with`.
// Reader data (data/reader/, config/config.json) is not in git and never travels.
//
//   node sync.mjs        needs a clean working tree — commit first
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { ROOT, loadConfig, out, fail } from './lib/paths.mjs';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const config = await loadConfig();
const copies = [config.sync_with ?? []].flat().map((p) => path.resolve(p.replace(/^~(?=\/|$)/, homedir())));
if (!copies.length) fail('no "sync_with" in config/config.json — list the other copies, e.g. ["~/fanfic-marat"]');
if (git('status', '--porcelain')) fail('uncommitted changes — commit them first, then sync');

const result = [];
for (const copy of copies) {
  if (!existsSync(path.join(copy, '.git'))) {
    result.push({ copy, error: 'not found' });
    continue;
  }
  const before = git('rev-parse', 'HEAD');
  try {
    git('pull', '--no-rebase', '--no-edit', copy, 'HEAD');
  } catch (e) {
    const conflicts = git('diff', '--name-only', '--diff-filter=U');
    if (conflicts) git('merge', '--abort');
    result.push({ copy, error: conflicts ? `conflict in ${conflicts.split('\n').join(', ')} — merge aborted` : String(e.stderr || e.message).trim() });
    continue;
  }
  const changed = before === git('rev-parse', 'HEAD') ? [] : git('diff', '--name-only', before, 'HEAD').split('\n').filter(Boolean);
  result.push({ copy, changed });
}
out(result);
if (result.some((r) => r.error)) process.exit(1);
