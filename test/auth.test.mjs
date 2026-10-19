import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { requireToken } from '../src/auth.js';
import { createApp } from '../src/app.js';

test('production refuses missing or blank tokens at startup', () => {
  for (const token of [undefined, null, '', '   ', '\n\t']) {
    assert.throws(() => requireToken(token, { environment: 'production' }), /Configure API_TOKEN/);
  }
  assert.equal(typeof requireToken('secret', { environment: 'production' }), 'function');
});

test('protected routes reject invalid tokens and accept both supported headers', async t => {
  const app = createApp({ apiToken: 'secret', manager: { getState: () => ({ connected: true }) } });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const headers of [{}, { token: 'wrong' }, { Authorization: 'Bearer wrong' }]) {
    assert.equal((await fetch(`${base}/session/status/default`, { headers })).status, 404);
  }
  for (const headers of [{ token: 'secret' }, { Authorization: 'Bearer secret' }]) {
    const response = await fetch(`${base}/session/status/default`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).connected, true);
  }
});
