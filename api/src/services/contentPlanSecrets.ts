import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';

const KEY_BYTES = 32;
const IV_BYTES = 12;

function keyFromBase64(value: string) {
  const key = Buffer.from(value, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new DomainError('Ключ шифрования секретов контент-плана настроен неверно.', {
      status: 503,
      code: 'CONTENT_PLAN_BOT_KEY_INVALID'
    });
  }
  return key;
}

function requireKey() {
  if (!env.contentPlanBotTokenKey) {
    throw new DomainError('Шифрование секретов контент-плана не настроено. Добавьте CONTENT_PLAN_BOT_TOKEN_KEY в api/.env.', {
      status: 503,
      code: 'CONTENT_PLAN_BOT_KEY_MISSING'
    });
  }
  return keyFromBase64(env.contentPlanBotTokenKey);
}

export function botTokenLooksValid(value: unknown) {
  return typeof value === 'string' && /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(value.trim());
}

export function encryptBotTokenWithKey(token: string, keyBase64: string) {
  const key = keyFromBase64(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptBotTokenWithKey(payload: string, keyBase64: string) {
  const key = keyFromBase64(keyBase64);
  const [version, iv, tag, data] = String(payload || '').split('.');
  if (version !== 'v1' || !iv || !tag || !data) {
    throw new DomainError('Секрет не читается. Замените токен или ключ доступа.', { status: 409, code: 'CONTENT_PLAN_BOT_TOKEN_UNREADABLE' });
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new DomainError('Секрет не читается. Замените токен или ключ доступа.', { status: 409, code: 'CONTENT_PLAN_BOT_TOKEN_UNREADABLE' });
  }
}

export function encryptBotToken(token: string) {
  return encryptBotTokenWithKey(token, Buffer.from(requireKey()).toString('base64'));
}

export function decryptBotToken(payload: string) {
  return decryptBotTokenWithKey(payload, Buffer.from(requireKey()).toString('base64'));
}


/** Общий секрет контент-плана: сейчас это токены Telegram-ботов и ключи сообществ ВК. */
export function encryptContentPlanSecret(value: string) {
  return encryptBotToken(value);
}

export function decryptContentPlanSecret(value: string) {
  return decryptBotToken(value);
}
