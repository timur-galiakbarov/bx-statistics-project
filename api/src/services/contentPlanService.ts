import mongoose from 'mongoose';
import { DomainError } from '../errors/domainError.js';
import { ContentPlanChannelModel } from '../models/ContentPlanChannel.js';
import { ContentPlanPostModel, type ContentPlanStatus } from '../models/ContentPlanPost.js';
import { getTelegramBotStatus, resolveTelegramChannel } from './telegramBotClient.js';

const TEXT_LIMITS: Record<'vk' | 'telegram', number> = { telegram: 4096, vk: 16000 };

function titleFrom(text: string) {
  const first = String(text || '').split('\n').find((line) => line.trim()) || 'Без названия';
  return first.replace(/[*_`#>\[\]]/g, '').replace(/\|/g, ' ').trim().slice(0, 120);
}

function normalizeTimeZone(value: unknown) {
  const timeZone = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new DomainError('Неизвестный часовой пояс.', { status: 400, code: 'CONTENT_PLAN_TIMEZONE_INVALID' });
  }
  return timeZone;
}

export type ContentPlanPostDto = {
  id: string;
  channelId: string;
  platform: 'vk' | 'telegram';
  title: string;
  text: string;
  status: ContentPlanStatus;
  scheduledAt: string | null;
  timeZone: string;
  autoPublish: boolean;
  externalUrl: string;
  error: string;
};

type PostInput = {
  channelId?: unknown;
  text?: unknown;
  status?: unknown;
  scheduledAt?: unknown;
  timeZone?: unknown;
};

export type ContentPlanChannelDto = {
  id: string;
  platform: 'vk' | 'telegram';
  title: string;
  handle: string;
  status: 'connected' | 'needs_reauth' | 'error';
  canPost: boolean;
  error: string;
};

export function toPostDto(doc: any): ContentPlanPostDto {
  return {
    id: String(doc._id),
    channelId: String(doc.channelId),
    platform: doc.platform,
    title: doc.title ?? '',
    text: doc.text,
    status: doc.status,
    scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString() : null,
    timeZone: doc.timeZone ?? 'UTC',
    autoPublish: Boolean(doc.autoPublish),
    externalUrl: doc.externalUrl ?? '',
    error: doc.error ?? ''
  };
}

function toDto(doc: { _id: mongoose.Types.ObjectId; platform: 'vk' | 'telegram'; title: string; handle?: string; status: 'connected' | 'needs_reauth' | 'error'; canPost: boolean; error?: string }): ContentPlanChannelDto {
  return {
    id: String(doc._id),
    platform: doc.platform,
    title: doc.title,
    handle: doc.handle ?? '',
    status: doc.status,
    canPost: doc.canPost,
    error: doc.error ?? ''
  };
}

export async function listChannels(userId: string): Promise<ContentPlanChannelDto[]> {
  const docs = await ContentPlanChannelModel.find({ userId }).sort({ createdAt: 1 }).lean();
  return docs.map(toDto);
}

export async function connectTelegramChannel(userId: string, ref: unknown): Promise<ContentPlanChannelDto> {
  const resolved = await resolveTelegramChannel(ref);
  const doc = await ContentPlanChannelModel.findOneAndUpdate(
    { userId, platform: 'telegram', externalId: resolved.externalId },
    {
      $set: {
        title: resolved.title,
        handle: resolved.handle,
        status: 'connected',
        canPost: true,
        lastCheckedAt: new Date(),
        error: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toDto(doc);
}

export async function deleteChannel(userId: string, id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) {
    throw new DomainError('Канал не найден.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
  }
  const result = await ContentPlanChannelModel.deleteOne({ _id: id, userId });
  if (!result.deletedCount) {
    throw new DomainError('Канал не найден.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
  }
}

async function ownedChannel(userId: string, channelId: unknown) {
  if (typeof channelId !== 'string' || !mongoose.isValidObjectId(channelId)) {
    throw new DomainError('Выберите канал публикации.', { status: 400, code: 'CONTENT_PLAN_CHANNEL_REQUIRED' });
  }
  const channel = await ContentPlanChannelModel.findOne({ _id: channelId, userId }).lean();
  if (!channel) {
    throw new DomainError('Канал не найден.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
  }
  if (channel.status !== 'connected' || !channel.canPost) {
    throw new DomainError('Канал не подключён к публикации.', { status: 409, code: 'CONTENT_PLAN_CHANNEL_NOT_READY' });
  }
  return channel;
}

function postFields(input: PostInput, channel: { platform: 'vk' | 'telegram' }): { text: string; title: string; status: ContentPlanStatus; scheduledAt: Date | null; timeZone: string; autoPublish: boolean } {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text) {
    throw new DomainError('Добавьте текст поста.', { status: 400, code: 'CONTENT_PLAN_TEXT_REQUIRED' });
  }
  if (text.length > TEXT_LIMITS[channel.platform]) {
    throw new DomainError(
      `Текст длиннее лимита ${TEXT_LIMITS[channel.platform].toLocaleString('ru-RU')} символов.`,
      { status: 422, code: 'CONTENT_PLAN_TEXT_TOO_LONG' }
    );
  }

  const status: ContentPlanStatus = input.status === 'scheduled' ? 'scheduled' : 'draft';
  let scheduledAt: Date | null = null;
  if (input.scheduledAt) {
    if (typeof input.scheduledAt !== 'string') {
      throw new DomainError('Дата публикации указана неверно.', { status: 400, code: 'CONTENT_PLAN_DATE_INVALID' });
    }
    scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new DomainError('Дата публикации указана неверно.', { status: 400, code: 'CONTENT_PLAN_DATE_INVALID' });
    }
    if (status === 'scheduled' && scheduledAt.getTime() < Date.now() - 60_000) {
      throw new DomainError('Дата публикации уже прошла.', { status: 422, code: 'CONTENT_PLAN_DATE_PAST' });
    }
  }
  if (status === 'scheduled' && !scheduledAt) {
    throw new DomainError('Выберите дату и время публикации.', { status: 400, code: 'CONTENT_PLAN_DATE_REQUIRED' });
  }

  return {
    text,
    title: titleFrom(text),
    status,
    scheduledAt,
    timeZone: normalizeTimeZone(input.timeZone),
    autoPublish: true
  };
}

export async function listPosts(userId: string): Promise<ContentPlanPostDto[]> {
  const docs = await ContentPlanPostModel.find({ userId }).sort({ scheduledAt: 1, createdAt: 1 }).lean();
  return docs.map(toPostDto);
}

export async function createPost(userId: string, input: PostInput): Promise<ContentPlanPostDto> {
  const channel = await ownedChannel(userId, input.channelId);
  const fields = postFields(input, channel);
  const doc = await ContentPlanPostModel.create({
    userId,
    channelId: channel._id,
    platform: channel.platform,
    ...fields
  });
  return toPostDto(doc.toObject());
}

export async function updatePost(userId: string, id: string, input: PostInput): Promise<ContentPlanPostDto> {
  if (!mongoose.isValidObjectId(id)) {
    throw new DomainError('Пост не найден.', { status: 404, code: 'CONTENT_PLAN_POST_NOT_FOUND' });
  }
  const post = await ContentPlanPostModel.findOne({ _id: id, userId });
  if (!post) {
    throw new DomainError('Пост не найден.', { status: 404, code: 'CONTENT_PLAN_POST_NOT_FOUND' });
  }
  if (post.status === 'published' || post.status === 'publishing') {
    throw new DomainError('Опубликованный пост нельзя редактировать.', { status: 409, code: 'CONTENT_PLAN_POST_LOCKED' });
  }
  const channel = await ownedChannel(userId, input.channelId ?? String(post.channelId));
  const fields = postFields(input, channel);
  post.channelId = channel._id as mongoose.Types.ObjectId;
  post.platform = channel.platform;
  post.text = fields.text;
  post.title = fields.title;
  post.status = fields.status;
  post.scheduledAt = fields.scheduledAt;
  post.timeZone = fields.timeZone;
  post.autoPublish = true;
  post.error = '';
  await post.save();
  return toPostDto(post.toObject());
}

export async function deletePost(userId: string, id: string): Promise<void> {
  if (!mongoose.isValidObjectId(id)) {
    throw new DomainError('Пост не найден.', { status: 404, code: 'CONTENT_PLAN_POST_NOT_FOUND' });
  }
  const post = await ContentPlanPostModel.findOne({ _id: id, userId });
  if (!post) {
    throw new DomainError('Пост не найден.', { status: 404, code: 'CONTENT_PLAN_POST_NOT_FOUND' });
  }
  if (post.status === 'published' || post.status === 'publishing') {
    throw new DomainError('Опубликованный пост нельзя удалить.', { status: 409, code: 'CONTENT_PLAN_POST_LOCKED' });
  }
  await post.deleteOne();
}

export async function getPlanMeta(userId: string) {
  const [channels, posts, telegramBot] = await Promise.all([listChannels(userId), listPosts(userId), getTelegramBotStatus()]);
  return {
    channels,
    posts,
    telegramBot
  };
}
