/** Рейтинг форматов контента: какие форматы дают больше просмотров и вовлечения. */

export type RankingPost = {
  contentType?: string;
  views: number | null;
  er: number | null;
  isAd?: boolean;
};

export type FormatRow = {
  format: string;
  posts: number;
  /** Доля постов формата от всех органических. */
  share: number;
  medianViews: number | null;
  medianEr: number | null;
  /** Отклонение медианы просмотров от общей медианы, %. */
  deltaViews: number | null;
  /** Меньше 5 постов: в выводах не участвует. */
  lowSample: boolean;
  best: boolean;
};

export type FormatRanking = {
  rows: FormatRow[];
  totalPosts: number;
  overallMedianViews: number | null;
  best: FormatRow | null;
  hasData: boolean;
};

const MIN_POSTS_FOR_PANEL = 10;
const MIN_POSTS_FOR_FORMAT = 5;

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Медиана, а не среднее: один вирусный пост не должен делать формат «лучшим».
 * Рекламные публикации исключаются полностью — у них другая механика просмотров.
 */
export function buildFormatRanking(posts: RankingPost[]): FormatRanking {
  const organic = posts.filter((post) => !post.isAd);
  const groups = new Map<string, { posts: number; views: number[]; ers: number[] }>();

  for (const post of organic) {
    const format = post.contentType?.trim() || 'Без вложений';
    const row = groups.get(format) ?? { posts: 0, views: [], ers: [] };
    row.posts += 1;
    if (typeof post.views === 'number') row.views.push(post.views);
    if (typeof post.er === 'number') row.ers.push(post.er);
    groups.set(format, row);
  }

  const allViews = organic.flatMap((post) => (typeof post.views === 'number' ? [post.views] : []));
  const overallMedianViews = allViews.length ? median(allViews) : null;
  const totalPosts = organic.length;

  const rows: FormatRow[] = [...groups.entries()].map(([format, row]) => {
    const formatMedian = row.views.length ? median(row.views) : null;
    return {
      format,
      posts: row.posts,
      share: totalPosts ? row.posts / totalPosts : 0,
      medianViews: formatMedian,
      medianEr: row.ers.length ? median(row.ers) : null,
      deltaViews: formatMedian !== null && overallMedianViews ? ((formatMedian - overallMedianViews) / overallMedianViews) * 100 : null,
      lowSample: row.posts < MIN_POSTS_FOR_FORMAT,
      best: false
    };
  }).sort((left, right) => (right.medianViews ?? -1) - (left.medianViews ?? -1) || right.posts - left.posts);

  const comparable = rows.filter((row) => !row.lowSample && row.medianViews !== null);
  const best = comparable.length
    ? comparable.reduce((top, row) => ((row.medianViews as number) > (top.medianViews as number) ? row : top))
    : null;
  if (best) best.best = true;

  return {
    rows,
    totalPosts,
    overallMedianViews,
    best,
    hasData: totalPosts >= MIN_POSTS_FOR_PANEL && rows.length >= 2 && rows.some((row) => row.medianViews !== null)
  };
}
