import { Router } from 'express';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { resolveYoutubeChannel, searchYoutubeChannels } from '../services/youtubeClient.js';

export const youtubeRouter = Router();

youtubeRouter.get('/channels/search', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const items = await searchYoutubeChannels(query, req.query.refresh === '1');
    res.json({ success: true, data: { count: items.length, items } });
  } catch (error) {
    next(error);
  }
});

youtubeRouter.get('/channels/resolve', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ success: true, data: await resolveYoutubeChannel(query, req.query.refresh === '1') });
  } catch (error) {
    next(error);
  }
});
