import { normalizeTelegramRichText } from './telegramRichText.js';
import { vkPhotoEnabled } from './vkContentPlanService.js';
import { confirmMedia, mediaEnabled, mediaReadUrl } from './contentPlanMedia.js';
import mongoose from 'mongoose';
import { DomainError } from '../errors/domainError.js';
import { ContentPlanBotModel } from '../models/ContentPlanBot.js';
import { ContentPlanChannelModel } from '../models/ContentPlanChannel.js';
import { ContentPlanPostModel, type ContentPlanStatus } from '../models/ContentPlanPost.js';
import { UserModel } from '../models/User.js';
import { decryptBotToken, encryptBotToken, botTokenLooksValid } from './contentPlanSecrets.js';
import { getTelegramBotInfo, resolveTelegramChannel } from './telegramBotClient.js';

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
  mediaId?: string;
  telegramHtml?: string;
  mediaPreviewUrl?: string;
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
  mediaId?: unknown;
  telegramHtml?: unknown;
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
  writingRules: string;
  imageRules: string;
};

export type ContentPlanBotDto = {
  configured: boolean;
  username: string;
  name: string;
  url: string;
  status: 'connected' | 'needs_reauth' | 'error' | null;
  error: string;
};

function toBotDto(doc: any): ContentPlanBotDto {
  if (!doc) return { configured: false, username: '', name: '', url: '', status: null, error: '' };
  return {
    configured: true,
    username: doc.username,
    name: doc.name ?? '',
    url: `https://t.me/${doc.username}`,
    status: doc.status,
    error: doc.error ?? ''
  };
}

export function toPostDto(doc: any): ContentPlanPostDto {
  return {
    id: String(doc._id),
    channelId: String(doc.channelId),
    platform: doc.platform,
    title: doc.title ?? '',
    text: doc.text,
    telegramHtml: doc.telegramHtml,
    ...(doc.mediaId && doc.status !== 'published' && mediaEnabled() ? { mediaId: doc.mediaId, mediaPreviewUrl: mediaReadUrl(doc.mediaId) } : {}),
    status: doc.status,
    scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString() : null,
    timeZone: doc.timeZone ?? 'UTC',
    autoPublish: Boolean(doc.autoPublish),
    externalUrl: doc.externalUrl ?? '',
    error: doc.error ?? ''
  };
}

function toDto(doc: { _id: mongoose.Types.ObjectId; platform: 'vk' | 'telegram'; title: string; handle?: string; status: 'connected' | 'needs_reauth' | 'error'; canPost: boolean; error?: string; writingRules?: string; imageRules?: string }): ContentPlanChannelDto {
  return {
    id: String(doc._id),
    platform: doc.platform,
    title: doc.title,
    handle: doc.handle ?? '',
    status: doc.status,
    canPost: doc.canPost,
    error: doc.error ?? '',
    writingRules: doc.writingRules ?? '',
    imageRules: doc.imageRules ?? ''
  };
}

const WRITING_RULES_LIMIT = 3000;

export async function getCommonWritingRules(userId: string, kind: 'text' | 'image' = 'text') {
  const field = kind === 'image' ? 'contentPlanImageRules' : 'contentPlanWritingRules';
  const user = await UserModel.findById(userId).select({ [field]: 1, _id: 0 }).lean();
  return user?.[field] ?? '';
}

export async function saveWritingRules(userId: string, body: { channelId?: unknown; rules?: unknown; previousRules?: unknown }, kind: 'text' | 'image' = 'text') {
  if (typeof body.rules !== 'string' || typeof body.previousRules !== 'string') {
    throw new DomainError('Укажите текст правил.', { status: 400, code: 'CONTENT_PLAN_RULES_INVALID' });
  }
  const rules = body.rules.trim();
  if (rules.length > WRITING_RULES_LIMIT) {
    throw new DomainError('Правила должны быть не длиннее 3 000 символов.', { status: 400, code: 'CONTENT_PLAN_RULES_INVALID' });
  }
  const field = body.channelId == null
    ? kind === 'image' ? 'contentPlanImageRules' : 'contentPlanWritingRules'
    : kind === 'image' ? 'imageRules' : 'writingRules';
  const previous = body.previousRules ? { [field]: body.previousRules } : { $or: [{ [field]: '' }, { [field]: { $exists: false } }] };
  let matchedCount: number;
  if (body.channelId == null) {
    ({ matchedCount } = await UserModel.updateOne({ _id: userId, ...previous }, { $set: { [field]: rules } }));
  } else {
    const channel = await getOwnedChannel(userId, body.channelId);
    ({ matchedCount } = await ContentPlanChannelModel.updateOne({ _id: channel._id, userId, ...previous }, { $set: { [field]: rules } }));
  }
  if (!matchedCount) {
    throw new DomainError('Правила уже изменились. Обновите страницу и повторите попытку.', { status: 409, code: 'CONTENT_PLAN_RULES_CHANGED' });
  }
  return { rules };
}

export function activeWritingRules(text: string, excluded: unknown) {
  if (excluded === undefined) return text;
  if (!Array.isArray(excluded) || excluded.length > WRITING_RULES_LIMIT ||
    excluded.some(rule => typeof rule !== 'string' || rule.length > WRITING_RULES_LIMIT)) {
    throw new DomainError('Не удалось применить правила поста.', { status: 400, code: 'CONTENT_PLAN_RULES_INVALID' });
  }
  const disabled = new Set<string>(excluded);
  return text.split(/\r?\n/).filter(rule => !disabled.has(rule.trim())).join('\n');
}

export async function getBotStatus(userId: string): Promise<ContentPlanBotDto> {
  return toBotDto(await ContentPlanBotModel.findOne({ userId }).lean());
}

export async function connectBot(userId: string, token: unknown): Promise<ContentPlanBotDto> {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!botTokenLooksValid(value)) {
    throw new DomainError('Токен не похож на токен Telegram-бота. Скопируйте его из BotFather целиком.', {
      status: 400,
      code: 'CONTENT_PLAN_BOT_TOKEN_INVALID'
    });
  }
  const info = await getTelegramBotInfo(value);
  const encrypted = encryptBotToken(value);
  const existing = await ContentPlanBotModel.findOne({ userId }).lean();
  if (existing && existing.botId !== info.id) {
    await ContentPlanChannelModel.updateMany(
      { userId, platform: 'telegram' },
      { $set: { status: 'needs_reauth', canPost: false, error: 'Бот заменён, проверьте канал' } }
    );
  }
  const doc = await ContentPlanBotModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        tokenEncrypted: encrypted,
        botId: info.id,
        username: info.username,
        name: info.name,
        status: 'connected',
        lastCheckedAt: new Date(),
        error: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toBotDto(doc);
}

export async function disconnectBot(userId: string): Promise<void> {
  await ContentPlanBotModel.deleteOne({ userId });
  await ContentPlanChannelModel.updateMany(
    { userId, platform: 'telegram' },
    { $set: { status: 'needs_reauth', canPost: false, error: 'Бот отключён' } }
  );
}

async function requireBotToken(userId: string) {
  const bot = await ContentPlanBotModel.findOne({ userId });
  if (!bot) {
    throw new DomainError('Сначала подключите своего Telegram-бота.', { status: 409, code: 'CONTENT_PLAN_BOT_REQUIRED' });
  }
  return { bot, token: decryptBotToken(bot.tokenEncrypted) };
}

/** Токен бота для отправки поста. Нужен и планировщику, и ручной публикации. */
export async function getBotTokenForChannel(channel: any): Promise<{ token: string; botId: string }> {
  const bot = channel.botId
    ? await ContentPlanBotModel.findOne({ _id: channel.botId })
    : await ContentPlanBotModel.findOne({ userId: channel.userId });
  if (!bot) {
    throw new DomainError('Бот отключён. Подключите его снова.', { status: 409, code: 'CONTENT_PLAN_BOT_REQUIRED' });
  }
  return { token: decryptBotToken(bot.tokenEncrypted), botId: String(bot._id) };
}

export async function listChannels(userId: string): Promise<ContentPlanChannelDto[]> {
  const docs = await ContentPlanChannelModel.find({ userId }).sort({ createdAt: 1 }).lean();
  return docs.map(toDto);
}

export async function connectTelegramChannel(userId: string, ref: unknown): Promise<ContentPlanChannelDto> {
  const { bot, token } = await requireBotToken(userId);
  const resolved = await resolveTelegramChannel(token, ref);
  const doc = await ContentPlanChannelModel.findOneAndUpdate(
    { userId, platform: 'telegram', externalId: resolved.externalId },
    {
      $set: {
        botId: bot._id,
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
  await ContentPlanBotModel.updateOne({ _id: bot._id }, { $set: { status: 'connected', error: '' } });
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

export async function getOwnedChannel(userId: string, channelId: unknown) {
  if (typeof channelId !== 'string' || !mongoose.isValidObjectId(channelId)) {
    throw new DomainError('Выберите канал публикации.', { status: 400, code: 'CONTENT_PLAN_CHANNEL_REQUIRED' });
  }
  const channel = await ContentPlanChannelModel.findOne({ _id: channelId, userId }).lean();
  if (!channel) {
    throw new DomainError('Канал не найден.', { status: 404, code: 'CONTENT_PLAN_CHANNEL_NOT_FOUND' });
  }
  return channel;
}

async function ownedChannel(userId: string, channelId: unknown) {
  const channel = await getOwnedChannel(userId, channelId);
  if (channel.status !== 'connected' || !channel.canPost) {
    throw new DomainError('Канал не подключён к публикации.', { status: 409, code: 'CONTENT_PLAN_CHANNEL_NOT_READY' });
  }
  return channel;
}

function postFields(input: PostInput, channel: { platform: 'vk' | 'telegram' }, mediaId?: string): { text: string; title: string; status: ContentPlanStatus; scheduledAt: Date | null; timeZone: string; autoPublish: boolean; telegramHtml?: string } {
  const rich = channel.platform === 'telegram' && typeof input.telegramHtml === 'string' && input.telegramHtml.length <= 100_000
    ? normalizeTelegramRichText(input.telegramHtml) : undefined;
  const text = rich?.text ?? (typeof input.text === 'string' ? input.text.trim() : '');
  if (!text) {
    throw new DomainError('Добавьте текст поста.', { status: 400, code: 'CONTENT_PLAN_TEXT_REQUIRED' });
  }
  const limit = mediaId && channel.platform === 'telegram' ? 1024 : TEXT_LIMITS[channel.platform];
  if (text.length > limit) {
    throw new DomainError(
      `Текст длиннее лимита ${limit.toLocaleString('ru-RU')} символов.`,
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
    ...(rich ? { telegramHtml: rich.html } : {}),
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

async function validatePostMedia(userId: string, platform: string, id: unknown, postId?: string) {
  if (id === undefined || id === null) return undefined;
  if (platform === 'vk' && !vkPhotoEnabled()) throw new DomainError('Загрузка фото в ВК не настроена.', { status: 503, code: 'VK_PHOTO_DISABLED' });
  const media = await confirmMedia(userId, id);
  if (await ContentPlanPostModel.exists({ mediaId: media.id, ...(postId ? { _id: { $ne: postId } } : {}) })) {
    throw new DomainError('Фото уже прикреплено к другому посту.', { status: 409, code: 'MEDIA_ALREADY_ATTACHED' });
  }
  return media.id;
}

export async function createPost(userId: string, input: PostInput): Promise<ContentPlanPostDto> {
  const channel = await ownedChannel(userId, input.channelId);
  const mediaId = await validatePostMedia(userId, channel.platform, input.mediaId);
  const fields = postFields(input, channel, mediaId);
  const doc = await ContentPlanPostModel.create({
    userId,
    channelId: channel._id,
    platform: channel.platform,
    mediaId,
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
  const mediaId = await validatePostMedia(userId, channel.platform, input.mediaId === undefined ? post.mediaId : input.mediaId, id);
  const fields = postFields(input, channel, mediaId);
  const updated = await ContentPlanPostModel.findOneAndUpdate(
    { _id: id, userId, status: { $nin: ['published', 'publishing'] } },
    { $set: { ...fields, channelId: channel._id, platform: channel.platform, error: '', nextAttemptAt: null, ...(mediaId ? { mediaId } : {}) }, $unset: { ...(mediaId ? {} : { mediaId: 1 }), ...(fields.telegramHtml === undefined ? { telegramHtml: 1 } : {}) } },
    { new: true }
  );
  if (!updated) throw new DomainError('Пост уже отправляется или опубликован.', { status: 409, code: 'CONTENT_PLAN_POST_LOCKED' });
  return toPostDto(updated);
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
  const removed = await ContentPlanPostModel.deleteOne({ _id: id, userId, status: { $nin: ['published', 'publishing'] } });
  if (!removed.deletedCount) throw new DomainError('Пост уже отправляется или опубликован.', { status: 409, code: 'CONTENT_PLAN_POST_LOCKED' });
}

export async function getPlanMeta(userId: string) {
  const [channels, posts, telegramBot, writingRules, imageRules] = await Promise.all([
    listChannels(userId), listPosts(userId), getBotStatus(userId), getCommonWritingRules(userId), getCommonWritingRules(userId, 'image')
  ]);
  return {
    channels,
    posts,
    telegramBot,
    writingRules,
    imageRules,
    mediaEnabled: mediaEnabled(),
    vkPhotoEnabled: mediaEnabled() && vkPhotoEnabled()
  };
}
