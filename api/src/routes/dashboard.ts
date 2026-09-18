import { Router } from 'express';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getDashboardSummary, getDashboardSummaryItem } from '../services/dashboardService.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary/groups/:savedGroupId', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const data = await getDashboardSummaryItem(req.user!.id, req.params.savedGroupId, req.query.period, req.query.refresh === '1');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/summary', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const data = await getDashboardSummary(req.user!.id, req.query.period, req.query.refresh === '1');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
