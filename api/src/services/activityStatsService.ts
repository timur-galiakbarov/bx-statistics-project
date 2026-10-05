import type { Types } from 'mongoose';
import { ActivityEventModel, type ActivityEventType } from '../models/ActivityEvent.js';
import { PaymentModel } from '../models/Payment.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { UserModel } from '../models/User.js';
import { VisitModel } from '../models/Visit.js';
import type { Acquisition } from '../repositories/accountRepository.js';

// Москва живёт в UTC+3 без перехода на летнее время, поэтому хватает фиксированного сдвига.
const MSK_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
const BOUNCE_MAX_MS = 15_000;
const FEED_LIMIT = 60;

export type AdminActivitySummary = {
  users: number;
  newUsers: number;
  returningUsers: number;
  visits: number;
  pageViews: number;
  bounceRate: number | null;
  avgVisitSeconds: number | null;
  pagesPerVisit: number | null;
  actions: number;
  groupsAdded: number;
  usersAddedGroups: number;
  payments: number;
  revenue: number;
};

export type AdminActivityDay = {
  date: string;
  users: number;
  newUsers: number;
  visits: number;
  bounces: number;
  groupsAdded: number;
  payments: number;
  revenue: number;
};

export type AdminActivityFeedItem = {
  id: string;
  at: string;
  userId: string;
  userName: string;
  type: ActivityEventType | 'registration' | 'payment';
  platform?: string;
  label?: string;
  amount?: number;
};

export type AdminActivityStats = {
  days: number;
  trackingSince: string | null;
  periods: {
    today: AdminActivitySummary;
    yesterday: AdminActivitySummary;
    week: AdminActivitySummary;
    previousWeek: AdminActivitySummary;
    month: AdminActivitySummary;
  };
  daily: AdminActivityDay[];
  engagement: {
    avgDau7: number;
    mau: number;
    stickiness: number | null;
    avgActiveDays30: number | null;
    visitsPerUser30: number | null;
    returnRate: number | null;
    returnCohort: number;
  };
  funnel: { registered: number; addedGroup: number; usedAnalytics: number; returned: number; paid: number };
  acquisition: Array<{ source: string; campaign: string; registrations: number; addedGroup: number; paid: number }>;
  groups: {
    byPlatform: Array<{ key: string; count: number }>;
    bySource: Array<{ key: string; count: number }>;
    top: Array<{ name: string; platform: string; users: number }>;
  };
  pages: Array<{ path: string; visits: number; users: number; entries: number }>;
  actions: Array<{ type: string; count: number; users: number }>;
  devices: Array<{ key: string; visits: number }>;
  hours: number[];
  feed: AdminActivityFeedItem[];
};

type VisitRow = {
  userId: Types.ObjectId;
  startedAt: Date;
  lastSeenAt: Date;
  pageViews?: number;
  actions?: number;
  entryPath?: string;
  paths?: string[];
  device?: string;
};

type EventRow = { _id: Types.ObjectId; userId: Types.ObjectId; type: ActivityEventType; platform?: string; label?: string; createdAt: Date };

export function mskDayStart(date: Date, shiftDays = 0) {
  return new Date(Math.floor((date.getTime() + MSK_OFFSET_MS) / DAY_MS) * DAY_MS - MSK_OFFSET_MS + shiftDays * DAY_MS);
}

export function mskDayKey(date: Date) {
  return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Bounce in the Metrika sense: a single page, no actions and less than 15 seconds on the site. */
export function isBounce(visit: Pick<VisitRow, 'pageViews' | 'actions' | 'startedAt' | 'lastSeenAt'>) {
  return (visit.pageViews ?? 0) <= 1
    && (visit.actions ?? 0) === 0
    && visit.lastSeenAt.getTime() - visit.startedAt.getTime() < BOUNCE_MAX_MS;
}

// Источник регистрации: UTM, иначе клик-ID рекламной сети, иначе домен referrer.
function acquisitionSource(acquisition?: Acquisition) {
  if (acquisition?.utmSource) return acquisition.utmSource;
  if (acquisition?.rbClickId) return 'vk_ads';
  if (acquisition?.yclid) return 'yandex_direct';
  return acquisition?.referrer;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export async function getAdminActivityStats(requestedDays: unknown, now = new Date()): Promise<AdminActivityStats> {
  const parsedDays = Number(requestedDays);
  const days = Number.isFinite(parsedDays) ? Math.min(90, Math.max(7, Math.round(parsedDays))) : 30;
  const todayStart = mskDayStart(now);
  const tomorrowStart = mskDayStart(now, 1);
  // Сводки за 30 дней и прошлую неделю нужны при любом выбранном периоде графика.
  const windowStart = mskDayStart(now, -(Math.max(days, 30) - 1));
  const rangeStart = mskDayStart(now, -(days - 1));

  // Администраторы постоянно заходят в кабинет и искажают статистику.
  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const notAdmin = { $nin: adminIds };

  const [visits, events, activeUsers, registrations, groups, payments, firstVisit, feedEvents, feedRegistrations, feedPayments] = await Promise.all([
    VisitModel.find({ startedAt: { $gte: windowStart }, userId: notAdmin })
      .select({ userId: 1, startedAt: 1, lastSeenAt: 1, pageViews: 1, actions: 1, entryPath: 1, paths: 1, device: 1 })
      .lean<VisitRow[]>(),
    ActivityEventModel.find({ createdAt: { $gte: windowStart }, userId: notAdmin })
      .select({ userId: 1, type: 1, platform: 1, createdAt: 1 })
      .lean<EventRow[]>(),
    UserModel.find({ isAdmin: { $ne: true }, lastActivityAt: { $gte: windowStart } })
      .select({ lastActivityAt: 1 })
      .lean<Array<{ _id: Types.ObjectId; lastActivityAt: Date }>>(),
    UserModel.find({ isAdmin: { $ne: true }, createdAt: { $gte: windowStart } })
      .select({ createdAt: 1, lastActivityAt: 1, acquisition: 1 })
      .lean<Array<{
        _id: Types.ObjectId;
        createdAt: Date;
        lastActivityAt?: Date;
        acquisition?: Acquisition;
      }>>(),
    SavedGroupModel.find({ createdAt: { $gte: windowStart }, userId: notAdmin })
      .select({ userId: 1, platform: 1, source: 1, name: 1, externalId: 1, vkGroupId: 1, createdAt: 1 })
      .lean<Array<{
        userId: Types.ObjectId;
        platform?: string;
        source: string;
        name: string;
        externalId?: string;
        vkGroupId: string;
        createdAt: Date;
      }>>(),
    PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, paidAt: { $gte: windowStart }, userId: notAdmin })
      .select({ userId: 1, amount: 1, paidAt: 1 })
      .lean<Array<{ userId: Types.ObjectId; amount: number; paidAt: Date }>>(),
    VisitModel.findOne().sort({ startedAt: 1 }).select({ startedAt: 1 }).lean<{ startedAt: Date }>(),
    ActivityEventModel.find({ userId: notAdmin }).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean<EventRow[]>(),
    UserModel.find({ isAdmin: { $ne: true } }).sort({ createdAt: -1 }).limit(20)
      .select({ createdAt: 1, acquisition: 1 })
      .lean<Array<{ _id: Types.ObjectId; createdAt: Date; acquisition?: Acquisition }>>(),
    PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, paidAt: { $exists: true }, userId: notAdmin })
      .sort({ paidAt: -1 }).limit(20)
      .select({ userId: 1, amount: 1, period: 1, paidAt: 1 })
      .lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId; amount: number; period?: string; paidAt: Date }>>()
  ]);

  // Дни активности по пользователям: визиты, действия, регистрация и «последняя активность»
  // (последняя достоверна и для истории до появления трекинга визитов).
  const activeByDay = new Map<string, Set<string>>();
  const daysByUser = new Map<string, Set<string>>();
  const markActive = (userId: Types.ObjectId, date?: Date | null) => {
    if (!date || date < windowStart) return;
    const key = mskDayKey(date);
    const id = userId.toString();
    if (!activeByDay.has(key)) activeByDay.set(key, new Set());
    activeByDay.get(key)!.add(id);
    if (!daysByUser.has(id)) daysByUser.set(id, new Set());
    daysByUser.get(id)!.add(key);
  };
  visits.forEach((visit) => { markActive(visit.userId, visit.startedAt); markActive(visit.userId, visit.lastSeenAt); });
  events.forEach((event) => markActive(event.userId, event.createdAt));
  activeUsers.forEach((user) => markActive(user._id, user.lastActivityAt));
  registrations.forEach((user) => markActive(user._id, user.createdAt));

  const dayKeysBetween = (from: Date, to: Date) => {
    const keys: string[] = [];
    for (let time = from.getTime(); time < to.getTime(); time += DAY_MS) keys.push(mskDayKey(new Date(time)));
    return keys;
  };

  const summarize = (from: Date, to: Date): AdminActivitySummary => {
    const inRange = (date?: Date | null) => Boolean(date && date >= from && date < to);
    const users = new Set<string>();
    for (const key of dayKeysBetween(from, to)) activeByDay.get(key)?.forEach((id) => users.add(id));
    const periodVisits = visits.filter((visit) => inRange(visit.startedAt));
    const newUsers = registrations.filter((user) => inRange(user.createdAt)).length;
    const periodGroups = groups.filter((group) => inRange(group.createdAt));
    const periodPayments = payments.filter((payment) => inRange(payment.paidAt));
    const pageViews = periodVisits.reduce((total, visit) => total + (visit.pageViews ?? 0), 0);
    const visitMs = periodVisits.reduce((total, visit) => total + (visit.lastSeenAt.getTime() - visit.startedAt.getTime()), 0);

    return {
      users: users.size,
      newUsers,
      returningUsers: Math.max(0, users.size - newUsers),
      visits: periodVisits.length,
      pageViews,
      bounceRate: ratio(periodVisits.filter(isBounce).length, periodVisits.length),
      avgVisitSeconds: periodVisits.length ? Math.round(visitMs / periodVisits.length / 1000) : null,
      pagesPerVisit: ratio(pageViews, periodVisits.length),
      actions: events.filter((event) => inRange(event.createdAt)).length,
      groupsAdded: periodGroups.length,
      usersAddedGroups: new Set(periodGroups.map((group) => group.userId.toString())).size,
      payments: periodPayments.length,
      revenue: periodPayments.reduce((total, payment) => total + payment.amount, 0)
    };
  };

  const periods = {
    today: summarize(todayStart, tomorrowStart),
    yesterday: summarize(mskDayStart(now, -1), todayStart),
    week: summarize(mskDayStart(now, -6), tomorrowStart),
    previousWeek: summarize(mskDayStart(now, -13), mskDayStart(now, -6)),
    month: summarize(mskDayStart(now, -29), tomorrowStart)
  };

  const daily: AdminActivityDay[] = dayKeysBetween(rangeStart, tomorrowStart).map((date) => {
    const dayVisits = visits.filter((visit) => mskDayKey(visit.startedAt) === date);
    const dayPayments = payments.filter((payment) => mskDayKey(payment.paidAt) === date);
    return {
      date,
      users: activeByDay.get(date)?.size ?? 0,
      newUsers: registrations.filter((user) => mskDayKey(user.createdAt) === date).length,
      visits: dayVisits.length,
      bounces: dayVisits.filter(isBounce).length,
      groupsAdded: groups.filter((group) => mskDayKey(group.createdAt) === date).length,
      payments: dayPayments.length,
      revenue: dayPayments.reduce((total, payment) => total + payment.amount, 0)
    };
  });

  // Вовлечённость за 30 дней.
  const last7Keys = dayKeysBetween(mskDayStart(now, -6), tomorrowStart);
  const avgDau7 = last7Keys.reduce((total, key) => total + (activeByDay.get(key)?.size ?? 0), 0) / last7Keys.length;
  const monthKeys = new Set(dayKeysBetween(mskDayStart(now, -29), tomorrowStart));
  const monthUserDays = [...daysByUser.values()]
    .map((keys) => [...keys].filter((key) => monthKeys.has(key)).length)
    .filter((count) => count > 0);
  const monthStart = mskDayStart(now, -29);
  const monthVisits = visits.filter((visit) => visit.startedAt >= monthStart);
  const monthVisitors = new Set(monthVisits.map((visit) => visit.userId.toString())).size;

  // Когорта регистраций выбранного периода: что успели сделать после регистрации.
  const cohort = registrations.filter((user) => user.createdAt >= rangeStart);
  const cohortIds = cohort.map((user) => user._id);
  const [cohortWithGroups, cohortPaid] = await Promise.all([
    SavedGroupModel.distinct('userId', { userId: { $in: cohortIds } }),
    PaymentModel.distinct('userId', { status: 'paid', amount: { $gt: 0 }, userId: { $in: cohortIds } })
  ]);
  const withGroupsSet = new Set(cohortWithGroups.map((id) => id.toString()));
  const paidSet = new Set(cohortPaid.map((id) => id.toString()));
  const analyticsUsers = new Set(events.filter((event) => event.type === 'analytics_view').map((event) => event.userId.toString()));
  const hasReturned = (user: (typeof cohort)[number]) => {
    const registrationKey = mskDayKey(user.createdAt);
    return [...(daysByUser.get(user._id.toString()) ?? [])].some((key) => key > registrationKey);
  };
  // Зарегистрированные сегодня ещё не могли вернуться на следующий день.
  const returnCohort = cohort.filter((user) => user.createdAt < todayStart);

  const acquisitionRows = new Map<string, { source: string; campaign: string; registrations: number; addedGroup: number; paid: number }>();
  for (const user of cohort) {
    const source = acquisitionSource(user.acquisition) ?? 'без меток';
    const campaign = user.acquisition?.utmCampaign ?? '';
    const key = `${source}\u0000${campaign}`;
    const row = acquisitionRows.get(key) ?? { source, campaign, registrations: 0, addedGroup: 0, paid: 0 };
    row.registrations += 1;
    if (withGroupsSet.has(user._id.toString())) row.addedGroup += 1;
    if (paidSet.has(user._id.toString())) row.paid += 1;
    acquisitionRows.set(key, row);
  }

  // Детализация за выбранный период.
  const rangeVisits = visits.filter((visit) => visit.startedAt >= rangeStart);
  const rangeGroups = groups.filter((group) => group.createdAt >= rangeStart);
  const rangeEvents = events.filter((event) => event.createdAt >= rangeStart);

  const pages = new Map<string, { visits: number; users: Set<string>; entries: number }>();
  for (const visit of rangeVisits) {
    for (const path of new Set(visit.paths ?? [])) {
      const row = pages.get(path) ?? { visits: 0, users: new Set<string>(), entries: 0 };
      row.visits += 1;
      row.users.add(visit.userId.toString());
      pages.set(path, row);
    }
    if (visit.entryPath) {
      const row = pages.get(visit.entryPath) ?? { visits: 0, users: new Set<string>(), entries: 0 };
      row.entries += 1;
      pages.set(visit.entryPath, row);
    }
  }

  const actions = new Map<string, { count: number; users: Set<string> }>();
  for (const event of rangeEvents) {
    const row = actions.get(event.type) ?? { count: 0, users: new Set<string>() };
    row.count += 1;
    row.users.add(event.userId.toString());
    actions.set(event.type, row);
  }

  const topChannels = new Map<string, { name: string; platform: string; users: Set<string> }>();
  for (const group of rangeGroups) {
    const platform = group.platform ?? 'vk';
    const key = `${platform}:${group.externalId ?? group.vkGroupId}`;
    const row = topChannels.get(key) ?? { name: group.name, platform, users: new Set<string>() };
    row.users.add(group.userId.toString());
    topChannels.set(key, row);
  }

  const hours = Array.from({ length: 24 }, () => 0);
  rangeVisits.forEach((visit) => { hours[new Date(visit.startedAt.getTime() + MSK_OFFSET_MS).getUTCHours()] += 1; });

  // Лента: действия плюс регистрации и оплаты, которые есть в истории и до появления трекинга.
  const feedUserIds = [...new Set([...feedEvents, ...feedPayments].map((item) => item.userId.toString())
    .concat(feedRegistrations.map((user) => user._id.toString())))];
  const feedUsers = await UserModel.find({ _id: { $in: feedUserIds } })
    .select({ firstName: 1, lastName: 1 })
    .lean<Array<{ _id: Types.ObjectId; firstName?: string; lastName?: string }>>();
  const userNames = new Map(feedUsers.map((user) => [
    user._id.toString(),
    [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Без имени'
  ]));
  const nameOf = (id: string) => userNames.get(id) ?? 'Удалённый пользователь';
  const feed: AdminActivityFeedItem[] = [
    ...feedEvents.map((event) => ({
      id: event._id.toString(),
      at: event.createdAt.toISOString(),
      userId: event.userId.toString(),
      userName: nameOf(event.userId.toString()),
      type: event.type,
      platform: event.platform,
      label: event.label
    })),
    ...feedRegistrations.map((user) => ({
      id: `registration:${user._id.toString()}`,
      at: user.createdAt.toISOString(),
      userId: user._id.toString(),
      userName: nameOf(user._id.toString()),
      type: 'registration' as const,
      label: acquisitionSource(user.acquisition)
    })),
    ...feedPayments.map((payment) => ({
      id: `payment:${payment._id.toString()}`,
      at: payment.paidAt.toISOString(),
      userId: payment.userId.toString(),
      userName: nameOf(payment.userId.toString()),
      type: 'payment' as const,
      label: payment.period,
      amount: payment.amount
    }))
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);

  return {
    days,
    trackingSince: firstVisit?.startedAt.toISOString() ?? null,
    periods,
    daily,
    engagement: {
      avgDau7: Math.round(avgDau7 * 10) / 10,
      mau: periods.month.users,
      stickiness: ratio(avgDau7, periods.month.users),
      avgActiveDays30: monthUserDays.length
        ? monthUserDays.reduce((total, count) => total + count, 0) / monthUserDays.length
        : null,
      visitsPerUser30: ratio(monthVisits.length, monthVisitors),
      returnRate: ratio(returnCohort.filter(hasReturned).length, returnCohort.length),
      returnCohort: returnCohort.length
    },
    funnel: {
      registered: cohort.length,
      addedGroup: cohort.filter((user) => withGroupsSet.has(user._id.toString())).length,
      usedAnalytics: cohort.filter((user) => analyticsUsers.has(user._id.toString())).length,
      returned: cohort.filter(hasReturned).length,
      paid: cohort.filter((user) => paidSet.has(user._id.toString())).length
    },
    acquisition: [...acquisitionRows.values()].sort((a, b) => b.registrations - a.registrations).slice(0, 15),
    groups: {
      byPlatform: countBy(rangeGroups, (group) => group.platform ?? 'vk'),
      bySource: countBy(rangeGroups, (group) => group.source),
      top: [...topChannels.values()]
        .map((row) => ({ name: row.name, platform: row.platform, users: row.users.size }))
        .sort((a, b) => b.users - a.users)
        .slice(0, 10)
    },
    pages: [...pages.entries()]
      .map(([path, row]) => ({ path, visits: row.visits, users: row.users.size, entries: row.entries }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 15),
    actions: [...actions.entries()]
      .map(([type, row]) => ({ type, count: row.count, users: row.users.size }))
      .sort((a, b) => b.count - a.count),
    devices: countBy(rangeVisits, (visit) => visit.device ?? 'desktop').map(({ key, count }) => ({ key, visits: count })),
    hours,
    feed
  };
}
