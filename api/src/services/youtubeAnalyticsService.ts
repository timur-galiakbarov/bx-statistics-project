import { getAnalyticsPeriod, getPreviousAnalyticsPeriod, buildDailySeries, type AnalyticsPeriodRange } from './analyticsUtils.js';
import { getYoutubeVideos, resolveYoutubeChannel, YoutubeApiError, type YoutubeChannel, type YoutubeVideo } from './youtubeClient.js';

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function value(value: number | null) {
  return value ?? 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function videoEr(video: YoutubeVideo, subscribers: number | null) {
  if (!subscribers) return 0;
  return ((value(video.likes) + value(video.comments)) / subscribers) * 100;
}

export function summarizeYoutubeVideos(channel: YoutubeChannel, videos: YoutubeVideo[], period: AnalyticsPeriodRange) {
  const periodVideos = videos.filter((video) => {
    const date = new Date(video.publishedAt).getTime();
    return date >= period.dateFrom.getTime() && date <= period.dateTo.getTime();
  });
  const knownViews = periodVideos.flatMap((video) => video.views === null ? [] : [video.views]);
  const knownLikes = periodVideos.flatMap((video) => video.likes === null ? [] : [video.likes]);
  const knownComments = periodVideos.flatMap((video) => video.comments === null ? [] : [video.comments]);
  const views = knownViews.reduce((sum, count) => sum + count, 0);
  const likes = knownLikes.reduce((sum, count) => sum + count, 0);
  const comments = knownComments.reduce((sum, count) => sum + count, 0);
  const actions = likes + comments;
  const ers = periodVideos.map((video) => videoEr(video, channel.followersCount));
  const periodDays = Math.max(1, Math.ceil((period.dateTo.getTime() - period.dateFrom.getTime()) / 86_400_000) + 1);
  const dated = periodVideos.map((video) => ({ ...video, date: Math.floor(new Date(video.publishedAt).getTime() / 1000) }));
  return {
    totalPosts: channel.videoCount,
    periodPosts: periodVideos.length,
    actions,
    likes,
    reposts: 0,
    comments,
    views,
    averageActionsPerPost: periodVideos.length ? round(actions / periodVideos.length) : 0,
    averageActionsPerDay: round(actions / periodDays),
    averagePostsPerDay: round(periodVideos.length / periodDays),
    averageViewsPerPost: knownViews.length ? round(views / knownViews.length) : 0,
    medianViewsPerPost: median(knownViews),
    maxViews: knownViews.length ? Math.max(...knownViews) : 0,
    minViews: knownViews.length ? Math.min(...knownViews) : 0,
    adsPosts: 0,
    erAverage: ers.length && channel.followersCount ? round(ers.reduce((sum, er) => sum + er, 0) / ers.length, 5) : null,
    erMax: ers.length && channel.followersCount ? round(Math.max(...ers), 5) : null,
    isComplete: true,
    availability: {
      subscribers: channel.followersCount !== null,
      views: knownViews.length === periodVideos.length,
      likes: knownLikes.length === periodVideos.length,
      comments: knownComments.length === periodVideos.length,
      reposts: false,
      er: channel.followersCount !== null && knownLikes.length === periodVideos.length && knownComments.length === periodVideos.length
    },
    dayGroups: buildDailySeries(period, dated, (video) => ({
      actions: value(video.likes) + value(video.comments),
      likes: value(video.likes),
      reposts: 0,
      comments: value(video.comments),
      views: value(video.views),
      er: videoEr(video, channel.followersCount)
    })).map((day) => channel.followersCount === null ? { ...day, er: null } : day),
    topPosts: [...periodVideos]
      .sort((a, b) => value(b.views) - value(a.views))
      .map((video) => ({
        id: video.id,
        date: video.publishedAt,
        text: video.description || video.title,
        title: video.title,
        url: video.url,
        media: video.thumbnail ? [{ type: 'video' as const, url: video.thumbnail, title: video.title }] : [],
        likes: video.likes,
        reposts: null,
        comments: video.comments,
        views: video.views,
        er: channel.followersCount && video.likes !== null && video.comments !== null ? round(videoEr(video, channel.followersCount), 5) : null,
        isAd: false,
        contentType: 'Видео'
      }))
  };
}

export async function getYoutubeChannelAnalytics(
  channelId: string,
  periodValue: unknown,
  dateFromValue?: unknown,
  dateToValue?: unknown,
  forceRefresh = false
) {
  let period: ReturnType<typeof getAnalyticsPeriod>;
  try {
    period = getAnalyticsPeriod(periodValue, dateFromValue, dateToValue);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_ANALYTICS_PERIOD';
    throw new YoutubeApiError(code === 'ANALYTICS_PERIOD_TOO_LONG' ? 'Произвольный период не может быть длиннее 93 дней.' : 'Укажите корректный период без будущих дат.', { status: 400, code });
  }
  const previousPeriod = getPreviousAnalyticsPeriod(period);
  const channel = await resolveYoutubeChannel(channelId, forceRefresh);
  const videos = await getYoutubeVideos(channel, previousPeriod.dateFrom, period.dateTo, forceRefresh);
  const wall = summarizeYoutubeVideos(channel, videos, period);
  const previousWall = summarizeYoutubeVideos(channel, videos, previousPeriod);
  const unavailable = {
    totalSubscribers: channel.followersCount === null,
    shares: true,
    subscriberGrowth: true,
    reach: true,
    uniqueViewers: true,
    retention: true,
    trafficSources: true
  };
  return {
    platform: 'youtube' as const,
    period: { key: period.key, dateFrom: formatDate(period.dateFrom), dateTo: formatDate(period.dateTo) },
    group: {
      platform: 'youtube' as const,
      id: channel.id,
      externalId: channel.externalId,
      name: channel.name,
      screenName: channel.handle,
      description: channel.description,
      photo: channel.photo,
      url: channel.url,
      membersCount: channel.followersCount,
      subscribersHidden: channel.subscribersHidden,
      channelViewCount: channel.viewCount,
      publicVideoCount: channel.videoCount,
      isManagedByCurrentUser: false
    },
    stats: { unavailable: true, growth: 0, subscribed: 0, unsubscribed: 0, visitors: 0, views: 0, reach: 0, reachSubscribers: 0, dayGroups: [] },
    wall,
    previous: {
      period: { dateFrom: formatDate(previousPeriod.dateFrom), dateTo: formatDate(previousPeriod.dateTo) },
      stats: null,
      wall: { ...previousWall, available: true }
    },
    photos: { total: 0, period: 0, likes: 0, reposts: 0, comments: 0, views: 0 },
    videos: { total: channel.videoCount, period: wall.periodPosts, likes: wall.likes, reposts: 0, comments: wall.comments, views: wall.views },
    unavailableMetrics: unavailable,
    warnings: []
  };
}
