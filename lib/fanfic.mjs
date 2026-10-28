// Parses fanfic list pages into facts — title, author, fandom, tags, size, status, popularity —
// and applies a reader's tag settings. Never the text itself. Links to fics are fine (unlike links
// to book translations).
import { norm } from './util.mjs';

export const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
export const text = (html) => decode(String(html ?? '').replace(/<br\s*\/?>|<\/p>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const num = (s) => Number(text(s).replace(/[^\d]/g, '')) || 0;
const tagsIn = (html) => [...(html ?? '').matchAll(/<a [^>]*class="tag"[^>]*>([^<]*)<\/a>/g)].map((m) => decode(m[1]).trim());

// An unfinished fic with no update for this long counts as abandoned.
export const STALE_DAYS = 365;

/** AO3 tag → URL path segment: AO3 escapes / & . ? # as *s* *a* *d* *q* *h*. */
export function ao3TagPath(tag) {
  const esc = tag.replace(/\//g, '*s*').replace(/&/g, '*a*').replace(/\./g, '*d*').replace(/\?/g, '*q*').replace(/#/g, '*h*');
  return encodeURIComponent(esc);
}

function stale(status, updated, now) {
  return status === 'in_progress' && updated && (now - Date.parse(updated)) / 864e5 > STALE_DAYS ? 'abandoned' : status;
}

/**
 * One page of AO3 blurbs: works (/tags/<tag>/works) or bookmarks (/users/<name>/bookmarks).
 * Bookmarks of series and external works have no /works/ link and are skipped.
 */
export function parseAo3(html, now = Date.now()) {
  return html.split(/<li id="(?:work|bookmark)_\d+" class="(?:reading )?(?:work|bookmark) blurb group/).slice(1).map((li) => {
    li = li.split('<div class="user module group">')[0]; // a bookmark's own tags and notes follow the work
    const head = li.match(/<h4 class="heading">([\s\S]*?)<\/h4>/)?.[1] ?? '';
    const id = head.match(/href="\/works\/(\d+)"/)?.[1];
    if (!id) return null;
    const title = text(head.match(/<a href="\/works\/\d+">([\s\S]*?)<\/a>/)?.[1]);
    const authors = [...head.matchAll(/<a rel="author"[^>]*>([^<]*)<\/a>/g)].map((m) => decode(m[1]));
    const tagList = (cls) => tagsIn(li.match(new RegExp(`<li class=['"]${cls}['"]>([\\s\\S]*?)<\\/li>`, 'g'))?.join(''));
    const dd = (cls) => li.match(new RegExp(`<dd class="${cls}"[^>]*>([\\s\\S]*?)<\\/dd>`))?.[1];
    const [done, total] = text(dd('chapters')).split('/');
    const complete = /class="complete-yes/.test(li) || (total !== '?' && done === total);
    const updated = text(li.match(/<p class="datetime">([^<]*)<\/p>/)?.[1]);
    // History pages (/users/<name>/readings): when the reader last opened the work.
    const visited = li.match(/Last visited:\s*([^<(]+)/)?.[1]?.trim();
    const updatedIso = updated && !Number.isNaN(Date.parse(updated)) ? new Date(Date.parse(updated) + 12 * 36e5).toISOString().slice(0, 10) : null;
    return {
      site: 'ao3',
      url: `https://archiveofourown.org/works/${id}`,
      title,
      authors: authors.length ? authors : [text(head.split(/\bby\b/)[1]) || 'Anonymous'],
      fandoms: tagsIn(li.match(/<h5 class="fandoms heading">([\s\S]*?)<\/h5>/)?.[1]),
      lang: li.match(/<dd class="language" lang="([^"]+)"/)?.[1] ?? null,
      rating: decode(li.match(/class="rating-[^"]*" title="([^"]*)"/)?.[1] ?? '') || null,
      category: decode(li.match(/class="category-[^"]*" title="([^"]*)"/)?.[1] ?? '') || null,
      warnings: tagList('warnings'),
      relationships: tagList('relationships'),
      characters: tagList('characters'),
      tags: tagList('freeforms'),
      summary: text(li.match(/<blockquote class="userstuff summary">([\s\S]*?)<\/blockquote>/)?.[1]) || null,
      words: num(dd('words')),
      chapters: text(dd('chapters')) || null,
      status: stale(complete ? 'full' : 'in_progress', updatedIso, now),
      updated: updatedIso,
      kudos: num(dd('kudos')),
      ...(visited ? { visited: new Date(Date.parse(visited) + 12 * 36e5).toISOString().slice(0, 10) } : {}),
      hits: num(dd('hits')),
    };
  }).filter(Boolean);
}

/**
 * Who left kudos on an AO3 work, from its public kudos page (/works/<id>/kudos): lower-case account names,
 * or null when the page has no kudos list to read (then nothing is decided). Guests are not named.
 */
export function kudosUsers(html) {
  const at = html.search(/id="kudos"|class="kudos"/);
  if (at < 0) return null;
  return new Set([...html.slice(at).matchAll(/href="(?:https:\/\/archiveofourown\.org)?\/users\/([^/"]+)/g)].map((m) => decodeURIComponent(m[1]).toLowerCase()));
}

/**
 * Fics on a page the reader saved from a site (Cmd+S): ficbook lists ("Понравившиеся работы", collections),
 * Author.Today lists and libraries, AO3 lists. Only title and link — enough to mark them read.
 */
export function savedPageFics(html) {
  const abs = (site, href) => (href.startsWith('http') ? href : `${site}${href}`).split(/[?#]/)[0];
  if (html.includes('fanfic-inline-title')) {
    return [...html.matchAll(/<h3 class="fanfic-inline-title">\s*<a [^>]*href="([^"]*\/readfic\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => ({ site: 'ficbook', url: abs('https://ficbook.net', m[1]), title: text(m[2]) }));
  }
  if (/blurb group/.test(html)) return parseAo3(html).map((f) => ({ site: 'ao3', url: f.url, title: f.title }));
  if (/author\.today/.test(html)) {
    const seen = new Map();
    for (const m of html.matchAll(/<a [^>]*href="((?:https:\/\/author\.today)?\/work\/\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
      const url = abs('https://author.today', m[1]);
      const title = text(m[2]);
      if (title && !seen.has(url)) seen.set(url, { site: 'author.today', url, title });
    }
    return [...seen.values()];
  }
  return [];
}

/**
 * Reads list pages (`fetchPage(n)` → html, `parse` → fics, or null when the list does not exist) until the last one,
 * `pages`, or — with `since` (YYYY-MM-DD), a list sorted newest-updated first — a fic updated before `since`.
 * `complete`: the list was read to its end or to `since`.
 */
export async function readListPages(fetchPage, parse, perPage, { pages, since }) {
  const fics = [];
  for (let p = 1; since || p <= pages; p++) {
    const page = parse(await fetchPage(p));
    if (page === null) return { fics, missing: true };
    fics.push(...page.filter((f) => !since || !f.updated || f.updated >= since));
    if (page.length < perPage || (since && page.some((f) => f.updated && f.updated < since))) return { fics, complete: true };
  }
  return { fics, complete: false };
}

/** The tag an AO3 works list is of ("… Works in <tag>"), or null. A synonym tag redirects to its canonical one — and drops the filters. */
export function ao3PageTag(html) {
  return decode(html.match(/<h2 class="heading">[\s\S]*?Works? in <a [^>]*class="tag"[^>]*>([^<]*)<\/a>/)?.[1] ?? '').trim() || null;
}

/** Whether an AO3 page is a list of works or bookmarks (an empty one included) — not a maintenance or error page. */
export const isAo3List = (html) => /class="(?:reading )?(?:work|bookmark) index group"|<h2 class="heading">\s*0 (?:Works|Bookmarks)/.test(html);

/** Comments on an AO3 work page (?show_comments=true): the text of each, without the commenters' names. */
export function parseAo3Comments(html) {
  // Only the comments section: the work's summary and notes above it are userstuff blockquotes too.
  const at = html.indexOf('id="comments_placeholder"');
  const section = at < 0 ? html : html.slice(at);
  return [...section.matchAll(/<blockquote class="userstuff">([\s\S]*?)<\/blockquote>/g)].map((m) => text(m[1])).filter(Boolean);
}

// What readers say about a fic in its comments. OOC: a character "not like themselves" — counted per comment.
export const SIGNALS = {
  ooc: /\b(?:ooc|out of character|out-of-character|occ)\b|(?<!\p{L})оос(?!\p{L})|не (?:похож|в своём характере|в характере|канонич)|не узнаю|не похоже на (?:него|неё|себя)|so unlike (?:him|her)/iu,
  in_character: /\bin[- ]character\b|\bso (?:him|her|them)\b|(?:characteri[sz]ation|voices?) (?:is|are|was|were) (?:so |really |absolutely )?(?:spot[- ]on|perfect|great|amazing)|(?<!не )канонич|(?<!не )в характере|(?<!не )узнаю (?:его|её)|прям(?:о)? (?:он|она)(?!\p{L})/iu,
  plot_good: /\b(?:plot|story ?line|pacing|structure|world[- ]?building)\b[^.!?]{0,40}\b(?:great|amazing|tight|well[- ]done|brilliant|love|coherent|solid)|(?:well|tightly|beautifully) (?:plotted|structured|paced)|сюжет[^.!?]{0,40}(?:стройн|логичн|продуман|отличн|захватыва|шикарн)|логично|продуманн/i,
  // Lore: the fic's world does not work the way the canon's does. Readers say it softly ("I don't think that's how
  // curses work", "кажется, в каноне это было иначе"), so the hedged forms count too; a character acting unlike
  // themselves is OOC, not lore, so "in canon he would never" is left out.
  lore: new RegExp([
    String.raw`\b(?:that'?s|this is|it'?s) not (?:quite |really |exactly )?how (?:\w+ ){0,3}works?\b`,
    String.raw`\b(?:don'?t|do not) think (?:that'?s|this is|it'?s|that is) (?:quite |really |exactly )?how\b`,
    String.raw`\bnot (?:sure|certain) (?:if |that )?(?:that'?s|this is|it'?s|that is|this was) (?:quite |really |exactly )?how\b`,
    String.raw`\bdoesn'?t (?:really |quite )?work (?:like that|that way)\b`,
    String.raw`\b(?:isn'?t|wasn'?t) (?:that|it|this) supposed to (?:work|be impossible)\b`,
    String.raw`\bin canon\b[^.!?]{0,40}\b(?:works? differently|is different|isn'?t possible|is impossible|doesn'?t work|can'?t be done|doesn'?t happen)\b`,
    String.raw`\b(?:pretty sure|i thought|i believe|if i remember)\b[^.!?]{0,20}\b(?:in canon|canonically)\b[^.!?]{0,40}\b(?:works?|worked|differently|impossible|rules?)\b`,
    String.raw`\b(?:took|takes|taking|take) (?:some |a few |a lot of )?liberties with (?:the )?(?:canon|lore|worldbuilding|world|rules|magic|mechanics)\b`,
    String.raw`\b(?:bit of a|slight|small) (?:stretch|liberty)\b[^.!?]{0,30}\b(?:canon|lore|rules|world)\b`,
    String.raw`\b(?:deviat|diverg|depart)\w* from (?:the )?(?:canon )?(?:lore|worldbuilding|rules|mechanics|magic system)\b`,
    String.raw`\b(?:lore|world[- ]?building|magic system|mechanics)\b[^.!?]{0,30}\b(?:wrong|inaccurate|broken|inconsistent|(?:a bit|slightly|kind of|somewhat|a little) (?:off|odd|weird|confusing|different))\b`,
    String.raw`\b(?:contradicts|goes against|ignores) (?:the )?canon\b`,
    String.raw`так не работает|(?:это|оно) не так работает|работает (?:не так|иначе|по-другому)`,
    String.raw`в каноне[^.!?]{0,40}(?:не так|иначе|по-другому|нельзя|невозможно|не бывает|не работает)`,
    String.raw`(?:кажется|вроде|по-моему|если не ошибаюсь|насколько (?:я )?помню)[^.!?]{0,30}(?:в каноне|по канону|в оригинале)`,
    String.raw`в оригинале[^.!?]{0,30}(?:не так|иначе|по-другому)`,
    String.raw`разве (?:в каноне|так можно|так бывает|так работает)`,
    String.raw`противоречит (?:канону|лору|матчасти)|не совсем по канону`,
    String.raw`вольн\p{L}* (?:обращени\p{L}*|трактовк\p{L}*) (?:с |)(?:канон|лор|матчаст|мир)`,
    String.raw`(?:лор|матчаст\p{L}*|механик\p{L}* мира|устройств\p{L}* мира|правила мира)[^.!?]{0,30}(?:не так|наруш|переврал|не соответств|неправильн|немного|слегка|чуть|не совсем|иначе|по-другому|странн|смущ|спорн)`,
    String.raw`переврал\p{L}* (?:лор|мир|механик|матчаст)|так не устроен`,
  ].join('|'), 'iu'),
  plot_bad: /\b(?:plot ?holes?|rushed|dragging|drags|confusing|doesn'?t make sense|messy|inconsistent)\b|сюжет[^.!?]{0,40}(?:провис|рваный|нелогичн|сыр|скомкан)|нелогичн|скомкан|дыр(?:а|ы) в сюжете|затянут/i,
};

/** Counts of comments that mention each signal. */
export function commentSignals(comments) {
  const out = { comments: comments.length };
  for (const [k, re] of Object.entries(SIGNALS)) out[k] = comments.filter((c) => re.test(c)).length;
  return out;
}

/** Users on a work's public bookmarks page (/works/<id>/bookmarks): their account names. */
export function parseBookmarkers(html) {
  return [...new Set([...html.matchAll(/Bookmarked by\s*<a href="\/users\/([^/"]+)\//g)].map((m) => decodeURIComponent(m[1])))];
}

function atStatus(raw) {
  const s = raw.toLowerCase();
  if (s.includes('весь текст')) return 'full';
  if (/замор|заброш|приостанов/.test(s)) return 'abandoned';
  if (s.includes('в процессе')) return 'in_progress';
  return null;
}

/** The tag an Author.Today tag page lists ("Книги #пацаны"), or null for any other page (unknown tags redirect to the genre list). */
export function atPageTag(html) {
  return decode(html.match(/<h1 class="panel-title[^"]*">Книги #([^<]*)<\/h1>/)?.[1] ?? '').trim() || null;
}

/** One page of Author.Today book rows (/work/tag/<tag>, /work/genre/...). The list shows genres, not tags. */
export function parseAt(html, now = Date.now()) {
  return html.split('<div class="book-row">').slice(1).map((row) => {
    const head = row.match(/<div class="book-title">\s*<a[^>]*href="\/work\/(\d+)">([\s\S]*?)<\/a>/);
    const statusRaw = text(row.match(/<span class="text-[a-z]+">\s*<i class="[^"]*book-status-icon[^"]*"><\/i>([\s\S]*?)<\/span>/)?.[1]);
    const updated = row.match(/data-hint="(?:Обновление|Завершено) "[^>]*data-time="([^"]+)"/)?.[1]?.slice(0, 10) ?? null;
    const status = atStatus(statusRaw);
    return {
      site: 'author.today',
      url: head ? `https://author.today/work/${head[1]}` : null,
      title: text(head?.[2]),
      authors: [...(row.match(/<div class="book-author">([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => decode(m[1]).trim()),
      genres: [...(row.match(/<div[^>]*class="book-genres">([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => decode(m[1]).trim()),
      lang: 'ru',
      adult: row.includes('label-adult-only'),
      free: row.includes('Свободный доступ'),
      series: text(row.match(/Цикл: <\/span>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]) || null,
      summary: text(row.match(/<div[^>]*class="annotation[^"]*">([\s\S]*?)<\/div>/)?.[1]) || null,
      chars: num(row.match(/кол-во знаков с пробелами">([^<]*)/)?.[1]),
      status: status && stale(status, updated, now),
      status_raw: statusRaw || null,
      updated,
      likes: num(row.match(/data-hint="Понравилось · ([\d\s]+)"/)?.[1]),
      views: num(row.match(/data-hint="Просмотры · ([\d\s]+)"/)?.[1]),
    };
  });
}

// Wattpad pages carry their data as JSON in `window.__remixContext`; its loaderData, or null.
function wattpadData(html) {
  const at = (html ?? '').indexOf('window.__remixContext = ');
  if (at < 0) return null;
  const from = at + 'window.__remixContext = '.length;
  try {
    return JSON.parse(html.slice(from, html.indexOf(';</script>', from))).state.loaderData;
  } catch {
    return null;
  }
}

// Wattpad language names → the codes the reader's mode uses.
const WATTPAD_LANGS = { English: 'en', Russian: 'ru', 'Русский': 'ru' };

/**
 * A Wattpad tag page (/stories/<tag>): its "hot" and "new" stories, 20 each — the page has no further pages.
 * Language, size and the last update are not on it: they come from the story page (parseWattpadStory).
 * Null when the page is not a tag page.
 */
export function parseWattpadTag(html) {
  const route = wattpadData(html)?.['routes/stories.$categoryid'];
  const modules = route?.storiesAndTagsForBrowse?.modules;
  if (!modules) return null;
  const seen = new Set();
  return modules.filter((m) => /StoriesForTag$/.test(m.type ?? '')).flatMap((m) => m.data?.items?.stories ?? [])
    .filter((s) => s.id && !seen.has(s.id) && seen.add(s.id))
    .map((s) => ({
      site: 'wattpad',
      url: `https://www.wattpad.com/story/${s.id}`,
      title: s.title ?? '',
      authors: s.user?.name ? [s.user.name] : [],
      tags: s.tags ?? [],
      summary: s.description || null,
      adult: !!s.mature,
      status: s.completed ? 'full' : 'in_progress',
      chapters: s.numParts ?? null,
      votes: s.voteCount ?? null,
      reads: s.readCount ?? null,
    }));
}

/** A Wattpad story page (/story/<id>): language, size in characters, last update, all tags. Null when it is not one. */
export function parseWattpadStory(html, now = Date.now()) {
  const s = wattpadData(html)?.['routes/story.$storyid']?.story;
  if (!s?.id) return null;
  const updated = (s.lastPublishedPart?.createDate ?? s.createDate)?.slice(0, 10) ?? null;
  const lang = s.language?.name ?? null;
  return {
    site: 'wattpad',
    url: `https://www.wattpad.com/story/${s.id}`,
    title: s.title ?? '',
    authors: [s.user?.username ?? s.user?.name].filter(Boolean),
    tags: s.tags ?? [],
    summary: s.description || null,
    lang: WATTPAD_LANGS[lang] ?? lang?.toLowerCase() ?? null,
    chars: s.length ?? null,
    adult: !!s.mature,
    status: stale(s.completed ? 'full' : 'in_progress', updated, now),
    updated,
    chapters: s.numParts ?? null,
    votes: s.voteCount ?? null,
    reads: s.readCount ?? null,
    // The author asked search engines not to index it, or it is gone: not offered.
    hidden: !!(s.noIndex || s.deleted || s.draft),
  };
}

// Fandom names are compared without diacritics: "Tian Guan Ci Fu" is "Tiān Guān Cì Fú".
const fold = (s) => norm(s).normalize('NFD').replace(/\p{M}/gu, '');

// "天官赐福 - 墨香铜臭 | Tiān Guān Cì Fú - Mòxiāng Tóngxiù" → ["天官赐福", "tian guan ci fu"]; "天官赐福 | Heaven Official's Blessing (Cartoon)" → ["天官赐福", "heaven official's blessing"].
const franchise = (tag) => tag.split('|').map((n) => fold(n.replace(/\([^)]*\)/g, '').split(' - ')[0])).filter(Boolean);

/**
 * Whether an AO3 fic is a crossover: fandoms of more than one franchise. Approximate — AO3 itself relates
 * a book, its donghua and its manhua through metatags; here one name inside another counts as the same franchise.
 * Used where AO3 did not filter (an author's works, similar); Author.Today lists show no fandoms (null).
 */
export function isCrossover(fic) {
  // Wattpad shows no fandoms: a story that calls itself a crossover in its tags or summary is one.
  if (fic.site === 'wattpad') return [...(fic.tags ?? []), fic.summary ?? ''].some((t) => /cross-?over/i.test(t));
  if (fic.site !== 'ao3') return null;
  // Names of one fandom tag (each side of "|"); two tags are one franchise when a name of one is inside a name of the other.
  const groups = [];
  for (const names of fic.fandoms.map(franchise).filter((n) => n.length)) {
    const same = groups.find((g) => g.some((a) => names.some((b) => a.includes(b) || b.includes(a))));
    if (same) same.push(...names);
    else groups.push(names);
  }
  return groups.length > 1;
}

/**
 * The reader's own fandom a query means: its name, an alias (by_fandom[f].aliases), or a part of either,
 * or a part of its AO3 tag — "ORV", "Небожители", "Alien". Null when none or several match.
 */
export function readerFandom(settings, query) {
  const q = fold(query);
  if (!q) return null;
  const names = (f) => [f, ...(settings?.by_fandom?.[f]?.aliases ?? [])].map(fold);
  const exact = (settings?.fandoms ?? []).filter((f) => names(f).includes(q));
  if (exact.length === 1) return exact[0];
  const part = (settings?.fandoms ?? []).filter((f) => names(f).some((n) => n.includes(q)) || fold(settings?.by_fandom?.[f]?.ao3_tag ?? '').includes(q));
  return part.length === 1 ? part[0] : null;
}

/** The by_fandom entries that apply to any of `names` (the query, an AO3 tag, a fic's fandoms). */
/**
 * Which of the reader's fandoms an AO3 fandom tag belongs to, or null: the tag's names (as in isCrossover)
 * against each fandom's name, aliases and AO3 tag — one name inside the other counts.
 */
export function readerFandomOf(settings, tag) {
  const names = franchise(tag);
  return (settings?.fandoms ?? []).find((f) => {
    const own = [f, ...(settings?.by_fandom?.[f]?.aliases ?? [])].map(fold).concat(franchise(settings?.by_fandom?.[f]?.ao3_tag ?? '')).filter(Boolean);
    return own.some((a) => names.some((b) => a.includes(b) || b.includes(a)));
  }) ?? null;
}

export function ownFandoms(settings, names) {
  const n = names.filter(Boolean).map(fold);
  return Object.entries(settings?.by_fandom ?? {}).filter(([k]) => n.some((x) => x.includes(fold(k))));
}

/**
 * A reader's fanfic settings for one search (data/reader/fanfic-settings.json, see fanfic.mjs):
 *   { mode, fandoms: [...], originals, categories: [...], exclude, require, prefer, demote,
 *     by_fandom: { <name>: { exclude, require, prefer, demote, allow, categories, relationships } } }
 * A by_fandom entry applies when its name is part of any of `names` (the query, the AO3 tag, a fic's fandoms).
 * Its lists add to the general ones; `allow` lifts a general exclude or require; its `categories` and `with_gen` replace the general ones.
 * `exclude_unless`: { <excluded tag>: [tags] } — the exclusion does not apply to a fic with any of these tags.
 */
export function effectiveTags(settings, names) {
  const own = ownFandoms(settings, names);
  const allow = new Set(own.flatMap(([, f]) => f.allow ?? []).map(norm));
  const merged = (key) => [...new Set([...(settings?.[key] ?? []), ...own.flatMap(([, f]) => f[key] ?? [])])];
  const lifted = (key) => merged(key).filter((t) => !allow.has(norm(t)));
  return {
    fandoms: own.map(([k]) => k),
    exclude: lifted('exclude'),
    require: lifted('require'),
    prefer: merged('prefer'),
    demote: merged('demote'),
    unless: Object.assign({}, settings?.exclude_unless, ...own.map(([, f]) => f.exclude_unless ?? {})),
    categories: own.map(([, f]) => f.categories).filter(Boolean).at(-1) ?? settings?.categories ?? [],
    relationships: [...new Set(own.flatMap(([, f]) => f.relationships ?? []))],
    // With pairings set: also gen fics of the fandom. The fandom's own answer wins over the general one.
    with_gen: own.map(([, f]) => f.with_gen).filter((v) => v !== undefined).at(-1) ?? settings?.with_gen ?? false,
  };
}

// "Yoo Joonghyuk/Kim Dokja" and "Kim Dokja/Yoo Joonghyuk" are one pairing; "&" (friendship) is not "/" (romance).
// Names are compared as sets of words, without diacritics and the fandom note: "Huā Chéng/Xiè Lián" is
// "Hua Cheng/Xie Lian (Tian Guan Ci Fu)", and a short form matches the full one ("Revy/Rock" is
// "Rebecca "Revy" Lee/Okajima "Rock" Rokuro") — every word of one name is in the other.
const person = (s) => norm(s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\([^)]*\)/g, '')).split(' ').filter(Boolean);
const people = (r) => r.split(/\s*[/&]\s*/).map(person);
const sameName = (a, b) => a.length > 0 && b.length > 0 && (a.every((w) => b.includes(w)) || b.every((w) => a.includes(w)));
export function samePairing(a, b) {
  if (a.includes('/') !== b.includes('/')) return false;
  const left = people(a);
  const right = people(b);
  if (left.length !== right.length) return false;
  // Each name of one pairing is matched to a different name of the other.
  const used = new Set();
  return left.every((n) => {
    const i = right.findIndex((m, j) => !used.has(j) && sameName(n, m));
    return i >= 0 && used.add(i);
  });
}

/**
 * How a fic fares against the settings: excluded tags it has, required tags it lacks, preferred and demoted tags it has,
 * and whether its category (Gen, M/M...) and pairing are the wanted ones. AO3 fics are matched by their tags;
 * Author.Today lists carry no tags or categories, so there tags are looked for in the genres and the author's
 * summary (approximate) and category and pairing stay unchecked (null).
 */
export function matchTags(fic, { exclude = [], require = [], prefer = [], demote = [], categories = [], relationships = [], unless = {} }) {
  const ao3 = fic.site === 'ao3';
  const hay = ao3
    ? [fic.rating, fic.category, ...fic.warnings, ...fic.relationships, ...fic.characters, ...fic.tags].filter(Boolean).map(norm)
    : [...(fic.genres ?? []), ...(fic.tags ?? []), ...(fic.relationships ?? []), fic.summary ?? '', fic.title].map(norm);
  // "=OOC": only a tag that is exactly this, not "slightly OOC" — compared with a fic's own tag list (AO3, or tags known from a web page).
  // The category counts as a tag here: "=Gen" — a gen-only fic ("Gen, M/M" is not).
  const own = (ao3 ? [...fic.warnings, ...fic.tags, fic.category ?? ''] : [...(fic.tags ?? []), fic.category ?? '']).map(norm);
  // "=Polyam": a relationship of three or more ("A/B/C") — no tag word says it.
  const polyam = (fic.relationships ?? []).some((r) => (r.match(/\//g) ?? []).length >= 2);
  // Wattpad tags are written together ("selfinsert", "slow-burn"): there tags are also compared without spaces and dashes.
  const squash = (s) => norm(s).replace(/×/g, 'x').replace(/[\s_-]+/g, '');
  const glued = fic.site === 'wattpad' ? (fic.tags ?? []).map(squash) : [];
  const hit = (t) => (t === '=Polyam' ? polyam
    : t.startsWith('=') ? own.includes(norm(t.slice(1))) || glued.includes(squash(t.slice(1)))
      : hay.some((h) => h.includes(norm(t))) || glued.some((h) => h.includes(squash(t))));
  // "No category": the author picked none — not a reason to drop the fic.
  const ficCats = (fic.category ?? '').split(', ').filter((c) => c && c !== 'No category');
  return {
    excluded_by: exclude.filter((t) => hit(t) && !(unless[t] ?? []).some(hit)),
    missing: require.filter((t) => !hit(t)),
    preferred: prefer.filter(hit),
    demoted: demote.filter(hit),
    category_ok: !categories.length || (ao3 && !ficCats.length) ? true : ao3 ? ficCats.some((c) => categories.includes(c)) : null,
    pairing_ok: !relationships.length ? true : ao3 ? fic.relationships.some((r) => relationships.some((w) => samePairing(r, w))) : null,
  };
}

/** What a list of saved fics says about taste: the most frequent fandoms, pairings, tags and so on. */
export function tasteSummary(fics, top = 25) {
  const count = (pick) => {
    const m = new Map();
    for (const f of fics) for (const v of new Set([pick(f)].flat().filter(Boolean))) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([v, n]) => `${v} (${n})`);
  };
  const words = fics.map((f) => f.words).filter(Boolean).sort((a, b) => a - b);
  return {
    fics: fics.length,
    fandoms: count((f) => f.fandoms),
    relationships: count((f) => f.relationships),
    characters: count((f) => f.characters),
    tags: count((f) => f.tags),
    warnings: count((f) => f.warnings),
    categories: count((f) => f.category?.split(', ')),
    ratings: count((f) => f.rating),
    languages: count((f) => f.lang),
    complete: fics.filter((f) => f.status === 'full').length,
    median_words: words.length ? words[Math.floor(words.length / 2)] : null,
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(String(u ?? '')) ? String(u) : '');

/**
 * A picks page the reader opens in the browser: { title, date, intro, fics: [{ title, url, authors, fandom, pairing,
 * rating, status, size, why, site }], left_out: [{ title, why }] }. Everything is escaped; only http(s) links.
 */
export function picksPage({ title = 'Подборка', date = '', intro = '', fics = [], left_out: leftOut = [] }) {
  const card = (f, i) => {
    const url = safeUrl(f.url);
    const authors = Array.isArray(f.authors) ? f.authors.join(', ') : f.authors;
    const meta = [authors, f.fandom, f.pairing, f.rating, f.site].filter(Boolean).map(esc).join(' · ');
    const head = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(f.title)}</a>` : esc(f.title);
    return `<article class="fic"><div class="num">${i + 1}</div><div class="body">
<h2>${head}</h2>
${meta ? `<p class="meta">${meta}</p>` : ''}
${f.status || f.size ? `<p class="status">${[f.status, f.size].filter(Boolean).map(esc).join(', ')}</p>` : ''}
${f.why ? `<p class="why">${esc(f.why)}</p>` : ''}
${url ? `<p class="link"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p>` : ''}
</div></article>`;
  };
  const left = leftOut.length
    ? `<section class="left"><h3>Не вошли</h3><ul>${leftOut.map((l) => `<li><b>${esc(l.title)}</b>${l.why ? ` — ${esc(l.why)}` : ''}</li>`).join('')}</ul></section>`
    : '';
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#f7f5f0;--card:#fff;--text:#1d1d1f;--muted:#6b6b70;--accent:#3b5bdb;--line:#e4e1da}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1e1e22;--text:#ececf0;--muted:#9a9aa3;--accent:#8ea2ff;--line:#2c2c33}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 64px}
header h1{font-size:26px;margin:0 0 4px}header .date{color:var(--muted);margin:0 0 12px}header .intro{margin:0 0 24px}
.fic{display:flex;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:0 0 14px}
.num{flex:none;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--card);display:grid;place-items:center;font-weight:600;font-size:14px}
.body{min-width:0}.fic h2{font-size:18px;margin:0 0 4px}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.meta,.status{color:var(--muted);margin:0 0 6px;font-size:14px}.why{margin:8px 0}.link{margin:0;font-size:13px;overflow-wrap:anywhere}
.left{margin-top:28px;color:var(--muted)}.left h3{font-size:16px;color:var(--text)}.left ul{padding-left:20px}
</style></head><body><main>
<header><h1>${esc(title)}</h1>${date ? `<p class="date">${esc(date)} · ${fics.length}</p>` : ''}${intro ? `<p class="intro">${esc(intro)}</p>` : ''}</header>
${fics.map(card).join('\n')}
${left}
</main></body></html>
`;
}
