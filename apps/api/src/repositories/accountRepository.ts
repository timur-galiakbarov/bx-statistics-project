import type { Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { NewsModel } from '../models/News.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { SessionModel } from '../models/Session.js';
import { UserModel } from '../models/User.js';
import { VkTokenModel } from '../models/VkToken.js';
import type { SavedGroup } from '../store/types.js';

type UserDocument = {
  _id: Types.ObjectId;
  vkId: string;
  firstName: string;
  lastName: string;
  photo?: string;
  activeTo: Date;
  isAdmin: boolean;
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
};

export function mapUser(user: UserDocument): AccountUser {
  return {
    id: user._id.toString(),
    vkId: user.vkId,
    firstName: user.firstName,
    lastName: user.lastName,
    photo: user.photo,
    activeTo: user.activeTo.toISOString().slice(0, 10),
    isAdmin: user.isAdmin
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

  const user = await UserModel.findOneAndUpdate(
    { vkId: profile.vkId },
    {
      $set: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        photo: profile.photo
      },
      $setOnInsert: {
        activeTo: fallbackActiveTo,
        isAdmin: false
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
  const expiresAt = options.expiresIn
    ? new Date(Date.now() + options.expiresIn * 1000)
    : undefined;

  await VkTokenModel.findOneAndUpdate(
    { userId: options.userId },
    {
      accessToken: options.accessToken,
      scopes: options.scopes,
      expiresAt
    },
    { upsert: true }
  );
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
  const createdGroup = await SavedGroupModel.create({
    userId,
    source: group.source ?? 'free',
    vkGroupId: group.vkGroupId ?? String(group.name ?? 'unknown'),
    name: group.name ?? group.vkGroupId ?? 'Новая группа',
    photo: group.photo,
    membersCount: group.membersCount
  });

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
