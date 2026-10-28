#!/usr/bin/env node
// Fics a reader has turned down, and the filter every scan and check goes through.
// All commands take --reader <name> (default: the computer's owner).
//
//   node reader.mjs reject "<title>" --reason read|not_interested|queued [--url <link>] [--note "<why>"]
//   node reader.mjs unreject "<title | link>"
//   node reader.mjs rejected                          the list
//   node reader.mjs filter "<title | link>" ...       which candidates must not be offered, and why
//
// A fic is matched by its title or by its link (the same fic on AO3 and in a translation has
// different titles, so give --url whenever it is known).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { out, fail, takeReader } from './lib/paths.mjs';
import { norm, today } from './lib/util.mjs';

const argv = process.argv.slice(2);
const reader = takeReader(argv);
const option = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv.splice(at, 2)[1] : undefined;
};
const reason = option('--reason');
const note = option('--note');
const url = option('--url');
const [cmd, ...rest] = argv;
const FILE = path.join(reader.dir, 'rejected.json');
const REASONS = { read: 'прочитано', not_interested: 'не хочет читать', queued: 'уже в списке на прочтение' };

/** A link as one string per fic: no scheme, www., query, fragment or trailing slash. */
const normUrl = (s) => String(s).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const isUrl = (s) => /^(https?:\/\/|www\.)\S+$/i.test(String(s).trim());
const matches = (r, query) => (isUrl(query) ? (r.urls ?? []).includes(normUrl(query)) : r.titles.includes(norm(query)));
const why = (r) => `${REASONS[r.reason]}${r.note ? `: ${r.note}` : ''}`;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function saveRejected(data) {
  await mkdir(reader.dir, { recursive: true });
  await writeFile(FILE, JSON.stringify(data, null, 2));
}

const rejected = await readJson(FILE, { fics: [] });

switch (cmd) {
  case 'reject': {
    const title = rest.join(' ');
    if (!title) fail('give a title');
    if (!(reason in REASONS)) fail(`--reason must be one of: ${Object.keys(REASONS).join(', ')}`);
    const entry = { title, titles: [norm(title)], ...(url ? { urls: [normUrl(url)] } : {}), reason, ...(note ? { note } : {}), date: today() };
    const existing = rejected.fics.findIndex((r) => matches(r, title) || (url && matches(r, url)));
    if (existing >= 0) rejected.fics[existing] = entry;
    else rejected.fics.push(entry);
    await saveRejected(rejected);
    out({ reader: reader.name, rejected: entry, total: rejected.fics.length });
    break;
  }

  case 'unreject': {
    const query = rest.join(' ');
    if (!query) fail('give a title or link');
    const before = rejected.fics.length;
    rejected.fics = rejected.fics.filter((r) => !matches(r, query));
    await saveRejected(rejected);
    out({ reader: reader.name, removed: before - rejected.fics.length });
    break;
  }

  case 'rejected':
    out({ reader: reader.name, fics: rejected.fics.map(({ title, urls, reason: r, note: n, date }) => ({ title, urls, reason: REASONS[r], note: n, date })) });
    break;

  case 'filter': {
    if (!rest.length) fail('give candidate titles or links');
    const result = rest.map((query) => {
      const hit = rejected.fics.find((r) => matches(r, query));
      return { query, ok: !hit, ...(hit ? { blocked: why(hit) } : {}) };
    });
    out({ reader: reader.name, offer: result.filter((r) => r.ok).map((r) => r.query), blocked: result.filter((r) => !r.ok) });
    break;
  }

  default:
    fail('usage: node reader.mjs [--reader <name>] reject <title> --reason read|not_interested|queued [--url <link>] [--note <why>] | unreject <title | link> | rejected | filter <title | link> ...');
}
