import { Router } from 'express';
import { hasActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getDashboardSummary, getDashboardSummaryItem } from '../services/dashboardService.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary/groups/:savedGroupId', requireUser, async (req, res, next) => {
  try {
    const data = await getDashboardSummaryItem(
      req.user!.id,
      req.params.savedGroupId,
      req.query.period,
      req.query.refresh === '1',
      hasActiveAccess(req.user),
      req.query.dateFrom,
      req.query.dateTo
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/summary', requireUser, async (req, res, next) => {
  try {
    const data = await getDashboardSummary(
      req.user!.id,
      req.query.period,
      req.query.refresh === '1',
      hasActiveAccess(req.user),
      req.query.dateFrom,
      req.query.dateTo
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
