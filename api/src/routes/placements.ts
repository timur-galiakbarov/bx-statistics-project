import { Router } from 'express';
import { DomainError } from '../errors/domainError.js';
import { hasActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { trackActivity } from '../services/activityTracking.js';
import { isFeatureEnabledFor } from '../services/featureFlags.js';
import { getPlacementUsage, runPlacementSearch, searchCities } from '../services/placementSearchService.js';
import { redis } from '../services/redis.js';
import { rememberViewedSource } from '../services/snapshotService.js';

export const placementsRouter = Router();

placementsRouter.use(requireUser);

// Rolled out with the «Подбор площадок» switch in the admin panel: off, admins only or everyone.
placementsRouter.use(async (req, res, next) => {
  try {
    if (await isFeatureEnabledFor('placements', req.user!)) return next();
    res.status(403).json({ success: false, error: 'FEATURE_OFF', message: 'Подбор площадок пока недоступен.' });
  } catch (error) { next(error); }
});

// Limits and caches live in Redis: without it searches would be unprotected.
placementsRouter.use((_req, res, next) => {
  if (redis.isReady) return next();
  res.status(503).json({ success: false, error: 'PLACEMENTS_UNAVAILABLE', message: 'Подбор площадок временно недоступен. Повторите позже.' });
});

placementsRouter.get('/usage', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getPlacementUsage(req.user!.id, hasActiveAccess(req.user)) });
  } catch (error) { next(error); }
});

placementsRouter.get('/cities', async (req, res, next) => {
  try {
    res.json({ success: true, data: await searchCities(req.user!.id, typeof req.query.q === 'string' ? req.query.q : '') });
  } catch (error) { next(error); }
});

placementsRouter.get('/search', async (req, res, next) => {
  try {
    const data = await runPlacementSearch({
      userId: req.user!.id,
      paid: hasActiveAccess(req.user),
      brief: req.query.brief,
      cityId: req.query.cityId,
      groupId: req.query.groupId
    });
    const task = data.ownGroup ? [data.ownGroup.name, data.brief].filter(Boolean).join(' · ') : data.brief;
    trackActivity(req, 'placement_search', { platform: 'vk', label: [data.city?.title ?? '', task, data.aiUsed ? 'ai' : 'rules', data.rows.length, data.ownGroup ? 'group' : 'text'].join('|') });
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof DomainError && error.code === 'PLACEMENT_LIMIT') trackActivity(req, 'placement_limit', { label: error.code });
    next(error);
  }
});

// «В подборку»: the community joins the nightly snapshots, so its history builds up from now on.
placementsRouter.post('/select', (req, res) => {
  const id = Number(req.body?.groupId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ success: false, error: 'INVALID_GROUP_ID' });
    return;
  }
  rememberViewedSource('vk', id, 'placement');
  trackActivity(req, 'placement_select', { platform: 'vk', label: String(id) });
  res.json({ success: true });
});
