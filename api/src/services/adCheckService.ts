import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { ChannelSnapshotModel } from '../models/ChannelSnapshot.js';
import { detectAdMarker } from './adDetection.js';
import { AD_CHECK_WINDOW_DAYS, summarizeAdCheck } from './adCheckUtils.js';
import { redis } from './redis.js';
import { RedisJsonCache } from './redisJsonCache.js';
import { getPostViewCurves, getSubscriberHistory, rememberViewedSource } from './snapshotService.js';
import { snapshotDateKey } from './snapshotUtils.js';
import { getTelegramAdCheckChannel, isTelegramAdCheckCached, normalizeTelegramChannelInput } from './telegramClient.js';
import { VkApiError } from './vkClient.js';
import { mapVkSource, POST_TEXT_LIMIT, VK_WALL_PAGE, vkRequest, type SourcePayload, type VkGroup, type VkPost } from './vkSourceLoader.js';

export type AdCheckPlatform = 'vk' | 'telegram';

export { AD_CHECK_WINDOW_DAYS } from './adCheckUtils.js';
const LIMIT_KEY_TTL_S = 2 * 86_400;

/** Platform from a link; a bare @name is ambiguous and needs the explicit platform. */
export function parseAdCheckSource(query: unknown, platformValue: unknown): { platform: AdCheckPlatform; id: string } {
  const value = typeof query === 'string' ? query.trim() : '';
  if (!value) throw new DomainError('Вставьте ссылку на сообщество VK или Telegram-канал.', { status: 400, code: 'AD_CHECK_SOURCE_REQUIRED' });
  if (/(youtube\.com|youtu\.be)\//i.test(value)) {
    throw new DomainError('Проверка YouTube-каналов пока недоступна: работают VK и Telegram.', { status: 400, code: 'AD_CHECK_PLATFORM_UNSUPPORTED' });
  }
  const platform = /(^|\/\/|\.)(t|telegram)\.me\//i.test(value) ? 'telegram'
    : /(^|\/\/|\.)vk\.(com|ru)\//i.test(value) ? 'vk'
      : platformValue === 'telegram' || platformValue === 'vk' ? platformValue : null;
  if (!platform) throw new DomainError('Выберите площадку или вставьте полную ссылку.', { status: 400, code: 'AD_CHECK_PLATFORM_REQUIRED' });
  return { platform, id: platform === 'telegram' ? normalizeTelegramChannelInput(value).toLowerCase() : normalizeVkSource(value) };
}

/** vk.com/name, club123, public123, -123 or 123 → a screen name or a numeric id. */
export function normalizeVkSource(value: string) {
  const path = value.trim().replace(/^(?:https?:\/\/)?(?:m\.)?vk\.(?:com|ru)\//i, '').split(/[/?#]/)[0].replace(/^@/, '');
  const numeric = path.match(/^(?:club|public|event)?-?(\d+)$/i);
  if (numeric) return numeric[1];
  if (/^[a-z0-9_.]{2,64}$/i.test(path)) return path.toLowerCase();
  throw new DomainError('Нужна ссылка на сообщество VK, например vk.com/socstat.', { status: 400, code: 'INVALID_VK_SOURCE' });
}

const vkCache = new RedisJsonCache<SourcePayload>('socstat:adcheck:vk', env.adCheckCacheTtlMs);

async function loadVkSource(userId: string, id: string): Promise<SourcePayload> {
  const cached = await vkCache.get(id);
  if (cached) return cached;
  let group: VkGroup | undefined;
  try {
    [group] = await vkRequest<VkGroup[]>(userId, 'groups.getById', { group_id: id, fields: 'members_count,photo_200,screen_name' });
  } catch (error) {
    if (error instanceof VkApiError && error.vkCode === 100) throw new DomainError('Сообщество VK не найдено.', { status: 404, code: 'VK_GROUP_NOT_FOUND' });
    throw error;
  }
  if (!group || group.deactivated) throw new DomainError('Сообщество VK не найдено или заблокировано.', { status: 404, code: 'VK_GROUP_NOT_FOUND' });
  if (group.is_closed) throw new DomainError('Это закрытое сообщество: его публикации видны только участникам.', { status: 403, code: 'VK_GROUP_CLOSED' });

  const wall = await vkRequest<{ count: number; items: VkPost[] }>(userId, 'wall.get', { owner_id: -group.id, count: VK_WALL_PAGE, filter: 'owner' });
  const payload = mapVkSource(group, wall.items, Date.now());
  await Promise.all([vkCache.set(id, payload), id !== payload.externalId ? vkCache.set(payload.externalId, payload) : undefined]);
  return payload;
}

async function loadTelegramSource(username: string): Promise<SourcePayload> {
  const { channel, posts, loadedAt } = await getTelegramAdCheckChannel(username, AD_CHECK_WINDOW_DAYS);
  return {
    platform: 'telegram',
    externalId: channel.username.toLowerCase(),
    name: channel.title,
    url: channel.url,
    // The avatar endpoint runs on the main session; the check page does without it.
    photo: null,
    subscribers: channel.subscribers,
    complete: true,
    loadedAt,
    posts: posts.map((post) => ({
      id: String(post.id),
      date: post.date,
      text: post.text.slice(0, POST_TEXT_LIMIT),
      url: post.url,
      views: post.views,
      reactions: post.reactions,
      comments: post.comments,
      forwards: post.forwards,
      ad: detectAdMarker({ text: post.text, links: post.links })
    }))
  };
}

function limitKey(userId: string) {
  return `socstat:adcheck:user:${userId}:${snapshotDateKey()}`;
}

/** Distinct sources checked today: opening the same source again is free. */
export async function getAdCheckUsage(userId: string, paid: boolean) {
  const limit = paid ? env.adCheckDailyLimitPaid : env.adCheckDailyLimitFree;
  const used = redis.isReady ? await redis.sCard(limitKey(userId)) : 0;
  return { used, limit, paid };
}

async function withinUserLimit(userId: string, source: string, limit: number) {
  const key = limitKey(userId);
  return await redis.sIsMember(key, source) || await redis.sCard(key) < limit;
}

/** Counted after a successful load, so a mistyped link does not spend the limit. */
async function countUserCheck(userId: string, source: string) {
  const key = limitKey(userId);
  await redis.sAdd(key, source);
  await redis.expire(key, LIMIT_KEY_TTL_S);
}

/** Service-wide budget of uncached Telegram checks per day, protecting the session account. */
async function consumeTelegramBudget() {
  const key = `socstat:adcheck:telegram:${snapshotDateKey()}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, LIMIT_KEY_TTL_S);
  return count <= env.adCheckTelegramMaxPerDay;
}

export async function runAdCheck(options: { userId: string; paid: boolean; query: unknown; platform: unknown }) {
  const { platform, id } = parseAdCheckSource(options.query, options.platform);

  const usage = await getAdCheckUsage(options.userId, options.paid);
  if (!await withinUserLimit(options.userId, `${platform}:${id}`, usage.limit)) {
    throw new DomainError(
      options.paid
        ? `Сегодня проверено ${usage.limit} источников — это дневной лимит. Завтра он обновится.`
        : `Без тарифа можно проверить ${usage.limit} источников в день. Завтра лимит обновится, а с тарифом — до ${env.adCheckDailyLimitPaid} в день.`,
      { status: 429, code: 'AD_CHECK_LIMIT' }
    );
  }
  if (platform === 'telegram' && !await isTelegramAdCheckCached(id, AD_CHECK_WINDOW_DAYS) && !await consumeTelegramBudget()) {
    throw new DomainError('Сегодня проверки Telegram-каналов исчерпаны. Повторите завтра — каналы, которые уже проверяли, открываются и сейчас.', { status: 429, code: 'AD_CHECK_TELEGRAM_BUDGET' });
  }

  const source = platform === 'vk' ? await loadVkSource(options.userId, id) : await loadTelegramSource(id);
  await countUserCheck(options.userId, `${platform}:${id}`);
  // Every checked source joins the nightly snapshots, so exact views at 24/48/72 hours appear in a few days.
  rememberViewedSource(platform, source.externalId, 'adcheck');

  const [curves, history, firstSnapshot] = await Promise.all([
    getPostViewCurves(platform, source.externalId, AD_CHECK_WINDOW_DAYS),
    getSubscriberHistory(platform, source.externalId, AD_CHECK_WINDOW_DAYS),
    ChannelSnapshotModel.findOne({ platform, externalId: source.externalId }, { _id: 0, date: 1 }).sort({ date: 1 }).lean()
  ]);
  const now = Date.now();
  return {
    platform,
    source: { id: source.externalId, name: source.name, url: source.url, photo: source.photo, subscribers: source.subscribers },
    loadedAt: source.loadedAt,
    windowDays: AD_CHECK_WINDOW_DAYS,
    complete: source.complete,
    ...summarizeAdCheck({ posts: source.posts, subscribers: source.subscribers, curves, windowDays: AD_CHECK_WINDOW_DAYS, complete: source.complete, now }),
    trackingSince: firstSnapshot?.date ?? null,
    history,
    posts: source.posts,
    usage: await getAdCheckUsage(options.userId, options.paid)
  };
}

export type AdCheckResult = Awaited<ReturnType<typeof runAdCheck>>;
