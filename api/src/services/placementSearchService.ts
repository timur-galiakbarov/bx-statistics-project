import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { normalizeVkSource } from './adCheckService.js';
import { summarizeAdCheck } from './adCheckUtils.js';
import { adSignals, type SellsAds } from './placementAdSignals.js';
import { isDeepseekConfigured } from './deepseekClient.js';
import {
  fallbackPlan,
  inParallel,
  judgeGroups,
  planBrief,
  planFromGroup,
  prefilterGroups,
  ruleVerdict,
  stem,
  type AdvertiserType,
  type AiUsage,
  type PlacementKind,
  type PlacementPlan,
  type PlacementPrefilter,
  type PlacementVerdict
} from './placementClassifier.js';
import { redis } from './redis.js';
import { RedisJsonCache } from './redisJsonCache.js';
import { rememberViewedSource } from './snapshotService.js';
import { snapshotDateKey } from './snapshotUtils.js';
import { VkApiError, vkApiRequest } from './vkClient.js';
import { mapVkSource, vkRequest, type VkGroup, type VkPost } from './vkSourceLoader.js';

/** Rows of one search; the shortlist whose posts the model reads; candidates it sees by name. */
export const PLACEMENT_ROWS = 30;
const SHORTLIST = 30;
const TOPIC_CANDIDATES = 240;
const CITY_CANDIDATES = 30;
// The whole wall page, as in the pre-ad check: frequent publics post 100 times in a few days.
const WALL_POSTS = 100;
// wall.get calls per execute: VK allows 25, but caps the response size — 10 walls of 100 posts already exceed it.
const EXECUTE_BATCH = 5;
const SEARCH_PAGE = 100;
const GET_BY_ID_BATCH = 400;
// VK allows a user token 3 requests per second.
const VK_INTERVAL_MS = 350;
const POSTS_FOR_MODEL = 6;
const ADS_FOR_MODEL = 4;
const LIMIT_KEY_TTL_S = 2 * 86_400;
const AI_STATS_TTL_S = 120 * 86_400;
const CITY_CACHE_TTL_MS = 30 * 86_400_000;
// Words of city publics: searched inside the city, they find the general publics any local business can use.
const CITY_WORDS = ['подслушано', 'типичный', 'новости', 'инцидент', 'афиша', 'чп'];

export type PlacementCity = { id: number; title: string; region: string; area: string };

type VkSearchGroup = VkGroup & {
  type?: string;
  description?: string;
  contacts?: Array<{ user_id?: number; desc?: string }>;
  city?: { id: number; title: string };
};

/** The advertiser's own community when the search starts from it. */
export type PlacementOwnGroup = { id: number; name: string; url: string; photo: string | null; members: number; views: number | null; closed: boolean };
/** Placements of comparable size: from half to twenty sizes of the own community. */
export type PlacementSizeRange = { min: number; max: number };

export type PlacementContact = { label: string; url: string };

export type PlacementRow = {
  id: number;
  name: string;
  url: string;
  photo: string | null;
  members: number;
  kind: PlacementKind;
  fit: number;
  /** Why the community suits the advertiser, by its posts; empty when the rules picked it. */
  reason: string;
  /** Who advertises there, by its ad posts. */
  advertisers: string;
  /** Few views for its size: under 100 or under 0.3% of members. */
  dead: boolean;
  /** Comparable in size to the own community; false when the search started from a description. */
  sizeMatch: boolean;
  /** Sells ads: yes — ads or promotion of communities seen; likely — only the contacts or the description say so. */
  sellsAds: SellsAds;
  sellsAdsNote: string;
  /** Posts promoting other VK communities in 30 days: someone buys community promotion here. */
  promoPosts: number;
  /** A line with a price from the description or the pinned post. */
  priceHint: string | null;
  locked: false;
  /** Median current views of the last posts older than 72 hours. */
  views: number | null;
  viewsLower: number | null;
  viewsUpper: number | null;
  viewsToSubscribers: number | null;
  postsPerDay: number;
  adsPerWeek: number;
  adsShare: number | null;
  engagement: number | null;
  /** The loaded posts cover all 30 days; otherwise frequencies refer to a shorter span. */
  complete: boolean;
  contacts: PlacementContact[];
  messageUrl: string;
};

/** A row past the free limit: what it is, without the metrics and the model's notes. */
export type PlacementLockedRow = Pick<PlacementRow, 'id' | 'name' | 'url' | 'photo' | 'members' | 'kind' | 'sizeMatch'> & { locked: true };

export type PlacementSearchResult = {
  /** The description, or the wishes added to the own community. */
  brief: string;
  ownGroup: PlacementOwnGroup | null;
  sizeRange: PlacementSizeRange | null;
  type: AdvertiserType;
  audience: string;
  city: PlacementCity | null;
  /** The model thinks the business is local but no city was given or found: the search went country-wide. */
  cityMissing: boolean;
  /** The model read the brief and answered every request; false — it was off or failed, and the rules did part of the work. */
  aiUsed: boolean;
  queries: string[];
  candidates: number;
  rows: PlacementRow[];
  loadedAt: string;
};

const cityCache = new RedisJsonCache<PlacementCity>('socstat:placements:city', CITY_CACHE_TTL_MS);
const searchCache = new RedisJsonCache<PlacementSearchResult>('socstat:placements:search', env.placementSearchCacheTtlMs);

// One queue per user token, shared by all requests of the search.
const vkQueues = new Map<string, number>();
async function vkSlot(userId: string) {
  const now = Date.now();
  const next = Math.max(now, vkQueues.get(userId) ?? 0);
  vkQueues.set(userId, next + VK_INTERVAL_MS);
  if (next > now) await new Promise((resolve) => setTimeout(resolve, next - now));
}

/** City suggestions; each one is remembered, so the search knows its region without asking VK again. */
export async function searchCities(userId: string, query: string): Promise<PlacementCity[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await vkSlot(userId);
  const response = await vkRequest<{ items: Array<{ id: number; title: string; region?: string; area?: string }> }>(userId, 'database.getCities', {
    country_id: 1, q, count: 10, need_all: 0, lang: 'ru'
  });
  const cities = response.items.map((item) => ({ id: item.id, title: item.title, region: item.region ?? '', area: item.area ?? '' }));
  await Promise.all(cities.map((city) => cityCache.set(String(city.id), city)));
  return cities;
}

async function resolveCity(userId: string, cityId: number): Promise<PlacementCity> {
  const cached = await cityCache.get(String(cityId));
  if (cached) return cached;
  await vkSlot(userId);
  const [city] = await vkRequest<Array<{ id: number; title: string }>>(userId, 'database.getCitiesById', { city_ids: cityId, lang: 'ru' });
  if (!city?.title) throw new DomainError('Город не найден. Выберите его из подсказок.', { status: 400, code: 'PLACEMENT_CITY_NOT_FOUND' });
  return { id: city.id, title: city.title, region: '', area: '' };
}

export type SearchQuery = { q: string; cityId?: number; source: PlacementKind };

/**
 * Queries of one search: the model's audience queries (inside the city for a local business); in a city also the
 * words of city publics and the city name without the filter, which catches publics that do not set a city.
 */
export function buildQueries(plan: PlacementPlan, city: PlacementCity | null): SearchQuery[] {
  const queries: SearchQuery[] = plan.queries.map((q) => ({ q, cityId: city?.id, source: 'topic' }));
  if (city) {
    queries.push(...CITY_WORDS.map((q) => ({ q, cityId: city.id, source: 'city' as const })), { q: city.title, source: 'city' });
  }
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = `${query.q.toLowerCase()}|${query.cityId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const VK_GROUP_LINK = /(?:https?:\/\/)?(?:m\.)?vk\.(?:com|ru)\/[a-z0-9_.]+|(?<![\p{L}\d_])(?:club|public)\d+(?![\p{L}\d_])/iu;

/** A VK community link in the description: its screen name or id, and the rest of the text as wishes. */
export function extractGroupRef(brief: string): { ref: string | null; rest: string } {
  const match = brief.match(VK_GROUP_LINK);
  if (!match) return { ref: null, rest: brief };
  try {
    return { ref: normalizeVkSource(match[0]), rest: brief.replace(match[0], ' ').replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '').replace(/\s+/g, ' ') };
  } catch {
    return { ref: null, rest: brief };
  }
}

/** From half to twenty sizes of the own community, but not below 1 000 and the upper bound not below 10 000. */
export function sizeRangeFor(members: number): PlacementSizeRange {
  return { min: Math.max(1_000, Math.round(members / 2)), max: Math.max(10_000, members * 20) };
}

const inRange = (members: number | undefined, range: PlacementSizeRange | null) => Boolean(range && members !== undefined && members >= range.min && members <= range.max);

/**
 * Communities worth reading posts of: no competitors; comparable in size first, so the giants do not take the shortlist;
 * then the model's best fit, then the biggest.
 */
export function pickShortlist<T extends { id: number; name: string; members_count?: number }>(
  groups: T[],
  labels: Map<number, PlacementPrefilter>,
  competitors: string[],
  range: PlacementSizeRange | null = null,
  limit = SHORTLIST
) {
  const competitorWords = competitors.map((item) => item.toLowerCase());
  return groups
    .filter((group) => {
      const label = labels.get(group.id);
      return label && label.fit >= 1 && !label.competitor && !competitorWords.some((item) => group.name.toLowerCase().includes(item));
    })
    .sort((left, right) => Number(inRange(right.members_count, range)) - Number(inRange(left.members_count, range))
      || labels.get(right.id)!.fit - labels.get(left.id)!.fit
      || (right.members_count ?? 0) - (left.members_count ?? 0))
    .slice(0, limit);
}

function contactsOf(group: VkSearchGroup): PlacementContact[] {
  return (group.contacts ?? [])
    .filter((contact) => contact.user_id)
    .slice(0, 2)
    .map((contact) => ({ label: contact.desc?.trim() || 'Контакт', url: `https://vk.com/id${contact.user_id}` }));
}

/** A table row from the community, its posts and the verdict: the same estimates as the pre-ad check, without snapshots. */
export function buildRow(group: VkSearchGroup, items: VkPost[], verdict: PlacementVerdict & { kind: PlacementKind }, now: number, range: PlacementSizeRange | null = null): PlacementRow {
  const source = mapVkSource(group, items, now, WALL_POSTS);
  const summary = summarizeAdCheck({ posts: source.posts, subscribers: source.subscribers, curves: null, windowDays: 30, complete: source.complete, now });
  const views = summary.estimate?.views ?? null;
  const signals = adSignals(group, items, summary.ads.posts, now);
  return {
    id: group.id,
    name: group.name,
    url: source.url,
    photo: source.photo,
    members: group.members_count ?? 0,
    kind: verdict.kind,
    fit: verdict.fit,
    reason: verdict.reason,
    advertisers: verdict.advertisers,
    dead: views !== null && (views < 100 || (summary.viewsToSubscribers !== null && summary.viewsToSubscribers < 0.3)),
    sizeMatch: inRange(group.members_count, range),
    ...signals,
    locked: false,
    views,
    viewsLower: summary.estimate?.lower ?? null,
    viewsUpper: summary.estimate?.upper ?? null,
    viewsToSubscribers: summary.viewsToSubscribers,
    postsPerDay: summary.postsPerDay,
    adsPerWeek: summary.ads.perWeek,
    adsShare: summary.ads.share,
    engagement: summary.engagement,
    complete: source.complete,
    contacts: contactsOf(group),
    messageUrl: `https://vk.com/im?sel=-${group.id}`
  };
}

const SELLS_RANK: Record<SellsAds, number> = { yes: 2, likely: 1, unknown: 0 };

/**
 * Live communities first, then comparable in size, the topic block before the city one, the model's fit; among equals
 * those that sell ads — one can actually buy a post there — then the views.
 */
export function sortRows(rows: PlacementRow[]) {
  return [...rows].sort((left, right) => Number(left.dead) - Number(right.dead)
    || Number(right.sizeMatch) - Number(left.sizeMatch)
    || Number(left.kind !== 'topic') - Number(right.kind !== 'topic')
    || right.fit - left.fit
    || SELLS_RANK[right.sellsAds] - SELLS_RANK[left.sellsAds]
    || (right.views ?? -1) - (left.views ?? -1));
}

/** Without a tariff only the first rows show their metrics. */
export function lockRows(rows: PlacementRow[], paid: boolean, freeRows = env.placementFreeRows): Array<PlacementRow | PlacementLockedRow> {
  return rows.map((row, index) => paid || index < freeRows
    ? row
    : { id: row.id, name: row.name, url: row.url, photo: row.photo, members: row.members, kind: row.kind, sizeMatch: row.sizeMatch, locked: true as const });
}

/** Post texts the model reads: the latest ordinary posts and the latest ad posts. */
export function postTexts(group: VkGroup, items: VkPost[], now: number) {
  const posts = mapVkSource(group, items, now, WALL_POSTS).posts.filter((post) => post.text.trim());
  return {
    posts: posts.filter((post) => !post.ad).slice(0, POSTS_FOR_MODEL).map((post) => post.text.replace(/\s+/g, ' ')),
    ads: posts.filter((post) => post.ad).slice(0, ADS_FOR_MODEL).map((post) => post.text.replace(/\s+/g, ' '))
  };
}

async function loadWallBatch(userId: string, batch: number[], walls: Map<number, VkPost[]>): Promise<void> {
  const code = `return [${batch.map((id) => `API.wall.get({"owner_id":${-id},"count":${WALL_POSTS},"filter":"owner"})`).join(',')}];`;
  try {
    await vkSlot(userId);
    // A failed wall.get inside execute comes back as false, the others still answer.
    const response = await vkRequest<Array<{ items?: VkPost[] } | false>>(userId, 'execute', { code });
    batch.forEach((id, index) => {
      const wall = response[index];
      if (wall && Array.isArray(wall.items)) walls.set(id, wall.items);
    });
  } catch (error) {
    // Walls with long posts can still overflow the response: halve the batch; a single wall is left without posts.
    if (!(error instanceof VkApiError && /too big/i.test(error.message)) || batch.length === 1) {
      console.error(`Failed to load walls ${batch.join(',')}`, error instanceof Error ? error.message : error);
      return;
    }
    const middle = Math.ceil(batch.length / 2);
    await Promise.all([loadWallBatch(userId, batch.slice(0, middle), walls), loadWallBatch(userId, batch.slice(middle), walls)]);
  }
}

async function loadWalls(userId: string, ids: number[]) {
  const walls = new Map<number, VkPost[]>();
  const batches: number[][] = [];
  for (let index = 0; index < ids.length; index += EXECUTE_BATCH) batches.push(ids.slice(index, index + EXECUTE_BATCH));
  await inParallel(batches, 3, (batch) => loadWallBatch(userId, batch, walls));
  return walls;
}

export function normalizeBrief(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 300) : '';
}

function searchKey(brief: string, cityId: number | null, groupRef: string | null) {
  return `${cityId ?? ''}|${groupRef ? `g:${groupRef.toLowerCase()}|` : ''}${brief.toLowerCase()}`;
}

function limitKey(userId: string) {
  return `socstat:placements:user:${userId}:${snapshotDateKey()}`;
}

/** Distinct searches today: repeating the same search is free. */
export async function getPlacementUsage(userId: string, paid: boolean) {
  const limit = paid ? env.placementDailyLimitPaid : env.placementDailyLimitFree;
  const used = redis.isReady ? await redis.sCard(limitKey(userId)) : 0;
  return { used, limit, paid, paidLimit: env.placementDailyLimitPaid, freeRows: env.placementFreeRows };
}

/** Service-wide budget of searches with DeepSeek per day; past it the rules work. */
async function consumeAiBudget() {
  if (!env.placementAiEnabled || !isDeepseekConfigured()) return false;
  const key = `socstat:placements:ai:budget:${snapshotDateKey()}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, LIMIT_KEY_TTL_S);
  return count <= env.placementAiMaxPerDay;
}

/** Daily DeepSeek counters for the export: searches, those finished by the rules, calls, tokens, time. */
async function recordAiStats(aiWanted: boolean, aiUsed: boolean, usage: AiUsage) {
  const key = `socstat:placements:ai:stats:${snapshotDateKey()}`;
  try {
    await redis.multi()
      .hIncrBy(key, 'searches', 1)
      .hIncrBy(key, 'fallbacks', aiUsed ? 0 : 1)
      .hIncrBy(key, 'aiWanted', aiWanted ? 1 : 0)
      .hIncrBy(key, 'calls', usage.calls)
      .hIncrBy(key, 'failed', usage.failed)
      .hIncrBy(key, 'tokens', usage.tokens)
      .hIncrBy(key, 'ms', usage.ms)
      .expire(key, AI_STATS_TTL_S)
      .exec();
  } catch (error) {
    console.error('Failed to record placement AI stats', error);
  }
}

export type PlacementSearchOptions = { userId: string; paid: boolean; brief: unknown; cityId: unknown; groupId?: unknown };

export async function runPlacementSearch(options: PlacementSearchOptions) {
  const text = normalizeBrief(options.brief);
  // The own community comes from the list (groupId) or from a link in the description; the rest of the text is wishes.
  const picked = typeof options.groupId === 'string' && /^\d{1,12}$/.test(options.groupId) ? options.groupId : null;
  const extracted = picked ? { ref: picked, rest: text } : extractGroupRef(text);
  // A link by screen name and the same community picked from the list are one search: the cache and the limit go by id.
  const groupRef = extracted.ref && !/^\d+$/.test(extracted.ref) ? await resolveGroupId(options.userId, extracted.ref) : extracted.ref;
  const brief = extracted.rest;
  if (!groupRef && brief.length < 3) throw new DomainError('Опишите, что рекламируете, или выберите свою группу: например, «шиномонтаж в Уфе» или vk.com/ваша_группа.', { status: 400, code: 'PLACEMENT_BRIEF_REQUIRED' });
  const cityId = options.cityId === undefined || options.cityId === '' ? null : Number(options.cityId);
  if (cityId !== null && (!Number.isInteger(cityId) || cityId <= 0)) throw new DomainError('Выберите город из подсказок.', { status: 400, code: 'PLACEMENT_CITY_INVALID' });
  const key = searchKey(brief, cityId, groupRef);

  const usage = await getPlacementUsage(options.userId, options.paid);
  const limitSet = limitKey(options.userId);
  if (!await redis.sIsMember(limitSet, key) && await redis.sCard(limitSet) >= usage.limit) {
    throw new DomainError(
      options.paid
        ? `Сегодня сделано ${usage.limit} подборов — это дневной лимит. Завтра он обновится.`
        : `Без тарифа доступен ${usage.limit} подбор в день. Завтра лимит обновится, а с тарифом — до ${env.placementDailyLimitPaid} подборов и все площадки в таблице.`,
      { status: 429, code: 'PLACEMENT_LIMIT' }
    );
  }

  let result = await searchCache.get(key);
  let cached = true;
  if (!result) {
    cached = false;
    result = await searchPlacements(options.userId, brief, cityId, groupRef);
    await searchCache.set(key, result);
  }
  // Counted after a successful search, so an error does not spend the limit.
  await redis.sAdd(limitSet, key);
  await redis.expire(limitSet, LIMIT_KEY_TTL_S);
  return {
    ...result,
    cached,
    rows: lockRows(result.rows, options.paid),
    usage: await getPlacementUsage(options.userId, options.paid)
  };
}

async function resolveGroupId(userId: string, screenName: string) {
  try {
    await vkSlot(userId);
    const [group] = await vkRequest<VkSearchGroup[]>(userId, 'groups.getById', { group_id: screenName });
    if (group?.id) return String(group.id);
  } catch (error) {
    if (!(error instanceof VkApiError && error.vkCode === 100)) throw error;
  }
  throw new DomainError('Не нашли сообщество VK по этой ссылке. Проверьте её или выберите группу из списка.', { status: 404, code: 'PLACEMENT_GROUP_NOT_FOUND' });
}

/** The own community with its last posts: what it is about, its size and typical views. */
async function loadOwnGroup(userId: string, ref: string) {
  let group: VkSearchGroup | undefined;
  try {
    await vkSlot(userId);
    [group] = await vkRequest<VkSearchGroup[]>(userId, 'groups.getById', { group_id: ref, fields: 'members_count,description,city,photo_200,screen_name' });
  } catch (error) {
    if (!(error instanceof VkApiError && error.vkCode === 100)) throw error;
  }
  if (!group || group.deactivated) throw new DomainError('Не нашли сообщество VK по этой ссылке. Проверьте её или выберите группу из списка.', { status: 404, code: 'PLACEMENT_GROUP_NOT_FOUND' });
  const items = group.is_closed ? [] : (await loadWalls(userId, [group.id])).get(group.id) ?? [];
  const now = Date.now();
  const source = mapVkSource(group, items, now, WALL_POSTS);
  const summary = summarizeAdCheck({ posts: source.posts, subscribers: source.subscribers, curves: null, windowDays: 30, complete: source.complete, now });
  const own: PlacementOwnGroup = {
    id: group.id,
    name: group.name,
    url: source.url,
    photo: source.photo,
    members: group.members_count ?? 0,
    views: summary.estimate?.views ?? null,
    closed: Boolean(group.is_closed)
  };
  return { own, group, posts: postTexts(group, items, now).posts };
}

async function searchPlacements(userId: string, brief: string, cityId: number | null, groupRef: string | null): Promise<PlacementSearchResult> {
  // groups.search does not work with the service key: the user's own token is required.
  const userToken = await getVkAccessToken(userId);
  if (!userToken) throw new DomainError('Для подбора нужен вход через VK. Выйдите и войдите заново.', { status: 401, code: 'VK_TOKEN_REQUIRED' });

  const owned = groupRef ? await loadOwnGroup(userId, groupRef) : null;
  const useAi = await consumeAiBudget();
  const aiUsage: AiUsage = { calls: 0, tokens: 0, ms: 0, failed: 0 };
  const modelPlan = !useAi ? null : owned
    ? await planFromGroup({ name: owned.own.name, members: owned.own.members, description: owned.group.description ?? '', city: owned.group.city?.title ?? null, posts: owned.posts, wishes: brief }, aiUsage)
    : await planBrief(brief, aiUsage);
  const plan = modelPlan ?? fallbackPlan(owned ? `${owned.own.name} ${brief}`.trim() : brief, cityId !== null);
  // The model reads the task as text: for the own community — its name, audience and the wishes.
  const task = owned ? `Сообщество «${owned.own.name}» (${owned.own.members} подписчиков). ${plan.audience}${brief ? ` Пожелания: ${brief}` : ''}` : brief;

  let city = cityId !== null ? await resolveCity(userId, cityId) : null;
  if (!city && plan.local && owned?.group.city?.id) city = await resolveCity(userId, owned.group.city.id).catch(() => null);
  if (!city && plan.local && plan.city) city = (await searchCities(userId, plan.city).catch(() => []))[0] ?? null;
  const cityMissing = plan.local && !city;
  const range = owned && owned.own.members > 0 ? sizeRangeFor(owned.own.members) : null;
  // The own community gets nightly snapshots: the base for measuring what the bought ads bring.
  if (owned) rememberViewedSource('vk', owned.own.id, 'placement');

  const pool = new Map<number, VkSearchGroup>();
  const sources = new Map<number, PlacementKind>();
  const answers = await inParallel(buildQueries(plan, city), 4, async (query) => {
    await vkSlot(userId);
    const params = { q: query.q, count: SEARCH_PAGE, ...(query.cityId ? { city_id: query.cityId } : {}) };
    const answer = await vkApiRequest<{ items: VkSearchGroup[] }>('groups.search', userToken, params).catch((error) => {
      console.error(`groups.search failed for «${query.q}»`, error instanceof Error ? error.message : error);
      return { items: [] as VkSearchGroup[] };
    });
    return { source: query.source, items: answer.items };
  });
  for (const answer of answers) {
    for (const group of answer.items) {
      if (pool.has(group.id)) continue;
      pool.set(group.id, group);
      sources.set(group.id, answer.source);
    }
  }
  const open = [...pool.values()].filter((group) => !group.is_closed && !group.deactivated && group.type !== 'event' && group.id !== owned?.own.id).map((group) => group.id);
  if (!open.length) throw new DomainError('VK не нашёл сообществ по этому запросу. Опишите задачу иначе или выберите другой город.', { status: 404, code: 'PLACEMENT_NOTHING_FOUND' });

  const details: VkSearchGroup[] = [];
  for (let index = 0; index < open.length; index += GET_BY_ID_BATCH) {
    await vkSlot(userId);
    details.push(...await vkRequest<VkSearchGroup[]>(userId, 'groups.getById', {
      group_ids: open.slice(index, index + GET_BY_ID_BATCH).join(','),
      fields: 'members_count,description,contacts,photo_200,screen_name'
    }));
  }
  const minMembers = city ? 1_000 : 3_000;
  const alive = details
    .filter((group) => !group.deactivated && !group.is_closed && (group.members_count ?? 0) >= minMembers)
    .sort((left, right) => (right.members_count ?? 0) - (left.members_count ?? 0));
  const candidates = [
    ...alive.filter((group) => sources.get(group.id) === 'topic').slice(0, TOPIC_CANDIDATES),
    ...alive.filter((group) => sources.get(group.id) === 'city').slice(0, CITY_CANDIDATES)
  ];

  const cityStems = city ? [...new Set([city.title, city.region].join(' ').split(/[\s-]+/).filter((item) => item.length >= 4 && !/^(республика|область|край)$/i.test(item)).map(stem))] : [];
  const rule = (group: VkSearchGroup) => ruleVerdict(group, sources.get(group.id) ?? 'topic', cityStems);
  const prefilter = modelPlan ? await prefilterGroups(task, plan, city?.title ?? null, candidates, aiUsage) : new Map<number, PlacementPrefilter>();
  // A community the model skipped in its answer gets the rules quietly; a failed request marks the whole search.
  for (const group of candidates) {
    if (!prefilter.has(group.id)) prefilter.set(group.id, { fit: rule(group).fit, competitor: false });
  }
  const shortlist = pickShortlist(candidates, prefilter, plan.competitors, range);

  const walls = await loadWalls(userId, shortlist.map((group) => group.id));
  const now = Date.now();
  const verdicts = modelPlan
    ? await judgeGroups(task, plan, city?.title ?? null, shortlist.map((group) => ({
      id: group.id,
      name: group.name,
      members: group.members_count ?? 0,
      ...postTexts(group, walls.get(group.id) ?? [], now)
    })), aiUsage)
    : new Map<number, PlacementVerdict>();
  const rows: PlacementRow[] = [];
  for (const group of shortlist) {
    const verdict = verdicts.get(group.id) ?? rule(group);
    if (verdict.fit < 1 || verdict.competitor || verdict.kind === 'none') continue;
    rows.push(buildRow(group, walls.get(group.id) ?? [], { ...verdict, kind: verdict.kind }, now, range));
  }
  const aiUsed = Boolean(modelPlan) && aiUsage.failed === 0;
  await recordAiStats(useAi, aiUsed, aiUsage);

  return {
    brief,
    ownGroup: owned?.own ?? null,
    sizeRange: range,
    type: plan.type,
    audience: plan.audience,
    city,
    cityMissing,
    aiUsed,
    queries: plan.queries,
    candidates: candidates.length,
    rows: sortRows(rows).slice(0, PLACEMENT_ROWS),
    loadedAt: new Date(now).toISOString()
  };
}
