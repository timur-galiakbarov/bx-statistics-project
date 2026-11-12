import type { CommunityAnalyticsResult } from './analyticsService.js';
import { lockSnapshotGrowth, type SnapshotGrowth } from './snapshotUtils.js';

type Wall = CommunityAnalyticsResult['wall'];
type Post = Wall['topPosts'][number];

export type PreviewInsight = { tone: 'good' | 'warn' | 'neutral'; title: string };

export type AnalyticsPreview = {
  /** Directions without numbers: the numbers and advice are what the tariff opens. */
  insights: PreviewInsight[];
  hiddenPosts: number;
  /** Growth from Socstat snapshots when VK gives no stats: direction only. */
  snapshotGrowth: SnapshotGrowth | null;
};

// Изменения меньше 1% показываем как «без изменений», чтобы заголовок не дёргался на шуме.
function direction(current: number, previous: number) {
  if (!previous) return null;
  const change = (current - previous) / Math.abs(previous);
  return Math.abs(change) < 0.01 ? 'steady' : change > 0 ? 'up' : 'down';
}

function toneOf(state: 'up' | 'down' | 'steady') {
  return state === 'up' ? 'good' : state === 'down' ? 'warn' : 'neutral';
}

function previewInsights(analytics: CommunityAnalyticsResult): PreviewInsight[] {
  const { wall } = analytics;
  const previous = analytics.previous.wall.available ? analytics.previous.wall : null;
  const result: PreviewInsight[] = [];

  if (previous && wall.periodPosts && previous.periodPosts) {
    const er = direction(wall.erAverage, previous.erAverage);
    if (er) result.push({ tone: toneOf(er), title: er === 'up' ? 'ER вырос' : er === 'down' ? 'ER снизился' : 'ER почти не изменился' });
    const views = direction(wall.averageViewsPerPost, previous.averageViewsPerPost);
    if (views) result.push({ tone: toneOf(views), title: `Средние просмотры поста ${views === 'up' ? 'выросли' : views === 'down' ? 'снизились' : 'стабильны'}` });
  }

  const byFormat = new Map<string, Post[]>();
  wall.topPosts.filter((post) => !post.isAd).forEach((post) => byFormat.set(post.contentType, [...(byFormat.get(post.contentType) ?? []), post]));
  const leader = [...byFormat.entries()]
    .filter(([, posts]) => posts.length >= 3)
    .map(([name, posts]) => {
      const ers = posts.map((post) => post.er).sort((left, right) => left - right);
      return { name, medianEr: ers[Math.floor(ers.length / 2)] };
    })
    .sort((left, right) => right.medianEr - left.medianEr)[0];
  if (leader) result.push({ tone: 'good', title: `${leader.name} — сильный формат` });

  if (wall.adsPosts) result.push({ tone: 'neutral', title: 'В ленте есть рекламные публикации' });

  return result;
}

function hideWallMetrics<T extends Wall>(wall: T): T {
  return {
    ...wall,
    actions: 0,
    likes: 0,
    reposts: 0,
    comments: 0,
    views: 0,
    averageActionsPerPost: 0,
    averageActionsPerDay: 0,
    averageViewsPerPost: 0,
    maxViews: 0,
    minViews: 0,
    adsPosts: 0,
    erAverage: 0,
    erMax: 0,
    dayGroups: wall.dayGroups.map((day) => ({
      ...day,
      likes: 0,
      reposts: 0,
      comments: 0,
      actions: 0,
      views: 0,
      er: null,
      averageViews: null,
      averageActionsPerPost: null
    })),
    topPosts: []
  };
}

/**
 * Report for a user without access: only what is visible in VK itself (subscribers, post count,
 * the single best post) plus insight headlines. Closed metrics never leave the server — the client
 * blurs placeholders, so nothing can be read from DevTools.
 */
export function toAnalyticsPreview(analytics: CommunityAnalyticsResult, snapshotGrowth: SnapshotGrowth | null = null): CommunityAnalyticsResult & { preview: AnalyticsPreview } {
  const bestPost = analytics.wall.topPosts[0];

  return {
    ...analytics,
    stats: {
      ...analytics.stats,
      visitors: 0,
      views: 0,
      reach: 0,
      reachSubscribers: 0,
      dayGroups: []
    },
    wall: { ...hideWallMetrics(analytics.wall), topPosts: bestPost ? [bestPost] : [] },
    previous: {
      ...analytics.previous,
      stats: null,
      wall: hideWallMetrics(analytics.previous.wall)
    },
    photos: { ...analytics.photos, likes: 0, reposts: 0, comments: 0, views: 0 },
    videos: { ...analytics.videos, likes: 0, reposts: 0, comments: 0, views: 0 },
    preview: {
      insights: previewInsights(analytics),
      hiddenPosts: Math.max(analytics.wall.topPosts.length - 1, 0),
      snapshotGrowth: snapshotGrowth && lockSnapshotGrowth(snapshotGrowth)
    }
  };
}
