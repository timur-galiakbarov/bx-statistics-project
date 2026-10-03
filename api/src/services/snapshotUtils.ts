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
};

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
