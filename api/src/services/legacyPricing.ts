import type { Types } from 'mongoose';
import { PaymentModel } from '../models/Payment.js';
import { DAY_PLAN_PERIOD } from './dayPlan.js';

const paidPaymentFilter = { status: 'paid', amount: { $gt: 0 } };
const legacyPaymentFilter = { ...paidPaymentFilter, period: { $ne: DAY_PLAN_PERIOD } };

export async function hasLegacyPricing(userId: string | Types.ObjectId) {
  return Boolean(await PaymentModel.exists({ ...legacyPaymentFilter, userId }));
}

export async function getLegacyPricingUserIds(userIds: Array<string | Types.ObjectId>) {
  const paidUserIds = await PaymentModel.distinct('userId', { ...legacyPaymentFilter, userId: { $in: userIds } });
  return new Set(paidUserIds.map((userId) => userId.toString()));
}

export async function getPaidUserIds(userIds: Array<string | Types.ObjectId>) {
  const paidUserIds = await PaymentModel.distinct('userId', { ...paidPaymentFilter, userId: { $in: userIds } });
  return new Set(paidUserIds.map((userId) => userId.toString()));
}
