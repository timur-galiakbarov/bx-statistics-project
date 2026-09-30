import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { acquireTelegramRefreshCooldown, consumeTelegramRateLimit } from '../services/telegramProtection.js';

function reject(res: Response, message: string, retryAfterMs: number) {
  res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  res.status(429).json({ success: false, error: 'TELEGRAM_RATE_LIMITED', message });
}

export async function limitTelegramRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return next();
    const ip = req.ip || 'unknown';
    const [userLimit, ipLimit] = await Promise.all([
      consumeTelegramRateLimit('user', userId, env.telegramUserRequestsPerMinute, 60_000),
      consumeTelegramRateLimit('ip', ip, env.telegramIpRequestsPerMinute, 60_000)
    ]);
    if (!userLimit.allowed) return reject(res, 'Слишком много запросов к Telegram. Повторите позже.', userLimit.retryAfterMs);
    if (!ipLimit.allowed) return reject(res, 'Слишком много запросов с этого IP. Повторите позже.', ipLimit.retryAfterMs);
    next();
  } catch (error) {
    next(error);
  }
}

export async function limitTelegramMediaRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return next();
    const result = await consumeTelegramRateLimit('media-user', userId, env.telegramMediaRequestsPerMinute, 60_000);
    if (!result.allowed) return reject(res, 'Слишком много загрузок медиа Telegram. Повторите позже.', result.retryAfterMs);
    next();
  } catch (error) {
    next(error);
  }
}

export async function limitTelegramRefresh(req: Request, res: Response, next: NextFunction) {
  if (req.query.refresh !== '1' || !req.user) return next();
  try {
    const result = await acquireTelegramRefreshCooldown(req.user.id, req.params.username ?? 'unknown');
    if (!result.allowed) return reject(res, 'Обновление этого источника пока недоступно. Повторите позже.', result.retryAfterMs);
    next();
  } catch (error) {
    next(error);
  }
}
