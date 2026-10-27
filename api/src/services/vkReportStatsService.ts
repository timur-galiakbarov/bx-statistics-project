import type { Types } from 'mongoose';
import { ActivityEventModel } from '../models/ActivityEvent.js';
import { NotificationDeliveryModel } from '../models/NotificationDelivery.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { mskDayStart } from './activityStatsService.js';
import { getFeatureMode, type FeatureMode } from './featureFlags.js';
import { isVkMessagesConfigured } from './vkCommunityMessages.js';
import { WEEKLY_REPORT_KIND } from './vkReports.js';

const DAY_MS = 86_400_000;
// Клик и оплата засчитываются отчёту, если были в течение недели после него.
const ATTRIBUTION_WINDOW_MS = 7 * DAY_MS;

export type AdminVkReportStats = {
  days: number;
  mode: FeatureMode;
  configured: boolean;
  connectedUsers: number;
  weeklyEnabledUsers: number;
  /** Нажали «Подключить» за период по месту; connected — из них сейчас подключены. */
  connectPlaces: Array<{ place: string; users: number; connected: number }>;
  reports: { sent: number; full: number; locked: number; failed: number; clicked: number; paid: number; revenue: number };
};

/** Подключения к сообщениям сообщества и результаты еженедельного отчёта за период. Админы исключены. */
export async function getAdminVkReportStats(requestedDays: unknown, now = new Date()): Promise<AdminVkReportStats> {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(7, Math.round(parsedDays))) : 30;
  const rangeStart = mskDayStart(now, -(days - 1));

  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const notAdmin = { $nin: adminIds };

  const [mode, connectedUsers, weeklyEnabledUsers, deliveries, connectClicks] = await Promise.all([
    getFeatureMode('vkReports'),
    UserModel.countDocuments({ _id: notAdmin, 'notifications.vk.allowed': true }),
    UserModel.countDocuments({ _id: notAdmin, 'notifications.vk.allowed': true, 'notifications.weeklyReport': { $ne: false } }),
    NotificationDeliveryModel.find({ kind: WEEKLY_REPORT_KIND, createdAt: { $gte: rangeStart }, userId: notAdmin })
      .select({ userId: 1, variant: 1, status: 1, sentAt: 1 })
      .lean(),
    ActivityEventModel.aggregate<{ _id: string; userIds: Types.ObjectId[] }>([
      { $match: { type: 'vk_report_connect', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: '$label', userIds: { $addToSet: '$userId' } } }
    ])
  ]);

  const clickedUserIds = [...new Set(connectClicks.flatMap((row) => row.userIds.map(String)))];
  const connectedClickers = new Set(
    clickedUserIds.length
      ? (await UserModel.distinct('_id', { _id: { $in: clickedUserIds }, 'notifications.vk.allowed': true })).map(String)
      : []
  );
  const connectPlaces = ['banner', 'dashboard', 'competitors', 'profile'].map((place) => {
    const userIds = connectClicks.find((row) => row._id === place)?.userIds.map(String) ?? [];
    return { place, users: userIds.length, connected: userIds.filter((id) => connectedClickers.has(id)).length };
  });

  const sent = deliveries.filter((delivery) => delivery.status === 'sent' && delivery.sentAt);
  const userIds = [...new Set(sent.map((delivery) => delivery.userId.toString()))];

  const [returns, payments] = userIds.length
    ? await Promise.all([
        ActivityEventModel.find({ type: 'ad_return', userId: { $in: userIds }, label: /^vk_msg/, createdAt: { $gte: rangeStart } })
          .select({ userId: 1, createdAt: 1 })
          .lean(),
        PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, userId: { $in: userIds }, paidAt: { $gte: rangeStart } })
          .select({ userId: 1, amount: 1, paidAt: 1 })
          .lean()
      ])
    : [[], []];

  // Событие засчитывается последнему отчёту перед ним, чтобы не делить одну оплату на два отчёта.
  const lastReportBefore = (userId: string, at: Date) => sent
    .filter((delivery) =>
      delivery.userId.toString() === userId &&
      delivery.sentAt!.getTime() <= at.getTime() &&
      at.getTime() < delivery.sentAt!.getTime() + ATTRIBUTION_WINDOW_MS
    )
    .sort((left, right) => right.sentAt!.getTime() - left.sentAt!.getTime())[0];

  const clicked = new Set<string>();
  for (const event of returns) {
    const delivery = lastReportBefore(event.userId.toString(), event.createdAt);
    if (delivery) clicked.add(delivery._id.toString());
  }
  const paid = new Map<string, number>();
  for (const payment of payments) {
    const delivery = lastReportBefore(payment.userId.toString(), payment.paidAt!);
    if (delivery && !paid.has(delivery._id.toString())) paid.set(delivery._id.toString(), payment.amount);
  }

  return {
    days,
    mode,
    configured: isVkMessagesConfigured(),
    connectedUsers,
    weeklyEnabledUsers,
    connectPlaces,
    reports: {
      sent: sent.length,
      full: sent.filter((delivery) => delivery.variant === 'full').length,
      locked: sent.filter((delivery) => delivery.variant === 'locked').length,
      failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
      clicked: clicked.size,
      paid: paid.size,
      revenue: [...paid.values()].reduce((sum, amount) => sum + amount, 0)
    }
  };
}
