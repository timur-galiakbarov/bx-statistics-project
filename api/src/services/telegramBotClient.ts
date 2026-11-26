import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { normalizeTelegramChannelRef } from './contentPlanUtils.js';

const BOT_INFO_TTL_MS = 10 * 60_000;

type BotApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export type TelegramBotInfo = { id: number; username: string; name: string; url: string };
export type TelegramBotStatus = { configured: boolean; username: string; url: string; name: string; error: string };
export type ResolvedTelegramChannel = { externalId: string; title: string; handle: string; canPost: true };
export type SentTelegramMessage = { messageId: number; url: string };

class BotApiError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = 'BotApiError';
  }
}

let botInfoCache: { value: TelegramBotInfo; expiresAt: number } | null = null;

export function isTelegramBotConfigured() {
  return Boolean(env.telegramBotToken);
}

async function botCall<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  if (!env.telegramBotToken) {
    throw new DomainError('Бот для публикации не настроен. Добавьте TELEGRAM_BOT_TOKEN в api/.env.', {
      status: 503,
      code: 'TELEGRAM_BOT_NOT_CONFIGURED'
    });
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new DomainError('Telegram сейчас недоступен. Повторите позже.', {
      status: 502,
      code: 'TELEGRAM_BOT_UNAVAILABLE'
    });
  }

  const data = (await response.json().catch(() => null)) as BotApiResponse<T> | null;
  if (data?.error_code === 401) {
    throw new DomainError('Токен Telegram-бота недействителен. Проверьте TELEGRAM_BOT_TOKEN.', {
      status: 503,
      code: 'TELEGRAM_BOT_UNAUTHORIZED'
    });
  }
  if (data?.error_code === 429) {
    throw new DomainError('Telegram ограничил частоту запросов. Повторите через минуту.', {
      status: 429,
      code: 'TELEGRAM_RATE_LIMITED'
    });
  }
  if (!response.ok || !data?.ok) {
    throw new BotApiError(data?.description || `Telegram API ${response.status}`, data?.error_code);
  }
  return data.result as T;
}

export async function getTelegramBotInfo(): Promise<TelegramBotInfo> {
  if (botInfoCache && botInfoCache.expiresAt > Date.now()) return botInfoCache.value;
  const me = await botCall<{ id: number; username: string; first_name: string }>('getMe', {});
  if (!me.username) {
    throw new DomainError('У бота нет username. Задайте его в BotFather.', {
      status: 503,
      code: 'TELEGRAM_BOT_USERNAME_MISSING'
    });
  }
  const value = { id: me.id, username: me.username, name: me.first_name, url: `https://t.me/${me.username}` };
  botInfoCache = { value, expiresAt: Date.now() + BOT_INFO_TTL_MS };
  return value;
}

/** Для страницы: не роняем весь раздел, если Telegram или токен недоступны. */
export async function getTelegramBotStatus(): Promise<TelegramBotStatus> {
  if (!isTelegramBotConfigured()) return { configured: false, username: '', url: '', name: '', error: '' };
  try {
    const info = await getTelegramBotInfo();
    return { configured: true, username: info.username, url: info.url, name: info.name, error: '' };
  } catch (error) {
    return {
      configured: true,
      username: '',
      url: '',
      name: '',
      error: error instanceof Error ? error.message : 'Не удалось получить данные бота.'
    };
  }
}

export async function resolveTelegramChannel(input: unknown): Promise<ResolvedTelegramChannel> {
  const ref = normalizeTelegramChannelRef(input);
  const bot = await getTelegramBotInfo();

  let chat: { id: number; type: string; title?: string; username?: string };
  try {
    chat = await botCall<{ id: number; type: string; title?: string; username?: string }>('getChat', { chat_id: ref });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof BotApiError && (error.code === 400 || error.code === 403)) {
      throw new DomainError(
        `Бот @${bot.username} не добавлен в канал или канал не найден. Добавьте бота администратором канала.`,
        { status: 422, code: 'TELEGRAM_CHANNEL_NOT_FOUND' }
      );
    }
    throw new DomainError('Telegram не принял запрос. Повторите позже.', { status: 502, code: 'TELEGRAM_BOT_ERROR' });
  }

  if (chat.type !== 'channel') {
    throw new DomainError('Пока поддерживаются только Telegram-каналы, не группы.', {
      status: 422,
      code: 'TELEGRAM_NOT_A_CHANNEL'
    });
  }

  try {
    const member = await botCall<{ status: string; can_post_messages?: boolean }>('getChatMember', {
      chat_id: chat.id,
      user_id: bot.id
    });
    const canPost = member.status === 'creator' || (member.status === 'administrator' && member.can_post_messages !== false);
    if (!canPost) {
      throw new DomainError(
        `Бот @${bot.username} должен быть администратором канала с правом «Публиковать сообщения».`,
        { status: 422, code: 'TELEGRAM_BOT_NOT_ADMIN' }
      );
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof BotApiError && (error.code === 400 || error.code === 403)) {
      throw new DomainError(
        `Бот @${bot.username} должен быть администратором канала с правом «Публиковать сообщения».`,
        { status: 422, code: 'TELEGRAM_BOT_NOT_ADMIN' }
      );
    }
    throw new DomainError('Telegram не принял запрос. Повторите позже.', { status: 502, code: 'TELEGRAM_BOT_ERROR' });
  }

  return {
    externalId: String(chat.id),
    title: chat.title || chat.username || String(chat.id),
    handle: chat.username ? '@' + chat.username : '',
    canPost: true
  };
}


/** Отправляет пост в канал. Текст уже должен быть HTML для parse_mode=HTML. */
export async function sendTelegramMessage(externalId: string, handle: string, html: string): Promise<SentTelegramMessage> {
  try {
    const result = await botCall<{ message_id: number }>('sendMessage', {
      chat_id: externalId,
      text: html,
      parse_mode: 'HTML'
    });
    const url = handle.startsWith('@') ? `https://t.me/${handle.slice(1)}/${result.message_id}` : '';
    return { messageId: result.message_id, url };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof BotApiError) {
      if (error.code === 400) {
        throw new DomainError('Telegram отклонил текст поста. Проверьте разметку и длину.', {
          status: 422,
          code: 'TELEGRAM_MESSAGE_INVALID'
        });
      }
      if (error.code === 403) {
        throw new DomainError('Бот больше не администратор канала или канал недоступен.', {
          status: 422,
          code: 'TELEGRAM_BOT_NOT_ADMIN'
        });
      }
    }
    throw new DomainError('Telegram не подтвердил отправку. Проверьте канал перед повтором.', {
      status: 502,
      code: 'TELEGRAM_SEND_UNKNOWN'
    });
  }
}
