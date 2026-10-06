import { redis } from './redis.js';
import { TtlCache } from './ttlCache.js';

// Redis keeps entries across API restarts and deploys; the in-memory layer
// serves hot reads and keeps the cache working while Redis is unavailable.
export class RedisJsonCache<T> {
  private readonly memory: TtlCache<T>;

  constructor(
    private readonly prefix: string,
    private readonly ttlMs: number
  ) {
    this.memory = new TtlCache<T>(ttlMs);
  }

  async get(key: string): Promise<T | undefined> {
    const local = this.memory.get(key);
    if (local !== undefined) return local;
    if (!redis.isOpen) return undefined;

    try {
      const [raw, ttlMs] = await Promise.all([redis.get(this.redisKey(key)), redis.pTTL(this.redisKey(key))]);
      if (!raw) return undefined;
      const value = JSON.parse(raw) as T;
      // Keep the Redis expiry so the local copy does not outlive the shared one.
      if (ttlMs > 0) this.memory.set(key, value, ttlMs);
      return value;
    } catch (error) {
      console.error('Redis cache read failed', error);
      return undefined;
    }
  }

  async set(key: string, value: T) {
    this.memory.set(key, value);
    if (!redis.isOpen) return;

    try {
      await redis.set(this.redisKey(key), JSON.stringify(value), { PX: this.ttlMs });
    } catch (error) {
      console.error('Redis cache write failed', error);
    }
  }

  private redisKey(key: string) {
    return `${this.prefix}:${key}`;
  }
}
