import type { Types } from 'mongoose';
import { ActivityEventModel } from '../models/ActivityEvent.js';
import { UserModel } from '../models/User.js';
import { DAY_PLAN_DURATION_MS } from './dayPlan.js';

export async function getAdminDayPlanOfferStats(now = new Date()) {
  const days = 30;
  const since = new Date(now.getTime() - days * DAY_PLAN_DURATION_MS);
  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const [totals] = await ActivityEventModel.aggregate<{ users: number; impressions: number }>([
    {
      $match: {
        type: 'day_plan_offer_shown',
        createdAt: { $gte: since, $lte: now },
        userId: { $nin: adminIds }
      }
    },
    { $group: { _id: '$userId', impressions: { $sum: 1 } } },
    { $group: { _id: null, users: { $sum: 1 }, impressions: { $sum: '$impressions' } } }
  ]);

  return { days, users: totals?.users ?? 0, impressions: totals?.impressions ?? 0 };
}
