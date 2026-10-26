import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { proto } from '@whiskeysockets/baileys';
import { pixPaymentParameters } from '../src/pix-payment.js';
import { BaileysSessionManager } from '../src/baileys-manager.js';
import { createApp } from '../src/app.js';

const payment = {
  amount: '30.01', body: 'Mensalidade',
  pix: { key: 'recebimentos@example.com', keyType: 'Email', merchantName: 'Titular' },
};

test('preserva os centavos e gera referências distintas para cobranças pendentes', () => {
  const first = pixPaymentParameters(payment).parameters;
  assert.deepEqual(first.total_amount, { value: 3001, offset: 100 });
  assert.equal(first.order.status, 'pending');
  assert.equal(first.payment_status, undefined);
  assert.notEqual(first.reference_id, pixPaymentParameters(payment).parameters.reference_id);
  assert.equal(pixPaymentParameters({ ...payment, amount: '0.01' }).parameters.total_amount.value, 1);
  assert.equal(pixPaymentParameters({ ...payment, amount: 30 }).parameters.total_amount.value, 3000);
});

test('normaliza os tipos de chave usados em Minha Conta sem alterar email ou EVP', () => {
  for (const [keyType, key, expectedType, expectedKey] of [
    ['Celular', '(11) 99999-9999', 'PHONE', '+5511999999999'],
    ['PHONE', '+55 11 99999-9999', 'PHONE', '+5511999999999'],
    ['CPF', '123.456.789-01', 'CPF', '12345678901'],
    ['CNPJ', '12.345.678/0001-90', 'CNPJ', '12345678000190'],
    ['Email', 'a@example.com', 'EMAIL', 'a@example.com'],
    ['Aleatória', '12345678-1234-1234-1234-123456789abc', 'EVP', '12345678-1234-1234-1234-123456789abc'],
  ]) {
    const params = pixPaymentParameters({ ...payment, pix: { ...payment.pix, keyType, key } }).parameters;
    assert.equal(params.payment_settings[0].pix_static_code.key_type, expectedType);
    assert.equal(params.payment_settings[0].pix_static_code.key, expectedKey);
  }
});

test('rejeita valores imprecisos e chaves incompletas antes de conectar', async () => {
  const manager = new BaileysSessionManager();
  manager.requireConnectedSocket = () => assert.fail('não deve conectar');
  for (const amount of ['0', '-1', 'NaN', 'Infinity', '', '30,00', '0.001', '1e2', true, {}, '10000000000']) {
    await assert.rejects(manager.sendPixPayment('test', '11999999999', { ...payment, amount }), { statusCode: 400 });
  }
  for (const pix of [{}, { ...payment.pix, keyType: 'Outro' }, { ...payment.pix, key: 'inválida' }]) {
    await assert.rejects(manager.sendPixPayment('test', '11999999999', { ...payment, pix }), { statusCode: 400 });
  }
  await assert.rejects(manager.sendPixPayment('test', '123@g.us', payment), { statusCode: 400 });
});

function fixture() {
  const manager = new BaileysSessionManager();
  const session = manager.getOrCreateState('test');
  const sends = [];
  session.status = 'conectado';
  session.socket = {
    user: { id: '5511999999999:7@s.whatsapp.net' },
    waitForMessage: async () => ({ tag: 'ack', attrs: { class: 'message' } }),
    relayMessage: async (...args) => {
      assert.ok(session.msgStore.has(args[2].messageId), 'mensagem disponível para reenvio antes do relay');
      sends.push(args);
    },
  };
  manager.resolveJid = async () => '5511888888888@s.whatsapp.net';
  return { manager, session, sends };
}

test('envia protobuf válido, mantém o Pix pendente e exige aceitação do servidor', async () => {
  const { manager, sends } = fixture();
  const result = await manager.sendPixPayment('test', '11999999999', payment);
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  const decoded = proto.Message.decode(proto.Message.encode(sends[0][1]).finish());
  const flow = decoded.interactiveMessage.nativeFlowMessage;
  assert.equal(flow.buttons[0].name, 'payment_info');
  const params = JSON.parse(flow.buttons[0].buttonParamsJson);
  assert.equal(params.reference_id, result.referenceId);
  assert.equal(params.total_amount.value, 3001);
  assert.equal(params.order.status, 'pending');
  assert.equal(params.payment_settings[0].pix_static_code.key, payment.pix.key);
  assert.equal(sends[0][2].additionalNodes.find(node => node.tag === 'biz').attrs.native_flow_name, 'payment_info');
});

test('não repete o envio nem informa sucesso em falha, timeout ou recusa do servidor', async () => {
  for (const node of [undefined, { tag: 'receipt', attrs: {} }, { tag: 'ack', attrs: { class: 'message', error: '479' } }]) {
    const { manager, session, sends } = fixture();
    session.socket.waitForMessage = async () => node;
    await assert.rejects(manager.sendPixPayment('test', '11999999999', payment), /confirmou|recusou/);
    assert.equal(sends.length, 1);
  }
  const { manager, session, sends } = fixture();
  session.socket.waitForMessage = async () => { throw new Error('socket fechado'); };
  await assert.rejects(manager.sendPixPayment('test', '11999999999', payment), /confirmou/);
  assert.equal(sends.length, 1);
});

test('rota exige autenticação e retorna erro 400 para dados inválidos', async t => {
  const { manager, sends } = fixture();
  const server = createServer(createApp({ manager, apiToken: 'test-token' }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/api/messages/send/pix`;
  const request = (body, auth = true) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-token' } : {}) },
    body: JSON.stringify(body),
  });
  const payload = { session: 'test', number: '11999999999', ...payment };
  assert.equal((await request(payload, false)).status, 404);
  assert.equal((await request({ ...payload, amount: '-30' })).status, 400);
  assert.equal((await request({})).status, 400);
  assert.equal(sends.length, 0);
  const response = await request(payload);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).accepted, true);
  assert.equal(sends.length, 1);
});
