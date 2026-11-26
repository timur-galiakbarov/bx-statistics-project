import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { isFeatureEnabledFor } from '../services/featureFlags.js';
import { connectTelegramChannel, deleteChannel, getPlanMeta, listChannels } from '../services/contentPlanService.js';

/**
 * Контент-план: календарь публикаций. Этап 1 — подключение Telegram-каналов
 * и каркас календаря. Публикация появится на следующем этапе.
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

contentPlanRouter.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await getPlanMeta(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.get('/channels', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listChannels(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.post('/channels/telegram', async (req, res, next) => {
  try {
    const ref = req.body && typeof req.body.ref === 'string' ? req.body.ref : '';
    res.json({ success: true, data: await connectTelegramChannel(req.user!.id, ref) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.delete('/channels/:id', async (req, res, next) => {
  try {
    await deleteChannel(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
