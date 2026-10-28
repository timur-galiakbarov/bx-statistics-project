import { Router } from 'express';
import { getUserReportPassState, hasActiveAccess, hasBonusCommunityAccess, hasReportPassAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { toAnalyticsPreview } from '../services/analyticsPreview.js';
import { getCommunityAnalytics } from '../services/analyticsService.js';
import { getAdminPreviewStats } from '../services/previewStatsService.js';
import { activateReportPass, getReportPassState } from '../services/reportPass.js';
import { getSnapshotGrowth, rememberViewedSource } from '../services/snapshotService.js';
import { getYoutubeChannelAnalytics } from '../services/youtubeAnalyticsService.js';
import { trackActivity } from '../services/activityTracking.js';
import { UserModel } from '../models/User.js';

export const analyticsRouter = Router();

// Без тарифа отчёт VK собирается только за неделю и без принудительного обновления — из кэша.
const PREVIEW_PERIOD = 'week';

analyticsRouter.get('/community/:groupId', requireUser, async (req, res, next) => {
  try {
    const isYoutube = req.query.platform === 'youtube';
    const isPaidAccess = hasActiveAccess(req.user) || await hasBonusCommunityAccess(req.user!, req.params.groupId);
    const isPassAccess = !isPaidAccess && hasReportPassAccess(req.user, isYoutube ? 'youtube' : 'vk', req.params.groupId);
    const hasFullAccess = isPaidAccess || isPassAccess;

    if (!hasFullAccess) {
      if (isYoutube) {
        res.status(402).json({ success: false, error: 'ACCESS_EXPIRED', message: 'Для анализа этого канала нужен активный тариф.' });
        return;
      }
      const data = await getCommunityAnalytics(req.user!.id, req.params.groupId, PREVIEW_PERIOD);
      // Без статистики VK прирост есть только в срезах Socstat — отдаём из них лишь направление.
      const snapshotGrowth = data.stats.unavailable
        ? await getSnapshotGrowth('vk', String(data.group.id), data.period.dateFrom, data.period.dateTo, data.group.membersCount).catch(() => null)
        : null;
      rememberViewedSource('vk', data.group.id);
      trackActivity(req, 'analytics_preview', { platform: 'vk' });
      res.json({ success: true, data: toAnalyticsPreview(data, snapshotGrowth) });
      return;
    }

    let data;
    if (isYoutube) {
      data = await getYoutubeChannelAnalytics(req.params.groupId, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
      rememberViewedSource('youtube', data.group.id);
    } else {
      const community = await getCommunityAnalytics(req.user!.id, req.params.groupId, req.query.period, req.query.dateFrom, req.query.dateTo, req.query.refresh === '1');
      rememberViewedSource('vk', community.group.id);
      data = community;
    }
    if (req.query.refresh !== '1') trackActivity(req, 'analytics_view', { platform: isYoutube ? 'youtube' : 'vk', label: isPassAccess ? 'pass' : undefined });
    const passState = isPassAccess ? getUserReportPassState(req.user!) : null;
    // Пропуск могли включить со страницы, открытой по ссылке, когда название источника ещё не было известно.
    if (isPassAccess && data.group.name && req.user!.reportPass?.sourceName !== data.group.name) {
      void UserModel.updateOne({ _id: req.user!.id, 'reportPass.usedAt': new Date(req.user!.reportPass!.usedAt) }, { $set: { 'reportPass.sourceName': data.group.name.slice(0, 160) } })
        .catch((error) => console.error('Failed to update report pass name', error));
    }
    res.json({ success: true, data: passState?.status === 'active' ? { ...data, reportPass: { expiresAt: passState.expiresAt } } : data });
  } catch (error) {
    next(error);
  }
});

// Бесплатный полный отчёт без доступа: один источник VK или YouTube на 24 часа раз в 30 дней.
analyticsRouter.post('/report-pass', requireUser, async (req, res, next) => {
  try {
    const platform = req.body?.platform;
    const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId.trim() : '';
    const sourceName = typeof req.body?.sourceName === 'string' ? req.body.sourceName : '';
    if ((platform !== 'vk' && platform !== 'youtube') || !sourceId || sourceId.length > 64) {
      res.status(400).json({ success: false, error: 'INVALID_REPORT_PASS' });
      return;
    }
    if (hasActiveAccess(req.user)) {
      res.status(409).json({ success: false, error: 'ACCESS_ACTIVE', message: 'Доступ уже активен, пропуск не нужен.' });
      return;
    }
    const now = new Date();
    if (!await activateReportPass(req.user!.id, platform, sourceId, sourceName, now)) {
      res.status(409).json({ success: false, error: 'REPORT_PASS_UNAVAILABLE', message: 'Бесплатный полный отчёт уже использован.', data: getReportPassState(req.user!.reportPass) });
      return;
    }
    trackActivity(req, 'report_pass_used', { platform, label: sourceId });
    res.json({ success: true, data: getReportPassState({ platform, sourceId: sourceId.replace(/^-/, ''), sourceName, usedAt: now.toISOString() }, now.getTime()) });
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get('/admin/preview-stats', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }
  try {
    res.json({ success: true, data: await getAdminPreviewStats(req.query.days) });
  } catch (error) {
    next(error);
  }
});
