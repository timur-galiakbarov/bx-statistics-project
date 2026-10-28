import { Router } from 'express';
import { DomainError } from '../errors/domainError.js';
import { hasActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { trackActivity } from '../services/activityTracking.js';
import { isFeatureEnabledFor } from '../services/featureFlags.js';
import { getPlacementUsage, runPlacementSearch, searchCities } from '../services/placementSearchService.js';
import { addToShortlist, getShortlist, removeFromShortlist, updateShortlistItem } from '../services/placementShortlistService.js';
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

// The shortlist lives in MongoDB and works without Redis. Adding a community also puts it into the nightly snapshots.
placementsRouter.get('/shortlist', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getShortlist(req.user!.id) });
  } catch (error) { next(error); }
});

placementsRouter.post('/shortlist', async (req, res, next) => {
  try {
    const { item, created } = await addToShortlist(req.user!.id, req.body);
    rememberViewedSource('vk', item.groupId, 'placement');
    if (created) trackActivity(req, 'placement_select', { platform: 'vk', label: String(item.groupId) });
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
});

placementsRouter.patch('/shortlist/:groupId', async (req, res, next) => {
  try {
    const { item, patch } = await updateShortlistItem(req.user!.id, Number(req.params.groupId), req.body);
    if (patch.status) trackActivity(req, 'placement_status', { platform: 'vk', label: patch.status });
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
});

placementsRouter.delete('/shortlist/:groupId', async (req, res, next) => {
  try {
    await removeFromShortlist(req.user!.id, Number(req.params.groupId));
    res.json({ success: true });
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
