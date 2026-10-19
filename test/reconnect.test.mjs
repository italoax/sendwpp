import test from 'node:test';
import assert from 'node:assert/strict';
import { BaileysSessionManager } from '../src/baileys-manager.js';

test('reconnection keeps retrying after failures and eventually connects', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = new BaileysSessionManager();
  const session = manager.getOrCreateState('retry-test');
  let attempts = 0;
  manager.createSocket = async state => {
    attempts++;
    if (attempts < 3) throw new Error('Rede indisponível');
    state.socket = {};
    state.status = 'conectado';
  };
  await assert.rejects(manager.start(session.name), /Rede indisponível/);
  assert.equal(manager.getState(session.name).status, 'reconectando');
  t.mock.timers.tick(2000);
  await session.starting;
  assert.equal(attempts, 2);
  t.mock.timers.tick(4000);
  await session.starting;
  assert.equal(attempts, 3);
  assert.equal(manager.getState(session.name).connected, true);
  t.mock.timers.tick(60_000);
  assert.equal(attempts, 3);
});

test('a connection closed during startup is retried once startup finishes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = new BaileysSessionManager();
  const session = manager.getOrCreateState('early-close');
  manager.createSocket = async state => {
    await Promise.resolve();
    state.status = 'reconectando';
    manager.scheduleReconnect(state);
  };
  await manager.start(session.name);
  assert.ok(session.reconnectTimer);
  await manager.stop(session.name);
  assert.equal(session.reconnectTimer, null);
});

test('stopping a session cancels pending reconnection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = new BaileysSessionManager();
  const session = manager.getOrCreateState('stopped');
  let attempts = 0;
  manager.createSocket = async () => { attempts++; };
  manager.scheduleReconnect(session);
  await manager.stop(session.name);
  t.mock.timers.tick(60_000);
  assert.equal(attempts, 0);
  assert.equal(manager.getState(session.name).status, 'desconectado');
});

test('a failed attempt finishing after stop cannot restart the session', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = new BaileysSessionManager();
  const session = manager.getOrCreateState('stop-in-flight');
  let rejectAttempt;
  manager.createSocket = () => new Promise((_resolve, reject) => { rejectAttempt = reject; });
  const startup = manager.start(session.name);
  const rejected = assert.rejects(startup, /Rede indisponível/);
  await manager.stop(session.name);
  rejectAttempt(new Error('Rede indisponível'));
  await rejected;
  t.mock.timers.tick(60_000);
  assert.equal(session.status, 'desconectado');
  assert.equal(session.reconnectTimer, null);
});

test('an old attempt cannot clear a newer startup after restart', async () => {
  const manager = new BaileysSessionManager();
  const session = manager.getOrCreateState('new-startup');
  const completions = [];
  manager.createSocket = () => new Promise(resolve => { completions.push(resolve); });
  const oldStartup = manager.start(session.name);
  await manager.stop(session.name);
  const newStartup = manager.start(session.name);
  const newAttempt = session.starting;
  completions[0]();
  await oldStartup;
  assert.equal(session.starting, newAttempt);
  completions[1]();
  await newStartup;
});
