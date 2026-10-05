import { Router } from 'express';
import { requireCommunityAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getCommunityAnalytics } from '../services/analyticsService.js';
import { getYoutubeChannelAnalytics } from '../services/youtubeAnalyticsService.js';
import { trackActivity } from '../services/activityTracking.js';

export const analyticsRouter = Router();

analyticsRouter.get('/community/:groupId', requireUser, requireCommunityAccess, async (req, res, next) => {
  try {
    const data = req.query.platform === 'youtube'
      ? await getYoutubeChannelAnalytics(req.params.groupId, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1')
      : await getCommunityAnalytics(req.user!.id, req.params.groupId, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
    if (req.query.refresh !== '1') trackActivity(req, 'analytics_view', { platform: req.query.platform === 'youtube' ? 'youtube' : 'vk' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
