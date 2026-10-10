import { Router } from 'express';
import { hasActiveAccess, hasBonusCommunityAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { toAnalyticsPreview } from '../services/analyticsPreview.js';
import { getCommunityAnalytics } from '../services/analyticsService.js';
import { getAdminPreviewStats } from '../services/previewStatsService.js';
import { getSnapshotGrowth, rememberViewedSource } from '../services/snapshotService.js';
import { getYoutubeChannelAnalytics } from '../services/youtubeAnalyticsService.js';
import { trackActivity } from '../services/activityTracking.js';

export const analyticsRouter = Router();

// Без тарифа отчёт VK собирается только за неделю и без принудительного обновления — из кэша.
const PREVIEW_PERIOD = 'week';

analyticsRouter.get('/community/:groupId', requireUser, async (req, res, next) => {
  try {
    const isYoutube = req.query.platform === 'youtube';
    const hasFullAccess = hasActiveAccess(req.user) || await hasBonusCommunityAccess(req.user!, req.params.groupId);

    if (!hasFullAccess) {
      if (isYoutube) {
        res.status(402).json({ success: false, error: 'ACCESS_EXPIRED', message: 'Для анализа этого канала нужен активный тариф.' });
        return;
      }
      const data = await getCommunityAnalytics(req.user!.id, req.params.groupId, PREVIEW_PERIOD);
      // Без статистики VK прирост есть только в срезах Socstat — отдаём из них лишь направление.
      const snapshotGrowth = data.stats.unavailable
        ? await getSnapshotGrowth('vk', String(data.group.id), data.period.dateFrom, data.period.dateTo, data.group.membersCount).catch(() => null)
        : null;
      rememberViewedSource('vk', data.group.id);
      trackActivity(req, 'analytics_preview', { platform: 'vk' });
      res.json({ success: true, data: toAnalyticsPreview(data, snapshotGrowth) });
      return;
    }

    let data;
    if (isYoutube) {
      data = await getYoutubeChannelAnalytics(req.params.groupId, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
      rememberViewedSource('youtube', data.group.id);
    } else {
      const community = await getCommunityAnalytics(req.user!.id, req.params.groupId, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
      rememberViewedSource('vk', community.group.id);
      data = community;
    }
    if (req.query.refresh !== '1') trackActivity(req, 'analytics_view', { platform: isYoutube ? 'youtube' : 'vk' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get('/admin/preview-stats', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }
  try {
    res.json({ success: true, data: await getAdminPreviewStats(req.query.days) });
  } catch (error) {
    next(error);
  }
});
