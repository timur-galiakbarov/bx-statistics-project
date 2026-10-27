import type { Types } from 'mongoose';
import { ActivityEventModel } from '../models/ActivityEvent.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { mskDayKey, mskDayStart } from './activityStatsService.js';
import { getFeatureMode } from './featureFlags.js';
import { redis } from './redis.js';

export type AdminPlacementStats = {
  days: number;
  mode: string;
  users: number;
  searches: number;
  repeatUsers: number;
  topicShare: number | null;
  thinResults: number;
  rulesSearches: number;
  topCities: Array<{ city: string; users: number; searches: number }>;
  openUsers: number;
  selectUsers: number;
  selectedCommunities: number;
  priceUsers: number;
  filterUsers: number;
  filters: Array<{ category: string; users: number }>;
  limitUsers: number;
  paywallClicks: { rows: number; limit: number };
  paidAfterFirstSearch: { users: number; revenue: number };
  paidAfterLimit: { users: number; revenue: number };
  ai: { searches: number; fallbacks: number; calls: number; failed: number; tokens: number; avgSeconds: number | null };
};

type EventRow = { userId: Types.ObjectId; type: string; label?: string; createdAt: Date };

/** «Город|тема|ai или rules|строк»: тема может содержать «|», поэтому разбор с концов. */
export function parseSearchLabel(label = '') {
  const parts = label.split('|');
  if (parts.length < 4) return null;
  return { city: parts[0], topic: parts.slice(1, -2).join('|'), ai: parts.at(-2) === 'ai', rows: Number(parts.at(-1)) };
}

/** Счётчики DeepSeek из Redis по дням периода; админы в них не отделены. */
async function aiCounters(days: number, now: Date) {
  const totals = { searches: 0, fallbacks: 0, calls: 0, failed: 0, tokens: 0, ms: 0 };
  if (!redis.isReady) return totals;
  const keys = Array.from({ length: days }, (_, index) => `socstat:placements:ai:stats:${mskDayKey(new Date(now.getTime() - index * 86_400_000))}`);
  const rows = await Promise.all(keys.map((key) => redis.hGetAll(key)));
  for (const row of rows) {
    for (const field of Object.keys(totals) as Array<keyof typeof totals>) totals[field] += Number(row[field] ?? 0);
  }
  return totals;
}

/** Подбор площадок за период: спрос, глубина работы с выдачей, лимиты и оплаты, расход DeepSeek. Админы исключены. */
export async function getAdminPlacementStats(requestedDays: unknown, now = new Date()): Promise<AdminPlacementStats> {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(7, Math.round(parsedDays))) : 30;
  const rangeStart = mskDayStart(now, -(days - 1));
  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];

  const [mode, events, counters] = await Promise.all([
    getFeatureMode('placements'),
    ActivityEventModel.find({ type: { $regex: /^placement_/ }, createdAt: { $gte: rangeStart }, userId: { $nin: adminIds } })
      .select({ userId: 1, type: 1, label: 1, createdAt: 1 })
      .sort({ createdAt: 1 })
      .lean<EventRow[]>(),
    aiCounters(days, now)
  ]);

  const usersOf = (type: string, label?: string) => new Set(events.filter((event) => event.type === type && (label === undefined || event.label === label)).map((event) => event.userId.toString()));
  const searches = events.filter((event) => event.type === 'placement_search');
  const parsed = searches.map((event) => parseSearchLabel(event.label)).filter((item): item is NonNullable<ReturnType<typeof parseSearchLabel>> => item !== null);

  const searchDays = new Map<string, Set<string>>();
  const firstSearch = new Map<string, number>();
  for (const event of searches) {
    const id = event.userId.toString();
    if (!searchDays.has(id)) searchDays.set(id, new Set());
    searchDays.get(id)!.add(mskDayKey(event.createdAt));
    if (!firstSearch.has(id)) firstSearch.set(id, event.createdAt.getTime());
  }
  const firstLimit = new Map<string, number>();
  for (const event of events) if (event.type === 'placement_limit' && !firstLimit.has(event.userId.toString())) firstLimit.set(event.userId.toString(), event.createdAt.getTime());

  const cities = new Map<string, { users: Set<string>; searches: number }>();
  searches.forEach((event) => {
    const label = parseSearchLabel(event.label);
    if (!label) return;
    const city = cities.get(label.city) ?? { users: new Set<string>(), searches: 0 };
    city.users.add(event.userId.toString());
    city.searches += 1;
    cities.set(label.city, city);
  });

  const filterUsers = new Map<string, Set<string>>();
  events.filter((event) => event.type === 'placement_filter' && event.label).forEach((event) => {
    if (!filterUsers.has(event.label!)) filterUsers.set(event.label!, new Set());
    filterUsers.get(event.label!)!.add(event.userId.toString());
  });

  const payerIds = [...new Set([...firstSearch.keys()])];
  const payments = payerIds.length
    ? await PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, userId: { $in: payerIds }, paidAt: { $gte: rangeStart } }).select({ userId: 1, amount: 1, paidAt: 1 }).lean()
    : [];
  // Оплаты считаются только после первого подбора (или первого упора в лимит).
  const paidAfter = (starts: Map<string, number>) => {
    const matched = payments.filter((payment) => starts.has(payment.userId.toString()) && payment.paidAt!.getTime() >= starts.get(payment.userId.toString())!);
    return { users: new Set(matched.map((payment) => payment.userId.toString())).size, revenue: matched.reduce((sum, payment) => sum + payment.amount, 0) };
  };

  return {
    days,
    mode,
    users: firstSearch.size,
    searches: searches.length,
    repeatUsers: [...searchDays.values()].filter((set) => set.size >= 2).length,
    topicShare: parsed.length ? Math.round(parsed.filter((item) => item.topic).length / parsed.length * 100) / 100 : null,
    thinResults: parsed.filter((item) => item.rows < 5).length,
    rulesSearches: parsed.filter((item) => !item.ai).length,
    topCities: [...cities.entries()].map(([city, value]) => ({ city, users: value.users.size, searches: value.searches }))
      .sort((left, right) => right.users - left.users || right.searches - left.searches).slice(0, 10),
    openUsers: usersOf('placement_open').size,
    selectUsers: usersOf('placement_select').size,
    selectedCommunities: new Set(events.filter((event) => event.type === 'placement_select').map((event) => event.label)).size,
    priceUsers: usersOf('placement_price').size,
    filterUsers: usersOf('placement_filter').size,
    filters: [...filterUsers.entries()].map(([category, users]) => ({ category, users: users.size })).sort((left, right) => right.users - left.users),
    limitUsers: firstLimit.size,
    paywallClicks: { rows: usersOf('placement_paywall_click', 'rows').size, limit: usersOf('placement_paywall_click', 'limit').size },
    paidAfterFirstSearch: paidAfter(firstSearch),
    paidAfterLimit: paidAfter(firstLimit),
    ai: {
      searches: counters.searches,
      fallbacks: counters.fallbacks,
      calls: counters.calls,
      failed: counters.failed,
      tokens: counters.tokens,
      avgSeconds: counters.calls ? Math.round(counters.ms / counters.calls / 100) / 10 : null
    }
  };
}
