import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase } from '../db/database.js';
import { UserModel } from '../models/User.js';
import { VkTokenModel } from '../models/VkToken.js';

// Спайк перед миграцией с stats.get на partnerStats.
// npm run spike:partner-stats --workspace @socstat/api -- [--group <id>] [--vk-user-id <id>] [--noaccess-group <id>]
//
// Отвечает на вопросы, от которых зависит план миграции:
//  - с какой версией API работают методы partnerStats;
//  - какой код ошибки у сообщества без прав (нужен для деградации);
//  - есть ли где-нибудь поле visitors (посещения);
//  - какая максимальная длина окна при interval=day и как VK режет период;
//  - совпадает ли охват за период с суммой дневных охватов;
//  - сколько content_ids принимает статистика по контент-единицам;
//  - работают ли методы сервисным ключом и ключом сообщества (от этого зависят ночные срезы).
//
// Токены в вывод не попадают: из ответов VK вычищается access_token, токены печатаются только признаком.

const VK_API_BASE_URL = 'https://api.vk.com/method';
const USER_TOKEN_DELAY_MS = 400;
const SERVICE_KEY_DELAY_MS = 210;
const RATE_LIMIT_RETRY_MS = 1_500;
const MSK_OFFSET_SECONDS = 3 * 3_600;
const DAY = 86_400;

// Кандидаты версий API: partnerStats появились после 5.131, поэтому пробуем по возрастанию.
const VERSION_CANDIDATES = ['5.131', '5.199', '5.207', '5.220', '5.251'];
const CONTENT_STATS_PERIOD_DAYS = 90;

type VkError = { error_code: number; error_msg: string; request_params?: Array<{ key: string; value: string }> };

type VkAnswer<T> = { response?: T; error?: VkError };

class SpikeApiError extends Error {
  code?: number;
  method: string;
  params?: Record<string, unknown>;

  constructor(message: string, code: number | undefined, method: string, params?: Record<string, unknown>) {
    super(message);
    this.name = 'SpikeApiError';
    this.code = code;
    this.method = method;
    this.params = params;
  }
}

type Check = { name: string; ok: boolean; details: Record<string, unknown> };

const checks: Check[] = [];
const raw: Record<string, unknown> = {};

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const [key, inlineValue] = item.slice(2).split('=');
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function maskToken(token: string) {
  return `len=${token.length}, head=${token.slice(0, 3)}…`;
}

/** Убирает токены из любого ответа VK: они приходят в request_params и в тексте ошибок. */
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'access_token') {
        result[key] = '***';
        continue;
      }
      result[key] = sanitize(item);
    }
    return result;
  }
  if (typeof value === 'string' && value.length > 80 && /^[0-9a-f]{80,}$/i.test(value)) {
    return '***';
  }
  return value;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type CallOptions = { token?: string; version: string; delayMs?: number; httpMethod?: 'GET' | 'POST' };

async function callApi<T>(method: string, params: Record<string, string | number | undefined>, options: CallOptions): Promise<T> {
  const query = new URLSearchParams({ v: options.version });
  if (options.token) query.set('access_token', options.token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }

  const response = options.httpMethod === 'POST'
    ? await fetch(`${VK_API_BASE_URL}/${method}`, { method: 'POST', body: query })
    : await fetch(`${VK_API_BASE_URL}/${method}?${query.toString()}`);
  const payload = (await response.json()) as VkAnswer<T>;
  const answer = sanitize(payload) as VkAnswer<T>;

  if (payload.error) {
    throw new SpikeApiError(payload.error.error_msg, payload.error.error_code, method, sanitize(params) as Record<string, unknown>);
  }
  if (payload.response === undefined) {
    throw new SpikeApiError('VK API returned an empty response', undefined, method);
  }

  raw[method] = (raw[method] as unknown[] | undefined) ?? [];
  (raw[method] as unknown[]).push({
    params: sanitize({ ...params, access_token: undefined, v: options.version, httpMethod: options.httpMethod ?? 'GET' }),
    answer
  });
  if (options.delayMs) await delay(options.delayMs);
  return payload.response;
}

async function callApiWithRetry<T>(method: string, params: Record<string, string | number | undefined>, options: CallOptions): Promise<T> {
  try {
    return await callApi<T>(method, params, options);
  } catch (error) {
    if (error instanceof SpikeApiError && error.code === 6) {
      await delay(RATE_LIMIT_RETRY_MS);
      return callApi<T>(method, params, options);
    }
    throw error;
  }
}

function describe(error: unknown) {
  if (error instanceof SpikeApiError) {
    return { code: error.code ?? null, method: error.method, message: error.message, params: error.params ?? null };
  }
  return { code: null, message: error instanceof Error ? error.message : String(error) };
}

function record(name: string, ok: boolean, details: Record<string, unknown>) {
  checks.push({ name, ok, details });
  const icon = ok ? 'OK  ' : 'FAIL';
  console.log(`[${icon}] ${name}`);
  for (const [key, value] of Object.entries(details)) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    console.log(`       ${key}: ${text}`);
  }
}

/** Выполняет проверку изолированно: ошибка одной не обрывает спайк. */
async function check(name: string, run: () => Promise<{ ok: boolean; details: Record<string, unknown> }>) {
  try {
    const result = await run();
    record(name, result.ok, result.details);
    return result;
  } catch (error) {
    record(name, false, describe(error));
    return { ok: false, details: describe(error) as Record<string, unknown> };
  }
}

function unixStartOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return Math.floor(copy.getTime() / 1000);
}

/** Начало суток по Москве: VK считает статистику в московском дне. */
function mskStartOfDay(timestamp: number) {
  return Math.floor((timestamp + MSK_OFFSET_SECONDS) / DAY) * DAY - MSK_OFFSET_SECONDS;
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mskKey(timestamp: number) {
  return new Date((timestamp + MSK_OFFSET_SECONDS) * 1000).toISOString().slice(0, 10);
}

/** Дни, которых нет в ответе между первым и последним интервалом: VK пропускает сутки без данных. */
function missingDays(keys: string[]) {
  if (keys.length < 2) return [];
  const sorted = [...keys].sort();
  const first = Date.parse(`${sorted[0]}T00:00:00Z`);
  const last = Date.parse(`${sorted[sorted.length - 1]}T00:00:00Z`);
  const present = new Set(sorted);
  const missing: string[] = [];
  for (let time = first; time <= last; time += DAY * 1_000) {
    const key = new Date(time).toISOString().slice(0, 10);
    if (!present.has(key)) missing.push(key);
  }
  return missing;
}

function hasKeyDeep(value: unknown, needle: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKeyDeep(item, needle));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, item]) => key === needle || hasKeyDeep(item, needle)
    );
  }
  return false;
}

/** VK часть методов возвращает массив, часть — объект со списком внутри. */
function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.response)) return record.response as T[];
  }
  return [];
}

function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

type PartnerOwner = {
  reach?: { all?: number; subscribers?: number; viral?: number };
  views?: { all?: number; subscribers?: number; viral?: number };
  subscribe_action?: number;
  unsubscribe_action?: number;
};

type PartnerInterval = {
  period_from?: number;
  period_to?: number;
  owner?: PartnerOwner;
  posts?: PartnerOwner;
  clips?: PartnerOwner;
  videos?: PartnerOwner;
  stories?: PartnerOwner;
};

type PartnerContent = {
  id?: number;
  reach?: { all?: number; subscribers?: number; viral?: number };
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

type WallPost = {
  id: number;
  date: number;
  views?: { count?: number };
  likes?: { count?: number };
  reposts?: { count?: number };
  comments?: { count?: number };
};

type WallAnswer = { count: number; items: WallPost[] };

type ManagedGroup = { id: number; name?: string; members_count?: number };

type StatsDay = {
  period_from?: number;
  visitors?: { visitors?: number; views?: number };
  reach?: { reach?: number; reach_subscribers?: number };
  activity?: { subscribed?: number; unsubscribed?: number };
};

type TokenSource = { kind: string; token: string; vkId?: string };

/** Токен для спайка: аргумент, переменная окружения, затем токен администратора из базы. */
async function resolveUserToken(vkUserId?: string): Promise<TokenSource | null> {
  if (args.token) return { kind: 'CLI --token', token: args.token };
  if (process.env.VK_SPIKE_TOKEN?.trim()) return { kind: 'VK_SPIKE_TOKEN', token: process.env.VK_SPIKE_TOKEN.trim() };

  await connectDatabase();
  const ids = vkUserId ? [vkUserId] : env.adminVkIds;
  const users = await UserModel.find({ vkId: { $in: ids } }, { _id: 1, vkId: 1 }).lean();
  for (const user of users) {
    const token = await VkTokenModel.findOne(
      {
        userId: user._id,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }]
      },
      { accessToken: 1 }
    ).sort({ updatedAt: -1 }).lean();
    if (token?.accessToken) {
      const isAdmin = user.vkId ? env.adminVkIds.includes(user.vkId) : false;
      return { kind: `база, vkId=${user.vkId}${isAdmin ? ' (админ)' : ''}`, token: token.accessToken, vkId: user.vkId ?? undefined };
    }
  }
  return null;
}

async function probeVersions() {
  const accepted: string[] = [];
  const rejected: Record<string, unknown> = {};
  for (const version of VERSION_CANDIDATES) {
    try {
      await callApi<number>('utils.getServerTime', {}, { version });
      accepted.push(version);
    } catch (error) {
      rejected[version] = describe(error);
    }
  }
  record('Версии API: какие принимает VK', accepted.length > 0, { accepted, rejected });
  return accepted;
}

async function loadWall(token: string, version: string, groupId: number, pages: number) {
  const posts: WallPost[] = [];
  for (let page = 0; page < pages; page += 1) {
    const response = await callApiWithRetry<WallAnswer>(
      'wall.get',
      { owner_id: -groupId, count: 100, offset: page * 100 },
      { token, version, delayMs: USER_TOKEN_DELAY_MS }
    );
    posts.push(...response.items);
    if (response.items.length < 100) break;
  }
  return posts;
}

async function loadManagedGroups(token: string, version: string) {
  const response = await callApiWithRetry<{ count: number; items: ManagedGroup[] }>(
    'groups.get',
    { filter: 'moder', extended: 1, fields: 'members_count', count: 1000 },
    { token, version, delayMs: USER_TOKEN_DELAY_MS }
  );
  return response.items ?? [];
}

async function main() {
  console.log('Спайк partnerStats. Токены в выводе скрыты.\n');

  const userToken = await resolveUserToken(args['vk-user-id']);
  if (!userToken) {
    record('Токен пользователя', false, {
      hint: 'Не нашёл токен администратора в базе. Передайте --token <user token> или VK_SPIKE_TOKEN.'
    });
  } else {
    console.log(`Токен пользователя: ${userToken.kind}, ${maskToken(userToken.token)}\n`);
  }

  const versions = await probeVersions();
  if (!versions.length) {
    record('Версии API: ни одна не принята', false, { candidates: VERSION_CANDIDATES });
    return finish();
  }
  const version = versions[versions.length - 1];
  console.log(`\nДальше используем версию API ${version}.\n`);

  if (!userToken) {
    await checkKeySources(null, version);
    return finish();
  }

  const token = userToken.token;

  const permissions = await check('Права токена', async () => {
    const mask = await callApiWithRetry<number>('account.getAppPermissions', {}, { token, version, delayMs: USER_TOKEN_DELAY_MS });
    return { ok: true, details: { mask, statsScope: Boolean(mask & 1048576) } };
  });
  const hasStatsScope = Boolean(permissions.details.statsScope);

  const managedGroups = await (async () => {
    try {
      const items = await loadManagedGroups(token, version);
      record('Сообщества под управлением токена', items.length > 0, {
        count: items.length,
        sample: items.slice(0, 8).map((group) => `${group.id} «${group.name ?? ''}» members=${group.members_count ?? '?'}`)
      });
      return items;
    } catch (error) {
      record('Сообщества под управлением токена', false, describe(error));
      return [] as ManagedGroup[];
    }
  })();

  const target = args.group
    ? managedGroups.find((group) => String(group.id) === String(args.group)) ?? { id: Number(args.group) }
    : [...managedGroups].sort((left, right) => (right.members_count ?? 0) - (left.members_count ?? 0))[0];
  const groupId = Number(target?.id ?? env.socstatVkGroupId);
  record('Целевое сообщество', Boolean(groupId), {
    groupId,
    name: target?.name ?? 'не найден в списке moder (проверяем как есть)',
    members: target?.members_count ?? null
  });

  const now = new Date();
  const today = unixStartOfDay(now);
  const todayMsk = mskStartOfDay(Math.floor(now.getTime() / 1000));

  // 1. Базовая линия: stats.get ещё жив до 7 декабря.
  const baseline = await check('stats.get (базовая линия, 7 дней)', async () => {
    const stats = await callApiWithRetry<unknown>(
      'stats.get',
      {
        group_id: groupId,
        timestamp_from: today - 7 * DAY,
        timestamp_to: today - 1,
        interval: 'day',
        stats_groups: 'visitors,reach,activity'
      },
      { token, version, delayMs: USER_TOKEN_DELAY_MS }
    );
    const days = asList<StatsDay>(stats);
    return {
      ok: true,
      details: {
        days: days.length,
        first: days[0]?.period_from ? dateKey(days[0].period_from) : null,
        last: days[days.length - 1]?.period_from ? dateKey(days[days.length - 1].period_from as number) : null,
        visitors: sum(days, (day) => day.visitors?.visitors ?? 0),
        views: sum(days, (day) => day.visitors?.views ?? 0),
        reach: sum(days, (day) => day.reach?.reach ?? 0),
        reachSubscribers: sum(days, (day) => day.reach?.reach_subscribers ?? 0),
        subscribed: sum(days, (day) => day.activity?.subscribed ?? 0),
        unsubscribed: sum(days, (day) => day.activity?.unsubscribed ?? 0)
      }
    };
  });

  // 2. С какой версией API реально работает partnerStats.
  const statsVersion = await (async () => {
    const errors: Record<string, unknown> = {};
    for (const candidate of versions) {
      try {
        await callApiWithRetry<unknown>(
          'partnerStats.getGeneralStatsByPeriod',
          {
            owner_id: -groupId,
            timestamp_from: today - 7 * DAY,
            timestamp_to: today - 1,
            filters: 'owner',
            fields: 'reach,views,subscribe_action,unsubscribe_action',
            interval: 'day'
          },
          { token, version: candidate, delayMs: USER_TOKEN_DELAY_MS }
        );
        return { version: candidate, errors };
      } catch (error) {
        errors[candidate] = describe(error);
      }
    }
    return { version: null, errors };
  })();
  record('partnerStats.getGeneralStatsByPeriod: рабочие версии', Boolean(statsVersion.version), statsVersion);
  if (!statsVersion.version) {
    await checkKeySources(userToken, version, groupId);
    return finish();
  }
  const partnerVersion = statsVersion.version;

  // 3. Неделя по дням: какие поля, есть ли visitors, сколько интервалов.
  const weekFrom = today - 7 * DAY;
  const weekTo = today - 1;
  const byPeriodWeek = await check('partnerStats: неделя по дням', async () => {
    const intervals = asList<PartnerInterval>(await callApiWithRetry<unknown>(
      'partnerStats.getGeneralStatsByPeriod',
      {
        owner_id: -groupId,
        timestamp_from: weekFrom,
        timestamp_to: weekTo,
        filters: 'owner',
        fields: 'reach,views,subscribe_action,unsubscribe_action',
        interval: 'day'
      },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    ));
    const ownerSum = (pick: (owner: PartnerOwner) => number) => sum(intervals, (interval) => pick(interval.owner ?? {}));
    return {
      ok: intervals.length > 0,
      details: {
        intervals: intervals.length,
        requestedDays: 7,
        first: intervals[0]?.period_from
          ? `${dateKey(intervals[0].period_from)} (msk ${mskKey(intervals[0].period_from)})`
          : null,
        last: intervals[intervals.length - 1]?.period_from
          ? `${dateKey(intervals[intervals.length - 1].period_from as number)} (msk ${mskKey(intervals[intervals.length - 1].period_from as number)})`
          : null,
        reachAll: ownerSum((owner) => owner.reach?.all ?? 0),
        reachSubscribers: ownerSum((owner) => owner.reach?.subscribers ?? 0),
        viewsAll: ownerSum((owner) => owner.views?.all ?? 0),
        subscribed: ownerSum((owner) => owner.subscribe_action ?? 0),
        unsubscribed: ownerSum((owner) => owner.unsubscribe_action ?? 0),
        hasVisitorsField: hasKeyDeep(intervals, 'visitors'),
        missingDays: missingDays(intervals.map((interval) => (interval.period_from ? mskKey(interval.period_from) : ''))),
        baseline: baseline.details
      }
    };
  });

  // 4. Охват за период: сумма дней против getGeneralStatsTotal.
  await check('partnerStats.getGeneralStatsTotal: охват за период', async () => {
    const total = await callApiWithRetry<{ owner?: PartnerOwner }>(
      'partnerStats.getGeneralStatsTotal',
      {
        owner_id: -groupId,
        timestamp_from: weekFrom,
        timestamp_to: weekTo,
        filters: 'owner',
        fields: 'reach,views,subscribe_action,unsubscribe_action'
      },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    );
    const reachTotal = total.owner?.reach?.all ?? 0;
    const reachSum = Number(byPeriodWeek.details.reachAll ?? 0);
    return {
      ok: true,
      details: {
        reachTotal,
        reachSumOfDays: reachSum,
        difference: reachTotal - reachSum,
        viewsTotal: total.owner?.views?.all ?? 0,
        viewsSumOfDays: byPeriodWeek.details.viewsAll
      }
    };
  });

  // 5. Сетка: какая максимальная длина окна при interval=day и как влияет выравнивание.
  const windowGrid: Array<Record<string, unknown>> = [];
  for (const lengthDays of [28, 30, 31, 32, 35]) {
    for (const alignment of ['msk', 'local'] as const) {
      const from = alignment === 'msk' ? todayMsk - lengthDays * DAY : today - lengthDays * DAY;
      const to = (alignment === 'msk' ? todayMsk : today) - 1;
      try {
        const intervals = asList<PartnerInterval>(await callApiWithRetry<unknown>(
          'partnerStats.getGeneralStatsByPeriod',
          { owner_id: -groupId, timestamp_from: from, timestamp_to: to, filters: 'owner', fields: 'reach', interval: 'day' },
          { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
        ));
        windowGrid.push({
          lengthDays,
          alignment,
          ok: true,
          intervals: intervals.length,
          first: intervals[0]?.period_from ? mskKey(intervals[0].period_from) : null,
          last: intervals[intervals.length - 1]?.period_from ? mskKey(intervals[intervals.length - 1].period_from as number) : null
        });
      } catch (error) {
        windowGrid.push({ lengthDays, alignment, ok: false, ...describe(error) });
      }
    }
  }
  record('Окно interval=day: сетка длин и выравнивания', true, { grid: windowGrid });

  // 6. Интервалы week/month: максимальная длина периода.
  const weekInterval = await check('Интервал week (180 дней)', async () => {
    const intervals = asList<PartnerInterval>(await callApiWithRetry<unknown>(
      'partnerStats.getGeneralStatsByPeriod',
      { owner_id: -groupId, timestamp_from: todayMsk - 180 * DAY, timestamp_to: todayMsk - 1, filters: 'owner', fields: 'reach', interval: 'week' },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    ));
    return { ok: true, details: { intervals: intervals.length } };
  });
  const monthInterval = await check('Интервал month (365 дней)', async () => {
    const intervals = asList<PartnerInterval>(await callApiWithRetry<unknown>(
      'partnerStats.getGeneralStatsByPeriod',
      { owner_id: -groupId, timestamp_from: todayMsk - 365 * DAY, timestamp_to: todayMsk - 1, filters: 'owner', fields: 'reach', interval: 'month' },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    ));
    return { ok: true, details: { intervals: intervals.length } };
  });
  record('Интервалы week и month', true, { weekInterval: weekInterval.details, monthInterval: monthInterval.details });

  // 7. Поштучная статистика по публикациям.
  const posts = await loadWall(token, partnerVersion, groupId, 10).catch((error) => {
    record('wall.get для списка постов', false, describe(error));
    return [] as WallPost[];
  });
  record('wall.get: посты для проверки контент-методов', posts.length > 0, {
    posts: posts.length,
    withViews: posts.filter((post) => typeof post.views?.count === 'number').length
  });

  const contentFrom = today - CONTENT_STATS_PERIOD_DAYS * DAY;
  const contentTo = today - 1;
  const contentIds = posts.slice(0, 20).map((post) => post.id);

  await check('partnerStats.getContentStatsByPeriod', async () => {
    if (!contentIds.length) throw new Error('нет постов для проверки');
    const answer = await callApiWithRetry<unknown>(
      'partnerStats.getContentStatsByPeriod',
      {
        owner_id: -groupId,
        content_type: 'post',
        content_ids: contentIds.join(','),
        timestamp_from: contentFrom,
        timestamp_to: contentTo
      },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    );
    const items = asList<PartnerContent>(answer);
    const first = items[0];
    const fields = first ? Object.keys(first).filter((key) => key !== 'id').sort() : [];
    const wallById = new Map(posts.map((post) => [post.id, post]));
    return {
      ok: items.length > 0,
      details: {
        receivedIds: items.length,
        requestedIds: contentIds.length,
        shape: Array.isArray(answer) ? 'array' : Object.keys(answer as Record<string, unknown>),
        fields,
        hasComments: fields.includes('comments'),
        hasComplains: fields.includes('complains'),
        hasBookmarks: fields.includes('bookmarks'),
        hasLinkClicks: fields.includes('link_clicks'),
        sample: items.slice(0, 3).map((item) => ({
          id: item.id,
          views: item.views,
          wallViews: wallById.get(item.id ?? -1)?.views?.count ?? null,
          likes: item.likes,
          wallLikes: wallById.get(item.id ?? -1)?.likes?.count ?? null,
          comments: item.comments,
          wallComments: wallById.get(item.id ?? -1)?.comments?.count ?? null,
          shares: item.shares,
          wallReposts: wallById.get(item.id ?? -1)?.reposts?.count ?? null,
          reachAll: item.reach?.all ?? null,
          hides: item.hides,
          complains: item.complains,
          bookmarks: item.bookmarks
        }))
      }
    };
  });

  // 8. Лимит content_ids: реальными постами и повторами одного id (проверяет длину параметра, а не уникальность).
  const probes: Array<Record<string, unknown>> = [];
  const probeSize = async (size: number, ids: number[], httpMethod: 'GET' | 'POST') => {
    try {
      const answer = await callApiWithRetry<unknown>(
        'partnerStats.getContentStatsByPeriod',
        {
          owner_id: -groupId,
          content_type: 'post',
          content_ids: ids.join(','),
          timestamp_from: contentFrom,
          timestamp_to: contentTo
        },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS, httpMethod }
      );
      probes.push({ size, httpMethod, ok: true, returned: asList<PartnerContent>(answer).length, paramLength: ids.join(',').length });
    } catch (error) {
      probes.push({ size, httpMethod, ok: false, paramLength: ids.join(',').length, ...describe(error) });
    }
  };
  const postIds = posts.map((post) => post.id);
  for (const size of [10, 50, 100]) {
    if (size > postIds.length) break;
    await probeSize(size, postIds.slice(0, size), 'GET');
  }
  if (postIds.length) {
    for (const size of [100, 300, 500, 1000]) {
      await probeSize(size, Array.from({ length: size }, () => postIds[0]), 'POST');
    }
  }
  record('Лимит content_ids', true, { probes });

  // 9. Накопительная статистика за всё время.
  await check('partnerStats.getContentStatsAllTime', async () => {
    if (!contentIds.length) throw new Error('нет постов для проверки');
    const answer = await callApiWithRetry<unknown>(
      'partnerStats.getContentStatsAllTime',
      { owner_id: -groupId, content_type: 'post', content_ids: contentIds.join(',') },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    );
    const items = asList<PartnerContent>(answer);
    const fields = items[0] ? Object.keys(items[0]).filter((key) => key !== 'id').sort() : [];
    return {
      ok: items.length > 0,
      details: {
        returned: items.length,
        requested: contentIds.length,
        shape: Array.isArray(answer) ? 'array' : Object.keys(answer as Record<string, unknown>),
        fields,
        hasGroupVisits: fields.includes('group_visits'),
        hasLinkClicks: fields.includes('link_clicks'),
        hasSubscriptions: fields.includes('subscriptions'),
        hasComments: fields.includes('comments'),
        sample: items.slice(0, 2)
      }
    };
  });

  // 10. Демография и география: в документации имена полей не совпадают с API.
  const demographicVariants: Array<Record<string, unknown>> = [];
  const tryDemographic = async (label: string, fields?: string) => {
    try {
      const total = await callApiWithRetry<{ owner?: Record<string, unknown> }>(
        'partnerStats.getGeneralStatsTotal',
        {
          owner_id: -groupId,
          timestamp_from: todayMsk - 30 * DAY,
          timestamp_to: todayMsk - 1,
          filters: 'owner',
          fields
        },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
      );
      const owner = total.owner ?? {};
      const demo = (owner.views_demographic ?? {}) as Record<string, unknown>;
      const geo = (owner.views_geographic ?? {}) as Record<string, unknown>;
      demographicVariants.push({
        label,
        ok: true,
        ownerKeys: Object.keys(owner).sort(),
        ageGroups: Array.isArray(demo.age) ? (demo.age as unknown[]).length : 0,
        sexGroups: Array.isArray(demo.sex) ? (demo.sex as unknown[]).length : 0,
        sexAgeGroups: Array.isArray(demo.sex_age) ? (demo.sex_age as unknown[]).length : 0,
        cities: Array.isArray(geo.cities) ? (geo.cities as unknown[]).length : 0,
        countries: Array.isArray(geo.countries) ? (geo.countries as unknown[]).length : 0,
        payloadBytes: JSON.stringify(total).length
      });
    } catch (error) {
      demographicVariants.push({ label, ok: false, ...describe(error) });
    }
  };
  for (const field of ['views_sex', 'views_age', 'views_sex_age', 'views_cities', 'views_countries']) {
    await tryDemographic(`как в документации: ${field}`, `reach,${field}`);
  }
  await tryDemographic('реальное имя: views_demographic', 'reach,views_demographic');
  await tryDemographic('реальное имя: views_geographic', 'reach,views_geographic');
  await tryDemographic('без fields (всё по умолчанию)');
  record(
    'Демография: имена полей и содержимое',
    demographicVariants.some((item) => item.ok === true && Number(item.ageGroups ?? 0) > 0),
    { variants: demographicVariants }
  );

  // 11. Без filters: что возвращает статистика по типам контента.
  await check('partnerStats без filters: типы контента', async () => {
    const answer = await callApiWithRetry<unknown>(
      'partnerStats.getGeneralStatsByPeriod',
      {
        owner_id: -groupId,
        timestamp_from: todayMsk - 7 * DAY,
        timestamp_to: todayMsk - 1,
        fields: 'reach,views,likes,comments,shares,hides,subscribe_action,unsubscribe_action',
        interval: 'day'
      },
      { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
    );
    const intervals = asList<Record<string, unknown>>(answer);
    const first = intervals[0] ?? {};
    const typeKeys = ['owner', 'posts', 'clips', 'videos', 'stories'];
    const present = typeKeys.filter((key) => key in first);
    const sums: Record<string, unknown> = {};
    for (const key of present) {
      const type = (first[key] ?? {}) as PartnerOwner;
      sums[key] = {
        reach: sum(intervals, (interval) => ((interval[key] ?? {}) as PartnerOwner).reach?.all ?? 0),
        views: sum(intervals, (interval) => ((interval[key] ?? {}) as PartnerOwner).views?.all ?? 0)
      };
    }
    return { ok: true, details: { presentTypes: present, sums, sampleFields: Object.keys(first).sort() } };
  });

  // 12. Профиль: свой профиль администратора и знак owner_id.
  await check('Профиль администратора (owner_id своего vkId)', async () => {
    if (!userToken.vkId) throw new Error('vkId токена неизвестен');
    try {
      const answer = await callApiWithRetry<unknown>(
        'partnerStats.getGeneralStatsByPeriod',
        { owner_id: Number(userToken.vkId), timestamp_from: todayMsk - 7 * DAY, timestamp_to: todayMsk - 1, fields: 'reach,views', interval: 'day' },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
      );
      return { ok: true, details: { accepted: true, intervals: asList<PartnerInterval>(answer).length } };
    } catch (error) {
      return { ok: true, details: { accepted: false, ...describe(error) } };
    }
  });

  await check('Сообщество с положительным owner_id', async () => {
    try {
      const answer = await callApiWithRetry<unknown>(
        'partnerStats.getGeneralStatsByPeriod',
        { owner_id: groupId, timestamp_from: todayMsk - 7 * DAY, timestamp_to: todayMsk - 1, fields: 'reach,views', interval: 'day' },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
      );
      return { ok: true, details: { accepted: true, intervals: asList<PartnerInterval>(answer).length } };
    } catch (error) {
      return { ok: true, details: { accepted: false, ...describe(error) } };
    }
  });

  // 11. Отказы: чужое сообщество, несуществующий owner, профиль.
  const foreignGroupId = Number(args['noaccess-group'] ?? 69537711);
  await check(`Чужое сообщество ${foreignGroupId}: статистика и код ошибки`, async () => {
    try {
      const answer = await callApiWithRetry<unknown>(
        'partnerStats.getGeneralStatsByPeriod',
        { owner_id: -foreignGroupId, timestamp_from: weekFrom, timestamp_to: weekTo, filters: 'owner', fields: 'reach', interval: 'day' },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
      );
      return { ok: true, details: { access: 'есть', intervals: asList<PartnerInterval>(answer).length } };
    } catch (error) {
      return { ok: true, details: { access: 'нет', ...describe(error) } };
    }
  });

  await check('Несуществующий owner: код ошибки', async () => {
    try {
      await callApiWithRetry<unknown>(
        'partnerStats.getGeneralStatsByPeriod',
        { owner_id: -999999999, timestamp_from: weekFrom, timestamp_to: weekTo, filters: 'owner', fields: 'reach', interval: 'day' },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
      );
      return { ok: false, details: { unexpected: 'VK отдал статистику для несуществующего owner' } };
    } catch (error) {
      const info = describe(error);
      if (info.code === 6) {
        return { ok: true, details: { inconclusive: 'упёрлись в лимит запросов, код не определён', ...info } };
      }
      return { ok: true, details: info };
    }
  });

  await check('Профиль owner_id=1: принимается ли', async () => {
    try {
      const answer = await callApiWithRetry<unknown>(
        'partnerStats.getGeneralStatsByPeriod',
        { owner_id: 1, timestamp_from: weekFrom, timestamp_to: weekTo, filters: 'owner', fields: 'reach', interval: 'day' },
        { token, version: partnerVersion, delayMs: USER_TOKEN_DELAY_MS }
      );
      return { ok: true, details: { accepted: true, intervals: asList<PartnerInterval>(answer).length } };
    } catch (error) {
      return { ok: true, details: { accepted: false, ...describe(error) } };
    }
  });

  // 12. Ключи для ночных срезов.
  await checkKeySources(userToken, partnerVersion, groupId);

  return finish();
}

/** Проверка, работают ли partnerStats сервисным ключом и ключом сообщества. */
async function checkKeySources(userToken: TokenSource | null, version: string, groupId?: number) {
  const now = new Date();
  const todayMsk = mskStartOfDay(Math.floor(now.getTime() / 1000));
  const targetGroupId = groupId ?? Number(env.socstatVkGroupId);

  const attempt = async (token: string, delayMs: number, ownerId: number) => {
    try {
      const answer = await callApiWithRetry<unknown>(
        'partnerStats.getGeneralStatsByPeriod',
        {
          owner_id: -ownerId,
          timestamp_from: todayMsk - 7 * DAY,
          timestamp_to: todayMsk - 1,
          filters: 'owner',
          fields: 'reach',
          interval: 'day'
        },
        { token, version, delayMs }
      );
      return { ok: true as const, intervals: asList<PartnerInterval>(answer).length };
    } catch (error) {
      return { ok: false as const, ...describe(error) };
    }
  };

  if (env.vkServiceKey) {
    const result = await attempt(env.vkServiceKey, SERVICE_KEY_DELAY_MS, targetGroupId);
    record('Сервисный ключ (VK_SERVICE_KEY)', result.ok, { groupId: targetGroupId, ...result });
  } else {
    record('Сервисный ключ (VK_SERVICE_KEY)', false, { hint: 'не задан в окружении' });
  }

  if (env.vkGroupToken) {
    const groupTokenGroup = Number(env.socstatVkGroupId);
    const result = await attempt(env.vkGroupToken, SERVICE_KEY_DELAY_MS, groupTokenGroup);
    record('Ключ сообщества (VK_GROUP_TOKEN)', result.ok, { groupId: groupTokenGroup, ...result });
  } else {
    record('Ключ сообщества (VK_GROUP_TOKEN)', false, { hint: 'не задан в окружении' });
  }

  if (userToken) {
    const result = await attempt(userToken.token, USER_TOKEN_DELAY_MS, targetGroupId);
    record('Пользовательский токен: контрольный запрос', result.ok, { groupId: targetGroupId, ...result });
  }
}

async function finish() {
  const summary = {
    generatedAt: new Date().toISOString(),
    checks,
    raw: sanitize(raw)
  };
  const outputDir = path.resolve(process.cwd(), '..', 'exports');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'partner-stats-spike.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

  const failed = checks.filter((item) => !item.ok).length;
  console.log(`\nИтог: ${checks.length - failed} ok, ${failed} fail. Сырые ответы: ${outputPath}`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

try {
  await main();
} catch (error) {
  console.error('Спайк упал:', describe(error));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
