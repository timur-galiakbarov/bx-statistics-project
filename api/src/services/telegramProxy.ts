import type { ProxyInterface } from 'telegram/network/connection/TCPMTProxy.js';
import { env } from '../config/env.js';

export function getTelegramProxy(): ProxyInterface | undefined {
  if (!env.telegramProxyHost) return undefined;

  if (!Number.isInteger(env.telegramProxyPort) || env.telegramProxyPort < 1 || env.telegramProxyPort > 65_535) {
    throw new Error('TELEGRAM_PROXY_PORT must be a valid port when TELEGRAM_PROXY_HOST is set.');
  }

  if (env.telegramProxyType !== 4 && env.telegramProxyType !== 5) {
    throw new Error('TELEGRAM_PROXY_TYPE must be 4 or 5.');
  }

  return {
    ip: env.telegramProxyHost,
    port: env.telegramProxyPort,
    socksType: env.telegramProxyType,
    username: env.telegramProxyUsername || undefined,
    password: env.telegramProxyPassword || undefined
  };
}
