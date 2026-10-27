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

function fields(code) {
  const result = {};
  for (let offset = 0; offset < code.length;) {
    const id = code.slice(offset, offset + 2), length = Number(code.slice(offset + 2, offset + 4));
    assert.ok(Number.isInteger(length) && length > 0 && offset + 4 + length <= code.length);
    result[id] = code.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return result;
}

test('gera Pix Copia e Cola com o valor exato e identificador distinto sem resumo de pedido', () => {
  const first = pixPaymentParameters(payment);
  assert.notEqual(first.referenceId, pixPaymentParameters(payment).referenceId);
  for (const [amount, expected] of [['0.01', '0.01'], ['30.01', '30.01'], [30, '30.00']]) {
    const result = pixPaymentParameters({ ...payment, amount });
    assert.equal(result.parameters.display_text, 'Copiar código Pix');
    const code = fields(result.parameters.copy_code);
    assert.equal(code['54'], expected);
    assert.equal(fields(code['62'])['05'], result.referenceId);
    assert.match(result.referenceId, /^[a-zA-Z0-9]{25}$/);
  }
});

test('normaliza os tipos de chave usados em Minha Conta sem alterar email ou EVP', () => {
  for (const [keyType, key, expectedKey] of [
    ['Celular', '(11) 99999-9999', '+5511999999999'],
    ['PHONE', '+55 11 99999-9999', '+5511999999999'],
    ['CPF', '123.456.789-01', '12345678901'],
    ['CNPJ', '12.345.678/0001-90', '12345678000190'],
    ['Email', 'a@example.com', 'a@example.com'],
    ['Email', 'Titular@EXAMPLE.COM', 'titular@example.com'],
    ['CNPJ', '12.ABC.345/01DE-35', '12ABC34501DE35'],
    ['Aleatória', '12345678-1234-1234-1234-123456789abc', '12345678-1234-1234-1234-123456789abc'],
  ]) {
    const params = pixPaymentParameters({ ...payment, pix: { ...payment.pix, keyType, key } }).parameters;
    assert.equal(fields(fields(params.copy_code)['26'])['01'], expectedKey);
  }
});

test('rejeita valores imprecisos e chaves incompletas antes de conectar', async () => {
  const manager = new BaileysSessionManager();
  manager.requireConnectedSocket = () => assert.fail('não deve conectar');
  for (const amount of ['0', '-1', 'NaN', 'Infinity', '', '30,00', '0.001', '1e2', true, {}, '10000000000']) {
    await assert.rejects(manager.sendPixPayment('test', '11999999999', { ...payment, amount }), { statusCode: 400 });
  }
  for (const pix of [{}, { ...payment.pix, keyType: 'Outro' }, { ...payment.pix, key: 'inválida' }, { ...payment.pix, key: 'a'.repeat(66) + '@example.com' }]) {
    await assert.rejects(manager.sendPixPayment('test', '11999999999', { ...payment, pix }), { statusCode: 400 });
  }
  await assert.rejects(manager.sendPixPayment('test', '123@g.us', payment), { statusCode: 400 });
});

test('bloqueia chave de celular sem nono dígito sem tentar adivinhar o recebedor', async () => {
  const manager = new BaileysSessionManager();
  manager.requireConnectedSocket = () => assert.fail('não deve conectar nem enviar');
  for (const key of ['(11) 8888-7777', '1188887777', '551188887777', '+551188887777', '(11) 88888-7777']) {
    await assert.rejects(manager.sendPixPayment('test', '11999999999', {
      ...payment, pix: { ...payment.pix, keyType: 'Celular', key },
    }), error => error.statusCode === 400 && /9 dígitos/.test(error.message));
  }
});

test('celular copiado do banco mantém todos os dígitos no código Pix', () => {
  for (const key of ['11988887777', '(11) 98888-7777', '+55 (11) 98888-7777']) {
    const result = pixPaymentParameters({ ...payment, pix: { ...payment.pix, keyType: 'Celular', key } });
    assert.equal(fields(fields(result.parameters.copy_code)['26'])['01'], '+5511988887777');
  }
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

test('envia mensagem e botão de copiar o código Pix, sem resumo ou marcação de IA', async () => {
  const { manager, sends } = fixture();
  const result = await manager.sendPixPayment('test', '11999999999', payment);
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  const decoded = proto.Message.decode(proto.Message.encode(sends[0][1]).finish());
  const flow = decoded.interactiveMessage.nativeFlowMessage;
  assert.equal(flow.buttons.length, 1);
  assert.equal(flow.buttons[0].name, 'cta_copy');
  const params = JSON.parse(flow.buttons[0].buttonParamsJson);
  assert.equal(params.display_text, 'Copiar código Pix');
  assert.match(params.copy_code, /^000201/);
  const code = fields(params.copy_code);
  assert.equal(fields(code['26'])['01'], payment.pix.key);
  assert.equal(code['54'], '30.01');
  assert.equal(fields(code['62'])['05'], result.referenceId);
  assert.equal(decoded.interactiveMessage.body.text, payment.body);
  assert.equal(decoded.interactiveMessage.header, null);
  assert.doesNotMatch(JSON.stringify(decoded), /order_details|review_and_pay|payment_info|total_amount|retailer_id|quantity/);
  const biz = sends[0][2].additionalNodes.find(node => node.tag === 'biz');
  assert.equal(sends[0][2].additionalNodes.some(node => node.tag === 'bot'), false, 'Modelo Pix não recebe a marcação de IA');
  assert.equal(decoded.messageContextInfo?.botMetadata, undefined);
  assert.equal(decoded.interactiveMessage.contextInfo?.forwardedAiBotMessageInfo, undefined);
  assert.equal(biz.attrs.native_flow_name, undefined);
  assert.equal(biz.content[0].attrs.type, 'native_flow');
  assert.equal(biz.content[0].content[0].attrs.name, 'mixed');
});

test('preserva o valor, a formatação e as quebras de linha do modelo sem acrescentar cabeçalho', async () => {
  const { manager, sends } = fixture();
  const body = 'Olá, *Maria*!\n\n💰 Valor: R$ 30,00\n\nEnvie o comprovante para confirmar.';
  await manager.sendPixPayment('test', '11999999999', { ...payment, amount: '30.00', body });
  const params = JSON.parse(sends[0][1].interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson);
  assert.equal(sends[0][1].interactiveMessage.body.text, body);
  assert.equal(fields(params.copy_code)['54'], '30.00');
  assert.equal(fields(fields(params.copy_code)['26'])['01'], payment.pix.key);
  assert.equal(params.order, undefined);
  assert.equal(params.total_amount, undefined);
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
