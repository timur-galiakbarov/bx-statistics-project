import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { getDashboardSummary } from '../services/dashboardService.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', requireUser, async (req, res, next) => {
  try {
    const data = await getDashboardSummary(req.user!.id, req.query.period);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
