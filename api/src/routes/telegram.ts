import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { requireActiveAccess } from '../middleware/access.js';
import { getTelegramChannelAnalytics, getTelegramChannelPhoto, getTelegramPostMedia, resolveTelegramChannel } from '../services/telegramClient.js';
import { limitTelegramMediaRequests, limitTelegramRefresh, limitTelegramRequests } from '../middleware/telegramProtection.js';

export const telegramRouter = Router();

telegramRouter.use(requireUser, limitTelegramRequests);

telegramRouter.get('/channels/resolve', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ success: true, data: await resolveTelegramChannel(query, req.query.refresh === '1') });
  } catch (error) { next(error); }
});

telegramRouter.get('/channels/:username/photo', async (req, res, next) => {
  try {
    const photo = await getTelegramChannelPhoto(req.params.username, req.query.refresh === '1');
    if (!photo) {
      res.status(404).end();
      return;
    }
    res.set({
      'Cache-Control': 'private, max-age=3600',
      'Content-Type': 'image/jpeg'
    });
    res.send(photo);
  } catch (error) { next(error); }
});

telegramRouter.get('/channels/:username/posts/:postId/media', requireActiveAccess, limitTelegramMediaRequests, async (req, res, next) => {
  try {
    const media = await getTelegramPostMedia(req.params.username, req.params.postId, req.query.refresh === '1');
    if (!media) {
      res.status(404).end();
      return;
    }
    res.set({
      'Cache-Control': 'private, max-age=3600',
      'Content-Type': media.contentType
    });
    res.send(media.data);
  } catch (error) { next(error); }
});

telegramRouter.get('/channels/:username/analytics', requireActiveAccess, limitTelegramRefresh, async (req, res, next) => {
  try {
    const data = await getTelegramChannelAnalytics(req.params.username, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
