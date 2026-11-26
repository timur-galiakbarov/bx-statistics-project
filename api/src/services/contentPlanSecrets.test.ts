import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { DomainError } from '../errors/domainError.js';
import { botTokenLooksValid, decryptBotTokenWithKey, encryptBotTokenWithKey } from './contentPlanSecrets.js';

const key = randomBytes(32).toString('base64');

test('bot token encrypts and decrypts', () => {
  const token = '123456789:ABCdefGhIJKlmNoPQRsTuVwXyZ_1234567';
  const encrypted = encryptBotTokenWithKey(token, key);
  assert.notEqual(encrypted, token);
  assert.equal(decryptBotTokenWithKey(encrypted, key), token);
});

test('bot token decrypt fails with another key', () => {
  const encrypted = encryptBotTokenWithKey('123456789:ABCdefGhIJKlmNoPQRsTuVwXyZ_1234567', key);
  assert.throws(() => decryptBotTokenWithKey(encrypted, randomBytes(32).toString('base64')), (error) => error instanceof DomainError);
});

test('bot token format is checked', () => {
  assert.equal(botTokenLooksValid('123456789:ABCdefGhIJKlmNoPQRsTuVwXyZ_1234567'), true);
  assert.equal(botTokenLooksValid('not-a-token'), false);
  assert.equal(botTokenLooksValid(''), false);
});
