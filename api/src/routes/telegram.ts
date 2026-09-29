import { Router } from 'express';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { getTelegramChannelAnalytics, resolveTelegramChannel } from '../services/telegramClient.js';

export const telegramRouter = Router();

telegramRouter.get('/channels/resolve', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ success: true, data: await resolveTelegramChannel(query, req.query.refresh === '1') });
  } catch (error) { next(error); }
});

telegramRouter.get('/channels/:username/analytics', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const data = await getTelegramChannelAnalytics(req.params.username, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
