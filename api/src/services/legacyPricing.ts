import type { Types } from 'mongoose';
import { PaymentModel } from '../models/Payment.js';

// Кто хотя бы раз успешно оплатил, сохраняет старую тарифную сетку.
const paidPaymentFilter = { status: 'paid', amount: { $gt: 0 } };

export async function hasLegacyPricing(userId: string | Types.ObjectId) {
  return Boolean(await PaymentModel.exists({ ...paidPaymentFilter, userId }));
}

export async function getLegacyPricingUserIds(userIds: Array<string | Types.ObjectId>) {
  const paidUserIds = await PaymentModel.distinct('userId', { ...paidPaymentFilter, userId: { $in: userIds } });
  return new Set(paidUserIds.map((userId) => userId.toString()));
}
