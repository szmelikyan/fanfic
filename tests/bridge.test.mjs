import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBridge, browserLoop } from '../lib/bridge.mjs';

test('bridge: a page asked for is fetched by the "browser" and handed back; close tells the tab to stop', async () => {
  const port = 47399;
  const bridge = startBridge({ origin: 'https://archiveofourown.org', port });
  const B = `http://localhost:${port}`;
  const asked = bridge.fetch('https://archiveofourown.org/works?page=1');
  // What the tab does: take a job, fetch it, post the page back.
  const job = await (await fetch(`${B}/next`)).json();
  assert.equal(job.url, 'https://archiveofourown.org/works?page=1');
  const pre = await fetch(`${B}/result`, { method: 'OPTIONS' });
  assert.equal(pre.headers.get('access-control-allow-private-network'), 'true');
  assert.equal(pre.headers.get('access-control-allow-origin'), 'https://archiveofourown.org');
  await fetch(`${B}/result`, { method: 'POST', body: JSON.stringify({ id: job.id, status: 200, body: '<html>works</html>' }) });
  assert.deepEqual(await asked, { status: 200, body: '<html>works</html>' });
  const waiting = fetch(`${B}/next`).then((r) => r.json());
  bridge.close();
  assert.deepEqual(await waiting, { done: true });
  assert.match(browserLoop(port), /localhost:47399/);
});
