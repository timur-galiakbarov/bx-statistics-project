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

/** Saved Telegram sources keep the username in `handle` or `externalId`; numeric IDs cannot be resolved. */
export function telegramUsernameFromSource(source: { handle?: string | null; externalId?: string | null }) {
  for (const value of [source.handle, source.externalId]) {
    const username = value?.trim().replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?t\.me\//i, '').split('/')[0];
    if (username && /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) return username.toLowerCase();
  }
  return null;
}
