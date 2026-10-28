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
  /** Включили бесплатный полный отчёт и оплатили после этого. */
  passUsers: number;
  passPaidUsers: number;
  passRevenue: number;
  /** Видели заглушку «доступ закончился» на YouTube и в Telegram. */
  lockViewers: Array<{ platform: 'youtube' | 'telegram'; users: number }>;
};

/** Short VK report for users without access: who saw it, clicked a locked block and paid afterwards. Admins are excluded. */
export async function getAdminPreviewStats(requestedDays: unknown, now = new Date()): Promise<AdminPreviewStats> {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(7, Math.round(parsedDays))) : 30;
  const rangeStart = mskDayStart(now, -(days - 1));

  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const notAdmin = { $nin: adminIds };

  const [viewerRows, unlockRows, passRows, lockRows] = await Promise.all([
    ActivityEventModel.aggregate<{ _id: Types.ObjectId; firstAt: Date; views: number }>([
      { $match: { type: 'analytics_preview', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: '$userId', firstAt: { $min: '$createdAt' }, views: { $sum: 1 } } }
    ]),
    ActivityEventModel.aggregate<{ _id: { label: string; userId: Types.ObjectId } }>([
      { $match: { type: 'preview_unlock', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: { label: '$label', userId: '$userId' } } }
    ]),
    ActivityEventModel.aggregate<{ _id: Types.ObjectId; firstAt: Date }>([
      { $match: { type: 'report_pass_used', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: '$userId', firstAt: { $min: '$createdAt' } } }
    ]),
    ActivityEventModel.aggregate<{ _id: { label: string; userId: Types.ObjectId } }>([
      { $match: { type: 'access_lock', createdAt: { $gte: rangeStart }, userId: notAdmin } },
      { $group: { _id: { label: '$label', userId: '$userId' } } }
    ])
  ]);

  const firstPreview = new Map(viewerRows.map((row) => [row._id.toString(), row.firstAt.getTime()]));
  const firstPass = new Map(passRows.map((row) => [row._id.toString(), row.firstAt.getTime()]));
  const payerIds = [...new Set([...firstPreview.keys(), ...firstPass.keys()])];
  const payments = payerIds.length
    ? await PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, userId: { $in: payerIds }, paidAt: { $gte: rangeStart } })
      .select({ userId: 1, amount: 1, paidAt: 1 })
      .lean()
    : [];
  // Засчитываем только оплаты после первого просмотра краткого отчёта или включения пропуска.
  const paidAfter = (first: Map<string, number>) => payments.filter((payment) => {
    const firstAt = first.get(payment.userId.toString());
    return firstAt !== undefined && payment.paidAt!.getTime() >= firstAt;
  });
  const paidAfterPreview = paidAfter(firstPreview);
  const paidAfterPass = paidAfter(firstPass);

  const targetUsers = new Map<string, number>();
  unlockRows.forEach((row) => targetUsers.set(row._id.label, (targetUsers.get(row._id.label) ?? 0) + 1));

  return {
    days,
    viewers: viewerRows.length,
    views: viewerRows.reduce((sum, row) => sum + row.views, 0),
    unlockUsers: new Set(unlockRows.map((row) => row._id.userId.toString())).size,
    unlockTargets: [...targetUsers.entries()].map(([label, users]) => ({ label, users })).sort((left, right) => right.users - left.users),
    paidUsers: new Set(paidAfterPreview.map((payment) => payment.userId.toString())).size,
    revenue: paidAfterPreview.reduce((sum, payment) => sum + payment.amount, 0),
    passUsers: passRows.length,
    passPaidUsers: new Set(paidAfterPass.map((payment) => payment.userId.toString())).size,
    passRevenue: paidAfterPass.reduce((sum, payment) => sum + payment.amount, 0),
    lockViewers: (['youtube', 'telegram'] as const).map((platform) => ({ platform, users: lockRows.filter((row) => row._id.label === platform).length }))
  };
}
