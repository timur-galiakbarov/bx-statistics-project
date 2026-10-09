import { PaymentModel } from '../models/Payment.js';

/**
 * До 2026-10-09 подтверждение платежа не записывало paidAt, и статистика админки не видела эти оплаты.
 * Время подтверждения совпадает с последним сохранением платежа, поэтому берём updatedAt. Повторный запуск ничего не меняет.
 */
export async function backfillPaymentPaidAt() {
  const result = await PaymentModel.updateMany({ status: 'paid', paidAt: null }, [{ $set: { paidAt: '$updatedAt' } }], { updatePipeline: true, timestamps: false });
  if (result.modifiedCount) console.log(`Backfilled paidAt for ${result.modifiedCount} payments`);
}
