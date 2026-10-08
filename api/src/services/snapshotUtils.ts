export const SNAPSHOT_TIME_ZONE = 'Europe/Moscow';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SNAPSHOT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SNAPSHOT_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23'
});

/** Day of the snapshot (YYYY-MM-DD) in Moscow time, regardless of the server time zone. */
export function snapshotDateKey(date = new Date()) {
  return dateKeyFormatter.format(date);
}

export function snapshotHour(date = new Date()) {
  return Number(hourFormatter.format(date));
}

export function hoursSince(publishedAt: Date, now = new Date()) {
  return Math.max(0, Math.round((now.getTime() - publishedAt.getTime()) / 360_000) / 10);
}

export type SubscriberPoint = { date: string; subscribers: number | null };

export type SubscriberHistoryPoint = SubscriberPoint & {
  /** Change against the previous known value; null for the first point or unknown values. */
  change: number | null;
};

export function buildSubscriberHistory(points: SubscriberPoint[]): SubscriberHistoryPoint[] {
  let previous: number | null = null;
  return [...points]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((point) => {
      const change = point.subscribers !== null && previous !== null ? point.subscribers - previous : null;
      if (point.subscribers !== null) previous = point.subscribers;
      return { ...point, change };
    });
}

export type SnapshotGrowth = {
  /** Change of subscribers over the period; null while there is not enough history. */
  total: number | null;
  /** Date the change is counted from: later than the period start while history is short. */
  since: string | null;
  /** First known snapshot of the source. */
  historySince: string | null;
  /** Without access the exact change is hidden: only whether subscribers grew. */
  locked?: boolean;
  direction?: 'up' | 'down' | 'steady' | null;
};

/** Socstat's own snapshots are a paid feature: a user without access sees only the direction. */
export function lockSnapshotGrowth(growth: SnapshotGrowth): SnapshotGrowth {
  const direction = growth.total === null ? null : growth.total > 0 ? 'up' : growth.total < 0 ? 'down' : 'steady';
  return { total: null, since: growth.since, historySince: growth.historySince, locked: true, direction };
}

/**
 * Subscriber change for a period of snapshot days. A snapshot is taken early in the morning,
 * so the period ends with the next day's snapshot or, for periods up to today, the live value.
 */
export function snapshotGrowthForPeriod(
  points: SubscriberPoint[],
  dateFrom: string,
  dateTo: string,
  today: string,
  currentSubscribers: number | null,
  historySince: string | null
): SnapshotGrowth {
  const known = points
    .filter((point): point is { date: string; subscribers: number } => point.subscribers !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
  const baseline = known.find((point) => point.date >= dateFrom && point.date <= dateTo);
  if (!baseline) return { total: null, since: null, historySince };

  if (dateTo >= today && currentSubscribers !== null) {
    return { total: currentSubscribers - baseline.subscribers, since: baseline.date, historySince };
  }
  const end = known.find((point) => point.date > dateTo) ?? known.filter((point) => point.date <= dateTo).at(-1);
  if (!end || end.date === baseline.date) return { total: null, since: baseline.date, historySince };
  return { total: end.subscribers - baseline.subscribers, since: baseline.date, historySince };
}

/** Saved Telegram sources keep the username in `handle` or `externalId`; numeric IDs cannot be resolved. */
export function telegramUsernameFromSource(source: { handle?: string | null; externalId?: string | null }) {
  for (const value of [source.handle, source.externalId]) {
    const username = value?.trim().replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, '').split('/')[0];
    if (username && /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) return username.toLowerCase();
  }
  return null;
}

export type PostViewPoint = { hoursSincePublished: number; views: number | null };

/** Hours for which the dashboard reports how many views a post gained. */
export const VIEW_MILESTONE_HOURS = [24, 48, 72] as const;
// Without a snapshot before the milestone the curve starts from zero views at publication;
// a linear guess is only acceptable while the next snapshot is close to the milestone.
const MAX_ANCHOR_STRETCH = 1.5;

/**
 * Views a post had `targetHours` after publication, interpolated between the daily snapshots
 * around that moment. Null when snapshots do not cover it (the post is too young or was missed).
 */
export function viewsAtHour(points: PostViewPoint[], targetHours: number): number | null {
  const known = points
    .filter((point): point is { hoursSincePublished: number; views: number } => point.views !== null)
    .sort((left, right) => left.hoursSincePublished - right.hoursSincePublished);
  const upper = known.find((point) => point.hoursSincePublished >= targetHours);
  if (!upper) return null;
  if (upper.hoursSincePublished === targetHours) return upper.views;
  const lower = known.filter((point) => point.hoursSincePublished < targetHours).at(-1);
  if (!lower && upper.hoursSincePublished > targetHours * MAX_ANCHOR_STRETCH) return null;
  const from = lower ?? { hoursSincePublished: 0, views: 0 };
  const share = (targetHours - from.hoursSincePublished) / (upper.hoursSincePublished - from.hoursSincePublished);
  return Math.round(from.views + (upper.views - from.views) * share);
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Typical views at consecutive milestones. Older posts are the only ones reaching later milestones,
 * so plain medians per milestone compare different posts and can even decrease. Instead the first
 * milestone is a median and every next one applies the median growth of posts that have both values.
 */
export function chainedMedians(series: Array<Array<number | null>>, minPosts: number) {
  const steps = Math.max(0, ...series.map((values) => values.length));
  const result: Array<{ median: number | null; posts: number }> = [];
  let previous: number | null = null;
  for (let index = 0; index < steps; index += 1) {
    if (index === 0) {
      const values = series.map((item) => item[0]).filter((value): value is number => value !== null && value !== undefined);
      previous = values.length >= minPosts ? median(values) : null;
      result.push({ median: previous, posts: values.length });
      continue;
    }
    const growth = series
      .filter((item) => typeof item[index - 1] === 'number' && typeof item[index] === 'number' && item[index - 1]! > 0)
      .map((item) => item[index]! / item[index - 1]!);
    const typicalGrowth = growth.length >= minPosts ? medianFloat(growth) : null;
    previous = previous !== null && typicalGrowth !== null ? Math.round(previous * typicalGrowth) : null;
    result.push({ median: previous, posts: growth.length });
  }
  return result;
}

function medianFloat(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
