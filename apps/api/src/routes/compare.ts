import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { getCommunitiesCompare } from '../services/compareService.js';

export const compareRouter = Router();

compareRouter.get('/', requireUser, async (req, res, next) => {
  try {
    const data = await getCommunitiesCompare(req.user!.id, req.query.groupIds, req.query.period);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
