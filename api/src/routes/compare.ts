import { Router } from 'express';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getCommunitiesCompare } from '../services/compareService.js';
import { trackActivity } from '../services/activityTracking.js';

export const compareRouter = Router();

compareRouter.get('/', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const data = await getCommunitiesCompare(req.user!.id, req.query.sources ?? req.query.groupIds, req.query.period, req.query.platform);
    trackActivity(req, 'compare_run', { platform: typeof req.query.platform === 'string' ? req.query.platform : 'mixed' });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
