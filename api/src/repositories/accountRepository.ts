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

const FREE_GROUP_LIMIT = 3;

type UserDocument = {
  _id: Types.ObjectId;
  vkId?: string;
  firstName: string;
  lastName: string;
  photo?: string;
  activeTo: Date;
  isAdmin: boolean;
  enforceAccessRestrictions?: boolean;
};

type GroupDocument = {
  _id: Types.ObjectId;
  source: SavedGroup['source'];
  vkGroupId: string;
  name: string;
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
  isAdmin: boolean;
  enforceAccessRestrictions: boolean;
};

export type RecentAdminUser = {
  id: string;
  bitrixId?: number;
  vkId?: string;
  name: string;
  hasActiveAccess: boolean;
  lastLoginAt: string;
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
    isAdmin: user.isAdmin,
    enforceAccessRestrictions: Boolean(user.enforceAccessRestrictions)
  };
}

function mapGroup(group: GroupDocument): SavedGroup {
  return {
    id: group._id.toString(),
    source: group.source,
    vkGroupId: group.vkGroupId,
    name: group.name,
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
  fallbackActiveTo.setDate(fallbackActiveTo.getDate() + 14);
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
        ...(isAdmin ? {} : { isAdmin: false })
      }
    },
    { new: true, upsert: true }
  ).lean<UserDocument>();

  return mapUser(user);
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

export async function addGroup(userId: string, group: Partial<SavedGroup>) {
  const source = group.source ?? 'free';
  const vkGroupId = group.vkGroupId ?? String(group.name ?? 'unknown');

  if (source === 'free') {
    const [existingGroup, freeGroupsCount] = await Promise.all([
      SavedGroupModel.exists({ userId, source, vkGroupId }),
      SavedGroupModel.countDocuments({ userId, source })
    ]);

    if (!existingGroup && freeGroupsCount >= FREE_GROUP_LIMIT) {
      throw new DomainError('Можно добавить не больше 3 бесплатных групп.', {
        status: 409,
        code: 'FREE_GROUP_LIMIT_REACHED'
      });
    }
  }

  const createdGroup = await SavedGroupModel.findOneAndUpdate(
    { userId, source, vkGroupId },
    {
      $set: {
        name: group.name ?? group.vkGroupId ?? 'Новая группа',
        photo: group.photo,
        membersCount: group.membersCount
      },
      $setOnInsert: {
        userId,
        source,
        vkGroupId
      }
    },
    { new: true, upsert: true }
  );

  return mapGroup(createdGroup);
}

export async function removeGroup(userId: string, groupId: string) {
  await SavedGroupModel.deleteOne({ _id: groupId, userId });
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
  const users = await UserModel.find({ lastLoginAt: { $exists: true, $ne: null } })
    .sort({ lastLoginAt: -1 })
    .limit(Math.min(limit, 300))
    .select({ legacy: 1, vkId: 1, firstName: 1, lastName: 1, lastLoginAt: 1, activeTo: 1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        legacy?: { bitrixId?: number };
        vkId?: string;
        firstName?: string;
        lastName?: string;
        lastLoginAt: Date;
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
    lastLoginAt: user.lastLoginAt.toISOString(),
    activeTo: user.activeTo.toISOString().slice(0, 10)
  }));
}
