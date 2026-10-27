import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixCode } from '../src/pix-br-code.js';

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
const account = { key: '123e4567-e12b-12d1-a456-426655440000', merchantName: 'Fulano de Tal', merchantCity: 'BRASILIA' };

test('reproduz integralmente o exemplo oficial do BCB, inclusive o CRC 1D3D', () => {
  // Manual de Padrões para Iniciação do Pix v2.10.0, seção 2.6.3.
  const expected = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';
  assert.equal(createPixCode(account), expected);
});

test('codifica recebedor, moeda, valor e txid nos campos BR Code correspondentes', () => {
  const code = fields(createPixCode({ ...account, amountCents: 3001, txid: 'Mensalidade123' }));
  assert.equal(code['00'], '01');
  assert.equal(fields(code['26'])['00'], 'br.gov.bcb.pix');
  assert.equal(fields(code['26'])['01'], account.key);
  assert.equal(code['53'], '986');
  assert.equal(code['54'], '30.01');
  assert.equal(code['58'], 'BR');
  assert.equal(code['59'], account.merchantName);
  assert.equal(code['60'], account.merchantCity);
  assert.equal(fields(code['62'])['05'], 'Mensalidade123');
  assert.match(code['63'], /^[0-9A-F]{4}$/);
});

test('preserva centavos e o valor máximo sem arredondamento de ponto flutuante', () => {
  for (const [amountCents, expected] of [[1, '0.01'], [29, '0.29'], [1999, '19.99'], [3000, '30.00'], [999999999999, '9999999999.99']])
    assert.equal(fields(createPixCode({ ...account, amountCents }))['54'], expected);
});

test('normaliza acentos e limita os campos informativos sem alterar a chave', () => {
  const code = fields(createPixCode({ ...account, merchantName: "João D'Ávila & Cia", merchantCity: 'São José dos Campos' }));
  assert.equal(code['59'], 'Joao D Avila Cia');
  assert.equal(code['60'], 'Sao Jose dos Ca');
  assert.equal(fields(code['26'])['01'], account.key);
  assert.equal(fields(createPixCode({ ...account, merchantName: 'A'.repeat(80) }))['59'].length, 25);
  assert.equal(fields(createPixCode({ key: account.key, merchantName: 'Titular' }))['60'], 'NAO INFORMADO');
});

test('rejeita campos incompatíveis com o BR Code em vez de gerar um código corrompido', () => {
  for (const invalid of [
    { key: 'a'.repeat(78) }, { key: 'títular@example.com' }, { merchantName: '💰' },
    { merchantCity: '' }, { txid: 'a'.repeat(26) }, { txid: 'com-hifen' },
    { amountCents: 0 }, { amountCents: -1 }, { amountCents: 1.5 },
    { amountCents: Infinity }, { amountCents: 1000000000000 },
  ]) assert.throws(() => createPixCode({ ...account, ...invalid }), { statusCode: 400 });
  assert.equal(fields(fields(createPixCode({ ...account, key: 'a'.repeat(77) }))['26'])['01'].length, 77);
});
