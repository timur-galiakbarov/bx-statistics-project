import { Router } from 'express';
import type { Request, Response } from 'express';
import { hasActiveAccess, hasBonusCommunityAccess } from '../middleware/access.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { getPostViewCurves, getSnapshotCoverage, getSubscriberHistory, type SnapshotPlatform } from '../services/snapshotService.js';
import { snapshotDateKey, snapshotGrowthForPeriod, telegramUsernameFromSource } from '../services/snapshotUtils.js';

export const snapshotsRouter = Router();

const MAX_HISTORY_DAYS = 365;
const MAX_POST_CURVE_DAYS = 90;
const MAX_COVERAGE_DAYS = 90;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Daily snapshots are Socstat's own data: open with access or for the user's bonus source. */
async function denySnapshotsWithoutAccess(req: Request, res: Response, externalId: string) {
  if (hasActiveAccess(req.user) || await hasBonusCommunityAccess(req.user!, externalId)) return false;
  res.status(402).json({ success: false, error: 'ACCESS_EXPIRED', message: 'История подписчиков по срезам Socstat доступна на тарифе.' });
  return true;
}

snapshotsRouter.get('/history', requireUser, async (req, res, next) => {
  try {
    const platform = req.query.platform;
    const rawId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    if (platform !== 'vk' && platform !== 'youtube' && platform !== 'telegram') {
      res.status(400).json({ success: false, error: 'INVALID_PLATFORM' });
      return;
    }
    const externalId = platform === 'telegram' ? telegramUsernameFromSource({ externalId: rawId }) : rawId.replace(/^-/, '');
    if (!externalId) {
      res.status(400).json({ success: false, error: 'INVALID_SOURCE_ID' });
      return;
    }
    if (await denySnapshotsWithoutAccess(req, res, externalId)) return;
    const days = Math.min(MAX_HISTORY_DAYS, Math.max(1, Number(req.query.days) || 90));
    const points = await getSubscriberHistory(platform as SnapshotPlatform, externalId, days);
    // Optional period of the analytics report: growth is counted the same way as on the dashboard.
    const from = typeof req.query.from === 'string' && DATE_KEY.test(req.query.from) ? req.query.from : null;
    const to = typeof req.query.to === 'string' && DATE_KEY.test(req.query.to) ? req.query.to : null;
    const current = req.query.current === undefined || req.query.current === '' ? null : Number(req.query.current);
    const periodGrowth = from && to
      ? snapshotGrowthForPeriod(points, from, to, snapshotDateKey(), Number.isFinite(current) ? current : null, points.find((point) => point.subscribers !== null)?.date ?? null)
      : null;
    res.json({ success: true, data: { platform, externalId, days, points, periodGrowth } });
  } catch (error) {
    next(error);
  }
});

snapshotsRouter.get('/posts', requireUser, async (req, res, next) => {
  try {
    const platform = req.query.platform;
    const rawId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    if (platform !== 'vk' && platform !== 'youtube' && platform !== 'telegram') {
      res.status(400).json({ success: false, error: 'INVALID_PLATFORM' });
      return;
    }
    const externalId = platform === 'telegram' ? telegramUsernameFromSource({ externalId: rawId }) : platform === 'vk' ? rawId.replace(/^-/, '') : rawId;
    if (!externalId) {
      res.status(400).json({ success: false, error: 'INVALID_SOURCE_ID' });
      return;
    }
    if (await denySnapshotsWithoutAccess(req, res, externalId)) return;
    const days = Math.min(MAX_POST_CURVE_DAYS, Math.max(7, Number(req.query.days) || 30));
    res.json({ success: true, data: await getPostViewCurves(platform, externalId, days) });
  } catch (error) {
    next(error);
  }
});

// Покрытие ночных срезов по дням: сколько источников ожидалось и сколько снято.
snapshotsRouter.get('/coverage', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(MAX_COVERAGE_DAYS, Math.max(1, Number(req.query.days) || 14));
    res.json({ success: true, data: await getSnapshotCoverage(days) });
  } catch (error) {
    next(error);
  }
});
