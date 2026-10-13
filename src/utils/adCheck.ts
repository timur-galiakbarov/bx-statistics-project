import type { PostViewCurves, SocialPlatform } from '../api/types';

export const MIN_AD_SAMPLE = 3;
export type AdPost = { id: string | number; date: string; views: number | null; text?: string; url?: string; actions: number | null };

type CommunityAdInput = {
  platform?: SocialPlatform;
  wall: {
    availability?: Partial<Record<'views' | 'likes' | 'comments' | 'reposts', boolean>>;
    topPosts: Array<Omit<AdPost, 'actions'> & { likes: number | null; comments: number | null; reposts: number | null }>;
  };
};

export function communityAdPosts(analytics: CommunityAdInput): AdPost[] {
  const availability = analytics.wall.availability;
  const isYoutube = analytics.platform === 'youtube';
  return analytics.wall.topPosts.map((post) => {
    const counters = isYoutube ? [post.likes, post.comments] : [post.likes, post.comments, post.reposts];
    const actionsAvailable = availability?.likes !== false && availability?.comments !== false
      && (isYoutube || availability?.reposts !== false)
      && counters.every((value) => value !== null && Number.isFinite(value) && value >= 0);
    return {
      id: post.id, date: post.date, text: post.text, url: post.url,
      views: availability?.views === false ? null : post.views ?? null,
      actions: actionsAvailable ? counters.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null
    };
  });
}

export function quantile(values: number[], share: number): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * share;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

export function publicationDay(date: string) {
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) : '';
}

export function adSample(curves: PostViewCurves | null, from: string, to: string, hours: number) {
  const posts = (curves?.posts ?? []).filter((post) => {
    const day = publicationDay(post.publishedAt);
    const value = post.milestones[String(hours)];
    return day >= from && day <= to && typeof value === 'number' && Number.isFinite(value) && value >= 0;
  });
  const values = posts.map((post) => post.milestones[String(hours)]!);
  const sufficient = values.length >= MIN_AD_SAMPLE;
  return {
    posts, count: values.length, sufficient,
    median: sufficient ? quantile(values, 0.5) : null,
    lower: sufficient ? quantile(values, 0.25) : null,
    upper: sufficient ? quantile(values, 0.75) : null
  };
}

export function maturePostStats(posts: AdPost[], now: number = Date.now()) {
  const mature = posts.filter((post) => {
    const age = now - new Date(post.date).getTime();
    return age >= 72 * 3_600_000 && Number.isFinite(post.views) && post.views !== null && post.views >= 0;
  });
  const views = mature.map((post) => post.views!);
  const totalViews = views.reduce((sum, value) => sum + value, 0);
  const actionsAvailable = mature.length > 0 && mature.every((post) => post.actions !== null && Number.isFinite(post.actions) && post.actions >= 0);
  return {
    count: mature.length,
    median: mature.length >= MIN_AD_SAMPLE ? quantile(views, 0.5) : null,
    engagement: actionsAvailable && totalViews > 0 ? mature.reduce((sum, post) => sum + post.actions!, 0) / totalViews * 100 : null
  };
}

export function positiveAmount(input: string): number | null {
  const normalized = input.trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized.replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000 ? amount : null;
}

export function costPerThousand(price: number | null, views: number | null): number | null {
  return price !== null && Number.isFinite(price) && price > 0 && views !== null && Number.isFinite(views) && views > 0 ? price / views * 1000 : null;
}
