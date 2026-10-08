import type { Types } from 'mongoose';
import { ActivityEventModel } from '../models/ActivityEvent.js';
import { PaymentModel } from '../models/Payment.js';
import { PushDeliveryModel } from '../models/PushDelivery.js';
import { PushSubscriptionModel } from '../models/PushSubscription.js';
import { UserModel } from '../models/User.js';
import { mskDayStart } from './activityStatsService.js';

const DAY_MS = 86_400_000;
// Продление засчитывается напоминанию, если оплата пришла в течение недели после него.
const RENEWAL_WINDOW_MS = 7 * DAY_MS;
const reminderKinds = ['expiry_before', 'expiry_today', 'expiry_after'] as const;

export type AdminPushStats = {
  days: number;
  subscribedUsers: number;
  subscribedBrowsers: number;
  prompt: { shown: number; accepted: number; subscribed: number; dismissed: number; denied: number };
  reminders: Array<{ kind: string; sent: number; clicked: number; renewed: number; revenue: number }>;
};

/** Push subscriptions now, the soft-prompt funnel and reminder results for the period. Admins are excluded. */
export async function getAdminPushStats(requestedDays: unknown, now = new Date()): Promise<AdminPushStats> {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(7, Math.round(parsedDays))) : 30;
  const rangeStart = mskDayStart(now, -(days - 1));

  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const notAdmin = { $nin: adminIds };

  const [subscribedUsers, subscribedBrowsers, promptEvents, newSubscriptionUsers, deliveries] = await Promise.all([
    PushSubscriptionModel.distinct('userId', { userId: notAdmin }).then((ids) => ids.length),
    PushSubscriptionModel.countDocuments({ userId: notAdmin }),
    ActivityEventModel.aggregate<{ _id: string; users: number }>([
      { $match: { type: 'push_prompt', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: { label: '$label', userId: '$userId' } } },
      { $group: { _id: '$_id.label', users: { $sum: 1 } } }
    ]),
    PushSubscriptionModel.distinct('userId', { userId: notAdmin, createdAt: { $gte: rangeStart } }).then((ids) => ids.length),
    PushDeliveryModel.find({ createdAt: { $gte: rangeStart }, userId: notAdmin, delivered: { $gt: 0 } })
      .select({ userId: 1, kind: 1, createdAt: 1, clickedAt: 1 })
      .lean()
  ]);

  const promptUsers = new Map(promptEvents.map((row) => [row._id, row.users]));

  const payments = deliveries.length
    ? await PaymentModel.find({
        status: 'paid',
        amount: { $gt: 0 },
        userId: { $in: [...new Set(deliveries.map((delivery) => delivery.userId.toString()))] },
        paidAt: { $gte: rangeStart }
      }).select({ userId: 1, amount: 1, paidAt: 1 }).lean()
    : [];

  // Оплата засчитывается последнему напоминанию перед ней, чтобы не делить одну продажу на два пуша.
  const renewals = new Map<string, number>();
  for (const payment of payments) {
    const paidAt = payment.paidAt!.getTime();
    const delivery = deliveries
      .filter((item) =>
        item.userId.toString() === payment.userId.toString() &&
        item.createdAt.getTime() <= paidAt &&
        paidAt < item.createdAt.getTime() + RENEWAL_WINDOW_MS
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    if (delivery && !renewals.has(delivery._id.toString())) renewals.set(delivery._id.toString(), payment.amount);
  }

  const reminders = reminderKinds.map((kind) => {
    const rows = deliveries.filter((delivery) => delivery.kind === kind);
    const renewed = rows.filter((delivery) => renewals.has(delivery._id.toString()));
    return {
      kind,
      sent: rows.length,
      clicked: rows.filter((delivery) => delivery.clickedAt).length,
      renewed: renewed.length,
      revenue: renewed.reduce((sum, delivery) => sum + renewals.get(delivery._id.toString())!, 0)
    };
  });

  return {
    days,
    subscribedUsers,
    subscribedBrowsers,
    prompt: {
      shown: promptUsers.get('shown') ?? 0,
      accepted: promptUsers.get('accepted') ?? 0,
      subscribed: newSubscriptionUsers,
      dismissed: promptUsers.get('dismissed') ?? 0,
      denied: promptUsers.get('denied') ?? 0
    },
    reminders
  };
}
