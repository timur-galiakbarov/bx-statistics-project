import { Router } from 'express';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getMixedPostsAnalysis, getPostsAnalysis } from '../services/postsService.js';
import { limitTelegramRequests, requireTelegramProtectionStorage } from '../middleware/telegramProtection.js';

export const postsRouter = Router();

function includesTelegram(req: { query: { platform?: unknown; sources?: unknown } }) {
  return req.query.platform === 'telegram' || (typeof req.query.sources === 'string' && req.query.sources.split(',').some((source) => source.startsWith('telegram:')));
}

postsRouter.get(
  '/analyze',
  requireUser,
  requireActiveAccess,
  (req, res, next) => includesTelegram(req) ? requireTelegramProtectionStorage(req, res, next) : next(),
  (req, res, next) => includesTelegram(req) ? limitTelegramRequests(req, res, next) : next(),
  async (req, res, next) => {
    try {
      const data = typeof req.query.sources === 'string'
        ? await getMixedPostsAnalysis(req.user!.id, req.query.sources, req.query.period)
        : await getPostsAnalysis(req.user!.id, req.query.groupIds, req.query.period, req.query.platform);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
