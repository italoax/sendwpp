import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { downloadBuffer } from '../src/media-download.js';

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}/media`;
}

test('downloads media preserving bytes and content type', async t => {
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end('hello');
  });
  const media = await downloadBuffer(url, { maxBytes: 5 });
  assert.equal(media.buffer.toString(), 'hello');
  assert.equal(media.contentType, 'image/png');
});

test('rejects oversized declared bodies before downloading them', async t => {
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { 'Content-Length': '1000000' });
    res.flushHeaders();
  });
  await assert.rejects(downloadBuffer(url, { maxBytes: 5 }), /excede o limite/);
});

test('limits streamed bodies without content length', async t => {
  const url = await serve(t, (_req, res) => {
    res.writeHead(200);
    res.write('hello');
    res.end('world');
  });
  await assert.rejects(downloadBuffer(url, { maxBytes: 5 }), /excede o limite/);
});

test('limits decompressed media as well as compressed transfers', async t => {
  const compressed = gzipSync('x'.repeat(1024));
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': compressed.length });
    res.end(compressed);
  });
  await assert.rejects(downloadBuffer(url, { maxBytes: 128 }), /excede o limite/);
});

test('times out both unresponsive servers and stalled response bodies', async t => {
  for (const sendHeaders of [false, true]) {
    const url = await serve(t, (_req, res) => {
      if (sendHeaders) { res.writeHead(200); res.flushHeaders(); }
    });
    await assert.rejects(downloadBuffer(url, { timeoutMs: 100 }), /Tempo limite/);
  }
});

test('supports bounded data URLs and rejects unsupported URLs and HTTP errors', async t => {
  const media = await downloadBuffer('data:image/png;base64,aGVsbG8=', { maxBytes: 5 });
  assert.equal(media.buffer.toString(), 'hello');
  assert.equal(media.contentType, 'image/png');
  await assert.rejects(downloadBuffer('data:image/png;base64,aGVsbG8=', { maxBytes: 4 }), /excede o limite/);
  await assert.rejects(downloadBuffer(`data:;base64,${'A'.repeat(1000)}`, { maxBytes: 5 }), /excede o limite/);
  await assert.rejects(downloadBuffer('data:,hello%20world', { maxBytes: 5 }), /excede o limite/);
  await assert.rejects(downloadBuffer('file:///secret.txt'), /URL de mídia inválida/);
  const url = await serve(t, (_req, res) => { res.writeHead(404); res.end(); });
  await assert.rejects(downloadBuffer(url), /HTTP 404/);
});
