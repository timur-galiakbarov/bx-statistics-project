import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { ChannelSnapshotModel } from '../models/ChannelSnapshot.js';
import { PostSnapshotModel } from '../models/PostSnapshot.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { SnapshotSourceModel } from '../models/SnapshotSource.js';
import { UserModel } from '../models/User.js';
import { VkTokenModel } from '../models/VkToken.js';
import { redis } from './redis.js';
import { buildSubscriberHistory, hoursSince, snapshotDateKey, snapshotGrowthForPeriod, snapshotHour, telegramUsernameFromSource } from './snapshotUtils.js';
import { getTelegramChannelSnapshot, TelegramApiError } from './telegramClient.js';
import { vkApiRequest } from './vkClient.js';
import { getYoutubeVideos, resolveYoutubeChannel } from './youtubeClient.js';

export type SnapshotPlatform = 'vk' | 'youtube' | 'telegram';

type PlatformResult = { pending: number; saved: number; failed: number; stoppedReason?: string };

export type SnapshotPassResult = {
  date: string;
  vk: PlatformResult;
  youtube: PlatformResult;
  telegram: PlatformResult;
};

type PostSnapshotInput = {
  postId: string;
  publishedAt: Date;
  views: number | null;
  reactions?: number | null;
  comments?: number | null;
  forwards?: number | null;
};

const VK_GROUPS_PER_REQUEST = 400;
// Telegram errors that make further requests in this pass pointless.
const TELEGRAM_STOP_CODES = new Set(['TELEGRAM_RATE_LIMITED', 'TELEGRAM_NOT_CONFIGURED', 'TELEGRAM_SESSION_INVALID']);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function emptyResult(): PlatformResult {
  return { pending: 0, saved: 0, failed: 0 };
}

/** Normalized IDs of every source that should get a daily snapshot. */
export async function collectSnapshotSources() {
  const sources: Record<SnapshotPlatform, Set<string>> = { vk: new Set(), youtube: new Set(), telegram: new Set() };
  const add = (platform: string | undefined | null, source: { externalId?: string | null; vkGroupId?: string | null; handle?: string | null }) => {
    if (platform === 'telegram') {
      const username = telegramUsernameFromSource(source);
      if (username) sources.telegram.add(username);
      return;
    }
    const id = (source.externalId ?? source.vkGroupId ?? '').trim();
    if (platform === 'youtube' && /^UC[\w-]{20,}$/.test(id)) sources.youtube.add(id);
    if ((platform === 'vk' || !platform) && /^\d+$/.test(id.replace(/^-/, ''))) sources.vk.add(id.replace(/^-/, ''));
  };

  const saved = await SavedGroupModel.find({ isTracked: { $ne: false } }, { platform: 1, externalId: 1, vkGroupId: 1, handle: 1 }).lean();
  for (const source of saved) add(source.platform, source);
  const seeded = await SnapshotSourceModel.find({}, { platform: 1, externalId: 1 }).lean();
  for (const source of seeded) add(source.platform, source);

  return sources;
}

async function pendingIds(platform: SnapshotPlatform, ids: Set<string>, date: string) {
  const done = new Set(await ChannelSnapshotModel.distinct('externalId', { platform, date }));
  return [...ids].filter((id) => !done.has(id));
}

async function saveChannelSnapshot(
  platform: SnapshotPlatform,
  externalId: string,
  date: string,
  data: { title?: string; subscribers: number | null; totalViews?: number; videoCount?: number }
) {
  await ChannelSnapshotModel.updateOne({ platform, externalId, date }, { $set: data }, { upsert: true });
}

async function savePostSnapshots(platform: 'youtube' | 'telegram', externalId: string, date: string, posts: PostSnapshotInput[], now: Date) {
  if (!posts.length) return;
  await PostSnapshotModel.bulkWrite(posts.map((post) => ({
    updateOne: {
      filter: { platform, externalId, postId: post.postId, date },
      update: {
        $set: {
          publishedAt: post.publishedAt,
          hoursSincePublished: hoursSince(post.publishedAt, now),
          views: post.views,
          reactions: post.reactions ?? null,
          comments: post.comments ?? null,
          forwards: post.forwards ?? null
        }
      },
      upsert: true
    }
  })), { ordered: false });
}

/** Any working VK user token: groups.getById needs no special rights. Admin tokens go first. */
async function findVkAccessToken() {
  const admins = await UserModel.find({ vkId: { $in: env.adminVkIds } }, { _id: 1 }).lean();
  const adminToken = await VkTokenModel.findOne({ userId: { $in: admins.map((admin) => admin._id) } }).sort({ updatedAt: -1 }).lean();
  if (adminToken) return adminToken.accessToken;
  const anyToken = await VkTokenModel.findOne({}).sort({ updatedAt: -1 }).lean();
  return anyToken?.accessToken;
}

async function snapshotVk(ids: string[], date: string): Promise<PlatformResult> {
  const result: PlatformResult = { ...emptyResult(), pending: ids.length };
  if (!ids.length) return result;
  const accessToken = await findVkAccessToken();
  if (!accessToken) return { ...result, stoppedReason: 'VK_TOKEN_REQUIRED' };

  for (let offset = 0; offset < ids.length; offset += VK_GROUPS_PER_REQUEST) {
    const batch = ids.slice(offset, offset + VK_GROUPS_PER_REQUEST);
    try {
      const groups = await vkApiRequest<Array<{ id: number; name?: string; members_count?: number }>>('groups.getById', accessToken, {
        group_ids: batch.join(','),
        fields: 'members_count'
      });
      for (const group of groups) {
        await saveChannelSnapshot('vk', String(group.id), date, { title: group.name, subscribers: group.members_count ?? null });
        result.saved += 1;
      }
      result.failed += batch.length - groups.length;
    } catch (error) {
      console.error('VK snapshot batch failed', error);
      result.failed += batch.length;
    }
  }
  return result;
}

async function snapshotYoutube(ids: string[], date: string, now: Date): Promise<PlatformResult> {
  const result: PlatformResult = { ...emptyResult(), pending: ids.length };
  if (!ids.length) return result;
  if (!env.youtubeApiKey) return { ...result, stoppedReason: 'YOUTUBE_API_KEY_REQUIRED' };
  const publishedAfter = new Date(now.getTime() - env.snapshotPostWindowDays * 86_400_000);

  for (const id of ids) {
    try {
      const channel = await resolveYoutubeChannel(id, true);
      const videos = await getYoutubeVideos(channel, publishedAfter, now, true);
      await saveChannelSnapshot('youtube', id, date, {
        title: channel.name,
        subscribers: channel.followersCount,
        totalViews: channel.viewCount,
        videoCount: channel.videoCount
      });
      await savePostSnapshots('youtube', id, date, videos.map((video) => ({
        postId: video.id,
        publishedAt: new Date(video.publishedAt),
        views: video.views,
        reactions: video.likes,
        comments: video.comments
      })), now);
      result.saved += 1;
    } catch (error) {
      console.error(`YouTube snapshot failed for ${id}`, error);
      result.failed += 1;
    }
  }
  return result;
}

async function snapshotTelegram(usernames: string[], date: string, now: Date): Promise<PlatformResult> {
  const result: PlatformResult = { ...emptyResult(), pending: usernames.length };
  const unixFrom = Math.floor(now.getTime() / 1000) - env.snapshotPostWindowDays * 86_400;

  for (const [index, username] of usernames.slice(0, env.snapshotTelegramMaxPerRun).entries()) {
    // Пауза между каналами оставляет общую MTProto-сессию свободной для запросов пользователей.
    if (index > 0) await sleep(env.snapshotTelegramDelayMs);
    try {
      const { channel, posts } = await getTelegramChannelSnapshot(username, unixFrom);
      await saveChannelSnapshot('telegram', username, date, { title: channel.title, subscribers: channel.subscribers });
      await savePostSnapshots('telegram', username, date, posts.map((post) => ({
        postId: String(post.id),
        publishedAt: new Date(post.timestamp * 1000),
        views: post.views,
        reactions: post.reactions,
        comments: post.comments,
        forwards: post.forwards
      })), now);
      result.saved += 1;
    } catch (error) {
      if (error instanceof TelegramApiError && TELEGRAM_STOP_CODES.has(error.code)) {
        result.stoppedReason = error.code;
        break;
      }
      console.error(`Telegram snapshot failed for @${username}`, error);
      result.failed += 1;
    }
  }
  return result;
}

/**
 * Snapshots every source that has no snapshot for today yet. Safe to call repeatedly:
 * an interrupted pass (rate limit, restart) continues with the remaining sources.
 */
export async function runSnapshotPass(now = new Date()): Promise<SnapshotPassResult> {
  const date = snapshotDateKey(now);
  const sources = await collectSnapshotSources();
  const [vkPending, youtubePending, telegramPending] = await Promise.all([
    pendingIds('vk', sources.vk, date),
    pendingIds('youtube', sources.youtube, date),
    pendingIds('telegram', sources.telegram, date)
  ]);

  return {
    date,
    vk: await snapshotVk(vkPending, date),
    youtube: await snapshotYoutube(youtubePending, date, now),
    telegram: await snapshotTelegram(telegramPending, date, now)
  };
}

const RUN_LOCK_KEY = 'socstat:snapshots:run-lock';
const RUN_LOCK_TTL_MS = 2 * 60 * 60 * 1000;
const TICK_INTERVAL_MS = 15 * 60 * 1000;

let running = false;

async function tick() {
  if (running || snapshotHour() < env.snapshotStartHour) return;
  if (!redis.isOpen) {
    console.warn('Snapshots skipped: Redis is unavailable.');
    return;
  }
  // Only one API replica runs a pass at a time.
  const token = randomUUID();
  const locked = await redis.set(RUN_LOCK_KEY, token, { NX: true, PX: RUN_LOCK_TTL_MS });
  if (locked !== 'OK') return;

  running = true;
  try {
    const result = await runSnapshotPass();
    const touched = (['vk', 'youtube', 'telegram'] as const).some((platform) => result[platform].pending > 0);
    if (touched) console.log('Snapshot pass finished', JSON.stringify(result));
  } catch (error) {
    console.error('Snapshot pass failed', error);
  } finally {
    running = false;
    await redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      { keys: [RUN_LOCK_KEY], arguments: [token] }
    ).catch(() => undefined);
  }
}

export function startSnapshotScheduler() {
  if (!env.snapshotsEnabled) return;
  console.log(`Daily snapshots enabled: every ${TICK_INTERVAL_MS / 60_000} min after ${env.snapshotStartHour}:00 MSK`);
  setTimeout(() => void tick(), 60_000);
  setInterval(() => void tick(), TICK_INTERVAL_MS).unref();
}

export async function getSubscriberHistory(platform: SnapshotPlatform, externalId: string, days: number) {
  const fromDate = snapshotDateKey(new Date(Date.now() - (days - 1) * 86_400_000));
  const snapshots = await ChannelSnapshotModel.find(
    { platform, externalId, date: { $gte: fromDate } },
    { _id: 0, date: 1, subscribers: 1 }
  ).sort({ date: 1 }).lean();
  return buildSubscriberHistory(snapshots.map((snapshot) => ({ date: snapshot.date, subscribers: snapshot.subscribers ?? null })));
}

/** Subscriber change of a source over the dashboard period, based on daily snapshots. */
export async function getSnapshotGrowth(platform: SnapshotPlatform, externalId: string, dateFrom: string, dateTo: string, currentSubscribers: number | null) {
  const [points, first] = await Promise.all([
    ChannelSnapshotModel.find({ platform, externalId, date: { $gte: dateFrom } }, { _id: 0, date: 1, subscribers: 1 }).sort({ date: 1 }).lean(),
    ChannelSnapshotModel.findOne({ platform, externalId, subscribers: { $ne: null } }, { _id: 0, date: 1 }).sort({ date: 1 }).lean()
  ]);
  return snapshotGrowthForPeriod(
    points.map((point) => ({ date: point.date, subscribers: point.subscribers ?? null })),
    dateFrom,
    dateTo,
    snapshotDateKey(),
    currentSubscribers,
    first?.date ?? null
  );
}
