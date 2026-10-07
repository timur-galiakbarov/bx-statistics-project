import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { requireActiveAccess } from '../middleware/access.js';
import { CompetitorSetModel } from '../models/CompetitorSet.js';
import { competitorGrowth, competitorKey, competitorPlatform, competitorSource, storedCompetitors, summarizeCompetitorReport, validateCompetitors } from '../services/competitorUtils.js';
import { getCommunitiesCompare } from '../services/compareService.js';
import { getSubscriberHistory } from '../services/snapshotService.js';
import { trackActivity } from '../services/activityTracking.js';

export const competitorsRouter = Router();
competitorsRouter.use(requireUser, requireActiveAccess);
// Все наборы пользователя с сохранённой сводкой — для виджета на главной, без живой загрузки аналитики.
competitorsRouter.get('/', async (req, res, next) => {
  try {
    const sets = await CompetitorSetModel.find({ userId: req.user!.id, 'competitors.0': { $exists: true } }).sort({ updatedAt: -1 }).limit(50).lean();
    res.json({ success: true, data: { sets: sets.map((set) => ({ platform: set.platform, externalId: set.externalId, sourceName: set.sourceName || set.externalId, competitorsCount: set.competitors.length, summary: set.summary ?? null })) } });
  } catch (error) { next(error); }
});
competitorsRouter.get('/:platform/:id', async (req, res, next) => {
  try {
    const platform = competitorPlatform(req.params.platform);
    const externalId = competitorSource(platform, req.params.id);
    const set = await CompetitorSetModel.findOne({ userId: req.user!.id, platform, externalId }).lean();
    res.json({ success: true, data: { competitors: set ? storedCompetitors(set) : [] } });
  } catch (error) { next(error); }
});
competitorsRouter.post('/:platform/:id', async (req, res, next) => {
  try {
    const platform = competitorPlatform(req.params.platform);
    const externalId = competitorSource(platform, req.params.id);
    const competitors = validateCompetitors(platform, externalId, req.body?.competitors);
    const sourceName = typeof req.body?.sourceName === 'string' ? req.body.sourceName.trim().slice(0, 160) : '';
    const filter = { userId: req.user!.id, platform, externalId };
    // Empty sets need no background collection. Existing snapshots are preserved.
    if (!competitors.length) await CompetitorSetModel.deleteOne(filter);
    else await CompetitorSetModel.findOneAndUpdate(filter, { $set: { competitors, ...(sourceName ? { sourceName } : {}) } }, { upsert: true, runValidators: true });
    trackActivity(req, 'competitors_saved', { platform, label: `${competitors.length} конк.` });
    res.json({ success: true, data: { competitors } });
  } catch (error) { next(error); }
});
competitorsRouter.get('/:platform/:id/report', async (req, res, next) => {
  try {
    const platform = competitorPlatform(req.params.platform);
    const externalId = competitorSource(platform, req.params.id);
    const set = await CompetitorSetModel.findOne({ userId: req.user!.id, platform, externalId }).lean();
    const ids = [competitorKey({ platform, externalId }), ...(set ? storedCompetitors(set).map(competitorKey) : [])];
    const period = req.query.period === 'week' ? 'week' : 'month';
    const report = await getCommunitiesCompare(req.user!.id, ids.join(','), period, platform);
    const items = await Promise.all(report.items.map(async (item) => {
      const points = await getSubscriberHistory(item.platform, item.groupId, 35);
      const growth = item.analytics ? competitorGrowth(points, item.analytics.period.dateFrom.slice(0, 10), item.analytics.group.membersCount) : { total: null, percent: null };
      return { ...item, growth, historySince: points.find((point) => point.subscribers !== null)?.date ?? null };
    }));
    // timestamps: false — сводка не должна поднимать набор наверх списка «последних изменённых».
    if (set && period === 'month') await CompetitorSetModel.updateOne({ _id: set._id }, { $set: { summary: summarizeCompetitorReport(items, platform, externalId, period) } }, { timestamps: false });
    res.json({ success: true, data: { items } });
  } catch (error) { next(error); }
});
