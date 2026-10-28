import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAo3, parseAt, parseWattpadTag, parseWattpadStory, parseBookmarkers, atPageTag, ao3TagPath, effectiveTags, matchTags, samePairing, tasteSummary, isCrossover, readerFandomOf } from '../lib/fanfic.mjs';

// Same markup as AO3 and Author.Today list pages, with made-up fics.
const ao3Work = ({ id, title, complete = true, chapters = '3/3', date = '24 Feb 2024', category = 'M/M', kind = 'work' }) => `<li id="${kind}_${id}" class="${kind} blurb group ${kind}-${id}" role="article">
  <div class="header module">
    <h4 class="heading">
      <a href="/works/${id}">${title}</a>
      by
      <a rel="author" href="/users/someone/pseuds/someone">someone</a>
    </h4>
    <h5 class="fandoms heading"><span class="landmark">Fandoms:</span> <a class="tag" href="/tags/x/works">Some Fandom</a></h5>
    <ul class="required-tags">
      <li><a class="help symbol question modal" title="Symbol key"><span class="rating-mature rating" title="Mature"><span class="text">Mature</span></span></a></li>
      <li><a class="help"><span class="category-slash category" title="${category}"><span class="text">${category}</span></span></a></li>
      <li><a class="help"><span class="complete-${complete ? 'yes' : 'no'} iswip" title="x"><span class="text">x</span></span></a></li>
    </ul>
    <p class="datetime">${date}</p>
  </div>
  <ul class="tags commas">
    <li class='warnings'><strong><a class="tag" href="/tags/w/works">No Archive Warnings Apply</a></strong></li>
    <li class='relationships'><a class="tag" href="/tags/r/works">Yoo Joonghyuk/Kim Dokja</a></li>
    <li class='characters'><a class="tag" href="/tags/c/works">Kim Dokja</a></li>
    <li class='freeforms'><a class="tag" href="/tags/f/works">Found Family</a></li><li class='freeforms'><a class="tag" href="/tags/f2/works">Angst &amp; Comfort</a></li>
  </ul>
  <blockquote class="userstuff summary"><p>Первая строка.</p><p>Вторая.</p></blockquote>
  <dl class="stats">
    <dt class="language">Language:</dt><dd class="language" lang="ru">Русский</dd>
    <dt class="words">Words:</dt><dd class="words">52,465</dd>
    <dt class="chapters">Chapters:</dt><dd class="chapters"><a href="/works/${id}/chapters/1">${chapters.split('/')[0]}</a>/${chapters.split('/')[1]}</dd>
    <dt class="kudos">Kudos:</dt><dd class="kudos"><a href="/works/${id}/kudos">1,479</a></dd>
    <dt class="hits">Hits:</dt><dd class="hits">5,228</dd>
  </dl>
  ${kind === 'bookmark' ? '<div class="user module group"><ul class="meta tags commas"><li><a class="tag" href="/tags/b/works">my own bookmark tag</a></li></ul></div>' : ''}
</li>`;

const now = Date.parse('2026-10-17');

test('AO3: work blurbs — facts, status, and kudos not glued to the work id', () => {
  const [a, b, c] = parseAo3(ao3Work({ id: 52967443, title: 'Список &quot;дел&quot;' })
    + ao3Work({ id: 2, title: 'WIP', complete: false, chapters: '6/?', date: '1 Oct 2026' })
    + ao3Work({ id: 3, title: 'Old WIP', complete: false, chapters: '2/?', date: '1 Jan 2024' }), now);
  assert.equal(a.url, 'https://archiveofourown.org/works/52967443');
  assert.equal(a.title, 'Список "дел"');
  assert.deepEqual(a.authors, ['someone']);
  assert.deepEqual(a.fandoms, ['Some Fandom']);
  assert.equal(a.lang, 'ru');
  assert.equal(a.rating, 'Mature');
  assert.equal(a.category, 'M/M');
  assert.deepEqual(a.relationships, ['Yoo Joonghyuk/Kim Dokja']);
  assert.deepEqual(a.tags, ['Found Family', 'Angst & Comfort']);
  assert.equal(a.summary, 'Первая строка. Вторая.');
  assert.equal(a.words, 52465);
  assert.equal(a.kudos, 1479);
  assert.equal(a.hits, 5228);
  assert.equal(a.status, 'full');
  assert.equal(a.updated, '2024-02-24');
  assert.equal(b.status, 'in_progress');
  assert.equal(c.status, 'abandoned', 'no update for over a year');
});

test('AO3: bookmark blurbs parse like works; the bookmarker\'s own tags stay out', () => {
  const [f] = parseAo3(ao3Work({ id: 7, title: 'Saved', kind: 'bookmark' }), now);
  assert.equal(f.url, 'https://archiveofourown.org/works/7');
  assert.ok(!f.tags.includes('my own bookmark tag'));
  const series = '<li id="bookmark_9" class="bookmark blurb group" role="article"><div class="header module"><h4 class="heading"><a href="/series/1">A series</a></h4></div></li>';
  assert.equal(parseAo3(series).length, 0, 'series bookmarks are skipped');
});

test('AO3: bookmarkers of a work, and tag escaping in URLs', () => {
  const page = ['Verico', 'Anice%20Rhine', 'Verico'].map((u) => `<h5 class="byline heading">\n      Bookmarked by \n      <a href="/users/${u}/pseuds/${u}">${u}</a>\n    </h5>`).join('');
  assert.deepEqual(parseBookmarkers(page), ['Verico', 'Anice Rhine']);
  assert.equal(ao3TagPath('Books & Literature'), 'Books%20*a*%20Literature');
  assert.equal(ao3TagPath('Mr. Kim/Yoo?'), 'Mr*d*%20Kim*s*Yoo*q*');
});

const atRow = (id, title, status, genres) => `<div class="book-row">
    <div class="book-row-content" >
        <div class="book-title">
            <a data-pjax href="/work/${id}">
                ${title}
            </a>
        </div>
            <div class="book-author"><a data-pjax="" href="/u/a/works">Автор</a>, <a href="/u/b/works">Соавтор</a></div>
        <div data-pjax class="book-genres"><noindex>${genres.map((g) => `<a href="/work/genre/x">${g}</a>`).join(', ')}</noindex></div>
<span class="hint-top" data-hint="Размер, кол-во знаков с пробелами">296 771 <noindex>зн.</noindex></span>
                        <span class="text-success">Свободный доступ</span>
${status === 'full'
    ? '<span class="text-success"> <i class="icon-check-bold book-status-icon text-success text-bold"></i> весь текст </span><span><span class="hint-top" data-format="calendar" data-hint="Завершено " data-time="2021-11-29T20:50:41Z"></span></span>'
    : '<span class="text-primary"><i class="icon-pencil book-status-icon"></i> в процессе</span><span class="hint-top" data-format="calendar" data-hint="Обновление " data-time="2026-10-15T21:15:12Z"></span>'}
            <span data-hint="Просмотры · 23 985" class="hint-top"><i class="icon-eye"></i> 23K</span>
            <span data-hint="Понравилось · 1 752" class="hint-top"></span>
                            <span class="label label-adult-only">18+</span>
        <div data-bind="read-more: {}" class="annotation rich-text-content">
            <p>Попаданец.</p><p>Второй абзац.</p>        </div>
    </div>
</div>
`;

test('Author.Today: rows, statuses, the tag a page lists', () => {
  const html = '<h1 class="panel-title pull-left">Книги #пацаны</h1>' + atRow(1, 'Титан', 'full', ['Роман', 'Фанфик']) + atRow(2, 'Второй', 'wip', ['Роман']);
  assert.equal(atPageTag(html), 'пацаны');
  assert.equal(atPageTag('<h1 class="panel-title pull-left">Книги в жанре Фанфик</h1>'), null);
  const [a, b] = parseAt(html, now);
  assert.equal(a.url, 'https://author.today/work/1');
  assert.equal(a.title, 'Титан');
  assert.deepEqual(a.authors, ['Автор', 'Соавтор']);
  assert.deepEqual(a.genres, ['Роман', 'Фанфик']);
  assert.equal(a.status, 'full');
  assert.equal(a.updated, '2021-11-29');
  assert.equal(a.chars, 296771);
  assert.equal(a.likes, 1752);
  assert.equal(a.views, 23985);
  assert.equal(a.adult, true);
  assert.equal(a.free, true);
  assert.equal(a.summary, 'Попаданец. Второй абзац.');
  assert.equal(b.status, 'in_progress');
});

test('settings: per-fandom lists add to the general ones, allow lifts, categories replace', () => {
  const settings = {
    exclude: ['Major Character Death', 'Explicit'],
    require: ['Happy Ending'],
    prefer: ['Found Family'],
    categories: ['Gen'],
    by_fandom: { 'Omniscient Reader': { allow: ['Major Character Death', 'Happy Ending'], prefer: ['Slow Burn'], categories: ['M/M'], relationships: ['Kim Dokja/Yoo Joonghyuk'] } },
  };
  const orv = effectiveTags(settings, ['전지적 독자 시점 - 싱숑 | Omniscient Reader - Sing-Shong']);
  assert.deepEqual(orv.fandoms, ['Omniscient Reader']);
  assert.deepEqual(orv.exclude, ['Explicit']);
  assert.deepEqual(orv.require, []);
  assert.deepEqual(orv.prefer, ['Found Family', 'Slow Burn']);
  assert.deepEqual(orv.categories, ['M/M']);
  const other = effectiveTags(settings, ['Some Fandom']);
  assert.deepEqual(other.exclude, ['Major Character Death', 'Explicit']);
  assert.deepEqual(other.categories, ['Gen']);
  assert.deepEqual(other.relationships, []);
});

test('matching: tags, category, pairing in either order; Author.Today leaves category and pairing unchecked', () => {
  const [fic] = parseAo3(ao3Work({ id: 1, title: 'x' }), now);
  const m = matchTags(fic, { exclude: ['angst'], require: ['Found Family', 'Slow Burn'], prefer: ['found family'], categories: ['M/M'], relationships: ['Kim Dokja/Yoo Joonghyuk'] });
  assert.deepEqual(m.excluded_by, ['angst']);
  assert.deepEqual(m.missing, ['Slow Burn']);
  assert.deepEqual(m.preferred, ['found family']);
  assert.equal(m.category_ok, true);
  assert.equal(m.pairing_ok, true);
  assert.equal(matchTags(fic, { categories: ['Gen'] }).category_ok, false);
  assert.ok(!samePairing('Kim Dokja & Yoo Joonghyuk', 'Kim Dokja/Yoo Joonghyuk'), 'friendship is not romance');
  assert.ok(samePairing('Huā Chéng/Xiè Lián', 'Hua Cheng/Xie Lian (Tian Guan Ci Fu)'), 'diacritics and the fandom note');
  const own = { fandoms: ['Tian Guan Ci Fu', 'Black Lagoon'], by_fandom: { 'Tian Guan Ci Fu': { aliases: ['TGCF'] } } };
  assert.equal(readerFandomOf(own, '天官赐福 - 墨香铜臭 | Tiān Guān Cì Fú - Mòxiāng Tóngxiù'), 'Tian Guan Ci Fu', 'an author’s fic in a reader’s fandom');
  assert.equal(readerFandomOf(own, 'Black Lagoon (Anime & Manga)'), 'Black Lagoon');
  assert.equal(readerFandomOf(own, '魔道祖师 - 墨香铜臭 | Módào Zǔshī - Mòxiāng Tóngxiù'), null, 'the same writer’s other novel is another fandom');
  assert.ok(samePairing('Mu Qing/Feng Xin', 'Feng Xin/Mu Qing (Tian Guan Ci Fu)'), 'either order');
  assert.ok(samePairing('Revy/Rock', 'Rebecca "Revy" Lee/Okajima "Rock" Rokuro'), 'a short form of the names');
  assert.ok(!samePairing('Hua Cheng/Xie Lian', 'Hua Cheng/Feng Xin'), 'another partner');
  assert.ok(!samePairing('A/B/C', 'A/B'), 'a third person');
  const [at] = parseAt(atRow(1, 'Титан', 'full', ['Фанфик']), now);
  const a = matchTags(at, { exclude: ['попаданец'], categories: ['Gen'], relationships: ['A/B'] });
  assert.deepEqual(a.excluded_by, ['попаданец'], 'found in the summary');
  assert.equal(a.category_ok, null);
  assert.equal(a.pairing_ok, null);
});

test('taste summary counts each value once per fic', () => {
  const fics = parseAo3(ao3Work({ id: 1, title: 'a' }) + ao3Work({ id: 2, title: 'b', category: 'Gen' }), now);
  const t = tasteSummary(fics);
  assert.equal(t.fics, 2);
  assert.deepEqual(t.tags.slice(0, 1), ['Found Family (2)']);
  assert.deepEqual(t.categories, ['M/M (1)', 'Gen (1)']);
});

// The settings commands, against a temporary data folder (no network).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let dir;
const run = (...args) => JSON.parse(execFileSync('node', [path.join(ROOT, 'fanfic.mjs'), ...args], { env: { ...process.env, FANFIC_DATA: dir }, encoding: 'utf8' }));
before(() => { dir = mkdtempSync(path.join(tmpdir(), 'book-recs-')); });
after(() => rmSync(dir, { recursive: true, force: true }));

test('settings: first use asks, then each answer is stored for this reader only', () => {
  const first = run('settings', '--reader', 'Тест');
  assert.equal(first.onboarded, false);
  assert.ok(first.ask.some((q) => q.startsWith('status')));
  run('set', 'mode', 'ru+en', '--reader', 'Тест');
  run('tags', 'exclude', 'Major Character Death', '--reader', 'Тест');
  run('tags', 'prefer', 'Major Character Death', '--reader', 'Тест'); // moves, never in two lists
  run('tags', 'allow', 'Explicit', '--fandom', 'ORV', '--reader', 'Тест');
  run('fandom', 'add', 'ORV', '--reader', 'Тест');
  run('set', 'relationships', 'Kim Dokja/Yoo Joonghyuk', '--fandom', 'ORV', '--reader', 'Тест');
  run('set', 'min_words', '5000', '--reader', 'Тест');
  run('set', 'status', 'any', '--reader', 'Тест');
  assert.deepEqual(run('settings', '--reader', 'Тест').missing_required, ['crossovers']);
  run('set', 'crossovers', 'exclude', '--reader', 'Тест');
  assert.equal(run('settings', '--reader', 'Тест').missing_required, undefined);
  const s = run('set', 'ratings', 'General Audiences,Teen And Up Audiences', '--fandom', 'ORV', '--reader', 'Тест');
  assert.equal(s.mode, 'ru+en');
  assert.deepEqual(s.exclude, []);
  assert.deepEqual(s.prefer, ['Major Character Death']);
  assert.deepEqual(s.fandoms, ['ORV']);
  assert.deepEqual(s.scan, { pages: 1, min_words: 5000, status: 'any', crossovers: 'exclude' });
  assert.deepEqual(s.by_fandom.ORV, { allow: ['Explicit'], relationships: ['Kim Dokja/Yoo Joonghyuk'], scan: { ratings: ['General Audiences', 'Teen And Up Audiences'] } });
  assert.equal(run('settings').onboarded, false, 'the default reader is untouched');
});

test('fandom settings match AO3 tags with diacritics; uncategorised fics are not dropped by category', () => {
  const t = effectiveTags({ by_fandom: { 'Tian Guan Ci Fu': { prefer: ['Hurt/Comfort'] } } }, ['天官赐福 - 墨香铜臭 | Tiān Guān Cì Fú - Mòxiāng Tóngxiù']);
  assert.deepEqual(t.prefer, ['Hurt/Comfort']);
  const [fic] = parseAo3(ao3Work({ id: 1, title: 'x', category: 'No category' }), now);
  assert.equal(matchTags(fic, { categories: ['M/M'] }).category_ok, true);
});

test('"=tag" excludes only that exact tag', () => {
  const [fic] = parseAo3(ao3Work({ id: 1, title: 'x' }).replace('Found Family', 'slightly OOC'), now);
  assert.deepEqual(matchTags(fic, { exclude: ['=OOC'] }).excluded_by, []);
  assert.deepEqual(matchTags(fic, { exclude: ['OOC'] }).excluded_by, ['OOC']);
  const [direct] = parseAo3(ao3Work({ id: 2, title: 'y' }).replace('Found Family', 'OOC'), now);
  assert.deepEqual(matchTags(direct, { exclude: ['=OOC'] }).excluded_by, ['=OOC']);
});

test('with_gen: the fandom answer wins over the general one', () => {
  const s = { with_gen: true, by_fandom: { ORV: { relationships: ['A/B'], with_gen: false }, TGCF: { relationships: ['C/D'] } } };
  assert.equal(effectiveTags(s, ['ORV']).with_gen, false);
  assert.equal(effectiveTags(s, ['TGCF']).with_gen, true);
});

test('a reader\'s fandom is found by name, alias, or a part of either or of its AO3 tag', async () => {
  const { readerFandom } = await import('../lib/fanfic.mjs');
  const s = { fandoms: ['Omniscient Reader', 'Tian Guan Ci Fu', 'Alien Stage'], by_fandom: { 'Omniscient Reader': { aliases: ['ORV'] }, 'Tian Guan Ci Fu': { ao3_tag: '天官赐福 - 墨香铜臭 | Tiān Guān Cì Fú - Mòxiāng Tóngxiù', aliases: ['Небожители'] } } };
  assert.equal(readerFandom(s, 'orv'), 'Omniscient Reader');
  assert.equal(readerFandom(s, 'небожители'), 'Tian Guan Ci Fu');
  assert.equal(readerFandom(s, 'Mòxiāng'), 'Tian Guan Ci Fu');
  assert.equal(readerFandom(s, 'alien'), 'Alien Stage');
  assert.equal(readerFandom(s, 'Hurt/Comfort'), null, 'not a fandom of the reader: searched as an AO3 tag');
});

test('crossover: fandoms of more than one franchise; a book and its adaptations are one', () => {
  const fic = (fandoms) => ({ site: 'ao3', fandoms });
  assert.equal(isCrossover(fic(['天官赐福 - 墨香铜臭 | Tiān Guān Cì Fú - Mòxiāng Tóngxiù', 'Tian Guan Ci Fu (Cartoon)'])), false);
  assert.equal(isCrossover(fic(['Black Lagoon'])), false);
  assert.equal(isCrossover(fic(['Black Lagoon', '전지적 독자 시점 - 싱숑 | Omniscient Reader - Sing-Shong'])), true);
  assert.equal(isCrossover({ site: 'author.today', genres: [] }), null);
});

test('crossover: a novel and its donghua under another English name are one franchise', () => {
  assert.equal(isCrossover({ site: 'ao3', fandoms: ['天官赐福 - 墨香铜臭 | Tiān Guān Cì Fú - Mòxiāng Tóngxiù', "天官赐福 | Heaven Official's Blessing (Cartoon)"] }), false);
});

test('exclude --unless: the exclusion skips fics with one of those tags', () => {
  const [fic] = parseAo3(ao3Work({ id: 1, title: 'x' }).replace('Found Family', 'OOC'), now);
  const [modern] = parseAo3(ao3Work({ id: 2, title: 'y' }).replace('Found Family', 'OOC').replace('Angst &amp; Comfort', 'Alternate Universe - Modern Setting'), now);
  const s = effectiveTags({ exclude: ['=OOC'], exclude_unless: { '=OOC': ['Modern Setting', 'Modern AU'] } }, []);
  assert.deepEqual(matchTags(fic, s).excluded_by, ['=OOC']);
  assert.deepEqual(matchTags(modern, s).excluded_by, []);
  run('tags', 'exclude', '=OOC', '--unless', 'Modern Setting,Modern AU', '--reader', 'Тест2');
  assert.deepEqual(run('settings', '--reader', 'Тест2').exclude_unless, { '=OOC': ['Modern Setting', 'Modern AU'] });
  assert.equal(run('tags', 'exclude', '=OOC', '--reader', 'Тест2').exclude_unless, undefined, 'excluded again without --unless: unconditional');
});

test('list pages: all of them, a page limit, or newest first down to the last scan', async () => {
  const { readListPages } = await import('../lib/fanfic.mjs');
  const days = ['2026-10-16', '2026-10-15', '2026-10-14', '2026-10-10', '2026-10-01'];
  const fetched = [];
  const fetchPage = async (p) => (fetched.push(p), days.slice((p - 1) * 2, p * 2));
  const parse = (d) => d.map((updated) => ({ updated }));
  assert.deepEqual(await readListPages(fetchPage, parse, 2, { pages: Infinity }).then((r) => [r.fics.length, r.complete]), [5, true]);
  assert.deepEqual(await readListPages(fetchPage, parse, 2, { pages: 1 }).then((r) => [r.fics.length, r.complete]), [2, false], 'stopped by the page limit: not complete');
  fetched.length = 0;
  const since = await readListPages(fetchPage, parse, 2, { pages: 1, since: '2026-10-14' });
  assert.deepEqual(since.fics.map((f) => f.updated), ['2026-10-16', '2026-10-15', '2026-10-14']);
  assert.equal(since.complete, true);
  assert.deepEqual(fetched, [1, 2], 'stops at the page that reaches older fics, whatever the page limit');
  assert.equal((await readListPages(async () => null, () => null, 2, { pages: 3 })).missing, true);
});

test('kudos: account names from a work\'s kudos list; no list — undecided', async () => {
  const { kudosUsers } = await import('../lib/fanfic.mjs');
  const page = '<h2><a href="/works/1">x</a> by <a rel="author" href="/users/writer/pseuds/writer">writer</a></h2><div id="kudos"><p class="kudos"><a href="/users/Rhysel">Rhysel</a>, <a href="/users/other">other</a> and 3 guests</p></div>';
  assert.deepEqual([...kudosUsers(page)], ['rhysel', 'other']);
  assert.equal(kudosUsers('<html>error</html>'), null);
});

test('saved pages: ficbook list titles without promo blocks; Author.Today links once', async () => {
  const { savedPageFics } = await import('../lib/fanfic.mjs');
  const fb = '<a href="https://ficbook.net/readfic/9?from_promo=1" class="js-promo-fanfic">Промо</a><h3 class="fanfic-inline-title"> <a class="visit-link" href="/readfic/11207406">Что-то другое &amp; ещё </a></h3>';
  assert.deepEqual(savedPageFics(fb), [{ site: 'ficbook', url: 'https://ficbook.net/readfic/11207406', title: 'Что-то другое & ещё' }]);
  const at = '<a href="https://author.today/work/5"><img></a><a href="https://author.today/work/5">Книга</a><a href="/work/6?x=1">Другая</a>';
  assert.deepEqual(savedPageFics(at).map((f) => [f.url, f.title]), [['https://author.today/work/5', 'Книга'], ['https://author.today/work/6', 'Другая']]);
});

test('check: fics found by hand go through the settings by what is known of them', () => {
  run('tags', 'exclude', 'омегавер', '--reader', 'Тест3');
  run('tags', 'prefer', 'Пропущенная сцена', '--fandom', 'TGCF', '--reader', 'Тест3');
  const file = path.join(dir, 'fics.json');
  writeFileSync(file, JSON.stringify([
    { site: 'ficbook', title: 'Омега', url: 'https://ficbook.net/readfic/1', fandoms: ['TGCF'], tags: ['Омегаверс'] },
    { site: 'ficbook', title: 'Сцена', url: 'https://ficbook.net/readfic/2', fandoms: ['TGCF'], tags: ['Пропущенная сцена'], status: 'full' },
    { site: 'ficbook', title: 'Старый', url: 'https://ficbook.net/readfic/3', fandoms: ['TGCF'], status: 'in_progress', updated: '2020-01-01' },
  ]));
  const r = run('check', file, '--reader', 'Тест3');
  assert.deepEqual(r.fics.map((f) => [f.title, f.preferred, f.unknown]), [['Сцена', ['Пропущенная сцена'], ['updated', 'rating', 'pairing']]]);
  assert.equal(r.dropped.abandoned, 1);
  assert.deepEqual(r.dropped.by_settings.map((d) => d.title), ['Омега']);
});

test('exclude --unless "=Gen": the exclusion skips gen-only fics', () => {
  const [mm] = parseAo3(ao3Work({ id: 1, title: 'x' }).replace('Found Family', 'De-Aged Kim Dokja'), now);
  const [gen] = parseAo3(ao3Work({ id: 2, title: 'y', category: 'Gen' }).replace('Found Family', 'De-Aged Kim Dokja'), now);
  const [mixed] = parseAo3(ao3Work({ id: 3, title: 'z', category: 'Gen, M/M' }).replace('Found Family', 'De-Aged Kim Dokja'), now);
  const s = effectiveTags({ exclude: ['De-Aged'], exclude_unless: { 'De-Aged': ['=Gen'] } }, []);
  assert.deepEqual([mm, gen, mixed].map((f) => matchTags(f, s).excluded_by.length), [1, 0, 1]);
});

test('author block: works of a blocked author are dropped on any site', () => {
  run('author', 'block', 'Плохой Слог', '--reader', 'Тест4');
  const file = path.join(dir, 'fics4.json');
  writeFileSync(file, JSON.stringify([
    { site: 'ficbook', title: 'Её фик', url: 'https://ficbook.net/readfic/9', authors: ['плохой слог'], status: 'full' },
    { site: 'ficbook', title: 'Чужой', url: 'https://ficbook.net/readfic/10', authors: ['Кто-то'], status: 'full' },
  ]));
  const r = run('check', file, '--reader', 'Тест4');
  assert.deepEqual(r.fics.map((f) => f.title), ['Чужой']);
  assert.deepEqual(r.dropped.by_settings[0].why, ['blocked author: плохой слог']);
});

test('AO3 page tag: a synonym tag shows its canonical one', async () => {
  const { ao3PageTag } = await import('../lib/fanfic.mjs');
  assert.equal(ao3PageTag('<h2 class="heading">\n 1 - 20 of 963 Works in <a class="tag" href="/tags/x">Black Lagoon (Anime &amp; Manga)</a></h2>'), 'Black Lagoon (Anime & Manga)');
  assert.equal(ao3PageTag('<h2 class="heading">1 Work in <a class="tag" href="/tags/y">Ivan/Till (Alien Stage)</a></h2>'), 'Ivan/Till (Alien Stage)');
  assert.equal(ao3PageTag('<html></html>'), null);
});

test('AO3 list pages: a list (even empty) yes, a maintenance page no', async () => {
  const { isAo3List } = await import('../lib/fanfic.mjs');
  assert.equal(isAo3List('<ol class="work index group">'), true);
  assert.equal(isAo3List('<ol class="reading work index group">'), true);
  assert.equal(isAo3List('<h2 class="heading">\n 0 Works in <a class="tag">X</a></h2>'), true);
  assert.equal(isAo3List('<p>A non-profit, non-commercial archive for transformative fanworks</p>'), false);
});

test('"=Polyam": a relationship of three or more names', () => {
  const [trio] = parseAo3(ao3Work({ id: 1, title: 'x' }).replace('Yoo Joonghyuk/Kim Dokja', 'Yoo Joonghyuk/Han Sooyoung/Kim Dokja'), now);
  const [pair] = parseAo3(ao3Work({ id: 2, title: 'y' }), now);
  assert.deepEqual(matchTags(trio, { exclude: ['=Polyam'] }).excluded_by, ['=Polyam']);
  assert.deepEqual(matchTags(pair, { exclude: ['=Polyam'] }).excluded_by, []);
});

test('comment signals: OOC, in character, plot — counted per comment', async () => {
  const { commentSignals, parseAo3Comments } = await import('../lib/fanfic.mjs');
  const html = '<blockquote class="userstuff"><p>Loved it but Dokja felt really OOC here</p></blockquote><blockquote class="userstuff"><p>Joonghyuk is so in character!! and the plot is so well paced</p></blockquote><blockquote class="userstuff"><p>Му Цин тут совсем не похож на себя, ООС</p></blockquote>';
  const c = parseAo3Comments(html);
  assert.equal(c.length, 3);
  const s = commentSignals(c);
  assert.equal(s.ooc, 2);
  assert.equal(s.in_character, 1);
  assert.equal(s.plot_good, 1);
  assert.equal(commentSignals(['Хороший фик, но ООС']).ooc, 1, 'ООС in Cyrillic');
});

test('AO3 comments: only the comments section, not the summary and notes above it', async () => {
  const { parseAo3Comments } = await import('../lib/fanfic.mjs');
  const page = '<div class="summary"><blockquote class="userstuff"><p>Summary of the work</p></blockquote></div><div class="end notes"><blockquote class="userstuff"><p>thanks for reading</p></blockquote></div><div id="comments_placeholder"><ol class="thread"><li class="comment"><blockquote class="userstuff"><p>Loved it</p></blockquote></li></ol></div>';
  assert.deepEqual(parseAo3Comments(page), ['Loved it']);
  assert.deepEqual(parseAo3Comments('<blockquote class="userstuff"><p>Summary</p></blockquote><div id="comments_placeholder" style="display:none;"></div>'), [], 'a page without comments has none');
});

test('comment signals: lore — the world does not work like that', async () => {
  const { commentSignals } = await import('../lib/fanfic.mjs');
  const s = commentSignals([
    "Cute, but that's not how ascension works in canon",
    'Мило, но в каноне так не работает',
    'Автор переврал лор',
    'This works so well, loved it',
    'Работает на все сто, спасибо!',
  ]);
  assert.equal(s.lore, 3);
  // Said softly — still a complaint about the world.
  const soft = commentSignals([
    "I don't think that's quite how curses work, but I loved it",
    "Not sure that's how ascension works? Still cute",
    'The author took some liberties with the lore',
    'Кажется, в каноне это было немного иначе, но мне понравилось',
    'Насколько я помню, по канону боги так не могут',
    'Матчасть тут слегка спорная, но читается легко',
    'Вольное обращение с каноном, но мило',
  ]);
  assert.equal(soft.lore, 7);
  // A character unlike themselves is OOC, not lore; praise is neither.
  const not = commentSignals([
    'In canon he would never say that',
    'В каноне он бы так не поступил',
    'Как же хорошо всё работает в этой истории',
    'The worldbuilding is gorgeous',
  ]);
  assert.equal(not.lore, 0);
});

test('page: picks as an HTML page in the reader folder, escaped, only http(s) links', () => {
  const picks = path.join(dir, 'picks-in.json');
  writeFileSync(picks, JSON.stringify({
    title: 'Подборка <тест>',
    fics: [
      { title: 'Fic <one>', url: 'https://example.org/works/1', authors: ['someone'], fandom: 'Some Fandom', status: 'завершён', size: '10 000 слов', why: 'Because "yes" & more' },
      { title: 'Fic two', url: 'javascript:alert(1)' },
      { title: 'Fic three', url: 'https://example.org/works/3' },
    ],
    left_out: [{ title: 'Fic four', why: 'not a crossover' }],
  }));
  const res = execFileSync('node', [path.join(ROOT, 'fanfic.mjs'), 'page', picks, '--no-open'], { env: { ...process.env, FANFIC_DATA: dir }, encoding: 'utf8' });
  const { file, fics, opened } = JSON.parse(res);
  assert.equal(fics, 3);
  assert.equal(opened, false);
  assert.match(file, /reader\/picks\/\d{4}-\d{2}-\d{2}-подборка-тест\.html$/);
  const html = readFileSync(file, 'utf8');
  assert.match(html, /Fic &lt;one&gt;/);
  assert.match(html, /Because &quot;yes&quot; &amp; more/);
  assert.match(html, /href="https:\/\/example\.org\/works\/1"/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /Fic four<\/b> — not a crossover/);
});

test('demoted tags: found, never drop a fic', () => {
  const fic = { site: 'author.today', title: 'X', genres: ['Фанфик'], summary: 'Герой находит рояли в кустах и строит флот' };
  const m = matchTags(fic, { exclude: [], prefer: ['флот'], demote: ['рояли'] });
  assert.deepEqual(m.preferred, ['флот']);
  assert.deepEqual(m.demoted, ['рояли']);
  assert.deepEqual(m.excluded_by, []);
  assert.deepEqual(effectiveTags({ demote: ['рояли'], by_fandom: { 'Some Fandom': { demote: ['избранный'] } } }, ['Some Fandom']).demote, ['рояли', 'избранный']);
});

const wattpadPage = (loaderData) => `<html><script>window.__remixContext = ${JSON.stringify({ state: { loaderData } })};</script></html>`;

test('Wattpad: tag page stories, story page facts, tags written together', () => {
  const story = (id, title, extra = {}) => ({ id: String(id), title, description: 'Summary.', tags: ['slowburn', 'selfinsert'], completed: false, mature: true, numParts: 3, voteCount: 7, readCount: 70, user: { name: 'Writer' }, ...extra });
  const tag = wattpadPage({ 'routes/stories.$categoryid': { storiesAndTagsForBrowse: { modules: [
    { type: 'relatedTagsForTag', data: {} },
    { type: 'hotStoriesForTag', data: { items: { stories: [story(1, 'One'), story(2, 'Two', { completed: true })] } } },
    { type: 'newStoriesForTag', data: { items: { stories: [story(2, 'Two'), story(3, 'Three')] } } },
  ] } } });
  const list = parseWattpadTag(tag);
  assert.deepEqual(list.map((s) => s.title), ['One', 'Two', 'Three']);
  assert.equal(list[0].url, 'https://www.wattpad.com/story/1');
  assert.equal(list[1].status, 'full');
  assert.equal(parseWattpadTag('<html>nothing</html>'), null);

  const page = wattpadPage({ 'routes/story.$storyid': { story: { ...story(1, 'One'), length: 65000, language: { name: 'English' }, user: { name: 'Writer W', username: 'writerw' }, lastPublishedPart: { createDate: '2026-10-01T10:00:00Z' }, noIndex: false } } });
  const s = parseWattpadStory(page, now);
  assert.equal(s.lang, 'en');
  assert.equal(s.chars, 65000);
  assert.equal(s.updated, '2026-10-01');
  assert.equal(s.status, 'in_progress');
  assert.deepEqual(s.authors, ['writerw']);
  assert.equal(s.hidden, false);
  const old = parseWattpadStory(wattpadPage({ 'routes/story.$storyid': { story: { ...story(4, 'Old'), lastPublishedPart: { createDate: '2020-01-01T00:00:00Z' } } } }), now);
  assert.equal(old.status, 'abandoned');

  // "Self-Insert" and "=Slow Burn" catch Wattpad's "selfinsert" and "slowburn"; pairing and category stay unknown there.
  const m = matchTags(s, { exclude: ['Self-Insert'], prefer: ['=Slow Burn'], relationships: ['A/B'], categories: ['M/M'] });
  assert.deepEqual(m.excluded_by, ['Self-Insert']);
  assert.deepEqual(m.preferred, ['=Slow Burn']);
  assert.equal(m.pairing_ok, null);
  assert.equal(m.category_ok, null);
  assert.deepEqual(matchTags({ ...s, tags: ['×reader'] }, { exclude: ['x Reader'] }).excluded_by, ['x Reader']);
  assert.equal(isCrossover({ ...s, tags: ['orv', 'crossover'] }), true);
  assert.equal(isCrossover({ ...s, summary: 'A cross-over with another story.' }), true);
  assert.equal(isCrossover(s), false);
});

test('excerpts: start, middle and end of a downloaded text, never the network', () => {
  mkdirSync(path.join(dir, 'reader', 'texts'), { recursive: true });
  const words = Array.from({ length: 100 }, (_, i) => `w${i}`);
  writeFileSync(path.join(dir, 'reader', 'texts', '123.txt'), words.join(' '));
  const { excerpts } = run('excerpts', 'https://archiveofourown.org/works/123', '456', '--start', '5', '--middle', '4', '--end', '3');
  assert.equal(excerpts[0].text_words, 100);
  assert.equal(excerpts[0].start, 'w0 w1 w2 w3 w4');
  assert.equal(excerpts[0].middle, 'w48 w49 w50 w51');
  assert.equal(excerpts[0].end, 'w97 w98 w99');
  assert.equal(excerpts[0].comment_signals, null); // no cached page: nothing fetched
  assert.match(excerpts[1].error, /no text/);
});
