import { DomainError } from '../errors/domainError.js';

/**
 * Приводит ссылку на Telegram-канал к виду, который понимает Bot API:
 * `@username` или числовой chat_id. Ссылки на посты (`t.me/name/123`) тоже
 * превращаются в канал.
 */
export function normalizeTelegramChannelRef(input: unknown): string {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) {
    throw new DomainError('Вставьте ссылку на канал или @username.', { status: 400, code: 'TELEGRAM_CHANNEL_REF_REQUIRED' });
  }

  let value = raw
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, '');

  if (!value) {
    throw new DomainError('Вставьте ссылку на канал или @username.', { status: 400, code: 'TELEGRAM_CHANNEL_REF_REQUIRED' });
  }

  value = value.split('/')[0];

  if (value.startsWith('+') || value === 'joinchat' || value.startsWith('joinchat/')) {
    throw new DomainError('Приватные каналы пока не поддерживаются. Используйте @username канала.', {
      status: 422,
      code: 'TELEGRAM_PRIVATE_CHANNEL'
    });
  }

  if (/^-?\d+$/.test(value)) return value;

  if (!/^[A-Za-z][A-Za-z0-9_]{2,}$/.test(value)) {
    throw new DomainError('Не похоже на канал. Вставьте @username или ссылку t.me/….', {
      status: 400,
      code: 'TELEGRAM_CHANNEL_REF_INVALID'
    });
  }

  return '@' + value;
}
