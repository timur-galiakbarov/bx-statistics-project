import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { isFeatureEnabledFor } from '../services/featureFlags.js';
import { connectBot, connectTelegramChannel, createPost, deleteChannel, deletePost, disconnectBot, getPlanMeta, listChannels, updatePost } from '../services/contentPlanService.js';
import { publishNow } from '../services/contentPlanPublisher.js';
import { connectVkGroup, listVkGroups } from '../services/vkContentPlanService.js';

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

contentPlanRouter.post('/bot/telegram', async (req, res, next) => {
  try {
    res.json({ success: true, data: await connectBot(req.user!.id, req.body?.token) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.delete('/bot/telegram', async (req, res, next) => {
  try {
    await disconnectBot(req.user!.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.get('/vk/groups', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listVkGroups(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.post('/channels/vk', async (req, res, next) => {
  try {
    res.json({ success: true, data: await connectVkGroup(req.user!.id, req.body?.groupId) });
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

contentPlanRouter.post('/posts', async (req, res, next) => {
  try {
    res.json({ success: true, data: await createPost(req.user!.id, req.body ?? {}) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.patch('/posts/:id', async (req, res, next) => {
  try {
    res.json({ success: true, data: await updatePost(req.user!.id, req.params.id, req.body ?? {}) });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.delete('/posts/:id', async (req, res, next) => {
  try {
    await deletePost(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

contentPlanRouter.post('/posts/:id/publish', async (req, res, next) => {
  try {
    res.json({ success: true, data: await publishNow(req.user!.id, req.params.id) });
  } catch (error) {
    next(error);
  }
});
