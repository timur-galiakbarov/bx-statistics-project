import type { Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { NewsModel } from '../models/News.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { SessionModel } from '../models/Session.js';
import { UserModel } from '../models/User.js';
import { VkTokenModel } from '../models/VkToken.js';
import type { SavedGroup } from '../store/types.js';
import { DomainError } from '../errors/domainError.js';
import { env } from '../config/env.js';

export const FREE_GROUP_LIMIT = 1;
const LAST_ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1_000;
const lastActivityWriteAt = new Map<string, number>();

type UserDocument = {
  _id: Types.ObjectId;
  vkId?: string;
  firstName: string;
  lastName: string;
  photo?: string;
  activeTo: Date;
  trialEndsAt?: Date;
  isAdmin: boolean;
  enforceAccessRestrictions?: boolean;
};

type GroupDocument = {
  _id: Types.ObjectId;
  source: SavedGroup['source'];
  isTracked?: boolean;
  vkGroupId: string;
  platform?: SavedGroup['platform'];
  externalId?: string | null;
  name: string;
  handle?: string | null;
  url?: string | null;
  photo?: string | null;
  membersCount?: number | null;
};

export type AccountUser = {
  id: string;
  vkId: string;
  firstName: string;
  lastName: string;
  photo?: string;
  activeTo: string;
  trialEndsAt?: string;
  isAdmin: boolean;
  enforceAccessRestrictions: boolean;
};

export type RecentAdminUser = {
  id: string;
  bitrixId?: number;
  vkId?: string;
  name: string;
  hasActiveAccess: boolean;
  registeredAt: string;
  lastLoginAt: string;
  lastActivityAt: string;
  activeTo: string;
};

export function mapUser(user: UserDocument): AccountUser {
  return {
    id: user._id.toString(),
    vkId: user.vkId ?? '',
    firstName: user.firstName,
    lastName: user.lastName,
    photo: user.photo,
    activeTo: user.activeTo.toISOString().slice(0, 10),
    trialEndsAt: user.trialEndsAt?.toISOString() ?? undefined,
    isAdmin: user.isAdmin,
    enforceAccessRestrictions: Boolean(user.enforceAccessRestrictions)
  };
}

function mapGroup(group: GroupDocument): SavedGroup {
  const platform = group.platform ?? 'vk';
  const externalId = group.externalId ?? group.vkGroupId;
  return {
    id: group._id.toString(),
    source: group.source,
    isTracked: group.isTracked !== false,
    vkGroupId: group.vkGroupId,
    platform,
    externalId,
    name: group.name,
    handle: group.handle ?? undefined,
    url: group.url ?? (platform === 'youtube' ? `https://www.youtube.com/channel/${externalId}` : `https://vk.com/${externalId}`),
    photo: group.photo ?? undefined,
    membersCount: group.membersCount ?? undefined
  };
}

export async function getUserBySession(sessionId?: string) {
  if (!sessionId) {
    return undefined;
  }

  const session = await SessionModel.findOne({
    token: sessionId,
    expiresAt: { $gt: new Date() }
  })
    .populate<{ userId: UserDocument }>('userId')
    .lean();

  if (!session?.userId) {
    return undefined;
  }

  return mapUser(session.userId);
}

/** Records authenticated activity at most once per five minutes per process and user. */
export async function touchUserActivity(userId: string) {
  const now = Date.now();
  const lastWrite = lastActivityWriteAt.get(userId);

  if (lastWrite !== undefined && now - lastWrite < LAST_ACTIVITY_WRITE_INTERVAL_MS) {
    return;
  }

  // Set before the write so parallel browser requests do not generate duplicate updates.
  lastActivityWriteAt.set(userId, now);

  try {
    await UserModel.updateOne({ _id: userId }, { $set: { lastActivityAt: new Date(now) } });
  } catch (error) {
    lastActivityWriteAt.delete(userId);
    throw error;
  }
}

export async function getDemoUser() {
  const user = await UserModel.findOne({ vkId: '1' }).lean<UserDocument>();
  return user ? mapUser(user) : undefined;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await SessionModel.create({ userId, token, expiresAt });
  return { token, expiresAt };
}

export async function removeSession(token?: string) {
  if (!token) {
    return;
  }

  await SessionModel.deleteOne({ token });
}

export async function upsertVkUser(profile: {
  vkId: string;
  firstName: string;
  lastName: string;
  photo?: string;
}) {
  const fallbackActiveTo = new Date();
  fallbackActiveTo.setDate(fallbackActiveTo.getDate() + 3);
  const trialEndsAt = new Date(fallbackActiveTo);
  const isAdmin = env.adminVkIds.includes(profile.vkId);

  const user = await UserModel.findOneAndUpdate(
    { vkId: profile.vkId },
    {
      $set: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        photo: profile.photo,
        lastLoginAt: new Date(),
        ...(isAdmin ? { isAdmin: true } : {})
      },
      $setOnInsert: {
        activeTo: fallbackActiveTo,
        trialEndsAt,
        ...(isAdmin ? {} : { isAdmin: false })
      }
    },
    { new: true, upsert: true }
  ).lean<UserDocument>();

  return mapUser(user);
}

export function hasTrialAccess(user: AccountUser | undefined) {
  return Boolean(user?.trialEndsAt && new Date(user.trialEndsAt).getTime() >= Date.now());
}

export async function saveVkToken(options: {
  userId: string;
  accessToken: string;
  scopes: string[];
  expiresIn?: number;
}) {
  const expiresIn = Number(options.expiresIn);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000)
    : undefined;

  await VkTokenModel.findOneAndUpdate(
    { userId: options.userId },
    {
      $set: {
        accessToken: options.accessToken,
        scopes: options.scopes,
        ...(expiresAt ? { expiresAt } : {})
      },
      ...(expiresAt ? {} : { $unset: { expiresAt: 1 } })
    },
    { upsert: true }
  );
}

export async function getVkAccessToken(userId: string) {
  const token = await VkTokenModel.findOne({
    userId,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  })
    .sort({ updatedAt: -1 })
    .lean<{ accessToken: string }>();

  return token?.accessToken;
}

export async function getVkTokenStatus(userId: string) {
  const token = await VkTokenModel.findOne({ userId })
    .sort({ updatedAt: -1 })
    .lean<{
      scopes?: string[];
      expiresAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    }>();
  const now = Date.now();
  const expiresAt = token?.expiresAt;
  const isExpired = Boolean(expiresAt && expiresAt.getTime() <= now);

  return {
    hasToken: Boolean(token),
    isExpired,
    expiresAt: expiresAt?.toISOString() ?? null,
    scopes: token?.scopes ?? [],
    createdAt: token?.createdAt?.toISOString() ?? null,
    updatedAt: token?.updatedAt?.toISOString() ?? null
  };
}

export async function getGroups(userId: string, source?: SavedGroup['source']) {
  const query = {
    userId,
    ...(source ? { source } : {})
  };

  const groups = await SavedGroupModel.find(query).sort({ createdAt: 1 }).lean<GroupDocument[]>();
  return groups.map(mapGroup);
}

export async function addGroup(
  userId: string,
  group: Partial<SavedGroup>,
  options: { allowBonusGroup?: boolean } = {}
) {
  const source = group.source ?? 'free';
  const platform = group.platform ?? 'vk';
  const externalId = group.externalId ?? group.vkGroupId ?? String(group.name ?? 'unknown');
  // Populate the legacy field for old indexes and old deployments reading the collection.
  const vkGroupId = group.vkGroupId ?? externalId;
  const identityQuery: Record<string, unknown> = platform === 'vk'
    ? { userId, source, $or: [{ platform: 'vk', externalId }, { platform: 'vk', vkGroupId }, { platform: { $exists: false }, vkGroupId }] }
    : { userId, source, platform, externalId };

  const existingGroup = await SavedGroupModel.exists(identityQuery as any);
  const trackedIdentityQuery: Record<string, unknown> = platform === 'vk'
    ? { userId, $or: [{ platform: 'vk', externalId }, { platform: 'vk', vkGroupId }, { platform: { $exists: false }, vkGroupId }] }
    : { userId, platform, externalId };
  const isAlreadyTracked = source === 'free' || source === 'bonus'
    ? await SavedGroupModel.exists({ ...trackedIdentityQuery, isTracked: { $ne: false } } as any)
    : false;

  if (!existingGroup && source === 'free') {
    const groupsCount = await SavedGroupModel.countDocuments({ userId, source: 'free' });
    if (groupsCount >= FREE_GROUP_LIMIT) {
      throw new DomainError('Можно добавить только одно бесплатное сообщество.', {
        status: 409,
        code: 'FREE_GROUP_LIMIT_REACHED'
      });
    }
  }

  if (!existingGroup && source === 'bonus') {
    const groupsCount = await SavedGroupModel.countDocuments({ userId, source: 'bonus' });
    if (groupsCount >= FREE_GROUP_LIMIT) {
      throw new DomainError('Бонусное сообщество уже добавлено.', {
        status: 409,
        code: 'BONUS_GROUP_LIMIT_REACHED'
      });
    }
    if (!options.allowBonusGroup) {
      throw new DomainError('Второе сообщество доступно после вступления в сообщество Socstat во ВКонтакте.', {
        status: 403,
        code: 'BONUS_GROUP_SUBSCRIPTION_REQUIRED'
      });
    }
  }

  const createdGroup = await SavedGroupModel.findOneAndUpdate(
    identityQuery as any,
    {
      $set: {
        name: group.name ?? externalId ?? 'Новый источник',
        platform,
        externalId,
        vkGroupId,
        handle: group.handle,
        url: group.url,
        photo: group.photo,
        membersCount: group.membersCount
      },
      $setOnInsert: {
        userId,
        source,
        isTracked: !isAlreadyTracked
      }
    },
    { new: true, upsert: true }
  );

  return mapGroup(createdGroup);
}

export async function removeGroup(userId: string, groupId: string) {
  const group = await SavedGroupModel.findOne({ _id: groupId, userId }).select('source');

  if (!group) return;

  if (group.source === 'free' || group.source === 'bonus') {
    await SavedGroupModel.updateOne({ _id: groupId, userId }, { $set: { isTracked: false } });
    return;
  }

  await SavedGroupModel.deleteOne({ _id: groupId, userId });
}

export async function removeFreeGroups(userId: string) {
  const result = await SavedGroupModel.deleteMany({ userId, source: { $in: ['free', 'bonus'] } });
  return result.deletedCount;
}

export async function getNews() {
  const news = await NewsModel.find({ isVisible: true }).sort({ publishedAt: -1 }).lean();

  return news.map((item) => ({
    id: item._id.toString(),
    title: item.title,
    date: item.publishedAt.toISOString().slice(0, 10),
    body: item.body
  }));
}

export async function getAdminStat(userId: string) {
  const [users, paidUsers, savedGroups] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ activeTo: { $gt: new Date() } }),
    SavedGroupModel.countDocuments({ userId })
  ]);

  return { users, paidUsers, savedGroups };
}

export async function getRecentAdminUsers(limit = 300): Promise<RecentAdminUser[]> {
  const users = await UserModel.find({
    $or: [
      { lastActivityAt: { $exists: true, $ne: null } },
      { lastLoginAt: { $exists: true, $ne: null } }
    ]
  })
    .sort({ lastActivityAt: -1, lastLoginAt: -1 })
    .limit(Math.min(limit, 300))
    .select({ legacy: 1, vkId: 1, firstName: 1, lastName: 1, createdAt: 1, lastLoginAt: 1, lastActivityAt: 1, activeTo: 1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        legacy?: { bitrixId?: number };
        vkId?: string;
        firstName?: string;
        lastName?: string;
        createdAt: Date;
        lastLoginAt: Date;
        lastActivityAt?: Date;
        activeTo: Date;
      }>
    >();

  const now = new Date();

  return users.map((user) => ({
    id: user._id.toString(),
    bitrixId: user.legacy?.bitrixId,
    vkId: user.vkId,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Без имени',
    hasActiveAccess: user.activeTo > now,
    registeredAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
    lastActivityAt: (user.lastActivityAt ?? user.lastLoginAt).toISOString(),
    activeTo: user.activeTo.toISOString().slice(0, 10)
  }));
}
