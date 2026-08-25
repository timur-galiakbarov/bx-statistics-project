import { readFile } from 'node:fs/promises';
import mongoose, { type Types } from 'mongoose';
import { env } from '../config/env.js';

type LegacyPayment = {
  _id: string;
  legacy: { bitrixElementId: number };
  user: { legacyBitrixId: number };
  amount: number;
  amountWithCommission?: number;
  currency?: string;
  operationId?: string;
  label?: string;
  notificationType?: string;
  paidAt?: string;
  createdAt?: string;
  isActive?: boolean;
};

const SOURCE_PATH = process.argv[2];
const BATCH_SIZE = 300;

function date(value?: string) {
  return value ? new Date(value) : undefined;
}

async function main() {
  if (!SOURCE_PATH) {
    throw new Error('Укажите путь к JSON-файлу: npm run import:legacy-payments -- /path/to/payments.json');
  }

  const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8')) as LegacyPayment[];
  if (!Array.isArray(source)) {
    throw new Error('Ожидался JSON-массив платежей.');
  }

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs });

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Не удалось получить подключение к MongoDB.');
    }

    const usersCollection = db.collection('users');
    const paymentsCollection = db.collection('payments');
    await paymentsCollection.createIndex(
      { 'legacy.bitrixElementId': 1 },
      {
        name: 'legacy.bitrixElementId_1',
        unique: true,
        partialFilterExpression: { 'legacy.bitrixElementId': { $exists: true } }
      }
    );

    const bitrixUserIds = [...new Set(source.map((payment) => payment.user.legacyBitrixId))];
    const existingUsers = await usersCollection
      .find({ 'legacy.bitrixId': { $in: bitrixUserIds } })
      .project<{ _id: Types.ObjectId; legacy: { bitrixId: number } }>({ _id: 1, legacy: 1 })
      .toArray();
    const knownUserIds = new Set(existingUsers.map((user) => user.legacy.bitrixId));
    const missingUserIds = bitrixUserIds.filter((id) => !knownUserIds.has(id));
    const importedAt = new Date();

    if (missingUserIds.length) {
      await usersCollection.bulkWrite(
        missingUserIds.map((bitrixId) => ({
          updateOne: {
            filter: { 'legacy.bitrixId': bitrixId },
            update: {
              $setOnInsert: {
                legacy: { bitrixId },
                firstName: 'Удалённый',
                lastName: 'пользователь',
                activeTo: new Date(0),
                isActive: false,
                createdAt: importedAt,
                updatedAt: importedAt
              }
            },
            upsert: true
          }
        }))
      );
    }

    const resolvedUsers = await usersCollection
      .find({ 'legacy.bitrixId': { $in: bitrixUserIds } })
      .project<{ _id: Types.ObjectId; legacy: { bitrixId: number } }>({ _id: 1, legacy: 1 })
      .toArray();
    const userIdByBitrixId = new Map(resolvedUsers.map((user) => [user.legacy.bitrixId, user._id]));

    let writtenPayments = 0;
    for (let offset = 0; offset < source.length; offset += BATCH_SIZE) {
      const batch = source.slice(offset, offset + BATCH_SIZE);
      const elementIds = batch.map((payment) => payment.legacy.bitrixElementId);
      const operationIds = batch.flatMap((payment) => (payment.operationId ? [payment.operationId] : []));
      const existingPayments = await paymentsCollection
        .find({
          $or: [
            { 'legacy.bitrixElementId': { $in: elementIds } },
            ...(operationIds.length ? [{ providerTransactionId: { $in: operationIds } }] : [])
          ]
        })
        .project<{ _id: Types.ObjectId; legacy?: { bitrixElementId?: number }; providerTransactionId?: string }>({
          _id: 1,
          legacy: 1,
          providerTransactionId: 1
        })
        .toArray();
      const idByElementId = new Map(
        existingPayments.flatMap((payment) => payment.legacy?.bitrixElementId ? [[payment.legacy.bitrixElementId, payment._id] as const] : [])
      );
      const idByOperationId = new Map(
        existingPayments.flatMap((payment) => payment.providerTransactionId ? [[payment.providerTransactionId, payment._id] as const] : [])
      );
      const batchImportedAt = new Date();

      const result = await paymentsCollection.bulkWrite(
        batch.map((payment) => {
          const existingId =
            idByElementId.get(payment.legacy.bitrixElementId) ??
            (payment.operationId ? idByOperationId.get(payment.operationId) : undefined);
          const createdAt = date(payment.createdAt) ?? date(payment.paidAt) ?? batchImportedAt;
          const paidAt = date(payment.paidAt) ?? createdAt;

          return {
            updateOne: {
              filter: existingId ? { _id: existingId } : { 'legacy.bitrixElementId': payment.legacy.bitrixElementId },
              update: {
                $set: {
                  legacy: { bitrixElementId: payment.legacy.bitrixElementId },
                  userId: userIdByBitrixId.get(payment.user.legacyBitrixId),
                  provider: 'yoomoney',
                  amount: payment.amount,
                  period: 'Legacy payment',
                  status: payment.isActive === false ? 'failed' : 'paid',
                  providerTransactionId: payment.operationId,
                  paidAt,
                  updatedAt: batchImportedAt,
                  rawCallbackPayload: {
                    source: 'bitrix-migration',
                    legacyMongoId: payment._id,
                    amountWithCommission: payment.amountWithCommission,
                    currency: payment.currency,
                    label: payment.label,
                    notificationType: payment.notificationType,
                    paidAt: payment.paidAt,
                    isActive: payment.isActive
                  }
                },
                $setOnInsert: { createdAt }
              },
              upsert: true
            }
          };
        }),
        { ordered: true }
      );
      writtenPayments += result.upsertedCount + result.modifiedCount;
    }

    console.log(
      JSON.stringify({
        sourcePayments: source.length,
        paymentsWritten: writtenPayments,
        placeholderUsersCreated: missingUserIds.length
      })
    );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
