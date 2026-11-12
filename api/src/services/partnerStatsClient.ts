import { vkApiRequest } from './vkClient.js';

// Клиент partnerStats — замена stats.get и stats.getPostReach, которые VK отключает 7 декабря.
// Особенности, проверенные спайком (docs/partner-stats-spike.md):
//  - методы работают на текущей версии API 5.131;
//  - интервалы `interval=day` режутся по московским суткам;
//  - окно за один запрос — не больше месяца, поэтому период режется на окна;
//  - на стыке окон VK может вернуть один и тот же день, поэтому интервалы склеиваются по
//    `period_from` без дублей;
//  - `owner_id` сообщества передаётся со знаком минус;
//  - списки `content_ids` уходят POST-ом (в URL они не помещаются).

export const PARTNER_STATS_DAY_WINDOW_DAYS = 30;
export const PARTNER_STATS_WEEK_WINDOW_DAYS = 180;
export const PARTNER_STATS_MONTH_WINDOW_DAYS = 360;
export const PARTNER_STATS_CONTENT_IDS_CHUNK = 100;

/** VK считает статистику по московским суткам. */
const MSK_OFFSET_SECONDS = 3 * 3_600;
const DAY_SECONDS = 86_400;

const DEFAULT_FIELDS = 'reach,views,subscribe_action,unsubscribe_action';
const PERIOD_METHOD = 'partnerStats.getGeneralStatsByPeriod';
const TOTAL_METHOD = 'partnerStats.getGeneralStatsTotal';
const CONTENT_PERIOD_METHOD = 'partnerStats.getContentStatsByPeriod';
const CONTENT_ALL_TIME_METHOD = 'partnerStats.getContentStatsAllTime';

export type PartnerStatsInterval = 'day' | 'week' | 'month';
export type PartnerContentType = 'post' | 'clip' | 'video' | 'story';

export type PartnerReach = {
  all?: number;
  subscribers?: number;
  viral?: number;
};

export type PartnerStatsOwner = {
  reach?: PartnerReach;
  views?: PartnerReach;
  subscribe_action?: number;
  unsubscribe_action?: number;
  friend_action?: number;
  unfriend_action?: number;
  views_demographic?: {
    age?: Array<{ count?: number; value?: string }>;
    sex?: Array<{ count?: number; value?: string }>;
    sex_age?: Array<{ count?: number; value?: string }>;
  };
  views_geographic?: {
    cities?: Array<{ count?: number; name?: string; value?: number }>;
    countries?: Array<{ code?: string; count?: number; name?: string; value?: number }>;
  };
};

export type PartnerStatsIntervalEntry = {
  period_from?: number;
  period_to?: number;
  owner?: PartnerStatsOwner;
  posts?: PartnerStatsOwner;
  clips?: PartnerStatsOwner;
  videos?: PartnerStatsOwner;
  stories?: PartnerStatsOwner;
};

export type PartnerStatsTotal = {
  period_from?: number;
  period_to?: number;
  owner?: PartnerStatsOwner;
  posts?: PartnerStatsOwner;
  clips?: PartnerStatsOwner;
  videos?: PartnerStatsOwner;
  stories?: PartnerStatsOwner;
};

export type PartnerContentStats = {
  id?: number;
  reach?: PartnerReach;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  bookmarks?: number;
  hides?: number;
  complains?: number;
  subscriptions?: number;
  replies?: number;
  link_clicks?: number;
  group_visits?: number;
};

/** Функция запроса к VK: подменяется в тестах. */
export type PartnerStatsRequest = <T>(
  method: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined>,
  httpMethod?: 'GET' | 'POST'
) => Promise<T>;

export type PartnerStatsWindow = { from: number; to: number };

/** VK отвечает по-разному: списком напрямую или объектом с items. */
export function asPartnerItems<T>(answer: unknown): T[] {
  if (Array.isArray(answer)) return answer as T[];

  if (answer && typeof answer === 'object' && Array.isArray((answer as { items?: unknown }).items)) {
    return (answer as { items: T[] }).items;
  }

  return [];
}

/** Начало московских суток для переданного unix-времени. */
export function mskStartOfDay(timestamp: number) {
  return Math.floor((timestamp + MSK_OFFSET_SECONDS) / DAY_SECONDS) * DAY_SECONDS - MSK_OFFSET_SECONDS;
}

/** Сообщество: VK ждёт owner_id со знаком минус. */
export function toCommunityOwnerId(id: number) {
  return -Math.abs(Math.trunc(id));
}

/** Профиль: owner_id без минуса. */
export function toProfileOwnerId(id: number) {
  return Math.abs(Math.trunc(id));
}

function windowDays(interval: PartnerStatsInterval) {
  if (interval === 'week') return PARTNER_STATS_WEEK_WINDOW_DAYS;
  if (interval === 'month') return PARTNER_STATS_MONTH_WINDOW_DAYS;
  return PARTNER_STATS_DAY_WINDOW_DAYS;
}

/**
 * Режет период на окна, которые VK принимает за один запрос.
 * Границы — по московским суткам: с локальными VK отвергает окно в 31 день.
 */
export function buildStatsWindows(
  unixFrom: number,
  unixTo: number,
  interval: PartnerStatsInterval = 'day'
): PartnerStatsWindow[] {
  if (!Number.isFinite(unixFrom) || !Number.isFinite(unixTo) || unixTo < unixFrom) return [];
  const maxDays = windowDays(interval);
  const windows: PartnerStatsWindow[] = [];
  const start = mskStartOfDay(unixFrom);

  for (let cursor = start; cursor <= unixTo; cursor += maxDays * DAY_SECONDS) {
    windows.push({ from: cursor, to: Math.min(cursor + maxDays * DAY_SECONDS - 1, unixTo) });
  }

  return windows;
}

/** Склеивает интервалы окон: один и тот же день на стыке остаётся один раз, порядок — по возрастанию. */
export function mergeStatsIntervals(intervals: PartnerStatsIntervalEntry[]) {
  const byStart = new Map<number, PartnerStatsIntervalEntry>();

  for (const interval of intervals) {
    const start = interval.period_from;
    if (typeof start !== 'number' || !Number.isFinite(start)) continue;

    const existing = byStart.get(start);
    if (!existing || (!existing.owner && interval.owner)) {
      byStart.set(start, interval);
    }
  }

  return [...byStart.values()].sort((left, right) => (left.period_from ?? 0) - (right.period_from ?? 0));
}

export type GeneralStatsQuery = {
  ownerId: number;
  unixFrom: number;
  unixTo: number;
  fields?: string;
  interval?: PartnerStatsInterval;
  /** null — не передавать filters (получить все типы контента). */
  filters?: string | null;
};

/** Общая статистика по интервалам (дни, недели, месяцы) за период любой длины. */
export async function fetchGeneralStatsByPeriod(
  accessToken: string,
  query: GeneralStatsQuery,
  request: PartnerStatsRequest = vkApiRequest
) {
  const interval = query.interval ?? 'day';
  const windows = buildStatsWindows(query.unixFrom, query.unixTo, interval);
  const intervals: PartnerStatsIntervalEntry[] = [];

  for (const window of windows) {
    const params: Record<string, string | number> = {
      owner_id: toCommunityOwnerId(query.ownerId),
      timestamp_from: String(window.from),
      timestamp_to: String(window.to),
      fields: query.fields ?? DEFAULT_FIELDS,
      interval
    };
    if (query.filters !== null) params.filters = query.filters ?? 'owner';

    const answer = await request<unknown>(PERIOD_METHOD, accessToken, params);
    intervals.push(...asPartnerItems<PartnerStatsIntervalEntry>(answer));
  }

  return mergeStatsIntervals(intervals);
}

export type GeneralStatsTotalQuery = {
  ownerId: number;
  unixFrom: number;
  unixTo: number;
  fields?: string;
  filters?: string | null;
};

/**
 * Итоги за период одним объектом. Охват здесь дедуплицированный — это значение для KPI,
 * а не сумма дневных охватов.
 */
export async function fetchGeneralStatsTotal(
  accessToken: string,
  query: GeneralStatsTotalQuery,
  request: PartnerStatsRequest = vkApiRequest
) {
  const params: Record<string, string | number> = {
    owner_id: toCommunityOwnerId(query.ownerId),
    timestamp_from: String(query.unixFrom),
    timestamp_to: String(query.unixTo),
    fields: query.fields ?? DEFAULT_FIELDS
  };
  if (query.filters !== null) params.filters = query.filters ?? 'owner';

  return request<PartnerStatsTotal>(TOTAL_METHOD, accessToken, params);
}

function chunkIds(contentIds: number[], size = PARTNER_STATS_CONTENT_IDS_CHUNK) {
  const unique = [...new Set(contentIds.filter((id) => Number.isFinite(id)))];
  const chunks: number[][] = [];

  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size));
  }

  return chunks;
}

function mergeContentStats(items: PartnerContentStats[]) {
  const byId = new Map<number, PartnerContentStats>();

  for (const item of items) {
    if (typeof item.id !== 'number' || !Number.isFinite(item.id)) continue;
    byId.set(item.id, item);
  }

  return [...byId.values()];
}

export type ContentStatsQuery = {
  ownerId: number;
  contentType: PartnerContentType;
  contentIds: number[];
  unixFrom: number;
  unixTo: number;
};

/** Статистика по единицам контента за период: списки id режутся на чанки и уходят POST-ом. */
export async function fetchContentStatsByPeriod(
  accessToken: string,
  query: ContentStatsQuery,
  request: PartnerStatsRequest = vkApiRequest
) {
  const items: PartnerContentStats[] = [];

  for (const ids of chunkIds(query.contentIds)) {
    const answer = await request<unknown>(
      CONTENT_PERIOD_METHOD,
      accessToken,
      {
        owner_id: toCommunityOwnerId(query.ownerId),
        content_type: query.contentType,
        content_ids: ids.join(','),
        timestamp_from: String(query.unixFrom),
        timestamp_to: String(query.unixTo)
      },
      'POST'
    );
    items.push(...asPartnerItems<PartnerContentStats>(answer));
  }

  return mergeContentStats(items);
}

export type ContentStatsAllTimeQuery = {
  ownerId: number;
  contentType: Extract<PartnerContentType, 'post' | 'story'>;
  contentIds: number[];
};

/**
 * Накопительная статистика по постам и историям за всё время: VK отдаёт её без ограничения
 * по историческим данным — то, чего нет у stats.get.
 */
export async function fetchContentStatsAllTime(
  accessToken: string,
  query: ContentStatsAllTimeQuery,
  request: PartnerStatsRequest = vkApiRequest
) {
  const items: PartnerContentStats[] = [];

  for (const ids of chunkIds(query.contentIds)) {
    const answer = await request<unknown>(
      CONTENT_ALL_TIME_METHOD,
      accessToken,
      {
        owner_id: toCommunityOwnerId(query.ownerId),
        content_type: query.contentType,
        content_ids: ids.join(',')
      },
      'POST'
    );
    items.push(...asPartnerItems<PartnerContentStats>(answer));
  }

  return mergeContentStats(items);
}
