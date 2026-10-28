// A site that does not let the scripts in (AO3 behind Cloudflare) is read through the reader's own browser:
// this process serves a queue on localhost, a tab of that site in the reader's Chrome runs `browserLoop` —
// it takes a URL, fetches it there (same site, the reader's session) and posts the page back.
// lib/http.mjs then gets the page as if it had fetched it itself: same cache, same parsing, same filters.
import http from 'node:http';

export const PORT = 47321;

/** The script to run in a tab of the site (Claude in Chrome, javascript_tool). It returns at once and keeps working in the tab. */
export const browserLoop = (port = PORT) => `(() => {
  if (window.__bookRecsBridge) return 'already running';
  window.__bookRecsBridge = true;
  const B = 'http://localhost:${port}';
  (async () => {
    for (;;) {
      let job;
      try { job = await (await fetch(B + '/next', { signal: AbortSignal.timeout(30000) })).json(); } catch { await new Promise((r) => setTimeout(r, 3000)); continue; }
      /* The scan ended: keep waiting for the next one (a scheduled scan finds this tab still listening). */
      if (job.done) { await new Promise((r) => setTimeout(r, 10000)); continue; }
      if (!job.url) continue;
      let status = 0, body = '';
      /* A page that hangs is given up after a minute: the script retries it, the queue moves on. */
      try { const r = await fetch(job.url, { credentials: 'include', signal: AbortSignal.timeout(60000) }); status = r.status; body = await r.text(); } catch (e) { body = String(e); }
      await fetch(B + '/result', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: job.id, status, body }) }).catch(() => {});
    }
  })();
  return 'bridge started';
})()`;

/**
 * Starts the queue. `fetch(url)` resolves to { status, body } once the browser has fetched it;
 * a request the browser does not answer within `timeoutMs` fails. `close()` tells the tab to stop.
 */
export function startBridge({ origin, port = PORT, timeoutMs = 120000, log = () => {} }) {
  const queue = [];
  const pending = new Map();
  const waiters = [];
  let seq = 0;
  let closed = false;
  let seen = false;
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
  };
  const send = (res, code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const take = (res) => {
    if (closed) return send(res, 200, { done: true });
    const job = queue.shift();
    if (job) return send(res, 200, job);
    const w = { res, timer: setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); send(res, 200, { wait: true }); }, 20000) };
    waiters.push(w);
  };
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'GET' && req.url === '/next') {
      if (!seen) { seen = true; log('the browser is connected'); }
      return take(res);
    }
    if (req.method === 'POST' && req.url === '/result') {
      let data = '';
      req.on('data', (c) => (data += c)).on('end', () => {
        try {
          const { id, status, body } = JSON.parse(data);
          pending.get(id)?.resolve({ status, body });
          pending.delete(id);
        } catch {}
        send(res, 200, { ok: true });
      });
      return;
    }
    send(res, 404, { error: 'not found' });
  });
  server.listen(port, '127.0.0.1');
  log(`waiting for the browser on http://localhost:${port} — run the bridge script in a tab of ${origin}`);
  return {
    /** Resolves true once the tab has asked for work, false after `ms`. */
    connected(ms) {
      return new Promise((resolve) => {
        const t0 = Date.now();
        const tick = () => (seen ? resolve(true) : Date.now() - t0 > ms ? resolve(false) : setTimeout(tick, 500));
        tick();
      });
    },
    fetch(url) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`the browser did not fetch ${url} in ${timeoutMs / 1000} s`)); }, timeoutMs);
        pending.set(id, { resolve: (r) => { clearTimeout(timer); resolve(r); } });
        const job = { id, url };
        const w = waiters.shift();
        if (w) { clearTimeout(w.timer); send(w.res, 200, job); } else queue.push(job);
      });
    },
    close() {
      closed = true;
      for (const w of waiters.splice(0)) { clearTimeout(w.timer); send(w.res, 200, { done: true }); }
      setTimeout(() => server.close(), 25000).unref();
    },
  };
}
