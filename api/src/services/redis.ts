import { createClient } from 'redis';
import { env } from '../config/env.js';

export const redis = createClient({ url: env.redisUrl });

redis.on('error', (error: Error) => {
  console.error('Redis client error', error);
});

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }

  await redis.ping();
}

export async function disconnectRedis() {
  if (redis.isOpen) {
    await redis.quit();
  }
}
