import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

test('status removal endpoint requires authentication and forwards the original context', async t => {
  const calls = [];
  const app = createApp({ apiToken: 'test-token', manager: {
    deleteStatus: async (...args) => { calls.push(args); return { ok: true, confirmed: true }; },
  } });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/api/status/delete`;
  const payload = { session: 'original', messageId: 'WA-123', key: { id: 'WA-123', remoteJid: 'status@broadcast', fromMe: true }, recipients: ['123@lid'], ownerJid: '5511999999999@s.whatsapp.net' };
  const request = (body, authenticated) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer test-token' } : {}) }, body: JSON.stringify(body) });
  assert.equal((await request(payload, false)).status, 404);
  assert.equal((await request({ session: 'original' }, true)).status, 400);
  assert.equal(calls.length, 0);
  const response = await request(payload, true);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).confirmed, true);
  assert.deepEqual(calls[0], ['original', 'WA-123', { key: payload.key, recipients: payload.recipients, ownerJid: payload.ownerJid }]);
});
