import { request as httpsRequest } from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { DomainError } from '../errors/domainError.js';
import { normalizeTelegramChannelRef } from './contentPlanUtils.js';
import { getTelegramProxy } from './telegramProxy.js';

const BOT_INFO_TTL_MS = 10 * 60_000;

type TelegramHttpResponse = { status: number; body: string };
type SocksProxyConfig = { ip: string; port: number; socksType: 4 | 5; username?: string; password?: string };

type BotApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export type TelegramBotInfo = { id: number; username: string; name: string; url: string };
export type ResolvedTelegramChannel = { externalId: string; title: string; handle: string; canPost: true };
export type SentTelegramMessage = { messageId: number; url: string };

class BotApiError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = 'BotApiError';
  }
}

const botInfoCache = new Map<string, { value: TelegramBotInfo; expiresAt: number }>();

/**
 * Bot API идёт через тот же SOCKS5, что и MTProto: на проде прямой доступ
 * к api.telegram.org закрыт, и обычный fetch падал с 502.
 */
function botApiAgent(): SocksProxyAgent | undefined {
  const proxy = getTelegramProxy() as SocksProxyConfig | undefined;
  if (!proxy) return undefined;
  const protocol = proxy.socksType === 4 ? 'socks4a' : 'socks5h';
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
    : '';
  return new SocksProxyAgent(`${protocol}://${auth}${proxy.ip}:${proxy.port}`);
}

function telegramRequest(url: string, body: string, agent: SocksProxyAgent | undefined): Promise<TelegramHttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = httpsRequest({
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      agent,
      timeout: 10_000
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('timeout', () => req.destroy(new Error('Telegram Bot API timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

async function botCall<T>(token: string, method: string, payload: Record<string, unknown>): Promise<T> {
  if (!token) {
    throw new DomainError('Токен Telegram-бота не задан.', { status: 503, code: 'TELEGRAM_BOT_NOT_CONFIGURED' });
  }

  let result: TelegramHttpResponse;
  let agent: SocksProxyAgent | undefined;
  try {
    agent = botApiAgent();
  } catch (error) {
    console.error('Telegram Bot API proxy config failed', error instanceof Error ? error.message : error);
    throw new DomainError('Прокси Telegram настроен неверно. Проверьте TELEGRAM_PROXY_*.', {
      status: 503,
      code: 'TELEGRAM_PROXY_INVALID'
    });
  }
  try {
    result = await telegramRequest(`https://api.telegram.org/bot${token}/${method}`, JSON.stringify(payload), agent);
  } catch (error) {
    // URL содержит токен, поэтому в лог пишем только причину, без адреса.
    console.error('Telegram Bot API request failed', error instanceof Error ? error.message : error);
    if (error instanceof DomainError) throw error;
    throw new DomainError('Telegram недоступен с сервера. Проверьте SOCKS-прокси (TELEGRAM_PROXY_*).', {
      status: 502,
      code: 'TELEGRAM_BOT_UNAVAILABLE'
    });
  }

  let data: BotApiResponse<T> | null = null;
  try {
    data = JSON.parse(result.body) as BotApiResponse<T>;
  } catch {
    data = null;
  }
  if (data?.error_code === 401) {
    botInfoCache.delete(token);
    throw new DomainError('Токен Telegram-бота недействителен. Замените его в настройках контент-плана.', {
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
  if (result.status < 200 || result.status >= 300 || !data?.ok) {
    throw new BotApiError(data?.description || `Telegram API ${result.status}`, data?.error_code);
  }
  return data.result as T;
}

export async function getTelegramBotInfo(token: string): Promise<TelegramBotInfo> {
  const cached = botInfoCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const me = await botCall<{ id: number; username: string; first_name: string }>(token, 'getMe', {});
  if (!me.username) {
    throw new DomainError('У бота нет username. Задайте его в BotFather.', {
      status: 422,
      code: 'TELEGRAM_BOT_USERNAME_MISSING'
    });
  }
  const value = { id: me.id, username: me.username, name: me.first_name, url: `https://t.me/${me.username}` };
  botInfoCache.set(token, { value, expiresAt: Date.now() + BOT_INFO_TTL_MS });
  return value;
}

export async function resolveTelegramChannel(token: string, input: unknown): Promise<ResolvedTelegramChannel> {
  const ref = normalizeTelegramChannelRef(input);
  const bot = await getTelegramBotInfo(token);

  let chat: { id: number; type: string; title?: string; username?: string };
  try {
    chat = await botCall<{ id: number; type: string; title?: string; username?: string }>(token, 'getChat', { chat_id: ref });
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
    const member = await botCall<{ status: string; can_post_messages?: boolean }>(token, 'getChatMember', {
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
export async function sendTelegramMessage(token: string, externalId: string, handle: string, html: string): Promise<SentTelegramMessage> {
  try {
    const result = await botCall<{ message_id: number }>(token, 'sendMessage', {
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
