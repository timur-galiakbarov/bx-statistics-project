import { readFile } from 'node:fs/promises';
import mongoose, { type Types } from 'mongoose';
import { env } from '../config/env.js';

type LegacyUser = {
  _id: string;
  legacy: { bitrixId: number };
  email?: string | null;
  profile?: { firstName?: string | null; lastName?: string | null };
  vk?: { login?: string | null; accessToken?: string | null };
  subscription?: { activeUntil?: string | null };
  isActive?: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  lastActivityAt?: string | null;
};

const SOURCE_PATH = process.argv[2];
const BATCH_SIZE = 500;

function date(value?: string | null) {
  return value ? new Date(value) : undefined;
}

function isValidVkId(value?: string | null): value is string {
  return Boolean(value && /^\d+$/.test(value));
}

/** Оставляет единственную самую свежую запись для каждого VK ID. */
function removeDuplicateVkUsers(users: LegacyUser[]) {
  const newestByVkId = new Map<string, LegacyUser>();
  const withoutVkId: LegacyUser[] = [];

  for (const user of users) {
    if (!isValidVkId(user.vk?.login)) {
      withoutVkId.push(user);
      continue;
    }

    const existing = newestByVkId.get(user.vk.login);
    if (!existing || (date(user.lastLoginAt)?.getTime() ?? 0) > (date(existing.lastLoginAt)?.getTime() ?? 0)) {
      newestByVkId.set(user.vk.login, user);
    }
  }

  return [...withoutVkId, ...newestByVkId.values()];
}

async function main() {
  if (!SOURCE_PATH) {
    throw new Error('Укажите путь к JSON-файлу: npm run import:legacy-users -- /path/to/users.json');
  }

  const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8')) as LegacyUser[];
  if (!Array.isArray(source)) {
    throw new Error('Ожидался JSON-массив пользователей.');
  }

  const users = removeDuplicateVkUsers(source);
  const skippedDuplicates = source.length - users.length;
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs });

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Не удалось получить подключение к MongoDB.');
    }
    const usersCollection = db.collection('users');
    const tokensCollection = db.collection('vktokens');

    // Старый уникальный индекс не допускает больше одной записи без vkId.
    await usersCollection.dropIndex('vkId_1').catch((error: { codeName?: string }) => {
      if (error.codeName !== 'IndexNotFound') throw error;
    });
    await usersCollection.createIndex({ vkId: 1 }, { name: 'vkId_1', unique: true, sparse: true });
    await usersCollection.createIndex(
      { 'legacy.bitrixId': 1 },
      {
        name: 'legacy.bitrixId_1',
        unique: true,
        partialFilterExpression: { 'legacy.bitrixId': { $exists: true } }
      }
    );

    let importedUsers = 0;
    let importedTokens = 0;
    let cursor = 0;

    while (cursor < users.length) {
      const batch = users.slice(cursor, cursor + BATCH_SIZE);
      const importedAt = new Date();
      const bitrixIds = batch.map((user) => user.legacy.bitrixId);
      const vkIds = batch.flatMap((user) => (isValidVkId(user.vk?.login) ? [user.vk.login] : []));
      const existing = await usersCollection
        .find({ $or: [{ 'legacy.bitrixId': { $in: bitrixIds } }, { vkId: { $in: vkIds } }] })
        .project<{ _id: Types.ObjectId; vkId?: string; legacy?: { bitrixId?: number } }>({ _id: 1, vkId: 1, legacy: 1 })
        .toArray();
      const userIdByBitrixId = new Map(existing.flatMap((user) => user.legacy?.bitrixId ? [[user.legacy.bitrixId, user._id] as const] : []));
      const userIdByVkId = new Map(existing.flatMap((user) => user.vkId ? [[user.vkId, user._id] as const] : []));

      const operations = batch.map((user) => {
        const existingId = userIdByBitrixId.get(user.legacy.bitrixId) ?? (isValidVkId(user.vk?.login) ? userIdByVkId.get(user.vk.login) : undefined);
        const activeTo = date(user.subscription?.activeUntil) ?? date(user.createdAt) ?? new Date(0);
        const update = {
          legacy: { bitrixId: user.legacy.bitrixId },
          ...(isValidVkId(user.vk?.login) ? { vkId: user.vk.login } : {}),
          ...(user.email ? { email: user.email } : {}),
          firstName: user.profile?.firstName ?? '',
          lastName: user.profile?.lastName ?? '',
          activeTo,
          isActive: user.isActive ?? true,
          updatedAt: importedAt,
          ...(date(user.lastLoginAt) ? { lastLoginAt: date(user.lastLoginAt) } : {}),
          ...(date(user.lastActivityAt) ? { lastActivityAt: date(user.lastActivityAt) } : {})
        };
        return {
          updateOne: {
            filter: existingId ? { _id: existingId } : { 'legacy.bitrixId': user.legacy.bitrixId },
            update: { $set: update, $setOnInsert: { createdAt: date(user.createdAt) ?? new Date(), isAdmin: false } },
            upsert: true
          }
        };
      });

      const result = await usersCollection.bulkWrite(operations, { ordered: true });
      importedUsers += result.upsertedCount + result.modifiedCount;

      const resolved = await usersCollection
        .find({ 'legacy.bitrixId': { $in: bitrixIds } })
        .project<{ _id: Types.ObjectId; legacy: { bitrixId: number } }>({ _id: 1, legacy: 1 })
        .toArray();
      const ids = new Map(resolved.map((user) => [user.legacy.bitrixId, user._id]));
      const tokenOperations = batch.flatMap((user) => {
        const accessToken = user.vk?.accessToken;
        const userId = ids.get(user.legacy.bitrixId);
        return accessToken && userId
          ? [{ updateOne: { filter: { userId }, update: { $set: { userId, accessToken, scopes: [], updatedAt: importedAt }, $setOnInsert: { createdAt: importedAt } }, upsert: true } }]
          : [];
      });
      if (tokenOperations.length) {
        const tokenResult = await tokensCollection.bulkWrite(tokenOperations, { ordered: true });
        importedTokens += tokenResult.upsertedCount + tokenResult.modifiedCount;
      }
      cursor += batch.length;
    }

    console.log(JSON.stringify({ sourceRecords: source.length, importedUserRecords: users.length, skippedDuplicateVkRecords: skippedDuplicates, usersWritten: importedUsers, vkTokensWritten: importedTokens }));
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
