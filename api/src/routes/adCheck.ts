import { Router } from 'express';
import { DomainError } from '../errors/domainError.js';
import { hasActiveAccess } from '../middleware/access.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { limitTelegramRequests } from '../middleware/telegramProtection.js';
import { getAdCheckUsage, runAdCheck } from '../services/adCheckService.js';
import { trackActivity } from '../services/activityTracking.js';
import { redis } from '../services/redis.js';

export const adCheckRouter = Router();

adCheckRouter.use(requireUser, requireAdmin);

// Limits and the Telegram cache live in Redis: without it checks would be unprotected.
adCheckRouter.use((_req, res, next) => {
  if (redis.isReady) return next();
  res.status(503).json({ success: false, error: 'AD_CHECK_UNAVAILABLE', message: 'Проверка каналов временно недоступна. Повторите позже.' });
});

adCheckRouter.get('/usage', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getAdCheckUsage(req.user!.id, hasActiveAccess(req.user)) });
  } catch (error) { next(error); }
});

// Per-minute limits of the Telegram routes apply to every check: they are cheap and stop scripted bursts.
adCheckRouter.get('/', limitTelegramRequests, async (req, res, next) => {
  try {
    const data = await runAdCheck({ userId: req.user!.id, paid: hasActiveAccess(req.user), query: req.query.q, platform: req.query.platform });
    trackActivity(req, 'ad_check_run', { platform: data.platform, label: data.source.id });
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof DomainError && (error.code === 'AD_CHECK_LIMIT' || error.code === 'AD_CHECK_TELEGRAM_BUDGET')) {
      trackActivity(req, 'ad_check_limit', { label: error.code });
    }
    next(error);
  }
});
