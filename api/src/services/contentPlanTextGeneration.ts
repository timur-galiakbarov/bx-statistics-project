import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { DomainError } from '../errors/domainError.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { redis } from './redis.js';

const DAY = 86_400_000;
const TRIAL_LIMIT = 5;
const PAID_LIMIT = 30;
const MODEL = 'gpt-6.2-sol';

export function getApiKey() {
  if (process.env.OPEN_AI_SERVICE_KEY?.trim()) return process.env.OPEN_AI_SERVICE_KEY.trim();
  if (process.env.NODE_ENV !== 'production') {
    try {
      return dotenv.parse(readFileSync(new URL('../../../.env.local', import.meta.url))).OPEN_AI_SERVICE_KEY?.trim();
    } catch {
      return undefined;
    }
  }
}

export function unavailable(kind: 'text' | 'image' = 'text') {
  return new DomainError(`Генерация ${kind === 'image' ? 'изображений' : 'текста'} сейчас недоступна. Попробуйте позже.`, {
    status: 503, code: 'CONTENT_PLAN_AI_UNAVAILABLE'
  });
}

async function getQuota(userId: string, kind: 'text' | 'image') {
  const now = Date.now();
  const user = await UserModel.findById(userId).select('activeTo trialEndsAt isAdmin').lean();
  if (kind === 'image' && user?.isAdmin) return { unlimited: true } as const;
  if (!user || user.activeTo.getTime() <= now) return null;
  const paid = await PaymentModel.exists({ userId, status: 'paid', amount: { $gt: 0 } });
  if (kind === 'image') {
    const day = Math.floor((now + 3 * 3_600_000) / DAY);
    if (paid) return { key: `content-plan:ai:image:paid:${userId}:${day}`, now, since: 0, ttl: DAY, limit: 10, period: 'day' as const };
    if (!user.trialEndsAt || user.trialEndsAt.getTime() <= now) return null;
    return { key: `content-plan:ai:image:trial:${userId}`, now, since: 0, ttl: user.trialEndsAt.getTime() - now, limit: 3, period: 'trial' as const };
  }
  if (paid) {
    return { key: `content-plan:ai:paid:${userId}`, now, since: now - 30 * DAY, ttl: 30 * DAY, limit: PAID_LIMIT, period: 'month' as const };
  }
  if (!user.trialEndsAt || user.trialEndsAt.getTime() <= now) return null;
  const moscowOffset = 3 * 3_600_000;
  const day = Math.floor((now + moscowOffset) / DAY);
  const since = day * DAY - moscowOffset;
  return { key: `content-plan:ai:trial:${userId}:${day}`, now, since: since - 1, ttl: DAY, limit: TRIAL_LIMIT, period: 'day' as const };
}

async function requireQuota(userId: string, kind: 'text' | 'image') {
  if (!getApiKey()) throw unavailable(kind);
  const quota = await getQuota(userId, kind);
  if (!quota) {
    throw new DomainError('Генерация доступна во время триала и с оплаченной подпиской.', {
      status: 403, code: 'CONTENT_PLAN_AI_ACCESS'
    });
  }
  return quota;
}

export async function getContentPlanTextAvailability(userId: string, kind: 'text' | 'image' = 'text') {
  const quota = await requireQuota(userId, kind);
  if ('unlimited' in quota) return { period: 'unlimited' as const, remaining: null };
  const used = await redis.zCount(quota.key, `(${quota.since}`, '+inf');
  return { period: quota.period, remaining: Math.max(0, quota.limit - used) };
}

// Проверка и списание выполняются одной операцией, в том числе при запросах из разных вкладок.
const reserveQuota = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local used = redis.call('ZCARD', KEYS[1])
local limit = tonumber(ARGV[2])
if used >= limit then return -1 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return limit - used - 1
`;

export async function reserveContentPlanGeneration(userId: string, kind: 'text' | 'image') {
  const quota = await requireQuota(userId, kind);
  if ('unlimited' in quota) return { period: 'unlimited' as const, remaining: null };
  const remaining = await redis.eval(reserveQuota, {
    keys: [quota.key],
    arguments: [String(quota.since), String(quota.limit), String(quota.now), randomUUID(), String(quota.ttl)]
  });
  if (typeof remaining !== 'number' || remaining < 0) {
    throw new DomainError('Лимит генераций исчерпан.', { status: 429, code: 'CONTENT_PLAN_AI_LIMIT' });
  }

  return { remaining, period: quota.period };
}

export async function generateContentPlanText(userId: string, body: {
  topic?: unknown;
  platform?: unknown;
  caption?: unknown;
} | undefined) {
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  const platform = body?.platform;
  if (!topic || topic.length > 1000 || (platform !== 'vk' && platform !== 'telegram')) {
    throw new DomainError('Укажите тему поста длиной до 1 000 символов.', {
      status: 400, code: 'CONTENT_PLAN_AI_INVALID_TOPIC'
    });
  }
  const apiKey = getApiKey();
  if (!apiKey) throw unavailable();
  const quota = await reserveContentPlanGeneration(userId, 'text');
  const maxLength = platform === 'telegram' && body?.caption === true ? 1024 : 4096;
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: MODEL,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1600,
        instructions: `Напиши готовый текст для ${platform === 'vk' ? 'ВКонтакте' : 'Telegram'} на языке запроса. Верни только текст публикации, без Markdown и пояснений. Не выдумывай факты, цены, даты или ссылки. Длина — до ${maxLength === 1024 ? 900 : 2500} символов.`,
        input: topic
      })
    });
    if (!response.ok) throw unavailable();
    const result = await response.json() as {
      status?: string;
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = result.output?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text).join('\n').trim();
    if (result.status !== 'completed' || !text || text.length > maxLength) throw unavailable();
    return { text, ...quota };
  } catch {
    // При таймауте запрос мог быть обработан и оплачен. Списание сохраняем.
    throw unavailable();
  }
}
