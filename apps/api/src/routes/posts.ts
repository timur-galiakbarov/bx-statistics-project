import { Router } from 'express';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getPostsAnalysis } from '../services/postsService.js';

export const postsRouter = Router();

postsRouter.get('/analyze', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const data = await getPostsAnalysis(req.user!.id, req.query.groupIds, req.query.period);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
