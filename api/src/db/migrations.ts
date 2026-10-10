import { PaymentModel } from '../models/Payment.js';
import { SnapshotSourceModel } from '../models/SnapshotSource.js';
import { TelegramPeerModel } from '../models/TelegramPeer.js';

/**
 * До 2026-10-09 подтверждение платежа не записывало paidAt, и статистика админки не видела эти оплаты.
 * Время подтверждения совпадает с последним сохранением платежа, поэтому берём updatedAt. Повторный запуск ничего не меняет.
 */
export async function backfillPaymentPaidAt() {
  const result = await PaymentModel.updateMany({ status: 'paid', paidAt: null }, [{ $set: { paidAt: '$updatedAt' } }], { updatePipeline: true, timestamps: false });
  if (result.modifiedCount) console.log(`Backfilled paidAt for ${result.modifiedCount} payments`);
}

/**
 * До 2026-10-11 Telegram-каналы, которые открывали в аналитике, сравнении и публикациях, не попадали в ночные срезы.
 * Все такие каналы есть среди запомненных пиров сессии, поэтому разово переносим пиры, созданные до этой даты:
 * дальше каналы запоминаются при просмотре. Повторный запуск ничего не меняет.
 */
export async function backfillTelegramSnapshotSources() {
  const peers = await TelegramPeerModel.find({ createdAt: { $lt: new Date('2026-10-11T00:00:00+03:00') } }, { username: 1 }).lean();
  if (!peers.length) return;
  const result = await SnapshotSourceModel.bulkWrite(peers.map(({ username }) => ({
    updateOne: { filter: { platform: 'telegram', externalId: username }, update: { $setOnInsert: { note: 'telegram-peer' } }, upsert: true }
  })), { ordered: false });
  if (result.upsertedCount) console.log(`Added ${result.upsertedCount} Telegram channels to daily snapshots`);
}
