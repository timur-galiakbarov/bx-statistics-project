import mongoose from 'mongoose';
import { Api, TelegramClient } from 'telegram';
import { returnBigInt } from 'telegram/Helpers.js';
import { StringSession } from 'telegram/sessions/StringSession.js';
import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { TelegramPeerModel } from '../models/TelegramPeer.js';
import { CUSTOM_PERIOD_TOO_LONG_MESSAGE, getAnalyticsPeriod, getPreviousAnalyticsPeriod, type AnalyticsPeriodRange } from './analyticsUtils.js';
import { TtlCache } from './ttlCache.js';
import { getTelegramProxy } from './telegramProxy.js';
import { getTelegramAnalyticsCached, telegramQueue } from './telegramProtection.js';

export type TelegramChannel = {
  id: string;
  username: string;
  title: string;
  description: string;
  photo: string;
  subscribers: number | null;
  url: string;
  verified: boolean;
  canViewAdminStats: boolean;
};

export type TelegramPost = {
  id: number;
  date: string;
  timestamp: number;
  text: string;
  url: string;
  views: number;
  forwards: number;
  reactions: number;
  comments: number;
  engagement: number;
  mediaType: 'photo' | 'video' | 'document' | 'poll' | 'other' | null;
  mediaUrl?: string;
};

export class TelegramApiError extends DomainError {
  constructor(message: string, options: { status?: number; code: string }) {
    super(message, options);
    this.name = 'TelegramApiError';
  }
}

let clientPromise: Promise<TelegramClient> | null = null;
const cache = new TtlCache<unknown>(env.telegramCacheTtlMs);
const photoCache = new TtlCache<Buffer | null>(env.telegramCacheTtlMs);
const postMediaCache = new TtlCache<{ data: Buffer; contentType: string } | null>(env.telegramCacheTtlMs);
const channelEntityCache = new TtlCache<Api.Channel>(env.telegramCacheTtlMs);

export function normalizeTelegramChannelInput(input: string) {
  let value = input.trim();
  if (!value) throw new TelegramApiError('Укажите @username или ссылку на публичный Telegram-канал.', { status: 400, code: 'TELEGRAM_CHANNEL_REQUIRED' });
  try {
    if (/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i.test(value)) {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      value = url.pathname.split('/').filter(Boolean)[0] ?? '';
    }
  } catch {
    throw new TelegramApiError('Некорректная ссылка Telegram.', { status: 400, code: 'INVALID_TELEGRAM_CHANNEL' });
  }
  value = value.replace(/^@/, '').replace(/\/+$/, '');
  if (!/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(value)) {
    throw new TelegramApiError('Нужен публичный username канала, например @durov.', { status: 400, code: 'INVALID_TELEGRAM_CHANNEL' });
  }
  return value;
}

async function getClient() {
  if (!env.telegramApiId || !env.telegramApiHash || !env.telegramSession) {
    throw new TelegramApiError('Telegram MTProto не настроен. Заполните TELEGRAM_API_ID, TELEGRAM_API_HASH и TELEGRAM_SESSION.', { status: 503, code: 'TELEGRAM_NOT_CONFIGURED' });
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new TelegramClient(new StringSession(env.telegramSession), env.telegramApiId, env.telegramApiHash, {
        connectionRetries: 5,
        requestRetries: 3,
        autoReconnect: true,
        proxy: getTelegramProxy()
      });
      (client as unknown as { _loopStarted: boolean })._loopStarted = true;
      await client.connect();
      if (!await client.isUserAuthorized()) {
        await client.disconnect();
        throw new TelegramApiError('Telegram-сессия недействительна. Создайте новую командой npm run telegram:login --workspace @socstat/api.', { status: 503, code: 'TELEGRAM_SESSION_INVALID' });
      }
      return client;
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

/** Whether the channel still owns the username: it may have been renamed and the username taken by another chat. */
export function channelHasUsername(channel: { username?: string | null; usernames?: Array<{ username: string; active?: boolean }> | null }, username: string) {
  const wanted = username.toLowerCase();
  if (channel.username?.toLowerCase() === wanted) return true;
  return (channel.usernames ?? []).some((item) => item.active !== false && item.username.toLowerCase() === wanted);
}

// Stored peers are an optimization: without a database connection (smoke scripts) or on DB errors
// the client falls back to contacts.resolveUsername.
function peerStoreAvailable() {
  return mongoose.connection.readyState === 1;
}

async function rememberPeer(username: string, entity: Api.Channel) {
  if (!entity.accessHash || !peerStoreAvailable()) return;
  await TelegramPeerModel.updateOne(
    { username: username.toLowerCase() },
    { $set: { channelId: entity.id.toString(), accessHash: entity.accessHash.toString() } },
    { upsert: true }
  ).catch((error) => console.error(`Failed to store Telegram peer @${username}`, error));
}

async function forgetPeer(username: string) {
  if (!peerStoreAvailable()) return;
  await TelegramPeerModel.deleteOne({ username: username.toLowerCase() }).catch(() => undefined);
}

/** Opens a channel by the stored id and access_hash; null when there is no usable record. */
async function loadStoredChannel(client: TelegramClient, username: string) {
  if (!peerStoreAvailable()) return null;
  const peer = await TelegramPeerModel.findOne({ username: username.toLowerCase() }).lean().catch(() => null);
  if (!peer) return null;
  try {
    const full = await client.invoke(new Api.channels.GetFullChannel({
      channel: new Api.InputChannel({ channelId: returnBigInt(peer.channelId), accessHash: returnBigInt(peer.accessHash) })
    }));
    const entity = full.chats.find((chat): chat is Api.Channel => chat instanceof Api.Channel && chat.id.toString() === peer.channelId);
    if (entity?.broadcast && channelHasUsername(entity, username)) return { entity, full };
  } catch (error) {
    // A stale access_hash (other session account) or a channel that went private: resolve it again.
    const message = error instanceof Error ? error.message : '';
    if (!/CHANNEL_INVALID|CHANNEL_PRIVATE|CHANNEL_PUBLIC_GROUP_NA/i.test(message)) throw error;
  }
  await forgetPeer(username);
  return null;
}

async function resolveByUsername(client: TelegramClient, username: string) {
  const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
  const entity = resolved.chats.find((chat): chat is Api.Channel =>
    chat instanceof Api.Channel &&
    chat.broadcast === true
  );
  if (!(resolved.peer instanceof Api.PeerChannel) || !entity) {
    throw new TelegramApiError('Указанный адрес не является публичным Telegram-каналом.', { status: 400, code: 'TELEGRAM_NOT_A_CHANNEL' });
  }
  const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
  await rememberPeer(username, entity);
  return { entity, full };
}

async function resolveChannelEntity(input: string) {
  const username = normalizeTelegramChannelInput(input);
  try {
    const client = await getClient();
    const { entity, full } = await loadStoredChannel(client, username) ?? await resolveByUsername(client, username);
    channelEntityCache.set(username.toLowerCase(), entity);
    if (!(full.fullChat instanceof Api.ChannelFull)) {
      throw new TelegramApiError('Не удалось получить сведения о Telegram-канале.', { status: 502, code: 'TELEGRAM_API_ERROR' });
    }
    const resolvedUsername = entity.username ?? username;
    const channel: TelegramChannel = {
      id: entity.id.toString(),
      username: resolvedUsername,
      title: entity.title,
      description: full.fullChat.about,
      photo: `/api/telegram/channels/${encodeURIComponent(resolvedUsername)}/photo`,
      subscribers: full.fullChat.participantsCount ?? entity.participantsCount ?? null,
      url: `https://t.me/${resolvedUsername}`,
      verified: Boolean(entity.verified),
      canViewAdminStats: Boolean(full.fullChat.canViewStats)
    };
    return { client, entity, channel };
  } catch (error) {
    if (error instanceof TelegramApiError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/USERNAME_(?:NOT_OCCUPIED|INVALID)|CHANNEL_INVALID/i.test(message)) {
      throw new TelegramApiError('Telegram-канал не найден.', { status: 404, code: 'TELEGRAM_CHANNEL_NOT_FOUND' });
    }
    if (/FLOOD_WAIT/i.test(message)) {
      throw new TelegramApiError('Telegram временно ограничил частоту запросов. Повторите позже.', { status: 429, code: 'TELEGRAM_RATE_LIMITED' });
    }
    throw new TelegramApiError('Не удалось получить данные Telegram.', { status: 502, code: 'TELEGRAM_API_UNAVAILABLE' });
  }
}

async function getChannelEntity(input: string) {
  const username = normalizeTelegramChannelInput(input);
  const cached = channelEntityCache.get(username.toLowerCase());
  if (cached) return { client: await getClient(), entity: cached };
  const { client, entity } = await resolveChannelEntity(username);
  return { client, entity };
}

function mediaType(message: Api.Message): TelegramPost['mediaType'] {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.media instanceof Api.MessageMediaPoll) return 'poll';
  return message.media ? 'other' : null;
}

/** Reads channel posts between two unix timestamps, merging album parts into one post. */
async function collectChannelPosts(client: TelegramClient, entity: Api.Channel, channel: TelegramChannel, unixFrom: number, unixTo: number) {
  const postsByKey = new Map<string, TelegramPost>();
  for await (const message of client.iterMessages(entity, { limit: env.telegramMaxPosts * 2, offsetDate: unixTo + 1 })) {
    if (!(message instanceof Api.Message)) continue;
    if (message.date < unixFrom) break;
    if (message.date > unixTo || !message.post) continue;
    const reactions = message.reactions?.results.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0;
    const comments = message.replies?.replies ?? 0;
    const forwards = message.forwards ?? 0;
    const postMediaType = mediaType(message);
    const post: TelegramPost = {
      id: message.id,
      date: new Date(message.date * 1000).toISOString(),
      timestamp: message.date,
      text: message.message,
      url: `https://t.me/${channel.username}/${message.id}`,
      views: message.views ?? 0,
      forwards,
      reactions,
      comments,
      engagement: reactions + comments + forwards,
      mediaType: postMediaType,
      mediaUrl: postMediaType === 'photo' ? `/api/telegram/channels/${encodeURIComponent(channel.username)}/posts/${message.id}/media` : undefined
    };
    const groupKey = message.groupedId ? `album:${message.groupedId.toString()}` : `message:${message.id}`;
    const existing = postsByKey.get(groupKey);
    if (!existing) {
      postsByKey.set(groupKey, post);
    } else {
      const merged = {
        ...existing,
        id: Math.min(existing.id, post.id),
        text: existing.text || post.text,
        views: Math.max(existing.views, post.views),
        forwards: Math.max(existing.forwards, post.forwards),
        reactions: Math.max(existing.reactions, post.reactions),
        comments: Math.max(existing.comments, post.comments),
        mediaType: existing.mediaType ?? post.mediaType
      };
      postsByKey.set(groupKey, { ...merged, url: `https://t.me/${channel.username}/${merged.id}`, engagement: merged.reactions + merged.comments + merged.forwards });
    }
  }
  return [...postsByKey.values()];
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function summarizeTelegramPosts(channel: TelegramChannel, posts: TelegramPost[], period: AnalyticsPeriodRange) {
  const total = (key: 'views' | 'forwards' | 'reactions' | 'comments' | 'engagement') => posts.reduce((sum, post) => sum + post[key], 0);
  const views = total('views');
  const reactions = total('reactions');
  const comments = total('comments');
  const forwards = total('forwards');
  const actions = reactions + comments + forwards;
  const days = Math.max(1, Math.round((period.dateTo.getTime() - period.dateFrom.getTime()) / 86_400_000) + 1);
  const daily = new Map<string, { date: string; posts: number; views: number; reactions: number; comments: number; forwards: number }>();
  for (const post of posts) {
    const date = formatDate(new Date(post.timestamp * 1000));
    const item = daily.get(date) ?? { date, posts: 0, views: 0, reactions: 0, comments: 0, forwards: 0 };
    item.posts += 1; item.views += post.views; item.reactions += post.reactions; item.comments += post.comments; item.forwards += post.forwards;
    daily.set(date, item);
  }
  const dailySeries = [];
  for (let timestamp = period.dateFrom.getTime(); timestamp <= period.dateTo.getTime(); timestamp += 86_400_000) {
    const date = formatDate(new Date(timestamp));
    dailySeries.push(daily.get(date) ?? { date, posts: 0, views: 0, reactions: 0, comments: 0, forwards: 0 });
  }
  return {
    channel,
    period: { key: period.key, dateFrom: formatDate(period.dateFrom), dateTo: formatDate(period.dateTo) },
    summary: {
      posts: posts.length,
      views,
      reactions,
      comments,
      forwards,
      actions,
      averageViews: posts.length ? Math.round(views / posts.length) : 0,
      averageReachRate: channel.subscribers && posts.length ? Number((views / posts.length / channel.subscribers * 100).toFixed(2)) : null,
      engagementRate: views ? Number((actions / views * 100).toFixed(2)) : 0,
      postsPerWeek: Number((posts.length / days * 7).toFixed(1))
    },
    daily: dailySeries,
    posts: [...posts].sort((left, right) => right.timestamp - left.timestamp)
  };
}

export function summarizeTelegramAnalytics(channel: TelegramChannel, posts: TelegramPost[], period: AnalyticsPeriodRange) {
  const previousPeriod = getPreviousAnalyticsPeriod(period);
  const postsForPeriod = (range: AnalyticsPeriodRange) => posts.filter((post) => post.timestamp >= range.unixFrom && post.timestamp <= range.unixTo);
  const current = summarizeTelegramPosts(channel, postsForPeriod(period), period);
  const previous = summarizeTelegramPosts(channel, postsForPeriod(previousPeriod), previousPeriod);

  return {
    ...current,
    previous: {
      period: {
        dateFrom: previous.period.dateFrom,
        dateTo: previous.period.dateTo
      },
      summary: previous.summary,
      daily: previous.daily,
      posts: previous.posts
    }
  };
}

export async function resolveTelegramChannel(input: string, forceRefresh = false) {
  const username = normalizeTelegramChannelInput(input);
  const key = `channel:${username.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = cache.get(key) as TelegramChannel | undefined;
    if (cached) return cached;
  }
  const { channel } = await telegramQueue.run(() => resolveChannelEntity(username));
  cache.set(key, channel);
  return channel;
}

export async function getTelegramChannelPhoto(input: string, forceRefresh = false) {
  const username = normalizeTelegramChannelInput(input);
  const key = `photo:${username.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = photoCache.get(key);
    if (cached !== undefined) return cached;
  }

  try {
    const downloaded = await telegramQueue.run(async () => {
      const { client, entity } = await getChannelEntity(username);
      return client.downloadProfilePhoto(entity, { isBig: true });
    });
    const photo = Buffer.isBuffer(downloaded) && downloaded.length ? downloaded : null;
    photoCache.set(key, photo);
    return photo;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/FLOOD_WAIT/i.test(message)) {
      throw new TelegramApiError('Telegram временно ограничил загрузку аватарок. Повторите позже.', { status: 429, code: 'TELEGRAM_RATE_LIMITED' });
    }
    throw new TelegramApiError('Не удалось загрузить аватарку Telegram-канала.', { status: 502, code: 'TELEGRAM_PHOTO_UNAVAILABLE' });
  }
}

export async function getTelegramPostMedia(input: string, postIdValue: string, forceRefresh = false) {
  const username = normalizeTelegramChannelInput(input);
  const postId = Number(postIdValue);
  if (!Number.isSafeInteger(postId) || postId <= 0) {
    throw new TelegramApiError('Некорректный идентификатор публикации Telegram.', { status: 400, code: 'INVALID_TELEGRAM_POST_ID' });
  }
  const key = `post-media:${username.toLowerCase()}:${postId}`;
  if (!forceRefresh) {
    const cached = postMediaCache.get(key);
    if (cached !== undefined) return cached;
  }

  try {
    const [message] = await telegramQueue.run(async () => {
      const { client, entity } = await getChannelEntity(username);
      return client.getMessages(entity, { ids: postId });
    });
    if (!(message instanceof Api.Message) || !message.photo) {
      postMediaCache.set(key, null);
      return null;
    }
    const downloaded = await telegramQueue.run(async () => {
      const client = await getClient();
      return client.downloadMedia(message, {});
    });
    if (!Buffer.isBuffer(downloaded) || !downloaded.length) {
      postMediaCache.set(key, null);
      return null;
    }
    const media = { data: downloaded, contentType: 'image/jpeg' };
    postMediaCache.set(key, media);
    return media;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/FLOOD_WAIT/i.test(message)) {
      throw new TelegramApiError('Telegram временно ограничил загрузку изображений. Повторите позже.', { status: 429, code: 'TELEGRAM_RATE_LIMITED' });
    }
    throw new TelegramApiError('Не удалось загрузить изображение публикации.', { status: 502, code: 'TELEGRAM_POST_MEDIA_UNAVAILABLE' });
  }
}

/**
 * Fresh channel info and posts published since `unixFrom`, bypassing caches.
 * Used by the daily snapshot job; errors keep the same TelegramApiError codes.
 */
export async function getTelegramChannelSnapshot(input: string, unixFrom: number) {
  const username = normalizeTelegramChannelInput(input);
  try {
    return await telegramQueue.run(async () => {
      const { client, entity, channel } = await resolveChannelEntity(username);
      const posts = await collectChannelPosts(client, entity, channel, unixFrom, Math.floor(Date.now() / 1000));
      return { channel, posts };
    });
  } catch (error) {
    if (error instanceof TelegramApiError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/FLOOD_WAIT/i.test(message)) throw new TelegramApiError('Telegram временно ограничил частоту запросов. Повторите позже.', { status: 429, code: 'TELEGRAM_RATE_LIMITED' });
    throw new TelegramApiError('Не удалось загрузить публикации канала.', { status: 502, code: 'TELEGRAM_POSTS_UNAVAILABLE' });
  }
}

export async function getTelegramChannelAnalytics(input: string, periodValue: unknown, dateFromValue?: unknown, dateToValue?: unknown, forceRefresh = false) {
  let period: AnalyticsPeriodRange;
  try {
    period = getAnalyticsPeriod(periodValue, dateFromValue, dateToValue);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_ANALYTICS_PERIOD';
    throw new TelegramApiError(code === 'ANALYTICS_PERIOD_TOO_LONG' ? CUSTOM_PERIOD_TOO_LONG_MESSAGE : 'Укажите корректный период без будущих дат.', { status: 400, code });
  }
  const username = normalizeTelegramChannelInput(input);
  const previousPeriod = getPreviousAnalyticsPeriod(period);
  const key = `analytics:v3:${username.toLowerCase()}:${period.unixFrom}:${period.unixTo}`;
  if (!forceRefresh) {
    const cached = cache.get(key) as ReturnType<typeof summarizeTelegramAnalytics> | undefined;
    if (cached) return cached;
  }
  try {
    const result = await getTelegramAnalyticsCached(key, forceRefresh, async () => {
      const { client, entity, channel } = await resolveChannelEntity(username);
      const posts = await collectChannelPosts(client, entity, channel, previousPeriod.unixFrom, period.unixTo);
      return summarizeTelegramAnalytics(channel, posts, period);
    });
    cache.set(key, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TELEGRAM_ANALYTICS_IN_PROGRESS') throw new TelegramApiError('Такой анализ уже выполняется. Повторите через пару минут.', { status: 503, code: 'TELEGRAM_ANALYTICS_IN_PROGRESS' });
    if (/FLOOD_WAIT/i.test(message)) throw new TelegramApiError('Telegram временно ограничил частоту запросов. Повторите позже.', { status: 429, code: 'TELEGRAM_RATE_LIMITED' });
    throw new TelegramApiError('Не удалось загрузить публикации канала.', { status: 502, code: 'TELEGRAM_POSTS_UNAVAILABLE' });
  }
}
