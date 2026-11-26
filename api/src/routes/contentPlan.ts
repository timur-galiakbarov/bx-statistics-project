import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { isFeatureEnabledFor } from '../services/featureFlags.js';

/**
 * Контент-план: календарь публикаций. Пока этап 0 — каркас и проверка доступа.
 * Календарь, каналы и публикация появятся в следующих этапах.
 */
export const contentPlanRouter = Router();

contentPlanRouter.use(requireUser);

contentPlanRouter.use(async (req, res, next) => {
  try {
    if (!(await isFeatureEnabledFor('contentPlan', req.user!))) {
      res.status(403).json({ success: false, error: 'FEATURE_OFF', message: 'Контент-план пока недоступен.' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      channels: [],
      posts: [],
      serverTime: new Date().toISOString()
    }
  });
});
