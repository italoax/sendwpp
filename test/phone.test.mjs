import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrazilPhone, toJid } from '../src/utils.js';

test('adds country code to Brazilian landlines and mobile phones with DDD 55', () => {
  assert.equal(normalizeBrazilPhone('(55) 3333-4444'), '555533334444');
  assert.equal(normalizeBrazilPhone('(55) 99999-8888'), '5555999998888');
  assert.equal(toJid('55999998888'), '5555999998888@s.whatsapp.net');
});

test('preserves international numbers and normalizes ordinary local numbers', () => {
  for (const input of ['+55 (55) 99999-8888', '005555999998888', '5555999998888']) {
    assert.equal(normalizeBrazilPhone(input), '5555999998888');
  }
  assert.equal(normalizeBrazilPhone('+1 415 555 2671'), '14155552671');
  assert.equal(normalizeBrazilPhone('0014155552671'), '14155552671');
  assert.equal(normalizeBrazilPhone('(11) 99999-8888'), '5511999998888');
  assert.equal(normalizeBrazilPhone('011999998888'), '5511999998888');
  assert.equal(normalizeBrazilPhone(''), '');
  assert.equal(normalizeBrazilPhone(null), '');
  assert.equal(normalizeBrazilPhone('351912345678', '351'), '351912345678');
});
