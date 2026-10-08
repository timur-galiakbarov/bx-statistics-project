import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { resolveYoutubeChannel, searchYoutubeChannels } from '../services/youtubeClient.js';
import { trackActivity } from '../services/activityTracking.js';

export const youtubeRouter = Router();

// Поиск открыт и без тарифа: добавленные каналы попадают в ночные срезы и пополняют базу Socstat.

youtubeRouter.get('/channels/search', requireUser, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const items = await searchYoutubeChannels(query, req.query.refresh === '1');
    trackActivity(req, 'source_search', { platform: 'youtube', label: query });
    res.json({ success: true, data: { count: items.length, items } });
  } catch (error) {
    next(error);
  }
});

youtubeRouter.get('/channels/resolve', requireUser, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ success: true, data: await resolveYoutubeChannel(query, req.query.refresh === '1') });
  } catch (error) {
    next(error);
  }
});
