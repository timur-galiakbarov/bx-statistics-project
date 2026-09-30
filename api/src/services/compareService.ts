import { VkApiError } from './vkClient.js';
import { getCommunityAnalytics } from './analyticsService.js';
import { getYoutubeChannelAnalytics } from './youtubeAnalyticsService.js';
import { getTelegramChannelAnalytics } from './telegramClient.js';
import { DomainError } from '../errors/domainError.js';

function parseGroupIds(value: unknown) {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function getCommunitiesCompare(userId: string, groupIdsValue: unknown, period: unknown, platformValue: unknown = 'vk') {
  const groupIds = parseGroupIds(groupIdsValue);

  if (groupIds.length === 0) {
    throw new VkApiError('VK group ids are required', {
      status: 400,
      code: 'VK_GROUP_IDS_REQUIRED'
    });
  }

  const items = [];

  for (const groupId of groupIds) {
    const separator = groupId.indexOf(':');
    const explicitPlatform = separator > 0 ? groupId.slice(0, separator) : String(platformValue);
    const externalId = separator > 0 ? groupId.slice(separator + 1) : groupId;
    const platform = explicitPlatform === 'youtube' || explicitPlatform === 'telegram' ? explicitPlatform : 'vk';
    try {
      const analytics = platform === 'youtube'
        ? await getYoutubeChannelAnalytics(externalId, period)
        : platform === 'telegram'
          ? toComparableTelegramAnalytics(await getTelegramChannelAnalytics(externalId, period))
          : await getCommunityAnalytics(userId, externalId, period);
      items.push({
        groupId: externalId,
        platform,
        analytics,
        error: null
      });
    } catch (error) {
      if (error instanceof VkApiError || error instanceof DomainError) {
        items.push({
          groupId: externalId,
          platform,
          analytics: null,
          error: {
            code: error.code,
            message: error.message,
            ...(error instanceof VkApiError ? { vkCode: error.vkCode } : {})
          }
        });
        continue;
      }

      items.push({
        groupId: externalId,
        platform,
        analytics: null,
        error: {
          code: 'COMPARE_GROUP_FAILED',
          message: 'Не удалось получить данные сообщества.'
        }
      });
    }
  }

  return { items };
}

function toComparableTelegramAnalytics(telegram: Awaited<ReturnType<typeof getTelegramChannelAnalytics>>) {
  const { channel, period, summary, daily, posts, previous } = telegram;
  const toWall = (source: typeof summary, sourcePosts: typeof posts) => ({
    totalPosts: sourcePosts.length,
    periodPosts: source.posts,
    actions: source.actions,
    likes: source.reactions,
    reposts: source.forwards,
    comments: source.comments,
    views: source.views,
    averageActionsPerPost: source.posts ? Number((source.actions / source.posts).toFixed(1)) : 0,
    averageActionsPerDay: Number((source.actions / Math.max(1, daily.length)).toFixed(1)),
    averagePostsPerDay: Number((source.posts / Math.max(1, daily.length)).toFixed(1)),
    averageViewsPerPost: source.averageViews,
    maxViews: sourcePosts.length ? Math.max(...sourcePosts.map((post) => post.views)) : 0,
    minViews: sourcePosts.length ? Math.min(...sourcePosts.map((post) => post.views)) : 0,
    adsPosts: 0,
    erAverage: source.engagementRate,
    erMax: 0,
    availability: { subscribers: channel.subscribers !== null, views: true, likes: true, comments: true, reposts: true, er: true },
    isComplete: true,
    dayGroups: daily.map((item, dayIndex) => ({ date: item.date, dayIndex, posts: item.posts, likes: item.reactions, reposts: item.forwards, comments: item.comments, actions: item.reactions + item.forwards + item.comments, views: item.views, er: item.views ? Number(((item.reactions + item.forwards + item.comments) / item.views * 100).toFixed(2)) : null, averageViews: item.posts ? Math.round(item.views / item.posts) : null, averageActionsPerPost: item.posts ? Number(((item.reactions + item.forwards + item.comments) / item.posts).toFixed(1)) : null })),
    topPosts: sourcePosts.map((post) => ({ id: post.id, date: post.date, text: post.text, url: post.url, media: [], likes: post.reactions, reposts: post.forwards, comments: post.comments, views: post.views, er: post.views ? Number((post.engagement / post.views * 100).toFixed(2)) : 0, isAd: false, contentType: post.mediaType ?? 'other' }))
  });
  const wall = toWall(summary, posts);
  const previousWall = toWall(previous.summary, previous.posts);
  return {
    platform: 'telegram' as const,
    period,
    group: { id: channel.id, platform: 'telegram' as const, externalId: channel.username, name: channel.title, screenName: channel.username, photo: channel.photo, membersCount: channel.subscribers, url: channel.url },
    stats: { unavailable: true, growth: 0, subscribed: 0, unsubscribed: 0, visitors: 0, views: summary.views, reach: 0, reachSubscribers: 0 },
    wall,
    previous: { period: previous.period, stats: null, wall: { ...previousWall, available: true } },
    photos: { total: 0, period: posts.filter((post) => post.mediaType === 'photo').length, likes: 0, reposts: 0, comments: 0, views: 0 },
    videos: { total: 0, period: posts.filter((post) => post.mediaType === 'video').length, likes: 0, reposts: 0, comments: 0, views: 0 },
    warnings: ['Telegram показывает публичные счётчики публикаций за выбранный период. Динамика аудитории и охват подписчиков недоступны.']
  };
}
