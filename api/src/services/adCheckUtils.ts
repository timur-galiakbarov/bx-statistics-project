import type { AdMarker } from './adDetection.js';

/** A post of the checked source, as both platforms are reduced to for the pre-ad check. */
export type AdCheckPost = {
  id: string;
  date: string;
  views: number | null;
  /** Likes in VK, reactions in Telegram. */
  reactions: number | null;
  comments: number | null;
  /** Reposts in VK, forwards in Telegram. */
  forwards: number | null;
  ad: AdMarker | null;
};

export type AdCheckCurves = {
  milestones: Array<{ hours: number; median: number | null; posts: number }>;
  posts: Array<{ postId: string; milestones: Record<string, number | null> }>;
};

/** Below this many posts a median says nothing about the source. */
export const MIN_POSTS = 3;
/** Posts younger than this still gain views and are left out of the typical views. */
export const MATURE_HOURS = 72;
/** The estimate uses at most this many latest mature posts, so old history does not dominate. */
export const ESTIMATE_POSTS = 30;
/** Hours the snapshot-based estimate refers to: the usual term an ad post is paid for. */
export const ESTIMATE_HOURS = 48;

export function quantile(values: number[], share: number): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * share;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

function spread(values: number[]) {
  return {
    views: Math.round(quantile(values, 0.5)!),
    lower: Math.round(quantile(values, 0.25)!),
    upper: Math.round(quantile(values, 0.75)!),
    posts: values.length
  };
}

export type AdCheckEstimate = {
  /** snapshots — views 48 h after publication from Socstat's nightly snapshots;
   *  current — current views of posts older than 72 hours, available on the first check. */
  source: 'snapshots' | 'current';
  hours: number | null;
  views: number;
  lower: number;
  upper: number;
  posts: number;
};

/**
 * Typical views of a post. Snapshot history gives views at a fixed age; without it the current
 * views of mature posts are the best immediate guess (slightly above the 48-hour value).
 */
export function estimateViews(posts: AdCheckPost[], curves: AdCheckCurves | null, now: number): AdCheckEstimate | null {
  const milestone = curves?.milestones.find((item) => item.hours === ESTIMATE_HOURS);
  const atMilestone = (curves?.posts ?? [])
    .map((post) => post.milestones[String(ESTIMATE_HOURS)])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  if (milestone?.median != null && atMilestone.length >= MIN_POSTS) {
    return { source: 'snapshots', hours: ESTIMATE_HOURS, ...spread(atMilestone), views: milestone.median };
  }
  const mature = maturePosts(posts, now).slice(0, ESTIMATE_POSTS).map((post) => post.views!);
  if (mature.length < MIN_POSTS) return null;
  return { source: 'current', hours: null, ...spread(mature) };
}

/** Posts old enough to have gained most of their views, newest first. */
export function maturePosts(posts: AdCheckPost[], now: number) {
  return posts
    .filter((post) => post.views !== null && Number.isFinite(post.views) && post.views >= 0 && now - new Date(post.date).getTime() >= MATURE_HOURS * 3_600_000)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function median(values: number[], minPosts: number) {
  return values.length >= minPosts ? Math.round(quantile(values, 0.5)!) : null;
}

export type AdCheckAds = {
  posts: number;
  perWeek: number;
  share: number | null;
  /** Median views of mature ad posts (from 2 posts) and of the other mature posts (from 3). */
  medianViews: number | null;
  organicMedianViews: number | null;
  markers: Record<AdMarker, number>;
};

export function summarizeAds(posts: AdCheckPost[], coverageDays: number, now: number): AdCheckAds {
  const ads = posts.filter((post) => post.ad);
  const mature = maturePosts(posts, now).slice(0, ESTIMATE_POSTS * 2);
  const markers: Record<AdMarker, number> = { platform: 0, erid: 0, label: 0 };
  for (const post of ads) markers[post.ad!] += 1;
  return {
    posts: ads.length,
    perWeek: round(ads.length / Math.max(1, coverageDays) * 7, 1),
    share: posts.length ? round(ads.length / posts.length * 100, 1) : null,
    medianViews: median(mature.filter((post) => post.ad).map((post) => post.views!), 2),
    organicMedianViews: median(mature.filter((post) => !post.ad).map((post) => post.views!), MIN_POSTS),
    markers
  };
}

/** Actions per view of mature posts, %; null when some counter is unknown or there are too few posts. */
export function engagementRate(posts: AdCheckPost[], now: number) {
  const mature = maturePosts(posts, now).slice(0, ESTIMATE_POSTS);
  if (mature.length < MIN_POSTS || mature.some((post) => post.reactions === null || post.comments === null || post.forwards === null)) return null;
  const views = mature.reduce((sum, post) => sum + post.views!, 0);
  const actions = mature.reduce((sum, post) => sum + post.reactions! + post.comments! + post.forwards!, 0);
  return views > 0 ? round(actions / views * 100, 2) : null;
}

/**
 * Days the loaded posts cover. A complete load covers the whole window; a capped one (VK returns
 * the last 100 posts) covers only the time back to its oldest post.
 */
export function coverageDays(posts: AdCheckPost[], windowDays: number, complete: boolean, now: number) {
  if (complete || !posts.length) return windowDays;
  const oldest = Math.min(...posts.map((post) => new Date(post.date).getTime()));
  return Math.max(1, Math.min(windowDays, round((now - oldest) / 86_400_000, 1)));
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

export function summarizeAdCheck(options: {
  posts: AdCheckPost[];
  subscribers: number | null;
  curves: AdCheckCurves | null;
  windowDays: number;
  complete: boolean;
  now: number;
}) {
  const { posts, subscribers, curves, windowDays, complete, now } = options;
  const days = coverageDays(posts, windowDays, complete, now);
  const estimate = estimateViews(posts, curves, now);
  return {
    coverageDays: days,
    postsPerDay: round(posts.length / days, 1),
    estimate,
    viewsToSubscribers: estimate && subscribers ? round(estimate.views / subscribers * 100, 1) : null,
    engagement: engagementRate(posts, now),
    ads: summarizeAds(posts, days, now),
    milestones: (curves?.milestones ?? []).some((item) => item.median !== null) ? curves!.milestones : null
  };
}
