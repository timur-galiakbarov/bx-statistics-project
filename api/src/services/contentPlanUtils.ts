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


function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function telegramInline(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<i>$2</i>');
  return html;
}

/**
 * Преобразует markdown из редактора в HTML для Telegram Bot API (parse_mode: HTML).
 * Сам текст экранируется, поэтому HTML из поста не исполняется. Списки идут
 * строками с «•», цитаты — <blockquote>.
 */
export function markdownToTelegramHtml(text: string) {
  const lines = String(text || '').split('\n');
  return lines.map((line) => {
    if (/^\s*[-—•]\s+/.test(line)) return '• ' + telegramInline(line.replace(/^\s*[-—•]\s+/, ''));
    if (/^\s*>\s?/.test(line)) return '<blockquote>' + telegramInline(line.replace(/^\s*>\s?/, '')) + '</blockquote>';
    return telegramInline(line);
  }).join('\n');
}
