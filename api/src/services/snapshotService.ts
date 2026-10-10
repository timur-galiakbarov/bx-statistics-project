import { ComparisonCollectionModel } from '../models/ComparisonCollection.js';
import { CompetitorSetModel } from '../models/CompetitorSet.js';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { ChannelSnapshotModel } from '../models/ChannelSnapshot.js';
import { PostSnapshotModel } from '../models/PostSnapshot.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { SnapshotDayModel } from '../models/SnapshotDay.js';
import { SnapshotSourceModel } from '../models/SnapshotSource.js';
import { UserModel } from '../models/User.js';
import { VkTokenModel } from '../models/VkToken.js';
import { redis } from './redis.js';
import { buildSubscriberHistory, chainedMedians, hoursSince, snapshotDateKey, snapshotGrowthForPeriod, VIEW_MILESTONE_HOURS, viewsAtHour, snapshotHour, secondsUntilNextSnapshotDate, telegramUsernameFromSource } from './snapshotUtils.js';
import { getTelegramChannelSnapshot, TelegramApiError } from './telegramClient.js';
import { VkApiError, vkApiRequest } from './vkClient.js';
import { getYoutubeVideos, resolveYoutubeChannel } from './youtubeClient.js';

export type SnapshotPlatform = 'vk' | 'youtube' | 'telegram';

type PlatformResult = { pending: number; saved: number; failed: number; postsFailed?: number; stoppedReason?: string; keys?: string[] };

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
// Fresh posts are on the first page of a wall even for busy communities.
const VK_WALL_PAGE_SIZE = 100;
// VK allows 3 requests per second per user token and 5 per service key of an app with under 10k users.
const VK_USER_KEY_DELAY_MS = 350;
const VK_SERVICE_KEY_DELAY_MS = 210;
// Errors after which a key is useless for the rest of the pass: invalid token, too many requests
// even after retries, captcha, method quota reached.
const VK_KEY_EXHAUSTED_CODES = new Set([5, 6, 14, 29]);
// Wall errors that will not go away today: access denied, deleted or banned community, private wall.
const VK_WALL_PERMANENT_CODES = new Set([7, 15, 18, 30]);

type VkWallSnapshotResponse = {
  items: Array<{
    id: number;
    date: number;
    views?: { count?: number };
    likes?: { count?: number };
    reposts?: { count?: number };
    comments?: { count?: number };
  }>;
};
// Telegram errors that make further requests in this pass pointless.
const TELEGRAM_STOP_CODES = new Set(['TELEGRAM_RATE_LIMITED', 'TELEGRAM_NOT_CONFIGURED', 'TELEGRAM_SESSION_INVALID']);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function emptyResult(): PlatformResult {
  return { pending: 0, saved: 0, failed: 0 };
}

/** Where a source in the daily snapshots came from; `SnapshotSource.note` values come after the first three. */
export type SnapshotSourceOrigin = 'dashboard' | 'competitors' | 'collections' | SnapshotSourceNote;
export type SnapshotSourceNote = 'viewed' | 'compare' | 'posts' | 'seed' | 'telegram-peer';

/** Normalized IDs of every source that should get a daily snapshot, with the origin each was first found in. */
async function collectSourcesWithOrigins() {
  const sources: Record<SnapshotPlatform, Set<string>> = { vk: new Set(), youtube: new Set(), telegram: new Set() };
  const origins = new Map<string, SnapshotSourceOrigin>();
  const add = (platform: string | undefined | null, source: { externalId?: string | null; vkGroupId?: string | null; handle?: string | null }, origin: SnapshotSourceOrigin) => {
    const id = normalizeSourceId(platform || 'vk', source);
    if (!id) return;
    const key = `${id.platform}:${id.externalId}`;
    if (!origins.has(key)) origins.set(key, origin);
    sources[id.platform].add(id.externalId);
  };

  // Sources are added in priority order: when Telegram hits its daily limit, dashboards go first.
  // VK communities removed from a dashboard keep their history going.
  const saved = await SavedGroupModel.find(
    { $or: [{ isTracked: { $ne: false } }, { platform: 'vk' }] },
    { platform: 1, externalId: 1, vkGroupId: 1, handle: 1 }
  ).lean();
  for (const source of saved) add(source.platform, source, 'dashboard');

  const competitors = await CompetitorSetModel.find({}).lean();
  for (const set of competitors) {
    add(set.platform, set, 'competitors');
    for (const source of set.competitors) add(source.platform ?? set.platform, source, 'competitors');
  }

  const collections = await ComparisonCollectionModel.find({}, { sources: 1 }).lean();
  for (const collection of collections) {
    for (const source of collection.sources) add(source.platform, source, 'collections');
  }

  const seeded = await SnapshotSourceModel.find({}, { platform: 1, externalId: 1, note: 1 }).sort({ createdAt: 1 }).lean();
  for (const source of seeded) add(source.platform, source, isSourceNote(source.note) ? source.note : 'seed');

  return { sources, origins };
}

export async function collectSnapshotSources() {
  return (await collectSourcesWithOrigins()).sources;
}

function isSourceNote(note: unknown): note is SnapshotSourceNote {
  return note === 'viewed' || note === 'compare' || note === 'posts' || note === 'seed' || note === 'telegram-peer';
}

function normalizeSourceId(platform: string, source: { externalId?: string | null; vkGroupId?: string | null; handle?: string | null }): { platform: SnapshotPlatform; externalId: string } | null {
  if (platform === 'telegram') {
    const username = telegramUsernameFromSource(source);
    return username ? { platform, externalId: username } : null;
  }
  const id = (source.externalId ?? source.vkGroupId ?? '').trim();
  if (platform === 'youtube') return /^UC[\w-]{20,}$/.test(id) ? { platform, externalId: id } : null;
  const vkId = id.replace(/^-/, '');
  return platform === 'vk' && /^\d+$/.test(vkId) ? { platform, externalId: vkId } : null;
}

const rememberedSources = new Set<string>();

/**
 * Adds a source seen in analytics, comparison or post analysis to the daily snapshots for good.
 * The first origin wins. Never throws.
 */
export function rememberViewedSource(platform: SnapshotPlatform, sourceId: string | number, note: 'viewed' | 'compare' | 'posts' = 'viewed') {
  const id = normalizeSourceId(platform, { externalId: String(sourceId) });
  if (!id) return;
  const key = `${id.platform}:${id.externalId}`;
  if (rememberedSources.has(key)) return;
  rememberedSources.add(key);
  SnapshotSourceModel.updateOne({ platform: id.platform, externalId: id.externalId }, { $setOnInsert: { note } }, { upsert: true })
    .catch((error) => {
      // A parallel upsert of the same source hits the unique index: the source is there anyway.
      if ((error as { code?: number }).code === 11000) return;
      rememberedSources.delete(key);
      console.error(`Failed to remember ${platform} source ${id.externalId}`, error);
    });
}

/** Size of the snapshot base per platform: sources in the daily list, by origin, and how many have any history. */
export async function getSnapshotBase() {
  const { sources, origins } = await collectSourcesWithOrigins();
  const withHistory = await ChannelSnapshotModel.aggregate<{ _id: SnapshotPlatform; count: number }>([
    { $group: { _id: { platform: '$platform', externalId: '$externalId' } } },
    { $group: { _id: '$_id.platform', count: { $sum: 1 } } }
  ]);
  const platforms = (['vk', 'youtube', 'telegram'] as const).map((platform) => {
    const byOrigin: Partial<Record<SnapshotSourceOrigin, number>> = {};
    for (const [key, origin] of origins) {
      if (key.startsWith(`${platform}:`)) byOrigin[origin] = (byOrigin[origin] ?? 0) + 1;
    }
    return {
      platform,
      sources: sources[platform].size,
      withHistory: withHistory.find((item) => item._id === platform)?.count ?? 0,
      byOrigin
    };
  });
  return { platforms };
}

async function pendingIds(platform: SnapshotPlatform, ids: Set<string>, date: string) {
  const done = new Set(await ChannelSnapshotModel.distinct('externalId', { platform, date }));
  return [...ids].filter((id) => !done.has(id));
}

async function saveChannelSnapshot(
  platform: SnapshotPlatform,
  externalId: string,
  date: string,
  data: { title?: string; subscribers: number | null; totalViews?: number; videoCount?: number; postsCollected?: boolean; postsAttempts?: number }
) {
  await ChannelSnapshotModel.updateOne({ platform, externalId, date }, { $set: data }, { upsert: true });
}

async function savePostSnapshots(platform: SnapshotPlatform, externalId: string, date: string, posts: PostSnapshotInput[], now: Date) {
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

type VkSnapshotKey = { kind: 'service' | 'admin' | 'extra'; token: string; delayMs: number };

class VkKeysExhaustedError extends Error {}

/**
 * Keys for VK snapshots in order of use: the app service key (requests on behalf of the app, with
 * its own quota), then tokens of admins and of the service accounts from SNAPSHOT_VK_IDS.
 * Tokens of regular users are never used.
 */
async function vkSnapshotKeys() {
  const keys: VkSnapshotKey[] = [];
  if (env.vkServiceKey) keys.push({ kind: 'service', token: env.vkServiceKey, delayMs: VK_SERVICE_KEY_DELAY_MS });
  const addUserKeys = async (kind: VkSnapshotKey['kind'], vkIds: string[]) => {
    if (!vkIds.length) return;
    const users = await UserModel.find({ vkId: { $in: vkIds } }, { _id: 1 }).lean();
    const tokens = await VkTokenModel.find({
      userId: { $in: users.map((user) => user._id) },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }]
    }).sort({ updatedAt: -1 }).lean();
    for (const token of tokens) keys.push({ kind, token: token.accessToken, delayMs: VK_USER_KEY_DELAY_MS });
  };
  await addUserKeys('admin', env.adminVkIds);
  await addUserKeys('extra', env.snapshotVkIds.filter((id) => !env.adminVkIds.includes(id)));
  return keys;
}

/** Sends each request with the current key and moves to the next one when VK stops serving it. */
class VkKeyPool {
  private index = 0;
  readonly used = new Set<string>();

  constructor(private readonly keys: VkSnapshotKey[]) {}

  get delayMs() {
    return this.keys[this.index]?.delayMs ?? VK_USER_KEY_DELAY_MS;
  }

  async request<T>(method: string, params: Record<string, string | number>) {
    for (let key = this.keys[this.index]; key; key = this.keys[this.index]) {
      try {
        const response = await vkApiRequest<T>(method, key.token, params);
        this.used.add(key.kind);
        return response;
      } catch (error) {
        if (!(error instanceof VkApiError && VK_KEY_EXHAUSTED_CODES.has(error.vkCode ?? -1))) throw error;
        console.warn(`VK snapshot key #${this.index} (${key.kind}) dropped on ${method}: code ${error.vkCode}`);
        this.index += 1;
      }
    }
    throw new VkKeysExhaustedError();
  }
}

/** VK sources of the day whose subscribers are saved but posts are not yet, with attempts left. */
async function vkPostsPending(sourceIds: Set<string>, date: string) {
  const ids: string[] = await ChannelSnapshotModel.distinct('externalId', {
    platform: 'vk',
    date,
    postsCollected: false,
    postsAttempts: { $lt: env.snapshotPostMaxAttempts }
  });
  return ids.filter((id) => sourceIds.has(id));
}

async function snapshotVk(ids: string[], sourceIds: Set<string>, date: string, now: Date): Promise<PlatformResult> {
  const result: PlatformResult = { ...emptyResult(), pending: ids.length, postsFailed: 0 };
  const postsPending = await vkPostsPending(sourceIds, date);
  if (!ids.length && !postsPending.length) return result;
  const keys = await vkSnapshotKeys();
  if (!keys.length) return { ...result, stoppedReason: 'VK_TOKEN_REQUIRED' };
  const pool = new VkKeyPool(keys);
  const finish = (stoppedReason?: string) => ({ ...result, keys: [...pool.used], ...(stoppedReason ? { stoppedReason } : {}) });

  for (let offset = 0; offset < ids.length; offset += VK_GROUPS_PER_REQUEST) {
    const batch = ids.slice(offset, offset + VK_GROUPS_PER_REQUEST);
    try {
      const groups = await pool.request<Array<{ id: number; name?: string; members_count?: number }>>('groups.getById', {
        group_ids: batch.join(','),
        fields: 'members_count'
      });
      for (const group of groups) {
        await saveChannelSnapshot('vk', String(group.id), date, {
          title: group.name,
          subscribers: group.members_count ?? null,
          postsCollected: false,
          postsAttempts: 0
        });
        result.saved += 1;
      }
      result.failed += batch.length - groups.length;
    } catch (error) {
      if (error instanceof VkKeysExhaustedError) return finish('VK_KEYS_EXHAUSTED');
      console.error('VK snapshot batch failed', error);
      result.failed += batch.length;
    }
  }

  // Post counters for the views curve, in a separate step: a failed wall request is retried by later
  // passes of the day without taking the subscriber snapshot again.
  const unixFrom = Math.floor(now.getTime() / 1000) - env.snapshotPostWindowDays * 86_400;
  for (const id of await vkPostsPending(sourceIds, date)) {
    await sleep(pool.delayMs);
    try {
      const wall = await pool.request<VkWallSnapshotResponse>('wall.get', { owner_id: -Number(id), count: VK_WALL_PAGE_SIZE });
      await savePostSnapshots('vk', id, date, wall.items
        .filter((post) => post.date >= unixFrom)
        .map((post) => ({
          postId: String(post.id),
          publishedAt: new Date(post.date * 1000),
          views: post.views?.count ?? null,
          reactions: post.likes?.count ?? null,
          comments: post.comments?.count ?? null,
          forwards: post.reposts?.count ?? null
        })), now);
      await ChannelSnapshotModel.updateOne({ platform: 'vk', externalId: id, date }, { $set: { postsCollected: true }, $inc: { postsAttempts: 1 } });
    } catch (error) {
      // Later passes of the day retry the rest without spending its attempts.
      if (error instanceof VkKeysExhaustedError) return finish('VK_KEYS_EXHAUSTED');
      // A closed or deleted wall has no posts to collect: retrying it all day is pointless.
      const permanent = error instanceof VkApiError && VK_WALL_PERMANENT_CODES.has(error.vkCode ?? -1);
      if (!permanent) {
        console.error(`VK wall snapshot failed for ${id}`, error);
        result.postsFailed! += 1;
      }
      await ChannelSnapshotModel.updateOne(
        { platform: 'vk', externalId: id, date },
        permanent ? { $set: { postsCollected: true }, $inc: { postsAttempts: 1 } } : { $inc: { postsAttempts: 1 } }
      );
    }
  }
  return finish();
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

const TELEGRAM_PAUSE_KEY = 'socstat:snapshots:telegram-paused';
const telegramAttemptsKey = (date: string) => `socstat:snapshots:telegram-attempts:${date}`;
const telegramFailedKey = (date: string) => `socstat:snapshots:telegram-failed:${date}`;
const TELEGRAM_DAY_KEYS_TTL_S = 2 * 86_400;

/**
 * The session is the owner's personal Telegram account, so the snapshot spends a bounded number of requests:
 * at most `snapshotTelegramMaxPerDay` attempts a day, a channel that failed is retried only the next day,
 * and a FLOOD_WAIT pauses the snapshot until the next day.
 */
async function snapshotTelegram(pending: string[], date: string, now: Date): Promise<PlatformResult> {
  const result: PlatformResult = { ...emptyResult(), pending: pending.length };
  if (!pending.length) return result;
  if (!redis.isOpen) return { ...result, stoppedReason: 'TELEGRAM_REDIS_UNAVAILABLE' };
  if (await redis.exists(TELEGRAM_PAUSE_KEY)) return { ...result, stoppedReason: 'TELEGRAM_PAUSED' };
  const failedToday = new Set(await redis.sMembers(telegramFailedKey(date)));
  const usernames = pending.filter((username) => !failedToday.has(username));
  const attempts = Number(await redis.get(telegramAttemptsKey(date))) || 0;
  const budget = Math.max(0, Math.min(env.snapshotTelegramMaxPerRun, env.snapshotTelegramMaxPerDay - attempts));
  if (usernames.length && !budget) return { ...result, stoppedReason: 'TELEGRAM_DAILY_LIMIT' };
  const unixFrom = Math.floor(now.getTime() / 1000) - env.snapshotPostWindowDays * 86_400;

  for (const [index, username] of usernames.slice(0, budget).entries()) {
    // Пауза между каналами оставляет общую MTProto-сессию свободной для запросов пользователей.
    if (index > 0) await sleep(env.snapshotTelegramDelayMs);
    await redis.multi().incr(telegramAttemptsKey(date)).expire(telegramAttemptsKey(date), TELEGRAM_DAY_KEYS_TTL_S).exec();
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
        if (error.code === 'TELEGRAM_RATE_LIMITED') {
          await redis.set(TELEGRAM_PAUSE_KEY, date, { EX: secondsUntilNextSnapshotDate(now) });
        }
        result.stoppedReason = error.code;
        break;
      }
      console.error(`Telegram snapshot failed for @${username}`, error);
      await redis.multi().sAdd(telegramFailedKey(date), username).expire(telegramFailedKey(date), TELEGRAM_DAY_KEYS_TTL_S).exec();
      result.failed += 1;
    }
  }
  if (!result.stoppedReason && usernames.length > budget && attempts + budget >= env.snapshotTelegramMaxPerDay) {
    result.stoppedReason = 'TELEGRAM_DAILY_LIMIT';
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

  const result: SnapshotPassResult = {
    date,
    vk: await snapshotVk(vkPending, sources.vk, date, now),
    youtube: await snapshotYoutube(youtubePending, date, now),
    telegram: await snapshotTelegram(telegramPending, date, now)
  };
  await saveCoverage(result, sources).catch((error) => console.error('Failed to save snapshot coverage', error));
  return result;
}

/** Records how many of today's sources are already snapshotted, so gaps show up before the day is over. */
async function saveCoverage(result: SnapshotPassResult, sources: Record<SnapshotPlatform, Set<string>>) {
  const { date } = result;
  const coverage = async (platform: SnapshotPlatform) => {
    const done: string[] = await ChannelSnapshotModel.distinct('externalId', { platform, date });
    const postsPending: string[] = platform === 'vk'
      ? await ChannelSnapshotModel.distinct('externalId', { platform, date, postsCollected: false })
      : [];
    return {
      sources: sources[platform].size,
      collected: done.filter((id) => sources[platform].has(id)).length,
      postsPending: postsPending.filter((id) => sources[platform].has(id)).length,
      stoppedReason: result[platform].stoppedReason ?? null
    };
  };
  const [vk, youtube, telegram] = await Promise.all([coverage('vk'), coverage('youtube'), coverage('telegram')]);
  await SnapshotDayModel.updateOne({ date }, { $set: { lastPassAt: new Date(), vk, youtube, telegram } }, { upsert: true });
}

/**
 * Coverage of the last `days` snapshot days, newest first. Days before coverage records existed are
 * counted from the snapshots themselves (expected sources unknown); a day without snapshots comes back as null.
 */
export async function getSnapshotCoverage(days: number) {
  const dates = Array.from({ length: days }, (_, index) => snapshotDateKey(new Date(Date.now() - index * 86_400_000)));
  const records = await SnapshotDayModel.find({ date: { $gte: dates.at(-1)! } }, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 }).lean();
  const byDate = new Map(records.map((record) => [record.date, record]));
  const missing = dates.filter((date) => !byDate.has(date));
  const counted = missing.length
    ? await ChannelSnapshotModel.aggregate<{ _id: { date: string; platform: SnapshotPlatform }; count: number }>([
      { $match: { date: { $in: missing } } },
      { $group: { _id: { date: '$date', platform: '$platform' }, count: { $sum: 1 } } }
    ])
    : [];
  const countOf = (date: string, platform: SnapshotPlatform) => {
    const count = counted.find((item) => item._id.date === date && item._id.platform === platform)?.count;
    return count ? { sources: null, collected: count, postsPending: 0, stoppedReason: null } : null;
  };
  return dates.map((date) => byDate.get(date) ?? {
    date,
    lastPassAt: null,
    vk: countOf(date, 'vk'),
    youtube: countOf(date, 'youtube'),
    telegram: countOf(date, 'telegram')
  });
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
    const touched = (['vk', 'youtube', 'telegram'] as const).some((platform) => result[platform].pending > 0) || Boolean(result.vk.postsFailed);
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

// Curve points every 24 hours while a post stays in the snapshot window.
const CURVE_STEP_HOURS = 24;
// A median over one or two posts says nothing about the channel.
const MIN_POSTS_FOR_MEDIAN = 3;

/**
 * How posts of a source gain views: per-post views at 24/48/72 hours and channel medians,
 * from the nightly post snapshots of the last `days` days of publications.
 */
export async function getPostViewCurves(platform: SnapshotPlatform, externalId: string, days: number) {
  const publishedAfter = new Date(Date.now() - days * 86_400_000);
  const snapshots = await PostSnapshotModel.find(
    { platform, externalId, publishedAt: { $gte: publishedAfter } },
    { _id: 0, postId: 1, publishedAt: 1, hoursSincePublished: 1, views: 1 }
  ).lean();

  const byPost = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) byPost.set(snapshot.postId, [...(byPost.get(snapshot.postId) ?? []), snapshot]);

  const curveHours = Array.from({ length: Math.floor((env.snapshotPostWindowDays * 24) / CURVE_STEP_HOURS) }, (_, index) => (index + 1) * CURVE_STEP_HOURS);
  const posts = [...byPost.entries()].map(([postId, points]) => {
    const sorted = [...points].sort((left, right) => left.hoursSincePublished - right.hoursSincePublished);
    const latest = sorted.at(-1)!;
    const curvePoints = sorted.map((point) => ({ hoursSincePublished: point.hoursSincePublished, views: point.views ?? null }));
    return {
      postId,
      publishedAt: latest.publishedAt.toISOString(),
      latestViews: latest.views ?? null,
      latestHours: latest.hoursSincePublished,
      milestones: Object.fromEntries(VIEW_MILESTONE_HOURS.map((hours) => [hours, viewsAtHour(curvePoints, hours)])) as Record<number, number | null>,
      curve: curveHours.map((hours) => viewsAtHour(curvePoints, hours))
    };
  }).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  const curve = chainedMedians(posts.map((post) => post.curve), MIN_POSTS_FOR_MEDIAN).map((item, index) => ({ hours: curveHours[index], ...item }));

  return {
    days,
    snapshotPosts: posts.length,
    // Milestones are points of the same chained curve, so 48 h never shows less than 24 h.
    milestones: VIEW_MILESTONE_HOURS.map((hours) => curve.find((point) => point.hours === hours) ?? { hours, median: null, posts: 0 }),
    curve,
    posts: posts.map(({ curve: _curve, ...post }) => post)
  };
}
