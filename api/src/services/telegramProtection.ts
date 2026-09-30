import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { redis } from './redis.js';

const prefix = 'socstat:telegram';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Serializes all MTProto work so one shared account cannot be flooded by web traffic. */
class TelegramQueue {
  private tail: Promise<void> = Promise.resolve();
  private nextStartAt = 0;

  run<T>(task: () => Promise<T>) {
    const run = async () => {
      const waitMs = Math.max(0, this.nextStartAt - Date.now());
      if (waitMs) await sleep(waitMs);
      this.nextStartAt = Date.now() + env.telegramRequestIntervalMs;
      return this.runWithDistributedSlot(task);
    };
    const result = this.tail.then(run, run);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private async runWithDistributedSlot<T>(task: () => Promise<T>) {
    const key = `${prefix}:mtproto:slot`;
    const token = randomUUID();
    while (await redis.set(key, token, { NX: true, PX: env.telegramTaskLockTtlMs }) !== 'OK') {
      await sleep(250);
    }

    const refreshLease = setInterval(() => {
      void redis.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end',
        { keys: [key], arguments: [token, String(env.telegramTaskLockTtlMs)] }
      );
    }, Math.max(1_000, Math.floor(env.telegramTaskLockTtlMs / 3)));

    try {
      return await task();
    } finally {
      clearInterval(refreshLease);
      await releaseLock(key, token);
    }
  }
}

export const telegramQueue = new TelegramQueue();

async function readJson<T>(key: string): Promise<T | undefined> {
  const value = await redis.get(key);
  if (!value) return undefined;
  return JSON.parse(value) as T;
}

async function releaseLock(key: string, token: string) {
  await redis.eval(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    { keys: [key], arguments: [token] }
  );
}

/**
 * Shares the result across API replicas and lets only one replica fetch one channel/period.
 * A refresh starts one new fetch; concurrent refreshes receive that same fresh result.
 */
export async function getTelegramAnalyticsCached<T>(key: string, forceRefresh: boolean, load: () => Promise<T>) {
  const cacheKey = `${prefix}:analytics:${key}`;
  const lockKey = `${cacheKey}:lock`;

  if (!forceRefresh) {
    const cached = await readJson<T>(cacheKey);
    if (cached !== undefined) return cached;
  }

  const token = randomUUID();
  const locked = await redis.set(lockKey, token, { NX: true, PX: env.telegramAnalyticsLockTtlMs });
  if (locked === 'OK') {
    try {
      // Another process may have populated the cache just before we acquired an expired lock.
      if (!forceRefresh) {
        const cached = await readJson<T>(cacheKey);
        if (cached !== undefined) return cached;
      }
      const result = await telegramQueue.run(load);
      await redis.set(cacheKey, JSON.stringify(result), { PX: env.telegramCacheTtlMs });
      return result;
    } finally {
      await releaseLock(lockKey, token);
    }
  }

  const deadline = Date.now() + env.telegramAnalyticsWaitMs;
  while (Date.now() < deadline) {
    await sleep(500);
    const cached = await readJson<T>(cacheKey);
    if (cached !== undefined) return cached;
    if (!await redis.exists(lockKey)) {
      return getTelegramAnalyticsCached(key, forceRefresh, load);
    }
  }

  throw new Error('TELEGRAM_ANALYTICS_IN_PROGRESS');
}

export async function consumeTelegramRateLimit(scope: string, identifier: string, limit: number, windowMs: number) {
  const key = `${prefix}:rate:${scope}:${identifier}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.pExpire(key, windowMs);
  const retryAfterMs = await redis.pTTL(key);
  return { allowed: count <= limit, retryAfterMs: Math.max(0, retryAfterMs) };
}

export async function acquireTelegramRefreshCooldown(userId: string, source: string) {
  const key = `${prefix}:refresh:${userId}:${source.toLowerCase()}`;
  const acquired = await redis.set(key, '1', { NX: true, PX: env.telegramRefreshCooldownMs });
  if (acquired === 'OK') return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: Math.max(0, await redis.pTTL(key)) };
}
