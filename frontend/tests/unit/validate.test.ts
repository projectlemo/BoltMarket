import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPassword, isEmail, parseAmount, passwordOk } from '../../src/lib/validate';

test('email format', () => {
  assert.ok(isEmail('sara@example.com'));
  assert.ok(isEmail('  omar.k+fx@mail.co.uk '));
  assert.ok(!isEmail('nope'));
  assert.ok(!isEmail('a@b.c'));
});

test('password policy mirrors the API', () => {
  assert.ok(passwordOk('Sunrise-2048x'));
  assert.deepEqual(checkPassword('short1'), { length: false, letter: true, number: true, notCommon: true });
  assert.ok(!passwordOk('onlyletterslong'));
  assert.ok(!passwordOk('1234567890123'));
  assert.ok(passwordOk('كلمةمرور2048'));
});

test('amount parsing', () => {
  assert.equal(parseAmount('1,250.555'), 1250.56);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('abc'), null);
});
