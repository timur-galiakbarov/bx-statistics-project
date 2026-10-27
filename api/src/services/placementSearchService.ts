import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { summarizeAdCheck } from './adCheckUtils.js';
import { isDeepseekConfigured } from './deepseekClient.js';
import {
  classifyGroups,
  cleanRegion,
  expandTopic,
  type AiUsage,
  type PlacementCategory,
  type PlacementLabel,
  type PlacementPlace
} from './placementClassifier.js';
import { redis } from './redis.js';
import { RedisJsonCache } from './redisJsonCache.js';
import { snapshotDateKey } from './snapshotUtils.js';
import { VkApiError, vkApiRequest } from './vkClient.js';
import { mapVkSource, vkRequest, type VkGroup, type VkPost } from './vkSourceLoader.js';

/** Rows of one search, the candidates the model sees and the posts loaded per community. */
export const PLACEMENT_ROWS = 30;
const CANDIDATES = 120;
// The whole wall page, as in the pre-ad check: frequent publics post 100 times in a few days.
const WALL_POSTS = 100;
// wall.get calls per execute: VK allows 25, but caps the response size — 10 walls of 100 posts already exceed it.
const EXECUTE_BATCH = 5;
const SEARCH_PAGE = 100;
const SEARCH_CONCURRENCY = 3;
const GET_BY_ID_BATCH = 400;
const LIMIT_KEY_TTL_S = 2 * 86_400;
const AI_STATS_TTL_S = 120 * 86_400;
const CITY_CACHE_TTL_MS = 30 * 86_400_000;
// Words of city publics: searched inside the city, they find what a name search misses.
const CITY_WORDS = ['подслушано', 'типичный', 'новости', 'инцидент', 'афиша', 'куда пойти', 'объявления', 'жесть', 'чп'];

export type PlacementCity = { id: number; title: string; region: string; area: string };

type VkSearchGroup = VkGroup & {
  type?: string;
  description?: string;
  contacts?: Array<{ user_id?: number; desc?: string }>;
};

export type PlacementContact = { label: string; url: string };

export type PlacementRow = {
  id: number;
  name: string;
  url: string;
  photo: string | null;
  members: number;
  category: PlacementCategory;
  fit: number;
  locked: false;
  /** Median current views of the last posts older than 72 hours. */
  views: number | null;
  viewsLower: number | null;
  viewsUpper: number | null;
  viewsToSubscribers: number | null;
  postsPerDay: number;
  adsPerWeek: number;
  adsShare: number | null;
  adMedianViews: number | null;
  organicMedianViews: number | null;
  engagement: number | null;
  /** The loaded posts cover all 30 days; otherwise frequencies refer to a shorter span. */
  complete: boolean;
  contacts: PlacementContact[];
  messageUrl: string;
};

/** A row past the free limit: what it is, without the metrics. */
export type PlacementLockedRow = Pick<PlacementRow, 'id' | 'name' | 'url' | 'photo' | 'members' | 'category'> & { locked: true };

export type PlacementSearchResult = {
  city: PlacementCity;
  district: string;
  topic: string;
  minMembers: number;
  /** Every community was labelled by DeepSeek; false — the rules filtered at least part of them. */
  aiUsed: boolean;
  aiQueries: string[];
  candidates: number;
  rows: PlacementRow[];
  loadedAt: string;
};

const cityCache = new RedisJsonCache<PlacementCity>('socstat:placements:city', CITY_CACHE_TTL_MS);
const searchCache = new RedisJsonCache<PlacementSearchResult>('socstat:placements:search', env.placementSearchCacheTtlMs);

/** City suggestions; each one is remembered, so the search knows its region without asking VK again. */
export async function searchCities(userId: string, query: string): Promise<PlacementCity[]> {
  const q = query.trim();
  if (q.length < 2) return [];
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
  const [city] = await vkRequest<Array<{ id: number; title: string }>>(userId, 'database.getCitiesById', { city_ids: cityId, lang: 'ru' });
  if (!city?.title) throw new DomainError('Город не найден. Выберите его из подсказок.', { status: 400, code: 'PLACEMENT_CITY_NOT_FOUND' });
  return { id: city.id, title: city.title, region: '', area: '' };
}

export type SearchQuery = { q: string; cityId?: number };

/**
 * Queries of one search: city-public words, the topic and the model's queries inside the city; the city
 * and region names without the city filter catch publics that do not set a city.
 */
export function buildQueries(place: PlacementPlace, aiQueries: string[]): SearchQuery[] {
  const inCity = [...CITY_WORDS, place.district, place.topic, ...aiQueries].map((q) => q.trim()).filter(Boolean);
  const region = cleanRegion(place.region);
  const queries: SearchQuery[] = [...inCity.map((q) => ({ q, cityId: place.cityId })), { q: place.city }];
  if (region && region.toLowerCase() !== place.city.toLowerCase()) queries.push({ q: region });
  if (place.district.trim()) queries.push({ q: `${place.district.trim()} ${place.city}` });
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = `${query.q.toLowerCase()}|${query.cityId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Local communities that fit the topic, best fit first, then the biggest. */
export function pickRows<T extends { id: number; members_count?: number }>(groups: T[], labels: Map<number, PlacementLabel>, limit = PLACEMENT_ROWS) {
  return groups
    .filter((group) => labels.get(group.id)?.local && (labels.get(group.id)?.fit ?? 0) >= 1)
    .sort((left, right) => labels.get(right.id)!.fit - labels.get(left.id)!.fit || (right.members_count ?? 0) - (left.members_count ?? 0))
    .slice(0, limit);
}

function contactsOf(group: VkSearchGroup): PlacementContact[] {
  return (group.contacts ?? [])
    .filter((contact) => contact.user_id)
    .slice(0, 2)
    .map((contact) => ({ label: contact.desc?.trim() || 'Контакт', url: `https://vk.com/id${contact.user_id}` }));
}

/** A table row from the community and its last posts: the same estimates as the pre-ad check, without snapshots. */
export function buildRow(group: VkSearchGroup, items: VkPost[], label: PlacementLabel, now: number): PlacementRow {
  const source = mapVkSource(group, items, now, WALL_POSTS);
  const summary = summarizeAdCheck({ posts: source.posts, subscribers: source.subscribers, curves: null, windowDays: 30, complete: source.complete, now });
  return {
    id: group.id,
    name: group.name,
    url: source.url,
    photo: source.photo,
    members: group.members_count ?? 0,
    category: label.category,
    fit: label.fit,
    locked: false,
    views: summary.estimate?.views ?? null,
    viewsLower: summary.estimate?.lower ?? null,
    viewsUpper: summary.estimate?.upper ?? null,
    viewsToSubscribers: summary.viewsToSubscribers,
    postsPerDay: summary.postsPerDay,
    adsPerWeek: summary.ads.perWeek,
    adsShare: summary.ads.share,
    adMedianViews: summary.ads.medianViews,
    organicMedianViews: summary.ads.organicMedianViews,
    engagement: summary.engagement,
    complete: source.complete,
    contacts: contactsOf(group),
    messageUrl: `https://vk.com/im?sel=-${group.id}`
  };
}

/** Without a tariff only the first rows show their metrics. */
export function lockRows(rows: PlacementRow[], paid: boolean, freeRows = env.placementFreeRows): Array<PlacementRow | PlacementLockedRow> {
  return rows.map((row, index) => paid || index < freeRows
    ? row
    : { id: row.id, name: row.name, url: row.url, photo: row.photo, members: row.members, category: row.category, locked: true as const });
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

async function loadWallBatch(userId: string, batch: number[], walls: Map<number, VkPost[]>): Promise<void> {
  const code = `return [${batch.map((id) => `API.wall.get({"owner_id":${-id},"count":${WALL_POSTS},"filter":"owner"})`).join(',')}];`;
  try {
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
  await mapLimit(batches, SEARCH_CONCURRENCY, (batch) => loadWallBatch(userId, batch, walls));
  return walls;
}

function searchKey(place: PlacementPlace, minMembers: number) {
  return [place.cityId, place.district, place.topic, minMembers].map((part) => String(part).trim().toLowerCase()).join('|');
}

function limitKey(userId: string) {
  return `socstat:placements:user:${userId}:${snapshotDateKey()}`;
}

/** Distinct searches today: repeating the same search is free. */
export async function getPlacementUsage(userId: string, paid: boolean) {
  const limit = paid ? env.placementDailyLimitPaid : env.placementDailyLimitFree;
  const used = redis.isReady ? await redis.sCard(limitKey(userId)) : 0;
  return { used, limit, paid, freeRows: env.placementFreeRows };
}

/** Service-wide budget of searches with DeepSeek per day; past it the rules filter. */
async function consumeAiBudget() {
  if (!env.placementAiEnabled || !isDeepseekConfigured()) return false;
  const key = `socstat:placements:ai:budget:${snapshotDateKey()}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, LIMIT_KEY_TTL_S);
  return count <= env.placementAiMaxPerDay;
}

/** Daily DeepSeek counters for the export: searches, those filtered by the rules, calls, tokens, time. */
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

export type PlacementSearchOptions = { userId: string; paid: boolean; cityId: unknown; district: unknown; topic: unknown; minMembers: unknown };

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export async function runPlacementSearch(options: PlacementSearchOptions) {
  const cityId = Number(options.cityId);
  if (!Number.isInteger(cityId) || cityId <= 0) throw new DomainError('Выберите город из подсказок.', { status: 400, code: 'PLACEMENT_CITY_REQUIRED' });
  const minMembers = [1_000, 5_000, 20_000].includes(Number(options.minMembers)) ? Number(options.minMembers) : 1_000;
  const city = await resolveCity(options.userId, cityId);
  const place: PlacementPlace = { cityId, city: city.title, region: city.region, district: text(options.district, 60), topic: text(options.topic, 80) };
  const key = searchKey(place, minMembers);

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
    result = await searchPlacements(options.userId, city, place, minMembers);
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

async function searchPlacements(userId: string, city: PlacementCity, place: PlacementPlace, minMembers: number): Promise<PlacementSearchResult> {
  // groups.search does not work with the service key: the user's own token is required.
  const userToken = await getVkAccessToken(userId);
  if (!userToken) throw new DomainError('Для подбора нужен вход через VK. Выйдите и войдите заново.', { status: 401, code: 'VK_TOKEN_REQUIRED' });

  const useAi = await consumeAiBudget();
  const aiUsage: AiUsage = { calls: 0, tokens: 0, ms: 0, failed: 0 };
  let aiQueries: string[] = [];
  if (useAi && place.topic) {
    aiQueries = await expandTopic(place, aiUsage).catch((error) => {
      console.error('DeepSeek topic expansion failed', error instanceof Error ? error.message : error);
      return [];
    });
  }

  const pool = new Map<number, VkSearchGroup>();
  const answers = await mapLimit(buildQueries(place, aiQueries), SEARCH_CONCURRENCY, (query) =>
    vkApiRequest<{ items: VkSearchGroup[] }>('groups.search', userToken, { q: query.q, count: SEARCH_PAGE, ...(query.cityId ? { city_id: query.cityId } : {}) })
      .catch((error) => {
        console.error(`groups.search failed for «${query.q}»`, error instanceof Error ? error.message : error);
        return { items: [] };
      }));
  for (const answer of answers) for (const group of answer.items) if (!pool.has(group.id)) pool.set(group.id, group);
  const open = [...pool.values()].filter((group) => !group.is_closed && !group.deactivated && group.type !== 'event').map((group) => group.id);
  if (!open.length) throw new DomainError('VK не нашёл сообществ по этому запросу. Проверьте город или уберите тему.', { status: 404, code: 'PLACEMENT_NOTHING_FOUND' });

  const details: VkSearchGroup[] = [];
  for (let index = 0; index < open.length; index += GET_BY_ID_BATCH) {
    details.push(...await vkRequest<VkSearchGroup[]>(userId, 'groups.getById', {
      group_ids: open.slice(index, index + GET_BY_ID_BATCH).join(','),
      fields: 'members_count,description,contacts,photo_200,screen_name'
    }));
  }
  const candidates = details
    .filter((group) => !group.deactivated && !group.is_closed && (group.members_count ?? 0) >= minMembers)
    .sort((left, right) => (right.members_count ?? 0) - (left.members_count ?? 0))
    .slice(0, CANDIDATES);

  const { labels, aiUsed } = await classifyGroups(place, candidates, useAi, aiUsage);
  await recordAiStats(useAi, useAi && aiUsed, aiUsage);
  const picked = pickRows(candidates, labels);
  const walls = await loadWalls(userId, picked.map((group) => group.id));
  const now = Date.now();
  return {
    city,
    district: place.district,
    topic: place.topic,
    minMembers,
    aiUsed: useAi && aiUsed,
    aiQueries,
    candidates: candidates.length,
    rows: picked.map((group) => buildRow(group, walls.get(group.id) ?? [], labels.get(group.id)!, now)),
    loadedAt: new Date(now).toISOString()
  };
}
