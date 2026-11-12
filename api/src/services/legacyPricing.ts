import type { Types } from 'mongoose';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { DAY_PLAN_PERIOD } from './dayPlan.js';

const priceIncreaseAt = new Date('2026-10-08T00:00:00+03:00');
const legacyRegistrationFilter = { createdAt: { $lt: priceIncreaseAt } };
const paidPaymentFilter = { status: 'paid', amount: { $gt: 0 } };
const legacyPaymentFilter = { ...paidPaymentFilter, period: { $ne: DAY_PLAN_PERIOD } };

export async function hasLegacyPricing(userId: string | Types.ObjectId) {
  const registeredBeforeIncrease = await UserModel.exists({ ...legacyRegistrationFilter, _id: userId });
  if (!registeredBeforeIncrease) return false;

  return Boolean(await PaymentModel.exists({ ...legacyPaymentFilter, userId }));
}

export async function getLegacyPricingUserIds(userIds: Array<string | Types.ObjectId>) {
  const eligibleUsers = await UserModel.find({ ...legacyRegistrationFilter, _id: { $in: userIds } }, { _id: 1 }).lean();
  if (!eligibleUsers.length) return new Set<string>();

  const paidUserIds = await PaymentModel.distinct('userId', {
    ...legacyPaymentFilter,
    userId: { $in: eligibleUsers.map((user) => user._id) }
  });
  return new Set(paidUserIds.map((userId) => userId.toString()));
}

export async function getPaidUserIds(userIds: Array<string | Types.ObjectId>) {
  const paidUserIds = await PaymentModel.distinct('userId', { ...paidPaymentFilter, userId: { $in: userIds } });
  return new Set(paidUserIds.map((userId) => userId.toString()));
}
