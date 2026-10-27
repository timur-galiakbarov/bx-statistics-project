import { Router } from 'express';
import { env } from '../config/env.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { isFeatureEnabledFor } from '../services/featureFlags.js';
import { snapshotDateKey } from '../services/snapshotUtils.js';
import { isVkMessagesConfigured, sendVkCommunityMessage, vkCommunityDialogUrl } from '../services/vkCommunityMessages.js';
import { getAdminVkReportStats } from '../services/vkReportStatsService.js';
import {
  buildWeeklyReport,
  checkVkNotifications,
  connectVkNotifications,
  disconnectVkNotifications,
  handleVkIncomingMessage
} from '../services/vkReports.js';

export const notificationsRouter = Router();

/** Состояние отчёта во VK для профиля и плашки. enabled — фича включена этому пользователю. */
export async function getNotificationSettings(user: { id: string; isAdmin: boolean }) {
  const [enabled, stored] = await Promise.all([
    isFeatureEnabledFor('vkReports', user),
    UserModel.findById(user.id, { notifications: 1 }).lean()
  ]);
  return {
    enabled: enabled && isVkMessagesConfigured(),
    vkConnected: stored?.notifications?.vk?.allowed === true,
    weeklyReport: stored?.notifications?.weeklyReport !== false,
    connectUrl: vkCommunityDialogUrl()
  };
}

notificationsRouter.get('/settings', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getNotificationSettings(req.user!) });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/settings', requireUser, async (req, res, next) => {
  if (typeof req.body?.weeklyReport !== 'boolean') {
    res.status(400).json({ success: false, error: 'INVALID_NOTIFICATION_SETTINGS' });
    return;
  }
  try {
    await UserModel.updateOne({ _id: req.user!.id }, { $set: { 'notifications.weeklyReport': req.body.weeklyReport } });
    res.json({ success: true, data: await getNotificationSettings(req.user!) });
  } catch (error) {
    next(error);
  }
});

// Человек написал сообществу или разрешил сообщения, а Callback API не дошёл: спрашиваем VK напрямую.
notificationsRouter.post('/vk/check', requireUser, async (req, res, next) => {
  if (!isVkMessagesConfigured() || !req.user!.vkId) {
    res.status(409).json({ success: false, error: 'VK_MESSAGES_UNAVAILABLE', message: 'Сообщения во VK сейчас не подключить.' });
    return;
  }
  try {
    await checkVkNotifications(req.user!.id, req.user!.vkId);
    res.json({ success: true, data: await getNotificationSettings(req.user!) });
  } catch (error) {
    next(error);
  }
});

// Callback API сообщества socstat. VK ждёт «ok» быстро, иначе повторяет событие, поэтому обработка — после ответа.
notificationsRouter.post('/vk/callback', (req, res) => {
  const body = req.body ?? {};
  if (String(body.group_id) !== env.socstatVkGroupId) {
    res.status(403).send('forbidden');
    return;
  }
  if (body.type === 'confirmation') {
    res.type('text/plain').send(env.vkCallbackConfirmation);
    return;
  }
  if (!env.vkCallbackSecret || body.secret !== env.vkCallbackSecret) {
    res.status(403).send('forbidden');
    return;
  }
  res.type('text/plain').send('ok');

  const object = body.object ?? {};
  const task = body.type === 'message_allow' && object.user_id
    ? connectVkNotifications(String(object.user_id))
    : body.type === 'message_deny' && object.user_id
      ? disconnectVkNotifications(String(object.user_id))
      : body.type === 'message_new' && Number(object.message?.from_id) > 0
        ? handleVkIncomingMessage(String(object.message.from_id), object.message.text)
        : null;
  task?.catch((error) => console.error(`VK callback ${body.type} failed`, error));
});

// Отчёт администратору за последние 7 дней: текст в ответе и сообщение во VK, если сообщения подключены.
notificationsRouter.post('/admin/test-weekly', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id, { _id: 1, vkId: 1, activeTo: 1, isAdmin: 1, enforceAccessRestrictions: 1, notifications: 1 }).lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      return;
    }
    const report = await buildWeeklyReport(user, snapshotDateKey());
    if (!report) {
      res.json({ success: true, data: { text: null, sent: false, reason: 'На дашборде нет источников со срезами.' } });
      return;
    }
    if (user.notifications?.vk?.allowed !== true || !user.vkId) {
      res.json({ success: true, data: { text: report.text, sent: false, reason: 'Сообщения сообщества у вас не подключены — подключите их в профиле.' } });
      return;
    }
    try {
      await sendVkCommunityMessage(user.vkId, report.text);
      res.json({ success: true, data: { text: report.text, sent: true } });
    } catch (error) {
      res.json({ success: true, data: { text: report.text, sent: false, reason: `VK не принял сообщение: ${(error as Error).message}` } });
    }
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get('/admin/stats', requireUser, requireAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getAdminVkReportStats(req.query.days) });
  } catch (error) {
    next(error);
  }
});
