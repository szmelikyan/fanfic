#!/usr/bin/env node
// Fanfics (and originals) from the sites a script may read: AO3 tag pages (/tags/<tag>/works —
// robots.txt closes /works/search), Author.Today tag pages (/work/tag/<tag> — /search is closed) and Wattpad tag and
// story pages (/stories/<tag>, /story/<id>). Keeps facts and links to the fics, never their text. Ficbook, FanFiction.net,
// Quotev and Dreamwidth are not read by scripts: the agent searches them on the web, after offering it to the reader (modes/fanfic.md).
//
//   node fanfic.mjs settings                                     the reader's settings; "onboarded": false → ask first (modes/fanfic.md)
//   node fanfic.mjs set mode ru|ru+en
//   node fanfic.mjs set originals yes|no
//   node fanfic.mjs set categories "Gen,M/M,F/F,F/M,Multi,Other" [--fandom "<fandom>"]   (empty "" clears)
//   node fanfic.mjs set relationships "A/B,C/D" --fandom "<fandom>"                       (empty "" clears)
//   node fanfic.mjs set pages|min_words|max_words <N> [--fandom "<fandom>"]               scan defaults ("" clears; pages all = every page)
//   node fanfic.mjs set ratings "General Audiences,Teen And Up Audiences,..." [--fandom "<fandom>"]
//   node fanfic.mjs set status full|in_progress|any [--fandom "<fandom>"]             finished, being written, or both
//   node fanfic.mjs set with_gen yes|no [--fandom "<fandom>"]                             with pairings set: gen fics too
//   node fanfic.mjs set crossovers include|exclude|only [--fandom "<fandom>"]            crossovers with other fandoms
//   node fanfic.mjs set aliases "ORV,Всеведущий читатель" --fandom "<fandom>"             other names for scan "<name>"
//   node fanfic.mjs set ao3_tag|at_tag "<exact tag>" --fandom "<fandom>"                 where the fandom lives on each site
//   node fanfic.mjs set wattpad_tags "orv,kimdokja" --fandom "<fandom>"                   Wattpad tags of the fandom ("" clears)
//   node fanfic.mjs set ao3_user <login>                                                  the reader's AO3 account: fics with their kudos count as read
//   node fanfic.mjs fandom add|remove "<fandom>"
//   node fanfic.mjs author add|remove "<AO3 user>"                 authors the reader follows: their works join every scan
//   node fanfic.mjs author block|unblock "<name>"                  authors whose works are never offered (any site)
//   node fanfic.mjs tags exclude|require|prefer|demote|allow|remove "<tag>" [--fandom "<fandom>"]
//   node fanfic.mjs tags exclude "<tag>" --unless "<tag>,<tag>" [--fandom "<fandom>"]       not when the fic has one of these
//   node fanfic.mjs scan ["<fandom or tag>" | --author <AO3 user>] [--originals] [--require "a,b"] [--exclude "x,y"] [--text "<words>"]
//                        [--ao3 "<exact AO3 tag>"] [--at "<Author.Today tag>"] [--mode ru|ru+en] [--pages N]
//                        [--min-words N] [--max-words N] [--ratings "a,b"] [--status full|in_progress|any] [--crossovers include|exclude|only] [--full]
//                        [--site ao3|author.today|wattpad]   only this site (e.g. while another one is down)
//                        [--browser]   AO3 through the reader's browser: first scan stops at once when AO3 does not
//                                      let the script in; then rerun with --browser and run `browser-snippet` in an AO3 tab
//                        [--part pairings|gen|authors]   one part of the full scan: the wanted pairings (and fandoms without
//                                      pairings, and Author.Today and Wattpad), then gen, then followed authors — most wanted first
//                        [--offline]   only pages already in the cache — what a stopped scan had read (no state is saved)
//                        [--wait-browser N]   with --browser: give up when no tab connects in N minutes (default 10)
//   node fanfic.mjs comments <fics.json> [--browser] [--pages N]   readers' comments on AO3 fics: counts of what they praise or
//                                                                  criticise (OOC, in character, plot) — by what the reader said
//                                                                  matters to them in comments (asked first, see ONBOARDING)
//                                                                  fics from other sites bring their comments as "comments": [texts]
//   node fanfic.mjs set comments_ooc_max <N>                       more OOC mentions than N drop a fic ("" — OOC in comments does not drop)
//   node fanfic.mjs set comments_lore_max <N>                      more "that's not how this world works" comments than N drop a fic ("" — never)
//   node fanfic.mjs set comments_watch "in_character,plot_good,plot_bad"   what to weigh in the evaluation ("" — nothing)
//   node fanfic.mjs browser-snippet [--port N]                     the script for that tab (lib/bridge.mjs); --port for a second queue
//   node fanfic.mjs texts <fics.json | AO3 work URL or id ...> [--browser] [--port N]
//                                                                  the full text of AO3 fics → <reader>/texts/<id>.txt (kept, not refetched);
//                                                                  --port N: a second bridge, so texts download while a scan holds the first
//   node fanfic.mjs excerpts <AO3 work URL or id ...> [--fics <fics.json>] [--start N] [--middle N] [--end N]
//                                                                  start, middle and end of downloaded texts (words; default 450/240/120),
//                                                                  comment signals and the reader's kudos from the cached page — never the network
//   node fanfic.mjs history ao3 <user> --browser                   the reader's AO3 history (logged in, so through the browser)
//                                                                  → sources/; scans then mark fics they opened ("opened": date)
//   node fanfic.mjs saves ao3 <username> [--pages N]              the reader's AO3 bookmarks → data/reader/sources/, taste summary
//   node fanfic.mjs check <fics.json | ->                          fics found by hand (web search on ficbook, FanFiction.net...) through
//                                                                  the same filters as scan, by whatever is known of them:
//                                                                  [{ site, title, url, fandoms: [reader's fandom names], tags, summary,
//                                                                     relationships, rating, status: full|in_progress, updated, words }]
//   node fanfic.mjs read-list <saved page.htm> ...                 a page the reader saved (ficbook likes, Author.Today likes or library,
//                                                                  any list): every fic on it is marked read; the page goes to sources/
//   node fanfic.mjs similar [<AO3 work URL> ...] [--from-saves] [--seeds N] [--users N] [--mode ru|ru+en]
//                                                                  what people who saved the same fics also saved
//   node fanfic.mjs page <picks.json | -> [--no-open]              the picks as an HTML page in <reader>/picks/, opened in the browser:
//                                                                  { title, intro, fics: [{ title, url, authors, fandom, pairing, rating,
//                                                                    status, size, why, site }], left_out: [{ title, why }] }
// All commands take --reader <name>.
//
// Settings (data/reader/fanfic-settings.json): excluded tags drop a fic (any tag containing the words;
// "=OOC" — only a tag that is exactly "OOC", checked here, not by AO3, which would drop its sub-tags too; with --unless it does not
// apply to a fic that has one of those tags, also checked here); required tags must all be there;
// preferred ones rank it up, demoted ones down (never drop it); categories (Gen, M/M...) and pairings narrow it. Per-fandom entries add to the
// general lists, `allow` lifts a general exclude or require for that fandom (lib/fanfic.mjs effectiveTags).
//
// scan without a query goes through the reader's fandoms (and originals, if on), then the authors they follow;
// scan "<name>" — only that fandom: one of the reader's (by name, alias, or a part of either) with all its settings,
// or else any AO3 tag. The AO3 tag is looked up
// in the book project's data/fandoms.json (books only; config "book_recs", e.g. "~/book-recs") unless --ao3 is given; the Author.Today tag defaults to the query when
// it is in Cyrillic. Unfinished fics with no update for a year count as abandoned and are dropped, as are
// fics the reader rejected (node reader.mjs filter).
//
// Only what is new: once a source (an AO3 tag in one language and pairing, an Author.Today tag, an author's works)
// was read to its last page, the next scan of it reads newest-updated first and stops at the date of that scan,
// and fics the same search with the same filters already found are not shown again (data/reader/fanfic-scans.json).
// Other filters (changed settings, --require, --status...) make another search, read and shown in full.
// --full: read everything and show everything again.
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { get, reachable, useBridge, standbyBridge, httpStats } from './lib/http.mjs';
import { startBridge, browserLoop } from './lib/bridge.mjs';
import { ROOT, loadConfig, out, fail, takeReader } from './lib/paths.mjs';
import { norm, today } from './lib/util.mjs';
import { parseAo3, parseAt, parseWattpadTag, parseWattpadStory, parseBookmarkers, atPageTag, ao3TagPath, effectiveTags, ownFandoms, readerFandom, readerFandomOf, matchTags, tasteSummary, isCrossover, readListPages, kudosUsers, savedPageFics, ao3PageTag, isAo3List, parseAo3Comments, commentSignals, picksPage, text } from './lib/fanfic.mjs';

const AO3 = 'https://archiveofourown.org';
const CATEGORIES = ['Gen', 'M/M', 'F/F', 'F/M', 'Multi', 'Other'];
const STATUSES = ['full', 'in_progress', 'any'];
const CROSSOVERS = ['include', 'exclude', 'only'];
const RATINGS = ['General Audiences', 'Teen And Up Audiences', 'Mature', 'Explicit', 'Not Rated'];
// Author.Today shows characters, not words: about 6.5 characters with spaces per Russian word.
const CHARS_PER_WORD = 6.5;
const USAGE = 'usage: node fanfic.mjs settings | set mode|ao3_user|originals|categories|relationships|with_gen|aliases|pages|min_words|max_words|ratings|status|crossovers|ao3_tag|at_tag|wattpad_tags <value> [--fandom <f>] | fandom add|remove <f> | author add|remove <AO3 user> | author block|unblock <name>\n'
  + '     | tags exclude|require|prefer|demote|allow|remove "<tag>" [--fandom <f>] [--unless "<tag>,<tag>"]\n'
  + '     | scan ["<fandom or tag>" | --author <AO3 user>] [--originals] [--require a,b] [--exclude x,y] [--text "<words>"] [--ao3 <tag>] [--at <tag>] [--mode ru|ru+en]\n'
  + '            [--pages N] [--min-words N] [--max-words N] [--ratings a,b] [--status full|in_progress|any] [--crossovers include|exclude|only] [--full] [--site ao3|author.today|wattpad]\n'
  + '     | saves ao3 <username> [--pages N] | read-list <saved page.htm> ... | check <fics.json | ->\n'
  + '     | similar [<AO3 work URL> ...] [--from-saves] [--seeds N] [--users N] [--mode ru|ru+en]'
  + '\n     | page <picks.json | -> [--no-open]'
  + '\n     | texts <fics.json | AO3 work URL or id ...> [--browser] [--port N] | excerpts <AO3 work URL or id ...> [--fics <fics.json>] [--start N] [--middle N] [--end N]';

const argv = process.argv.slice(2);
const readerArg = argv.includes('--reader') ? argv.slice(argv.indexOf('--reader'), argv.indexOf('--reader') + 2) : [];
const reader = takeReader(argv);
const option = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv.splice(at, 2)[1] : undefined;
};
const flag = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? (argv.splice(at, 1), true) : false;
};
const list = (s) => (s ? s.split(',').map((t) => t.trim()).filter(Boolean) : []);

const SETTINGS_FILE = path.join(reader.dir, 'fanfic-settings.json');
const SOURCES = path.join(reader.dir, 'sources');
const SCANS_FILE = path.join(reader.dir, 'fanfic-scans.json');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const loadSettings = () => readJson(SETTINGS_FILE, null);

async function saveSettings(s) {
  await mkdir(reader.dir, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(s, null, 2) + '\n');
}

async function modeLangs(given, settings) {
  const mode = given ?? settings?.mode ?? (await loadConfig()).default_mode ?? 'ru';
  if (!['ru', 'ru+en'].includes(mode)) fail(`unknown mode "${mode}" — ru or ru+en`);
  return { mode, langs: mode === 'ru' ? ['ru'] : ['ru', 'en'] };
}

const verdict = (f) => (f.status === 'full' ? 'pass' : f.status === 'in_progress' ? 'pass_in_progress' : 'unknown');

/**
 * Drops abandoned fics, fics the reader already saved (their AO3 bookmarks), fics that break the settings
 * and the reader's rejections; ranks preferred tags up and demoted ones down.
 * `tagsFor`: fic → effective settings. Fics with `_server` were already filtered by AO3 for required tags.
 */
function applyFilters(found, tagsFor, saved, blockedAuthors = []) {
  const blockedBy = (f) => (f.authors ?? []).find((a) => blockedAuthors.some((b) => norm(a) === norm(b)));
  const dropped = { abandoned: 0, saved: 0, by_settings: [], blocked: [] };
  // Saved: by link, or by title — a translation of a saved fic on another site has the same title.
  let fics = found.filter((f) => (f.status === 'abandoned' ? (dropped.abandoned++, false) : true))
    .filter((f) => (saved.has(f.url) || saved.has(norm(f.title)) ? (dropped.saved++, false) : true));
  fics = fics.map((f) => {
    const t = tagsFor(f);
    return { ...f, ...matchTags(f, t), _with_gen: t.with_gen };
  }).filter((f) => {
    const author = blockedBy(f);
    const why = [
      ...(author ? [`blocked author: ${author}`] : []),
      ...f.excluded_by.map((t) => `excluded: ${t}`),
      ...(f._server ? [] : f.missing.map((t) => `missing required: ${t}`)),
      ...(f.category_ok === false ? [`category ${f.category}`] : []),
      ...(f.pairing_ok === false && !f._server_pairing && !(f._with_gen && /\bGen\b/.test(f.category ?? '')) ? ['not the wanted pairing'] : []),
    ];
    if (why.length) dropped.by_settings.push({ title: f.title, url: f.url, why });
    return !why.length;
  });
  if (fics.length) {
    const names = [...new Set(fics.flatMap((f) => [f.title, f.url]))];
    const res = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, 'reader.mjs'), ...readerArg, 'filter', ...names], { encoding: 'utf8' }));
    const why = new Map(res.blocked.map((b) => [b.query, b.blocked]));
    fics = fics.filter((f) => {
      const reason = why.get(f.title) ?? why.get(f.url);
      if (reason) dropped.blocked.push({ title: f.title, url: f.url, blocked: reason });
      return !reason;
    });
  }
  // Stable: within the same score (preferred tags minus demoted ones), the source's popularity order stays.
  const score = (f) => f.preferred.length - (f.demoted?.length ?? 0);
  fics.sort((a, b) => score(b) - score(a));
  return {
    fics: fics.map(({ excluded_by, missing, category_ok, pairing_ok, _server, _server_pairing, _with_gen, ...f }) => ({
      verdict: verdict(f),
      ...f,
      ...(category_ok === null || pairing_ok === null ? { unchecked: `category and pairing — ${f.site === 'wattpad' ? 'Wattpad' : 'Author.Today'} does not show them` } : {}),
    })),
    dropped,
  };
}

// ---------- settings ----------

const ONBOARDING = [
  'language: только русский (ru) или русский и английский (ru+en) → set mode',
  'disliked tags: исключаются полностью → tags exclude',
  'liked tags: для каждого — обязательный (tags require) или желательный (tags prefer)',
  'tell: теги можно в любой момент настроить отдельно для каждого фандома (--fandom)',
  'fandoms and/or originals → fandom add, set originals yes|no',
  'status: only finished (full), only being written (in_progress) or both (any) → set status',
  'gen or pairing; if pairing — which categories (set categories) and, per fandom, which pairings (set relationships --fandom); with pairings set — gen of the fandom too? (set with_gen yes|no, general or --fandom)',
  'crossovers: include them, exclude them, or only crossovers → set crossovers include|exclude|only (general or --fandom)',
  'before the comments step of an evaluation, asked in terms of what this reader named important (not OOC / world logic unless they spoke of canon faithfulness): use readers\' comments at all? if so — drop a fic when they call characters OOC more than N times (set comments_ooc_max N, or "" for never)? when they say the world does not work like that more than N times (set comments_lore_max N, or "")? what to weigh: in_character, plot_good, plot_bad (set comments_watch "...")',
  'always last, answering is optional: ratings (gen has them too), size (set min_words / max_words), pages; per fandom too',
];

const blank = () => ({ mode: null, fandoms: [], authors: [], originals: false, categories: [], exclude: [], require: [], prefer: [], scan: { pages: 1 }, by_fandom: {} });

/** Scan defaults for one search: general, then the fandom's own. */
function scanDefaults(settings, names) {
  const own = ownFandoms(settings, names);
  return {
    ...(settings?.scan ?? {}),
    ...Object.assign({}, ...own.map(([, f]) => f.scan ?? {})),
    ao3_tag: own.map(([, f]) => f.ao3_tag).filter(Boolean).at(-1),
    at_tag: own.map(([, f]) => f.at_tag).filter(Boolean).at(-1),
    wattpad_tags: own.map(([, f]) => f.wattpad_tags).filter(Boolean).at(-1),
  };
}

// Answers a scan cannot go without: ask for these before scanning.
const missingRequired = (s) => [...(s?.mode ? [] : ['mode']), ...(s?.scan?.status ? [] : ['status']), ...(s?.scan?.crossovers ? [] : ['crossovers'])];

async function settingsCmd() {
  const s = await loadSettings();
  const missing = missingRequired(s);
  out(s
    ? { reader: reader.name, onboarded: true, file: path.relative(ROOT, SETTINGS_FILE), ...(missing.length ? { missing_required: missing } : {}), ...s }
    : { reader: reader.name, onboarded: false, ask: ONBOARDING });
}

async function setCmd() {
  const fandom = option('--fandom');
  const [, key, ...rest] = argv;
  const value = rest.join(' ').trim();
  const s = (await loadSettings()) ?? blank();
  const target = fandom ? (s.by_fandom[fandom] ??= {}) : s;
  switch (key) {
    case 'mode':
      if (fandom || !['ru', 'ru+en'].includes(value)) fail('set mode ru|ru+en (not per fandom)');
      s.mode = value;
      break;
    case 'comments_ooc_max': {
      if (fandom) fail('comments_ooc_max is not per fandom');
      const n = value === '' ? null : Number(value);
      if (n !== null && (!Number.isInteger(n) || n < 0)) fail('set comments_ooc_max <whole number> or ""');
      s.comments = { ...(s.comments ?? {}), ooc_max: n };
      break;
    }
    case 'comments_lore_max': {
      if (fandom) fail('comments_lore_max is not per fandom');
      const n = value === '' ? null : Number(value);
      if (n !== null && (!Number.isInteger(n) || n < 0)) fail('set comments_lore_max <whole number> or ""');
      s.comments = { ooc_max: null, ...(s.comments ?? {}), lore_max: n };
      break;
    }
    case 'comments_watch': {
      if (fandom) fail('comments_watch is not per fandom');
      const w = list(value);
      const bad = w.filter((x) => !['ooc', 'lore', 'in_character', 'plot_good', 'plot_bad'].includes(x));
      if (bad.length) fail(`unknown ${bad.join(', ')} — ooc, lore, in_character, plot_good, plot_bad`);
      s.comments = { ooc_max: null, ...(s.comments ?? {}), watch: w };
      break;
    }
    case 'ao3_user':
      if (fandom || !value) fail('set ao3_user <login> (not per fandom)');
      s.ao3_user = value;
      break;
    case 'originals':
      if (fandom || !['yes', 'no'].includes(value)) fail('set originals yes|no');
      s.originals = value === 'yes';
      break;
    case 'categories': {
      const cats = list(value);
      const bad = cats.filter((c) => !CATEGORIES.includes(c));
      if (bad.length) fail(`unknown categories ${bad.join(', ')} — AO3 has ${CATEGORIES.join(', ')}`);
      target.categories = cats;
      if (fandom && !cats.length) delete target.categories;
      break;
    }
    case 'relationships':
      if (!fandom) fail('pairings belong to a fandom — give --fandom');
      target.relationships = list(value);
      if (!target.relationships.length) delete target.relationships;
      break;
    case 'with_gen':
      if (!['yes', 'no'].includes(value)) fail('set with_gen yes|no');
      target.with_gen = value === 'yes';
      break;
    case 'aliases':
      if (!fandom) fail('aliases belong to a fandom — give --fandom');
      target.aliases = list(value);
      if (!target.aliases.length) delete target.aliases;
      break;
    case 'ao3_tag':
    case 'at_tag':
      if (!fandom) fail(`${key} belongs to a fandom — give --fandom`);
      if (value) target[key] = value;
      else delete target[key];
      break;
    case 'wattpad_tags':
      if (!fandom) fail('wattpad_tags belong to a fandom — give --fandom');
      // Wattpad tags are one word, lower case: "Kim Dokja" is the tag "kimdokja".
      target.wattpad_tags = list(value).map((t) => t.toLowerCase().replace(/[\s#]+/g, ''));
      if (!target.wattpad_tags.length) delete target.wattpad_tags;
      break;
    case 'pages':
    case 'min_words':
    case 'max_words':
    case 'ratings':
    case 'status':
    case 'crossovers': {
      let v;
      if (key === 'ratings') {
        v = list(value);
        const bad = v.filter((r) => !RATINGS.includes(r));
        if (bad.length) fail(`unknown ratings ${bad.join(', ')} — AO3 has ${RATINGS.join(', ')}`);
        if (!v.length) v = undefined;
      } else if (key === 'status') {
        if (!STATUSES.includes(value)) fail(`set status ${STATUSES.join('|')}`);
        v = value;
      } else if (key === 'crossovers') {
        if (!CROSSOVERS.includes(value)) fail(`set crossovers ${CROSSOVERS.join('|')}`);
        v = value;
      } else if (key === 'pages' && value === 'all') {
        v = 'all';
      } else if (value) {
        v = Number(value);
        if (!Number.isInteger(v) || v < (key === 'pages' ? 1 : 0)) fail(`${key} must be a whole number`);
      }
      const sc = (target.scan ??= {});
      if (v === undefined) delete sc[key];
      else sc[key] = v;
      if (!Object.keys(sc).length) delete target.scan;
      break;
    }
    default:
      fail(USAGE);
  }
  if (fandom && !Object.keys(target).length) delete s.by_fandom[fandom];
  await saveSettings(s);
  out({ reader: reader.name, ...s });
}

async function authorCmd() {
  const [, action, ...rest] = argv;
  const name = rest.join(' ').trim();
  if (!['add', 'remove', 'block', 'unblock'].includes(action) || !name) fail(USAGE);
  const s = (await loadSettings()) ?? blank();
  if (action === 'block' || action === 'unblock') {
    s.blocked_authors = (s.blocked_authors ?? []).filter((a) => norm(a) !== norm(name));
    if (action === 'block') s.blocked_authors.push(name);
    if (!s.blocked_authors.length) delete s.blocked_authors;
    await saveSettings(s);
    return out({ reader: reader.name, blocked_authors: s.blocked_authors ?? [] });
  }
  s.authors = (s.authors ?? []).filter((a) => a.toLowerCase() !== name.toLowerCase());
  if (action === 'add') s.authors.push(name);
  await saveSettings(s);
  out({ reader: reader.name, authors: s.authors });
}

async function fandomCmd() {
  const [, action, ...rest] = argv;
  const name = rest.join(' ').trim();
  if (!['add', 'remove'].includes(action) || !name) fail(USAGE);
  const s = (await loadSettings()) ?? blank();
  s.fandoms = s.fandoms.filter((f) => norm(f) !== norm(name));
  if (action === 'add') s.fandoms.push(name);
  await saveSettings(s);
  out({ reader: reader.name, fandoms: s.fandoms });
}

async function tagsCmd() {
  const fandom = option('--fandom');
  const unless = list(option('--unless'));
  const [, action, ...rest] = argv;
  const tag = rest.join(' ').trim();
  const lists = ['exclude', 'require', 'prefer', 'demote', 'allow'];
  if (unless.length && action !== 'exclude') fail('--unless goes with tags exclude');
  if (![...lists, 'remove'].includes(action) || !tag) fail(USAGE);
  if (action === 'allow' && !fandom) fail('allow lifts a general exclude or require for one fandom — give --fandom');
  const s = (await loadSettings()) ?? blank();
  const target = fandom ? (s.by_fandom[fandom] ??= {}) : s;
  // A tag sits in one list at a level: moving it to another list takes it out of the old one.
  for (const k of lists) if (target[k]) target[k] = target[k].filter((t) => norm(t) !== norm(tag));
  if (action !== 'remove') (target[action] ??= []).push(tag);
  // Excluding a tag again without --unless makes the exclusion unconditional.
  if (target.exclude_unless) for (const k of Object.keys(target.exclude_unless)) if (norm(k) === norm(tag)) delete target.exclude_unless[k];
  if (unless.length) (target.exclude_unless ??= {})[tag] = unless;
  if (target.exclude_unless && !Object.keys(target.exclude_unless).length) delete target.exclude_unless;
  for (const k of lists) if (fandom && target[k] && !target[k].length) delete target[k];
  if (fandom && !Object.keys(target).length) delete s.by_fandom[fandom];
  await saveSettings(s);
  out({ reader: reader.name, ...s });
}

// ---------- scan ----------

async function ao3Tag(query, given, originals) {
  if (given) return { tag: given, from: '--ao3' };
  if (originals) return { tag: 'Original Work', from: 'originals' };
  if (!query) return null;
  const books = (await loadConfig()).book_recs;
  const tags = books ? (await readJson(path.join(books.replace(/^~(?=\/|$)/, homedir()), 'data', 'fandoms.json'), { tags: [] })).tags : [];
  const words = query.toLowerCase().split(/\s+/);
  const own = tags.find(({ tag }) => words.every((w) => tag.toLowerCase().includes(w)) && / - /.test(tag) && !/All Media|& Related/.test(tag));
  return own ? { tag: own.tag, from: `${books}/data/fandoms.json`, works: own.works } : { tag: query, from: 'as given (any AO3 tag: fandom, pairing, trope)' };
}

// AO3 lists must be lists: a maintenance page is retried, never taken for an empty last page.
const readPages = (pageUrl, parse, perPage, opts) => readListPages((p) => {
  const url = pageUrl(p);
  return get(url, { text: true, cacheDays: 1, ...(url.startsWith(AO3) ? { valid: isAo3List } : {}) });
}, parse, perPage, opts);

async function scanAo3(tag, lang, { require, exclude, text, pages, since, sc, pairingOnServer }) {
  const params = new URLSearchParams({ 'work_search[language_id]': lang, 'work_search[sort_column]': since ? 'revised_at' : 'kudos_count' });
  if (sc.status === 'full') params.set('work_search[complete]', 'T');
  if (sc.status === 'in_progress') params.set('work_search[complete]', 'F');
  if (sc.crossovers === 'exclude') params.set('work_search[crossover]', 'F');
  if (sc.crossovers === 'only') params.set('work_search[crossover]', 'T');
  if (sc.min_words) params.set('work_search[words_from]', sc.min_words);
  if (sc.max_words) params.set('work_search[words_to]', sc.max_words);
  if (require.length) params.set('work_search[other_tag_names]', require.join(','));
  if (exclude.length) params.set('work_search[excluded_tag_names]', exclude.join(','));
  if (text) params.set('work_search[query]', text);
  const url = (p) => (params.set('page', p), `${AO3}/tags/${ao3TagPath(tag)}/works?${params}`);
  // A synonym tag redirects to its canonical one and AO3 drops every filter (language, pairing, exclusions): stop and say which tag to use.
  const parse = (html) => {
    if (html === null) return null;
    const shown = ao3PageTag(html);
    if (shown && shown.toLowerCase() !== tag.toLowerCase()) throw Object.assign(new Error(`AO3 shows "${shown}" for "${tag}": a synonym, the filters are lost — set ao3_tag "${shown}"`), { plain: true });
    return parseAo3(html);
  };
  const { fics, missing, complete } = await readPages(url, parse, 20, { pages, since });
  if (missing) return { error: 'tag not found on AO3 — pass the exact tag with --ao3', fics };
  return { fics: fics.map((f) => ({ ...f, _server: true, ...(pairingOnServer ? { _server_pairing: true } : {}) })), complete };
}

async function scanAt(tag, { text, originals, pages, since }) {
  // "recent": newest first — for reading only what is new.
  const url = (p) => `https://author.today/work/tag/${encodeURIComponent(tag)}?sorting=${since ? 'recent' : 'likes'}&page=${p}`;
  const parse = (html) => (!html || atPageTag(html)?.toLowerCase() !== tag.toLowerCase() ? null : parseAt(html));
  const { fics, missing, complete } = await readPages(url, parse, 25, { pages, since });
  if (missing) return { error: 'no such tag on Author.Today — try another spelling with --at', fics };
  // No text search there: the title, genres and summary stand in.
  const hay = (f) => norm([f.title, f.summary, ...f.genres].join(' '));
  const kept = fics.filter((f) => f.genres.includes('Фанфик') !== originals)
    .filter((f) => !text || norm(text).split(' ').every((w) => hay(f).includes(w)));
  return { fics: kept, skipped: fics.length - kept.length, complete };
}

/**
 * Wattpad: the "hot" and "new" stories of each tag (40 a tag, the page has no more), then each story's own page
 * for its language, size and last update. Stories in other languages than the reader's, and hidden ones, are left out.
 */
async function scanWattpad(tags, { langs, text }) {
  const stubs = new Map();
  let complete = true;
  for (const tag of tags) {
    const list = parseWattpadTag(await get(`https://www.wattpad.com/stories/${encodeURIComponent(tag)}`, { text: true, cacheDays: 1 }));
    if (!list) { complete = false; continue; }
    for (const s of list) if (!stubs.has(s.url)) stubs.set(s.url, s);
  }
  const fics = [];
  let skipped = 0;
  for (const stub of stubs.values()) {
    const story = parseWattpadStory(await get(stub.url, { text: true, cacheDays: 7 }));
    if (!story) { complete = false; continue; }
    const fic = { ...stub, ...story };
    const hay = norm([fic.title, fic.summary, ...fic.tags].join(' '));
    if (fic.hidden || !langs.includes(fic.lang) || (text && !norm(text).split(' ').every((w) => hay.includes(w)))) { skipped++; continue; }
    delete fic.hidden;
    fics.push(fic);
  }
  return { fics, skipped, complete };
}

// ---------- only what is new ----------

// Settings that decide which fics a source returns; preferred and demoted tags only rank, pages only limit.
const filtersOf = (o) => JSON.parse(JSON.stringify(o ?? {}, (k, v) => (['prefer', 'demote', 'pages', 'aliases', 'fandoms', 'authors', 'ao3_tag', 'at_tag', 'wattpad_tags'].includes(k) ? undefined : v)));
const sourceKey = (parts, filters) => [...parts, createHash('sha1').update(JSON.stringify(filtersOf(filters))).digest('hex').slice(0, 12)].join('|');

/** The day to read a source from: the day before its last complete scan (dates are days), or null — read it all. */
function sinceFor(state, key) {
  const last = state.full ? null : state.sources[key];
  return last ? new Date(Date.parse(last) - 864e5).toISOString().slice(0, 10) : null;
}

/**
 * Fics with the reader's kudos on AO3 are read: their public kudos list is checked (one request each, cached a week)
 * for the fics that are left after every other filter. Without `ao3_user` in the settings nothing is checked.
 * The list page shows the last 50 accounts only: a fic with more kudos cannot be checked this way (`kudos_unchecked`).
 */
const KUDOS_PAGE = 50;
// Kudos means read and liked: fics found with the reader's kudos are kept as a taste source, like bookmarks.
const kudosed = [];

async function keepKudosed(settings) {
  if (!kudosed.length || !settings?.ao3_user) return;
  const file = path.join(SOURCES, `ao3-kudos-${settings.ao3_user}.json`);
  const old = await readJson(file, { site: 'ao3', user: settings.ao3_user, fics: [] });
  const urls = new Set(old.fics.map((f) => f.url));
  old.fics.push(...kudosed.filter((f) => !urls.has(f.url)).map(({ excluded_by, missing, preferred, demoted, category_ok, pairing_ok, _server, _server_pairing, _with_gen, verdict, ...f }) => ({ ...f, found: today() })));
  old.updated = today();
  await mkdir(SOURCES, { recursive: true });
  await writeFile(file, JSON.stringify(old, null, 1) + '\n');
}
async function dropKudosed(fics, dropped, settings) {
  const user = settings?.ao3_user?.toLowerCase();
  if (!user) return fics;
  dropped.kudos = [];
  const kept = [];
  for (const f of fics) {
    let users = null;
    if (f.site === 'ao3' && f.kudos > KUDOS_PAGE) dropped.kudos_unchecked = (dropped.kudos_unchecked ?? 0) + 1;
    else if (f.site === 'ao3') {
      try {
        users = kudosUsers((await get(`${f.url}/kudos`, { text: true, cacheDays: 7 })) ?? '');
      } catch {}
      if (users === null) dropped.kudos_unchecked = (dropped.kudos_unchecked ?? 0) + 1;
    }
    if (users?.has(user)) {
      dropped.kudos.push({ title: f.title, url: f.url });
      kudosed.push(f);
    }
    else kept.push(f);
  }
  return kept;
}

/** Hides fics the same search (same filters) found before; when this search was complete, remembers what it found. */
function onlyNew(fics, dropped, complete, state, key) {
  const before = new Set(state.found[key] ?? []);
  const fresh = state.full ? fics : fics.filter((f) => !before.has(f.url));
  dropped.found_before = fics.length - fresh.length;
  if (complete) state.found[key] = [...new Set([...before, ...fics.map((f) => f.url)])];
  return fresh;
}

/**
 * Size, rating, status and crossovers from the scan defaults (AO3 already filtered size and status; checked here for everything).
 * Crossovers are left to AO3 where it filtered them (`_server`): its own count knows related fandoms better.
 */
function fitScan(found, sc) {
  const words = (f) => f.words || Math.round((f.chars ?? 0) / CHARS_PER_WORD);
  const dropped_by_scan = [];
  const fit = found.filter((f) => {
    const why = [
      ...(sc.status && sc.status !== 'any' && f.status !== sc.status ? [`status ${f.status}`] : []),
      ...(sc.min_words && words(f) < sc.min_words ? [`${words(f)} words < ${sc.min_words}`] : []),
      ...(sc.max_words && words(f) > sc.max_words ? [`${words(f)} words > ${sc.max_words}`] : []),
      ...(sc.ratings?.length && f.site === 'ao3' && !sc.ratings.includes(f.rating) ? [`rating ${f.rating}`] : []),
      ...(!f._server && ['exclude', 'only'].includes(sc.crossovers) && isCrossover(f) === (sc.crossovers === 'exclude') ? [sc.crossovers === 'exclude' ? 'crossover' : 'not a crossover'] : []),
    ];
    if (why.length) dropped_by_scan.push({ title: f.title, url: f.url, why });
    return !why.length;
  });
  return { fit, dropped_by_scan };
}

/**
 * Works of an AO3 author the reader follows, in the reader's fandoms (and originals, if the reader reads them).
 * The author's other fandoms are counted in source.other_fandoms, so the reader can be told where else they write.
 * Each fic gets the settings of its own fandoms (pairings included).
 */
async function scanAuthor(name, { flags, langs, settings, saved, state }) {
  const sc = { ...(settings.scan ?? {}), ...flags };
  const pages = sc.pages === 'all' ? Infinity : Math.max(1, sc.pages ?? 1);
  const key = sourceKey(['ao3-author', name.toLowerCase(), langs.join('+')], { settings, sc });
  const since = sinceFor(state, key);
  let found = [];
  const source = { site: 'ao3', author: name, read: since ? `updated since ${since}` : 'all' };
  let complete = false;
  try {
    const url = (p) => `${AO3}/users/${encodeURIComponent(name)}/works?${since ? 'work_search[sort_column]=revised_at&' : ''}page=${p}`;
    const res = await readPages(url, (html) => (html === null ? null : parseAo3(html)), 20, { pages, since });
    found = res.fics;
    if (res.missing) source.error = `no AO3 user "${name}"`;
    complete = !res.missing && res.complete;
  } catch (e) {
    source.error = `site did not answer: ${e.message.replace(/\s*https?:\/\/\S+/, '')}`;
  }
  if (complete) state.sources[key] = today();
  const inLang = found.filter((f) => langs.includes(f.lang));
  source.found = found.length;
  source.other_languages = found.length - inLang.length;
  const mine = (f) => f.fandoms.some((t) => readerFandomOf(settings, t) || (settings.originals && /^Original Work$/i.test(t)));
  const other = {};
  for (const f of inLang.filter((x) => !mine(x))) for (const t of f.fandoms) other[t] = (other[t] ?? 0) + 1;
  if (Object.keys(other).length) source.other_fandoms = other;
  const { fit, dropped_by_scan } = fitScan(inLang.filter(mine), sc);
  const { fics, dropped } = applyFilters(fit, (f) => effectiveTags(settings, f.fandoms), saved, settings.blocked_authors);
  return { query: `author: ${name}`, sources: [source], fics: await dropKudosed(onlyNew(fics, dropped, complete, state, key), dropped, settings), dropped: { ...dropped, by_scan_settings: dropped_by_scan } };
}

/** One search: a fandom (or any tag), or originals. */
async function scanOne(query, { originals, ao3Opt, atOpt, require, exclude, text, flags, langs, settings, saved, state, site, part }) {
  const sc = { ...scanDefaults(settings, [query]), ...flags };
  // "all": every page there is — at 5 s a page on AO3 a big fandom takes an hour or more.
  const pages = sc.pages === 'all' ? Infinity : Math.max(1, sc.pages ?? 1);
  const ao3 = await ao3Tag(query, ao3Opt ?? sc.ao3_tag, originals);
  const atTag = atOpt ?? sc.at_tag ?? (query && /\p{Script=Cyrillic}/u.test(query) ? query.toLowerCase() : null);
  const tags = effectiveTags(settings, [query, ao3?.tag]);
  tags.exclude = [...new Set([...tags.exclude, ...exclude])];
  tags.require = [...new Set([...tags.require, ...require])];
  // Wanted pairings go to AO3 one search each (AO3 requires all given tags, so they cannot share one):
  // only fics with that pairing come back, never the whole fandom.
  // With with_gen, one more search: the fandom's gen fics (AO3 category tag "Gen").
  const allRuns = tags.relationships.length ? [...tags.relationships, ...(tags.with_gen ? ['Gen'] : [])] : [null];
  // --part: pairings (and a fandom searched whole) first, gen after.
  const pairingRuns = !part ? allRuns : part === 'gen' ? allRuns.filter((r) => r === 'Gen') : allRuns.filter((r) => r !== 'Gen');

  const sources = [];
  const found = [];
  let complete = true;
  const filters = { tags, sc, text, originals };
  const run = async (info, keyParts, fn) => {
    const key = sourceKey(keyParts, filters);
    const since = sinceFor(state, key);
    try {
      const { fics, error, skipped, complete: done } = await fn(since);
      sources.push({ ...info, read: since ? `updated since ${since}` : 'all', found: fics.length, ...(skipped ? { skipped_by_genre_or_text: skipped } : {}), ...(error ? { error } : {}) });
      found.push(...fics);
      if (done && !error) state.sources[key] = today();
      else complete = false;
    } catch (e) {
      sources.push({ ...info, found: 0, error: e.plain ? e.message : `site did not answer: ${e.message.replace(/\s*https?:\/\/\S+/, '')}` });
      complete = false;
    }
  };
  if (ao3 && (!site || site === 'ao3')) {
    for (const lang of langs) {
      for (const pairing of pairingRuns) {
        await run({ site: 'ao3', tag: ao3.tag, tag_from: ao3.from, lang, ...(pairing ? { pairing } : {}) }, ['ao3', ao3.tag, lang, pairing ?? ''],
          (since) => scanAo3(ao3.tag, lang, { require: [...tags.require, ...(pairing ? [pairing] : [])], exclude: tags.exclude.filter((t) => !t.startsWith('=') && !tags.unless[t]), text, pages, since, sc, pairingOnServer: !!pairing }));
      }
    }
  }
  if (part === 'gen') sources.push({ site: 'author.today', skipped: 'read with --part pairings' });
  else if (site && site !== 'author.today') sources.push({ site: 'author.today', skipped: `--site ${site}` });
  else if (atTag) await run({ site: 'author.today', tag: atTag, note: 'tags matched in genres and summary — approximate' }, ['author.today', atTag], (since) => scanAt(atTag, { text, originals, pages, since }));
  else sources.push({ site: 'author.today', skipped: originals ? 'originals there need a Russian tag — pass --at' : 'query is not in Cyrillic — pass the Russian tag with --at' });
  const wpTags = originals ? [] : sc.wattpad_tags ?? [];
  if (part === 'gen') sources.push({ site: 'wattpad', skipped: 'read with --part pairings' });
  else if (site && site !== 'wattpad') sources.push({ site: 'wattpad', skipped: `--site ${site}` });
  else if (wpTags.length) await run({ site: 'wattpad', tags: wpTags, note: 'hot and new stories of each tag (40 a tag); tags matched in tags and summary — approximate' }, ['wattpad', ...wpTags, langs.join('+')], () => scanWattpad(wpTags, { langs, text }));
  else sources.push({ site: 'wattpad', skipped: 'no Wattpad tags for this fandom — set wattpad_tags --fandom' });
  // A fic with two wanted pairings comes back from both searches.
  const seen = new Set();
  const unique = found.filter((f) => !seen.has(f.url) && seen.add(f.url));
  const { fit, dropped_by_scan } = fitScan(unique, sc);
  const { fics, dropped } = applyFilters(fit, (f) => (f.site === 'ao3' ? effectiveTags(settings, [query, ao3?.tag, ...f.fandoms]) : tags), saved, settings.blocked_authors);
  return {
    query: query ?? (originals ? 'originals' : atTag),
    settings_used: { ...tags, scan: { ...sc, pages: sc.pages ?? 1 }, text: text ?? null },
    sources,
    fics: await dropKudosed(onlyNew(fics, dropped, complete, state, sourceKey(['search', query ?? (originals ? 'originals' : atTag), langs.join('+')], filters)), dropped, settings),
    dropped: { ...dropped, by_scan_settings: dropped_by_scan },
  };
}

async function scan() {
  const started = new Date().toISOString();
  const opts = {
    originals: flag('--originals'),
    ao3Opt: option('--ao3'),
    atOpt: option('--at'),
    require: list(option('--require')),
    exclude: list(option('--exclude')),
    text: option('--text'),
    author: option('--author'),
    site: option('--site'),
    browser: flag('--browser'),
    part: option('--part'),
    offline: flag('--offline'),
    waitBrowser: Number(option('--wait-browser') ?? 10),
  };
  if (opts.part && !['pairings', 'gen', 'authors'].includes(opts.part)) fail('--part pairings|gen|authors');
  if (opts.site && !['ao3', 'author.today', 'wattpad'].includes(opts.site)) fail('--site ao3|author.today|wattpad');
  const scans = await readJson(SCANS_FILE, { sources: {}, found: {} });
  const state = { full: flag('--full'), sources: scans.sources, found: scans.found };
  // Flags given for this one scan override the reader's scan defaults.
  const flags = {};
  const pagesOpt = option('--pages');
  if (pagesOpt) flags.pages = pagesOpt === 'all' ? 'all' : Number(pagesOpt);
  const minOpt = option('--min-words');
  if (minOpt) flags.min_words = Number(minOpt);
  const maxOpt = option('--max-words');
  if (maxOpt) flags.max_words = Number(maxOpt);
  const ratingsOpt = option('--ratings');
  if (ratingsOpt) flags.ratings = list(ratingsOpt);
  const statusOpt = option('--status');
  if (statusOpt) {
    if (!STATUSES.includes(statusOpt)) fail(`--status ${STATUSES.join('|')}`);
    flags.status = statusOpt;
  }
  const crossOpt = option('--crossovers');
  if (crossOpt) {
    if (!CROSSOVERS.includes(crossOpt)) fail(`--crossovers ${CROSSOVERS.join('|')}`);
    flags.crossovers = crossOpt;
  }
  opts.flags = flags;
  const settings = await loadSettings();
  const { mode, langs } = await modeLangs(option('--mode'), settings);
  const query = argv.slice(1).join(' ').trim();
  // AO3 first by the script; if it does not let the script in, say so at once (no hour of retries) — then --browser.
  let bridge = null;
  if (opts.offline) process.env.FANFIC_OFFLINE = '1';
  if ((!opts.site || opts.site === 'ao3') && !opts.offline) {
    // Always the script first; --browser only says where to go if AO3 does not let it in.
    const direct = await reachable(`${AO3}/works`);
    // The script lets in: read directly, but keep the browser ready in case AO3 starts refusing mid-scan.
    if (direct === true && opts.browser) {
      bridge = startBridge({ origin: AO3, log: (m) => process.stderr.write(`[bridge] ${m}\n`) });
      standbyBridge(new URL(AO3).host, bridge);
      opts.browser = false;
    }
    if (direct !== true && opts.browser) process.stderr.write(`[scan] AO3 does not let the script in (${direct}) — through the browser\n`);
    if (opts.browser) {
      bridge = startBridge({ origin: AO3, log: (m) => process.stderr.write(`[bridge] ${m}\n`) });
      useBridge(new URL(AO3).host, bridge);
      if (!(await bridge.connected(opts.waitBrowser * 60000))) {
        bridge.close();
        fail(`no AO3 tab connected in ${opts.waitBrowser} min — open https://archiveofourown.org in the reader's Chrome and run "node fanfic.mjs browser-snippet" there`);
      }
    } else {
      const ok = direct;
      if (ok !== true) fail(`AO3 does not let the script in (${ok}). Rerun the scan with --browser and run "node fanfic.mjs browser-snippet" in an AO3 tab of the reader's Chrome (modes/fanfic.md)`);
    }
  }
  const saved = savedSet(await readerSaves());
  const base = { ...opts, langs, settings: settings ?? blank(), saved, state };
  let searches;
  if (opts.author && opts.site && opts.site !== 'ao3') fail('--author reads AO3 authors');
  if (opts.author) searches = [await scanAuthor(opts.author, base)];
  // One of the reader's fandoms, by name, alias or part of either: searched with all its settings.
  else if (query || opts.ao3Opt || opts.atOpt || opts.originals) searches = [await scanOne((query && readerFandom(settings, query)) || query || null, base)];
  else {
    if (!settings) fail('no fanfic settings yet — run node fanfic.mjs settings and ask the reader first (modes/fanfic.md)');
    if (!settings.fandoms.length && !settings.originals && !settings.authors?.length) fail('no fandoms, authors or originals — fandom add "<fandom>", author add "<name>" or set originals yes');
    searches = [];
    if (opts.part !== 'authors') {
      for (const f of settings.fandoms) searches.push(await scanOne(f, base));
      if (settings.originals && opts.part !== 'gen') searches.push(await scanOne(null, { ...base, originals: true }));
    }
    if ((!opts.site || opts.site === 'ao3') && (!opts.part || opts.part === 'authors')) for (const a of settings.authors ?? []) searches.push(await scanAuthor(a, base));
  }
  bridge?.close();
  await keepKudosed(settings);
  await mkdir(reader.dir, { recursive: true });
  // Offline shows what was read; it must not tell the next scan that anything was read in full.
  if (!opts.offline) await writeFile(SCANS_FILE, JSON.stringify({ sources: state.sources, found: state.found }, null, 1) + '\n');
  // Fics the reader opened on AO3 (history): marked, neither read nor dropped — only a kudos counts.
  const opened = await historyMap();
  for (const sr of searches) for (const f of sr.fics) if (opened.has(f.url)) f.opened = opened.get(f.url) || true;
  // A fic found both in a fandom and by its author is shown once, where it came first.
  const shown = new Set();
  for (const s of searches) s.fics = s.fics.filter((f) => !shown.has(f.url) && shown.add(f.url));
  out({
    reader: reader.name,
    mode,
    ...(settings ? {} : { onboarded: false }),
    ...(missingRequired(settings).length ? { missing_required: missingRequired(settings) } : {}),
    searches,
    run: { started, finished: new Date().toISOString(), via: bridge ? 'browser' : 'script', http: httpStats },
    // Not read by scripts: offer these to the reader, then search them on the web (modes/fanfic.md).
    web_search_next: ['ficbook.net', ...(langs.includes('en') ? ['fanfiction.net', 'quotev.com', 'dreamwidth.org'] : [])],
  });
}

// ---------- saves ----------

async function ao3Bookmarks(user, pages, cacheDays) {
  const fics = [];
  for (let p = 1; p <= pages; p++) {
    const html = await get(`${AO3}/users/${encodeURIComponent(user)}/bookmarks?page=${p}`, { text: true, cacheDays, valid: isAo3List });
    if (html === null) return { error: `no AO3 user "${user}"`, fics };
    fics.push(...parseAo3(html));
    if ((html.match(/<li id="bookmark_\d+"/g) ?? []).length < 20) break;
  }
  return { fics };
}

async function saves() {
  const pages = Math.max(1, Number(option('--pages') ?? 50));
  const [, site, user] = argv;
  if (site !== 'ao3' || !user) fail(USAGE);
  const { fics, error } = await ao3Bookmarks(user, pages, 0);
  if (error) fail(error);
  const file = path.join(SOURCES, `ao3-bookmarks-${user}.json`);
  await mkdir(SOURCES, { recursive: true });
  await writeFile(file, JSON.stringify({ site: 'ao3', user, fetched: today(), bookmarks: fics }, null, 1) + '\n');
  // The reader's own account: their kudos mark fics read from now on.
  const s = (await loadSettings()) ?? blank();
  if (!s.ao3_user) await saveSettings({ ...s, ao3_user: user });
  out({ reader: reader.name, saved: path.relative(ROOT, file), taste: tasteSummary(fics) });
}

/** url → last visited, from the reader's saved AO3 history (sources/ao3-history-*.json). */
async function historyMap() {
  const files = (await readdir(SOURCES).catch(() => [])).filter((f) => /^ao3-history-.+\.json$/.test(f));
  const all = await Promise.all(files.map((f) => readJson(path.join(SOURCES, f), { fics: [] })));
  return new Map(all.flatMap((h) => h.fics.map((f) => [f.url, f.visited ?? null])));
}

/** The reader's AO3 history (/users/<user>/readings) — visible only logged in, so through their browser. */
async function history() {
  const [, site, user] = argv;
  if (site !== 'ao3' || !user || !flag('--browser')) fail('usage: node fanfic.mjs history ao3 <user> --browser');
  const bridge = startBridge({ origin: AO3, log: (m) => process.stderr.write(`[bridge] ${m}\n`) });
  useBridge(new URL(AO3).host, bridge);
  if (!(await bridge.connected(Number(option('--wait-browser') ?? 10) * 60000))) { bridge.close(); fail('no AO3 tab connected — run "node fanfic.mjs browser-snippet" in an AO3 tab'); }
  const fics = [];
  let error = null;
  try {
    for (let p = 1; ; p++) {
      const html = await get(`${AO3}/users/${encodeURIComponent(user)}/readings?page=${p}`, { text: true, valid: isAo3List });
      if (html === null) { error = `no AO3 user "${user}"`; break; }
      if (!/Hi, /.test(html)) { error = 'not logged in on AO3 in this browser — history is private'; break; }
      const page = parseAo3(html);
      fics.push(...page);
      if (page.length < 20) break;
    }
  } catch (e) {
    error = `stopped: ${e.message.replace(/\s*https?:\/\/\S+/, '')}`;
  }
  bridge.close();
  if (!fics.length) fail(error ?? 'empty history');
  const file = path.join(SOURCES, `ao3-history-${user}.json`);
  await mkdir(SOURCES, { recursive: true });
  // Kept whole, as the reader's data; it marks fics as opened, never as read or liked.
  await writeFile(file, JSON.stringify({ site: 'ao3', user, fetched: today(), complete: !error, fics }, null, 1) + '\n');
  out({ reader: reader.name, saved: path.relative(ROOT, file), fics: fics.length, ...(error ? { error } : {}) });
}

/** Links and titles of the reader's saved fics. */
const savedSet = (saves) => new Set(saves.flatMap((s) => s.bookmarks.flatMap((b) => [b.url, norm(b.title)])));

/** The reader's saved fics: AO3 bookmarks, and fics with their kudos (read and liked). */
async function readerSaves() {
  const files = (await readdir(SOURCES).catch(() => [])).filter((f) => /^ao3-(bookmarks|kudos)-.+\.json$/.test(f));
  const all = await Promise.all(files.map((f) => readJson(path.join(SOURCES, f), null)));
  return all.filter(Boolean).map((s) => ({ ...s, bookmarks: s.bookmarks ?? s.fics ?? [] }));
}

/**
 * Fics found by hand go through the same filters as a scan: the reader's settings for their fandoms (tags against
 * the known tags, summary and title), status and size, abandoned, crossovers, saved, rejected and read, kudos.
 * What is not known is not held against a fic: `unknown` lists what could not be checked.
 */
async function check() {
  const file = argv[1];
  if (!file) fail(USAGE);
  const given = JSON.parse(file === '-' ? await new Promise((r) => { let d = ''; process.stdin.on('data', (c) => (d += c)).on('end', () => r(d)); }) : await readFile(file, 'utf8'));
  const settings = (await loadSettings()) ?? blank();
  const saved = savedSet(await readerSaves());
  const now = Date.now();
  const fics = given.map((f) => ({
    site: 'web', fandoms: [], tags: [], relationships: [], summary: null, ...f,
    status: f.status === 'in_progress' && f.updated && (now - Date.parse(f.updated)) / 864e5 > 365 ? 'abandoned' : f.status ?? null,
  }));
  const results = [];
  const dropped = { abandoned: 0, saved: 0, by_settings: [], blocked: [], by_scan_settings: [] };
  for (const f of fics) {
    // The fic's fandoms decide its settings; what is not known about it is not checked.
    const sc = { ...scanDefaults(settings, f.fandoms) };
    if (!f.status) delete sc.status;
    if (!f.words) delete sc.min_words, delete sc.max_words;
    const { fit, dropped_by_scan } = fitScan([f], sc);
    dropped.by_scan_settings.push(...dropped_by_scan);
    const r = applyFilters(fit, (x) => effectiveTags(settings, x.fandoms), saved, settings.blocked_authors);
    dropped.abandoned += r.dropped.abandoned;
    dropped.saved += r.dropped.saved;
    dropped.by_settings.push(...r.dropped.by_settings);
    dropped.blocked.push(...r.dropped.blocked);
    results.push(...r.fics);
  }
  const kept = await dropKudosed(results, dropped, settings);
  await keepKudosed(settings);
  const unknown = (f) => [
    ...(f.tags?.length ? [] : ['tags']),
    ...(f.status ? [] : ['status']),
    ...(f.updated ? [] : ['updated']),
    ...(f.rating ? [] : ['rating']),
    ...(f.relationships?.length || f.category ? [] : ['pairing']),
  ];
  out({ reader: reader.name, checked: given.length, passed: kept.length, fics: kept.map((f) => ({ ...f, unknown: unknown(given.find((g) => g.url === f.url)) })), dropped });
}

/**
 * Comments readers left on AO3 fics (the work page with comments, newest first; --pages N pages of them, default 2):
 * how many mention a character out of character, a world that does not work like the canon's, in character, a good or a bad plot.
 * Names are not kept. A fic with more OOC mentions than comments_ooc_max, or more lore complaints than comments_lore_max,
 * is dropped; the rest come back with their signals for the evaluation.
 */
async function commentsCmd() {
  const file = argv[1];
  if (!file) fail(USAGE);
  const pages = Math.max(1, Number(option('--pages') ?? 2));
  const settings = (await loadSettings()) ?? blank();
  // What matters in comments is the reader's own answer — never a default.
  if (!settings.comments) fail('ask the reader first what matters in comments: set comments_ooc_max <N|""> and set comments_watch "<in_character,plot_good,plot_bad>" (modes/fanfic.md)');
  const max = settings.comments.ooc_max ?? Infinity;
  const loreMax = settings.comments.lore_max ?? Infinity;
  const drops = (sig) => sig.ooc > max || sig.lore > loreMax;
  let bridge = null;
  if (flag('--browser')) {
    bridge = startBridge({ origin: AO3, log: (m) => process.stderr.write(`[bridge] ${m}\n`) });
    if ((await reachable(`${AO3}/works`)) === true) standbyBridge(new URL(AO3).host, bridge);
    else {
      useBridge(new URL(AO3).host, bridge);
      if (!(await bridge.connected(10 * 60000))) { bridge.close(); fail('no AO3 tab connected'); }
    }
  }
  const fics = JSON.parse(await readFile(file, 'utf8'));
  const kept = [];
  const dropped = [];
  const errors = [];
  for (const f of fics) {
    // Other sites (ficbook, FanFiction.net, Author.Today): comments read from the fic's page in the reader's browser come as f.comments.
    if (Array.isArray(f.comments)) {
      const { comments, ...rest } = f;
      const sig = commentSignals(comments);
      (drops(sig) ? dropped : kept).push({ ...rest, comment_signals: sig });
      continue;
    }
    if (!/archiveofourown\.org\/works\/\d+/.test(f.url ?? '')) { kept.push({ ...f, comment_signals: null }); continue; }
    const all = [];
    try {
      for (let p = 1; p <= pages; p++) {
        const html = await get(`${f.url}?view_full_work=true&show_comments=true&view_adult=true&page=${p}`, { text: true, cacheDays: 7 });
        if (html === null) break;
        const page = parseAo3Comments(html);
        all.push(...page);
        if (!html.includes(`page=${p + 1}`)) break;
      }
    } catch (e) {
      errors.push({ title: f.title, url: f.url, error: e.message.replace(/\s*https?:\/\/\S+/, '') });
      kept.push({ ...f, comment_signals: null });
      continue;
    }
    const sig = commentSignals(all);
    (drops(sig) ? dropped : kept).push({ ...f, comment_signals: sig });
  }
  bridge?.close();
  // Praise the reader cares about lifts a fic: the more of it, the higher; complaints about the plot pull it down.
  const watch = settings.comments.watch ?? [];
  const score = (f) => (f.comment_signals ? watch.filter((k) => !['plot_bad', 'ooc', 'lore'].includes(k)).reduce((n, k) => n + (f.comment_signals[k] ?? 0), 0) - (watch.includes('plot_bad') ? f.comment_signals.plot_bad ?? 0 : 0) : 0);
  kept.forEach((f) => (f.praise = score(f)));
  kept.sort((x, y) => y.praise - x.praise);
  out({ reader: reader.name, ooc_max: Number.isFinite(max) ? max : null, lore_max: Number.isFinite(loreMax) ? loreMax : null, watch, checked: fics.length, kept, dropped_by_comments: dropped.map(({ title, url, comment_signals }) => ({ title, url, comment_signals })), ...(errors.length ? { errors } : {}) });
}

/** Pages the reader saved from a site (likes, library, lists): kept as they are in sources/, every fic on them marked read. */
async function readList() {
  const files = argv.slice(1);
  if (!files.length) fail(USAGE);
  await mkdir(SOURCES, { recursive: true });
  const results = [];
  for (const file of files) {
    const fics = savedPageFics(await readFile(file, 'utf8'));
    if (!fics.length) {
      results.push({ file, error: 'no fics found on this page — is it a saved list page of ficbook, Author.Today or AO3?' });
      continue;
    }
    const kept = path.join(SOURCES, `read-${fics[0].site}-${today()}-${path.basename(file).replace(/[^\p{L}\p{N}.]+/gu, '_')}`);
    if (path.resolve(file) !== path.resolve(kept)) await copyFile(file, kept);
    for (const f of fics) {
      execFileSync(process.execPath, [path.join(ROOT, 'reader.mjs'), ...readerArg, 'reject', f.title, '--reason', 'read', '--url', f.url, '--note', `${f.site} (${path.basename(file)})`], { encoding: 'utf8' });
    }
    results.push({ file, site: fics[0].site, saved: path.relative(ROOT, kept), marked_read: fics.length, titles: fics.map((f) => f.title) });
  }
  out({ reader: reader.name, results });
}

// ---------- texts of fics (reading them, stage 3) ----------

const TEXTS = path.join(reader.dir, 'texts');
const workId = (s) => (String(s).match(/works\/(\d+)/) ?? String(s).match(/^(\d+)$/) ?? [])[1];
const workPage = (id) => `${AO3}/works/${id}?view_full_work=true&show_comments=true&view_adult=true&page=1`;

/** AO3 work ids from a fics file (scan, check, comments output) or from the arguments. */
async function workIds(args) {
  const ids = [];
  for (const a of args) {
    if (workId(a)) { ids.push(workId(a)); continue; }
    const j = JSON.parse(await readFile(a, 'utf8'));
    const fics = Array.isArray(j) ? j : j.fics ?? j.kept ?? (j.searches ?? []).flatMap((s) => s.fics ?? []);
    ids.push(...fics.map((f) => workId(f.url)).filter(Boolean));
  }
  return [...new Set(ids)];
}

/** The reader's AO3 tab through a bridge on `port`: a second port lets texts download while a scan holds the first. */
async function ao3Bridge(port) {
  const bridge = startBridge({ origin: AO3, port, log: (m) => process.stderr.write(`[bridge] ${m}\n`) });
  if ((await reachable(`${AO3}/works`)) === true) standbyBridge(new URL(AO3).host, bridge);
  else {
    useBridge(new URL(AO3).host, bridge);
    if (!(await bridge.connected(10 * 60000))) { bridge.close(); fail(`no AO3 tab connected — run "node fanfic.mjs browser-snippet${port ? ` --port ${port}` : ''}" in an AO3 tab of the reader's Chrome`); }
  }
  return bridge;
}

async function textsCmd() {
  const port = Number(option('--port')) || undefined;
  const browser = flag('--browser');
  const ids = await workIds(argv.slice(1));
  if (!ids.length) fail(USAGE);
  await mkdir(TEXTS, { recursive: true });
  const have = new Set((await readdir(TEXTS)).map((f) => f.replace(/\.txt$/, '')));
  const todo = ids.filter((id) => !have.has(id));
  const bridge = todo.length && browser ? await ao3Bridge(port) : null;
  const saved = [];
  const errors = [];
  for (const id of todo) {
    try {
      const html = await get(workPage(id), { text: true, cacheDays: 7 });
      if (html === null) { errors.push({ id, error: 'not found' }); continue; }
      const at = html.indexOf('>', html.indexOf('id="chapters"')) + 1;
      const end = html.lastIndexOf('<', html.indexOf('id="feedback"'));
      // Author's notes and chapter headings are not the text.
      const body = html.slice(at, end > at ? end : undefined)
        .replace(/<div[^>]*class="(?:notes|end notes)[^"]*"[\s\S]*?<\/div>/g, ' ')
        .replace(/<h3[^>]*class="landmark heading"[\s\S]*?<\/h3>/g, ' ')
        .replace(/<\/p>/g, '\n\n').replace(/<br\s*\/?>/g, '\n');
      const t = body.split(/\n{2,}/).map((p) => text(p)).filter(Boolean).join('\n\n');
      await writeFile(path.join(TEXTS, `${id}.txt`), t);
      saved.push({ id, words: t.split(/\s+/).length });
      process.stderr.write(`[texts] ${id} ${saved.at(-1).words} words (${saved.length + errors.length}/${todo.length})\n`);
    } catch (e) {
      errors.push({ id, error: e.message.replace(/\s*https?:\/\/\S+/, '') });
    }
  }
  bridge?.close();
  out({ reader: reader.name, dir: path.relative(ROOT, TEXTS), already: ids.length - todo.length, saved, ...(errors.length ? { errors } : {}) });
}

async function excerptsCmd() {
  const n = (name, d) => Math.max(0, Number(option(name) ?? d));
  const [start, middle, endN] = [n('--start', 450), n('--middle', 240), n('--end', 120)];
  const ficsFile = option('--fics');
  const meta = {};
  if (ficsFile) {
    const j = JSON.parse(await readFile(ficsFile, 'utf8'));
    const fics = Array.isArray(j) ? j : j.fics ?? j.kept ?? (j.searches ?? []).flatMap((s) => s.fics ?? []);
    for (const f of fics) if (workId(f.url)) meta[workId(f.url)] = f;
  }
  const ids = await workIds(argv.slice(1));
  if (!ids.length) fail(USAGE);
  const settings = (await loadSettings()) ?? blank();
  // Only the cache: reading excerpts never waits for AO3.
  process.env.FANFIC_OFFLINE = '1';
  const res = [];
  for (const id of ids) {
    const m = meta[id];
    const r = { id, url: `${AO3}/works/${id}`, ...(m ? { title: m.title, authors: m.authors, rating: m.rating, status: m.status, words: m.words, lang: m.lang, relationships: m.relationships, tags: m.tags, summary: m.summary } : {}) };
    try {
      const html = await get(workPage(id), { text: true, cacheDays: 30 });
      r.comment_signals = commentSignals(parseAo3Comments(html));
      // Only the kudos paragraph of the page: the comments below link users too.
      if (settings.ao3_user) r.reader_kudos = kudosUsers((html.match(/id="kudos"[\s\S]*?<\/p>/) ?? [''])[0])?.has(settings.ao3_user.toLowerCase()) ?? null;
    } catch { r.comment_signals = null; }
    let t;
    try { t = (await readFile(path.join(TEXTS, `${id}.txt`), 'utf8')).split(/\s+/).filter(Boolean); } catch { r.error = 'no text — node fanfic.mjs texts first'; res.push(r); continue; }
    const w = t.length;
    r.text_words = w;
    r.start = t.slice(0, start).join(' ');
    if (w > start + endN) r.middle = t.slice(Math.max(start, Math.floor(w / 2 - middle / 2)), Math.floor(w / 2 + middle / 2)).join(' ');
    if (w > start) r.end = t.slice(Math.max(start, w - endN)).join(' ');
    res.push(r);
  }
  out({ reader: reader.name, excerpts: res });
}

// ---------- similar ----------

async function similar() {
  const fromSaves = flag('--from-saves');
  const seedLimit = Math.max(1, Number(option('--seeds') ?? 10));
  const perSeed = Math.max(1, Number(option('--users') ?? 10));
  const settings = (await loadSettings()) ?? blank();
  const { mode, langs } = await modeLangs(option('--mode'), settings);
  const own = await readerSaves();
  const ownUsers = new Set(own.map((s) => s.user.toLowerCase()));
  const ownUrls = new Set(own.flatMap((s) => s.bookmarks.map((b) => b.url)));
  const ids = argv.slice(1).map((a) => a.match(/works\/(\d+)/)?.[1] ?? (/^\d+$/.test(a) ? a : null));
  if (ids.includes(null)) fail('give AO3 work URLs or ids');
  const seeds = [...ids.map((id) => ({ url: `${AO3}/works/${id}`, title: null })), ...(fromSaves ? own.flatMap((s) => s.bookmarks) : [])].slice(0, seedLimit);
  if (!seeds.length) fail('no seeds: give AO3 work URLs, or --from-saves after node fanfic.mjs saves ao3 <username>');
  const seedUrls = new Set(seeds.map((s) => s.url));

  // Only counts leave this function: who saved what is kept nowhere but the HTTP cache.
  const tally = new Map();
  const errors = [];
  let usersSeen = 0;
  for (const seed of seeds) {
    let users;
    try {
      users = parseBookmarkers((await get(`${seed.url}/bookmarks`, { text: true, cacheDays: 7 })) ?? '').filter((u) => !ownUsers.has(u.toLowerCase())).slice(0, perSeed);
    } catch (e) {
      errors.push(`${seed.url}: ${e.message}`);
      continue;
    }
    for (const user of users) {
      let fics;
      try {
        ({ fics } = await ao3Bookmarks(user, 1, 7));
      } catch (e) {
        errors.push(`bookmarks of a reader of ${seed.url}: ${e.message}`);
        continue;
      }
      usersSeen++;
      for (const f of fics) {
        if (seedUrls.has(f.url) || ownUrls.has(f.url)) continue;
        const t = tally.get(f.url) ?? { fic: f, users: 0, via: new Set() };
        t.users++;
        t.via.add(seed.title ?? seed.url);
        tally.set(f.url, t);
      }
    }
  }
  // Crossovers by the setting of the fic's own fandoms (or the general one).
  const crossOk = (f) => {
    const c = scanDefaults(settings, f.fandoms).crossovers;
    return !['exclude', 'only'].includes(c) || isCrossover(f) !== (c === 'exclude');
  };
  const ranked = [...tally.values()].filter((t) => langs.includes(t.fic.lang) && crossOk(t.fic)).sort((a, b) => b.users - a.users || b.fic.kudos - a.fic.kudos);
  const { fics, dropped } = applyFilters(ranked.map((t) => ({ ...t.fic, co_saved_by: t.users, via: [...t.via] })), (f) => effectiveTags(settings, f.fandoms), savedSet(own), settings.blocked_authors);
  fics.sort((a, b) => b.co_saved_by - a.co_saved_by); // stable: preferred tags break ties
  const top = (await dropKudosed(fics.slice(0, 60), dropped, settings)).slice(0, 40);
  await keepKudosed(settings);
  out({ reader: reader.name, mode, seeds: seeds.length, readers_looked_at: usersSeen, fics: top, dropped, ...(errors.length ? { errors } : {}) });
}

/** The picks shown to the reader, as a page they can open and keep (modes/fanfic.md, step 4). */
async function pageCmd() {
  const file = argv[1];
  if (!file) fail('usage: node fanfic.mjs page <picks.json | -> [--no-open]');
  const picks = JSON.parse(file === '-' ? await readFile(0, 'utf8') : await readFile(file, 'utf8'));
  if (!Array.isArray(picks.fics) || !picks.fics.length) fail('picks.json needs "fics": [...]');
  const date = picks.date ?? today();
  const slug = norm(picks.title ?? 'podborka').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'podborka';
  const dir = path.join(reader.dir, 'picks');
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `${date}-${slug}.html`);
  await writeFile(target, picksPage({ ...picks, date }));
  let opened = false;
  if (!argv.includes('--no-open') && !process.env.FANFIC_NO_OPEN) {
    try {
      execFileSync(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open', [target], { stdio: 'ignore' });
      opened = true;
    } catch {}
  }
  out({ reader: reader.name, file: target, fics: picks.fics.length, opened });
}

switch (argv[0]) {
  case 'settings': await settingsCmd(); break;
  case 'set': await setCmd(); break;
  case 'fandom': await fandomCmd(); break;
  case 'author': await authorCmd(); break;
  case 'tags': await tagsCmd(); break;
  case 'scan': await scan(); break;
  case 'saves': await saves(); break;
  case 'read-list': await readList(); break;
  case 'check': await check(); break;
  case 'history': await history(); break;
  case 'comments': await commentsCmd(); break;
  case 'browser-snippet': process.stdout.write(browserLoop(Number(option('--port')) || undefined) + '\n'); break;
  case 'texts': await textsCmd(); break;
  case 'excerpts': await excerptsCmd(); break;
  case 'similar': await similar(); break;
  case 'page': await pageCmd(); break;
  default: fail(USAGE);
}
