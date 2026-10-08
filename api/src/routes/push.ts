import { Router } from 'express';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { requireUser } from '../middleware/auth.js';
import { PushDeliveryModel } from '../models/PushDelivery.js';
import { PushSubscriptionModel } from '../models/PushSubscription.js';
import { VisitModel } from '../models/Visit.js';
import { parseVisitId, trackActivity } from '../services/activityTracking.js';
import { isPushConfigured, sendPushToUser } from '../services/pushReminders.js';
import { getAdminPushStats } from '../services/pushStatsService.js';

export const pushRouter = Router();

const promptLabels = ['shown', 'accepted', 'dismissed', 'denied'];

function parseSubscription(body: any) {
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000) return null;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/**
 * Whether the user has been here before the current visit. Visits are kept for 400 days, so
 * old accounts without visit records count as returning by the account creation time.
 */
async function isReturningVisit(userId: string, currentVisitId?: string) {
  if (new Types.ObjectId(userId).getTimestamp().getTime() < Date.now() - 400 * 86_400_000) return true;
  return Boolean(await VisitModel.exists({ userId, ...(currentVisitId ? { visitId: { $ne: currentVisitId } } : {}) }));
}

pushRouter.get('/config', requireUser, async (req, res, next) => {
  try {
    const [subscriptions, returningVisit] = await Promise.all([
      PushSubscriptionModel.countDocuments({ userId: req.user!.id }),
      isReturningVisit(req.user!.id, parseVisitId(req.header('x-socstat-visit')))
    ]);
    res.json({
      success: true,
      data: { enabled: isPushConfigured(), publicKey: env.vapidPublicKey || null, subscriptions, returningVisit }
    });
  } catch (error) {
    next(error);
  }
});

pushRouter.post('/subscribe', requireUser, async (req, res, next) => {
  const subscription = parseSubscription(req.body);
  if (!subscription) {
    res.status(400).json({ success: false, error: 'INVALID_PUSH_SUBSCRIPTION' });
    return;
  }
  try {
    // Браузер мог перейти к другому пользователю на том же компьютере — endpoint переезжает к текущему.
    await PushSubscriptionModel.updateOne(
      { endpoint: subscription.endpoint },
      { $set: { userId: req.user!.id, keys: subscription.keys, userAgent: req.header('user-agent')?.slice(0, 300) } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

pushRouter.post('/unsubscribe', requireUser, async (req, res, next) => {
  const endpoint = req.body?.endpoint;
  try {
    await PushSubscriptionModel.deleteMany(
      typeof endpoint === 'string' ? { userId: req.user!.id, endpoint } : { userId: req.user!.id }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Реакция на мягкий запрос разрешения: сколько раз показали, согласились, отказались.
pushRouter.post('/prompt', requireUser, (req, res) => {
  const label = req.body?.label;
  if (!promptLabels.includes(label)) {
    res.status(400).json({ success: false, error: 'INVALID_PUSH_PROMPT_EVENT' });
    return;
  }
  trackActivity(req, 'push_prompt', { label });
  res.json({ success: true });
});

// Клик по уведомлению приходит из service worker с cookie сессии.
pushRouter.post('/click', requireUser, async (req, res, next) => {
  const deliveryId = req.body?.deliveryId;
  try {
    if (typeof deliveryId === 'string' && Types.ObjectId.isValid(deliveryId)) {
      const delivery = await PushDeliveryModel.findOneAndUpdate(
        { _id: deliveryId, userId: req.user!.id, clickedAt: { $exists: false } },
        { $set: { clickedAt: new Date() } }
      ).lean();
      if (delivery) trackActivity({ userId: req.user!.id }, 'push_click', { label: delivery.kind });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

pushRouter.post('/test', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }
  try {
    const delivered = await sendPushToUser(req.user!.id, {
      title: 'Проверка уведомлений socstat',
      body: 'Если вы это видите, уведомления работают.',
      url: '/app/account'
    });
    res.json({ success: true, data: { delivered } });
  } catch (error) {
    next(error);
  }
});

pushRouter.get('/admin/stats', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }
  try {
    res.json({ success: true, data: await getAdminPushStats(req.query.days) });
  } catch (error) {
    next(error);
  }
});
