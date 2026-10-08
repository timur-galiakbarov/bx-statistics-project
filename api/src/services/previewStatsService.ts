import type { Types } from 'mongoose';
import { ActivityEventModel } from '../models/ActivityEvent.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { mskDayStart } from './activityStatsService.js';

export type AdminPreviewStats = {
  days: number;
  viewers: number;
  views: number;
  unlockUsers: number;
  unlockTargets: Array<{ label: string; users: number }>;
  paidUsers: number;
  revenue: number;
};

/** Short VK report for users without access: who saw it, clicked a locked block and paid afterwards. Admins are excluded. */
export async function getAdminPreviewStats(requestedDays: unknown, now = new Date()): Promise<AdminPreviewStats> {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(7, Math.round(parsedDays))) : 30;
  const rangeStart = mskDayStart(now, -(days - 1));

  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const notAdmin = { $nin: adminIds };

  const [viewerRows, unlockRows] = await Promise.all([
    ActivityEventModel.aggregate<{ _id: Types.ObjectId; firstAt: Date; views: number }>([
      { $match: { type: 'analytics_preview', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: '$userId', firstAt: { $min: '$createdAt' }, views: { $sum: 1 } } }
    ]),
    ActivityEventModel.aggregate<{ _id: { label: string; userId: Types.ObjectId } }>([
      { $match: { type: 'preview_unlock', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: { label: '$label', userId: '$userId' } } }
    ])
  ]);

  const firstPreview = new Map(viewerRows.map((row) => [row._id.toString(), row.firstAt.getTime()]));
  const payments = viewerRows.length
    ? await PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, userId: { $in: viewerRows.map((row) => row._id) }, paidAt: { $gte: rangeStart } })
      .select({ userId: 1, amount: 1, paidAt: 1 })
      .lean()
    : [];
  // Засчитываем только оплаты после первого просмотра краткого отчёта.
  const paidAfterPreview = payments.filter((payment) => payment.paidAt!.getTime() >= firstPreview.get(payment.userId.toString())!);

  const targetUsers = new Map<string, number>();
  unlockRows.forEach((row) => targetUsers.set(row._id.label, (targetUsers.get(row._id.label) ?? 0) + 1));

  return {
    days,
    viewers: viewerRows.length,
    views: viewerRows.reduce((sum, row) => sum + row.views, 0),
    unlockUsers: new Set(unlockRows.map((row) => row._id.userId.toString())).size,
    unlockTargets: [...targetUsers.entries()].map(([label, users]) => ({ label, users })).sort((left, right) => right.users - left.users),
    paidUsers: new Set(paidAfterPreview.map((payment) => payment.userId.toString())).size,
    revenue: paidAfterPreview.reduce((sum, payment) => sum + payment.amount, 0)
  };
}
