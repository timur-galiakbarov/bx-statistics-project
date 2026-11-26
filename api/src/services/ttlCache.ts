type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class TtlCache<T> {
  private entries = new Map<string, CacheEntry<T>>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 200
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('maxEntries must be a positive integer');
    }
  }

  get size() {
    return this.entries.size;
  }

  private removeExpired() {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    if (this.entries.size === 0 && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  get(key: string) {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Map insertion order tracks the least recently used entry.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs) {
    if (this.entries.size >= this.maxEntries) this.removeExpired();
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(key, {
      value,
      expiresAt: this.now() + ttlMs
    });
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => this.removeExpired(), 5 * 60_000);
      this.cleanupTimer.unref();
    }
  }
}
