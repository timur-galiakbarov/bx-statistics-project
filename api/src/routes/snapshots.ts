import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { getSubscriberHistory, type SnapshotPlatform } from '../services/snapshotService.js';
import { telegramUsernameFromSource } from '../services/snapshotUtils.js';

export const snapshotsRouter = Router();

const MAX_HISTORY_DAYS = 365;

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
    const days = Math.min(MAX_HISTORY_DAYS, Math.max(1, Number(req.query.days) || 90));
    const points = await getSubscriberHistory(platform as SnapshotPlatform, externalId, days);
    res.json({ success: true, data: { platform, externalId, days, points } });
  } catch (error) {
    next(error);
  }
});
