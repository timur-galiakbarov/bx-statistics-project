export type AnalyticsPeriodKey = 'week' | 'twoWeek' | 'month' | 'currentMonth' | 'previousMonth' | 'custom';

export type AnalyticsPeriodRange = {
  key: AnalyticsPeriodKey;
  dateFrom: Date;
  dateTo: Date;
  unixFrom: number;
  unixTo: number;
};

const MAX_CUSTOM_PERIOD_DAYS = 93;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed : null;
}

function range(key: AnalyticsPeriodKey, dateFrom: Date, dateTo: Date): AnalyticsPeriodRange {
  const start = startOfDay(dateFrom);
  const end = endOfDay(dateTo);
  return { key, dateFrom: start, dateTo: end, unixFrom: Math.floor(start.getTime() / 1000), unixTo: Math.floor(end.getTime() / 1000) };
}

export function getAnalyticsPeriod(
  key: unknown,
  dateFromValue?: unknown,
  dateToValue?: unknown,
  now = new Date()
): AnalyticsPeriodRange {
  const normalized: AnalyticsPeriodKey = ['week', 'twoWeek', 'month', 'currentMonth', 'previousMonth', 'custom'].includes(String(key))
    ? (key as AnalyticsPeriodKey)
    : 'month';
  const today = startOfDay(now);

  if (normalized === 'custom') {
    const dateFrom = parseDate(dateFromValue);
    const dateTo = parseDate(dateToValue);
    if (!dateFrom || !dateTo || dateFrom > dateTo || dateTo > today) throw new Error('INVALID_ANALYTICS_PERIOD');
    const days = Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
    if (days > MAX_CUSTOM_PERIOD_DAYS) throw new Error('ANALYTICS_PERIOD_TOO_LONG');
    return range(normalized, dateFrom, dateTo);
  }

  if (normalized === 'currentMonth') return range(normalized, new Date(today.getFullYear(), today.getMonth(), 1), today);
  if (normalized === 'previousMonth') return range(normalized, new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0));

  const days = normalized === 'week' ? 7 : normalized === 'twoWeek' ? 14 : 30;
  return range(normalized, new Date(today.getTime() - (days - 1) * 86_400_000), today);
}

export function getPreviousAnalyticsPeriod(period: AnalyticsPeriodRange): AnalyticsPeriodRange {
  if (period.key === 'currentMonth') {
    const year = period.dateFrom.getFullYear();
    const month = period.dateFrom.getMonth() - 1;
    const endDay = Math.min(period.dateTo.getDate(), daysInMonth(year, month));
    return range(period.key, new Date(year, month, 1), new Date(year, month, endDay));
  }
  if (period.key === 'previousMonth') {
    const year = period.dateFrom.getFullYear();
    const month = period.dateFrom.getMonth() - 1;
    return range(period.key, new Date(year, month, 1), new Date(year, month, daysInMonth(year, month)));
  }
  const durationMs = period.dateTo.getTime() - period.dateFrom.getTime() + 1;
  return range(period.key, new Date(period.dateFrom.getTime() - durationMs), new Date(period.dateFrom.getTime() - 1));
}

export function getWallCompleteness(totalCount: number, loadedPosts: Array<{ date: number }>, period: AnalyticsPeriodRange) {
  const oldestLoaded = loadedPosts.reduce((oldest, post) => Math.min(oldest, post.date), Number.POSITIVE_INFINITY);
  return totalCount <= loadedPosts.length || oldestLoaded < period.unixFrom;
}

export function buildDailySeries<T extends { date: number }>(
  period: AnalyticsPeriodRange,
  posts: T[],
  getValues: (post: T) => { actions: number; likes: number; reposts: number; comments: number; views: number; er: number }
) {
  const byDate = new Map<string, T[]>();
  posts.forEach((post) => {
    if (post.date < period.unixFrom || post.date > period.unixTo) return;
    const date = new Date(post.date * 1000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    byDate.set(key, [...(byDate.get(key) ?? []), post]);
  });

  const result: Array<{ date: string; dayIndex: number; posts: number; likes: number; reposts: number; comments: number; actions: number; views: number; er: number | null; averageViews: number | null; averageActionsPerPost: number | null }> = [];
  for (let index = 0, timestamp = period.dateFrom.getTime(); timestamp <= period.dateTo.getTime(); index += 1, timestamp += 86_400_000) {
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayPosts = byDate.get(key) ?? [];
    const values = dayPosts.map(getValues);
    const likes = values.reduce((sum, value) => sum + value.likes, 0);
    const reposts = values.reduce((sum, value) => sum + value.reposts, 0);
    const comments = values.reduce((sum, value) => sum + value.comments, 0);
    const actions = values.reduce((sum, value) => sum + value.actions, 0);
    const views = values.reduce((sum, value) => sum + value.views, 0);
    result.push({ date: key, dayIndex: index + 1, posts: dayPosts.length, likes, reposts, comments, actions, views, er: values.length ? Number((values.reduce((sum, value) => sum + value.er, 0) / values.length).toFixed(5)) : null, averageViews: values.length ? Number((views / values.length).toFixed(1)) : null, averageActionsPerPost: values.length ? Number((actions / values.length).toFixed(1)) : null });
  }
  return result;
}

export { MAX_CUSTOM_PERIOD_DAYS };

export function buildReachSeries(
  period: AnalyticsPeriodRange,
  stats: Array<{ period_from?: number; reach?: { reach?: number } }>
) {
  const byDate = new Map<string, number | null>();
  for (const day of stats) {
    if (day.period_from === undefined || !Number.isFinite(day.period_from)) continue;
    const date = new Date(day.period_from * 1000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    byDate.set(key, day.reach?.reach ?? null);
  }
  const result: Array<{ date: string; dayIndex: number; reach: number | null }> = [];
  const date = new Date(period.dateFrom);
  while (date <= period.dateTo) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    result.push({ date: key, dayIndex: result.length + 1, reach: byDate.get(key) ?? null });
    date.setDate(date.getDate() + 1);
  }
  return result;
}
