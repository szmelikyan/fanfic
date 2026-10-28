// HTTP for the fanfic sites: one User-Agent, a minimum gap between requests per host,
// and an optional on-disk cache.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { DATA, loadConfig } from './paths.mjs';

const config = await loadConfig();
const contact = config.contact ? ` (${config.contact})` : '';
export const USER_AGENT = `fanfic-prototype/0.1 non-commercial${contact}`;

// Milliseconds between two requests to the same host.
const MIN_GAP = {
  'archiveofourown.org': 5000,
  'author.today': 2000, // robots.txt Crawl-delay: 2
  'www.wattpad.com': 2000, // no Crawl-delay there: as polite as Author.Today
};
const lastCall = new Map();

// Hosts read through the reader's browser (lib/bridge.mjs): { host: bridge }. A tab paces itself less strictly
// than a bot is asked to, but still at most one page every 2 s.
const bridges = new Map();
const BRIDGE_GAP = 2000;
// Sites that fail in waves (AO3's 525s): more patience, whichever way they are read.
const PATIENT = new Set(['archiveofourown.org']);
// Requests and failed attempts (429, 5xx, no answer) per host in this run — to see when a site is at its worst.
export const httpStats = {};
const count = (host, failed) => {
  const s = (httpStats[host] ??= { requests: 0, failed: 0 });
  s.requests++;
  if (failed) s.failed++;
};

export function useBridge(host, bridge) {
  bridges.set(host, bridge);
}

// A bridge kept in reserve: the script reads the host directly, and after 3 failed requests in a row
// switches to the reader's browser for the rest of the run.
const standby = new Map();
const failedInRow = new Map();
export function standbyBridge(host, bridge) {
  standby.set(host, bridge);
}

async function waitTurn(host) {
  const gap = bridges.has(host) ? BRIDGE_GAP : MIN_GAP[host] ?? 1000;
  const wait = (lastCall.get(host) ?? 0) + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall.set(host, Date.now());
}

function cachePath(url) {
  const { host } = new URL(url);
  const key = createHash('sha1').update(url).digest('hex');
  return path.join(DATA, 'cache', host, `${key}.json`);
}

/** One quick request: does the host let this script in at all (no retries, `timeoutMs`)? */
export async function reachable(url, timeoutMs = 30000) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? true : `${res.status}`;
  } catch (e) {
    return e.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : e.message;
  }
}

/**
 * GET a URL and parse JSON (or return text with { text: true }).
 * cacheDays: 0 disables the disk cache.
 */
export async function get(url, { cacheDays = 0, text = false, valid } = {}) {
  const file = cachePath(url);
  if (cacheDays > 0) {
    try {
      const hit = JSON.parse(await readFile(file, 'utf8'));
      if (Date.now() - hit.at < cacheDays * 864e5 && (!valid || valid(hit.body))) return hit.body;
    } catch {}
  }
  // FANFIC_OFFLINE=1: only what is in the cache (to show what a stopped scan had already read).
  if (process.env.FANFIC_OFFLINE === '1') throw new Error('offline: not in the cache');
  const { host } = new URL(url);
  for (let attempt = 1; ; attempt++) {
    await waitTurn(host);
    const bridge = bridges.get(host);
    const res = bridge
      ? await bridge.fetch(url).then(({ status, body }) => ({ status, ok: status >= 200 && status < 300, text: async () => body, json: async () => JSON.parse(body) }))
      : await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: text ? 'text/html' : 'application/json' }, signal: AbortSignal.timeout(90000) }).catch(() => ({ status: 0, ok: false }));
    const failed = res.status === 429 || res.status >= 500 || res.status === 0;
    // A 200 that is not the expected page (a maintenance or "retry later" page) is a failure too, and is not cached.
    const body = !failed && res.ok ? (text ? await res.text() : await res.json()) : null;
    const wrong = body !== null && valid && !valid(body);
    count(host, failed || wrong);
    if (!bridge && standby.has(host)) {
      failedInRow.set(host, failed || wrong ? (failedInRow.get(host) ?? 0) + 1 : 0);
      if (failedInRow.get(host) >= 3) {
        process.stderr.write(`[http] ${host} keeps failing for the script — switching to the reader's browser\n`);
        bridges.set(host, standby.get(host));
        standby.delete(host);
        continue;
      }
    }
    if (failed || wrong) {
      // Through the reader's browser a flaky site (AO3's 525s come in waves of minutes) gets more patience:
      // 10 tries, waiting 5 s, 10 s, 20 s… up to a minute — about 6 minutes before a page (and its run) is given up.
      const patient = bridge || PATIENT.has(host);
      if (attempt >= (patient ? 10 : 3)) throw new Error(`${wrong ? 'unexpected page' : res.status} ${url}`);
      await new Promise((r) => setTimeout(r, patient ? Math.min(60000, 5000 * 2 ** (attempt - 1)) : 2000 * attempt));
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    if (cacheDays > 0) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ at: Date.now(), body }));
    }
    return body;
  }
}
