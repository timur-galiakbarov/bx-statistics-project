import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { redis } from './redis.js';

const prefix = 'socstat:telegram';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Accounts the API can talk to: the main session and an optional one for pre-ad channel checks. */
export type TelegramAccount = 'main' | 'adcheck';

/**
 * A queued MTProto task ran longer than TELEGRAM_TASK_TIMEOUT_MS. gramjs can wait forever on a connection
 * that died silently (e.g. the SOCKS tunnel restarted), and without the timeout the whole queue would stall.
 */
export class TelegramTaskTimeoutError extends Error {
  constructor() {
    super('TELEGRAM_TIMEOUT');
    this.name = 'TelegramTaskTimeoutError';
  }
}

let timeoutHandler: (account: TelegramAccount) => void = () => undefined;

/** Called when a task of the account times out; the client uses it to drop the stuck connection. */
export function onTelegramTaskTimeout(handler: (account: TelegramAccount) => void) {
  timeoutHandler = handler;
}

/** Rejects after `ms` unless the task settles first. The task itself keeps running: gramjs calls cannot be cancelled. */
export async function withTaskTimeout<T>(task: Promise<T>, ms: number, onTimeout: () => void = () => undefined) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new TelegramTaskTimeoutError());
    }, ms);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Serializes all MTProto work of one account so it cannot be flooded by web traffic. */
class TelegramQueue {
  private tail: Promise<void> = Promise.resolve();
  private nextStartAt = 0;

  constructor(private readonly account: TelegramAccount, private readonly slotKey: string) {}

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
    const key = this.slotKey;
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
      return await withTaskTimeout(task(), env.telegramTaskTimeoutMs, () => {
        console.error(`Telegram ${this.account} task timed out after ${env.telegramTaskTimeoutMs} ms; reconnecting`);
        timeoutHandler(this.account);
      });
    } finally {
      clearInterval(refreshLease);
      await releaseLock(key, token);
    }
  }
}

export const telegramQueue = new TelegramQueue('main', `${prefix}:mtproto:slot`);
const adCheckQueue = new TelegramQueue('adcheck', `${prefix}:mtproto:adcheck:slot`);

export function telegramQueueFor(account: TelegramAccount) {
  return account === 'adcheck' ? adCheckQueue : telegramQueue;
}

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
export async function getTelegramAnalyticsCached<T>(
  key: string,
  forceRefresh: boolean,
  load: () => Promise<T>,
  options: { queue?: TelegramQueue; ttlMs?: number } = {}
): Promise<T> {
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
      const result = await (options.queue ?? telegramQueue).run(load);
      await redis.set(cacheKey, JSON.stringify(result), { PX: options.ttlMs ?? env.telegramCacheTtlMs });
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
      return getTelegramAnalyticsCached(key, forceRefresh, load, options);
    }
  }

  throw new Error('TELEGRAM_ANALYTICS_IN_PROGRESS');
}

/** A result stored by getTelegramAnalyticsCached, without loading anything. */
export function peekTelegramAnalyticsCache<T>(key: string) {
  return readJson<T>(`${prefix}:analytics:${key}`);
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
