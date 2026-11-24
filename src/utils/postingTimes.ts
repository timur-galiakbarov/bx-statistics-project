/** Лучшее время публикации: раскладываем посты по дню недели и двухчасовым окнам (МСК). */

export type PostingPost = {
  date: string;
  er: number | null;
  views: number | null;
};

export type PostingCell = {
  /** 0 — понедельник, 6 — воскресенье. */
  weekday: number;
  /** 0 — 0:00–2:00, 11 — 22:00–24:00. */
  bucket: number;
  posts: number;
  medianEr: number | null;
  averageViews: number | null;
};

export type PostingHeatmap = {
  cells: PostingCell[][];
  maxMedianEr: number | null;
  totalPosts: number;
  /** Окна, где постов достаточно для вывода: лучшие по медианному ER. */
  best: PostingCell[];
  hasData: boolean;
};

export const POSTING_BUCKETS = 12;
const BUCKET_HOURS = 2;
const MSK_OFFSET_MS = 3 * 3_600_000;
const MIN_POSTS_FOR_WINDOW = 3;
const MIN_POSTS_FOR_PANEL = 10;

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * МСК — фиксированный UTC+3 без перехода на летнее время, поэтому сдвигаем метку
 * и читаем UTC-поля: так результат не зависит от таймзоны браузера.
 */
export function moscowWeekdayAndHour(date: string): { weekday: number; hour: number } {
  const msk = new Date(new Date(date).getTime() + MSK_OFFSET_MS);
  return { weekday: (msk.getUTCDay() + 6) % 7, hour: msk.getUTCHours() };
}

export function buildPostingHeatmap(posts: PostingPost[], minPostsPerWindow = MIN_POSTS_FOR_WINDOW): PostingHeatmap {
  const erValues: number[][][] = Array.from({ length: 7 }, () => Array.from({ length: POSTING_BUCKETS }, () => []));
  const viewValues: number[][][] = Array.from({ length: 7 }, () => Array.from({ length: POSTING_BUCKETS }, () => []));
  let totalPosts = 0;

  for (const post of posts) {
    const date = new Date(post.date);
    if (Number.isNaN(date.getTime())) continue;
    const { weekday, hour } = moscowWeekdayAndHour(post.date);
    const bucket = Math.floor(hour / BUCKET_HOURS);
    totalPosts += 1;
    if (typeof post.er === 'number') erValues[weekday][bucket].push(post.er);
    if (typeof post.views === 'number') viewValues[weekday][bucket].push(post.views);
  }

  const cells = erValues.map((byBucket, weekday) => byBucket.map((ers, bucket) => {
    const views = viewValues[weekday][bucket];
    return {
      weekday,
      bucket,
      posts: Math.max(ers.length, views.length),
      medianEr: ers.length ? median(ers) : null,
      averageViews: views.length ? views.reduce((sum, value) => sum + value, 0) / views.length : null
    };
  }));

  const filled = cells.flat().filter((cell) => cell.posts >= minPostsPerWindow && cell.medianEr !== null);
  const maxMedianEr = filled.length ? Math.max(...filled.map((cell) => cell.medianEr as number)) : null;
  const best = [...filled]
    .sort((left, right) => (right.medianEr ?? 0) - (left.medianEr ?? 0) || right.posts - left.posts)
    .slice(0, 3);

  return { cells, maxMedianEr, totalPosts, best, hasData: totalPosts >= MIN_POSTS_FOR_PANEL && filled.length > 0 };
}
