import { Router } from 'express';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getCommunityAnalytics } from '../services/analyticsService.js';

export const analyticsRouter = Router();

analyticsRouter.get('/community/:groupId', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const data = await getCommunityAnalytics(req.user!.id, req.params.groupId, req.query.period);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
