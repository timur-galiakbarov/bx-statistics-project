import { getVkAccessToken } from '../repositories/accountRepository.js';
import { VkApiError, vkApiRequest } from './vkClient.js';
import {
  buildDailySeries,
  getAnalyticsPeriod,
  getPreviousAnalyticsPeriod,
  getWallCompleteness
} from './analyticsUtils.js';

type VkGroupInfo = {
  id: number;
  name: string;
  screen_name?: string;
  description?: string;
  photo_100?: string;
  photo_200?: string;
  members_count?: number;
};

type VkStatsDay = {
  visitors?: {
    views?: number;
    visitors?: number;
  };
  reach?: {
    reach?: number;
    reach_subscribers?: number;
  };
  activity?: {
    subscribed?: number;
    unsubscribed?: number;
  };
};

type VkWallPost = {
  id: number;
  owner_id?: number;
  date: number;
  text?: string;
  marked_as_ads?: number;
  attachments?: VkAttachment[];
  likes?: { count?: number };
  reposts?: { count?: number };
  comments?: { count?: number };
  views?: { count?: number };
};

type VkPhotoSize = {
  type?: string;
  url?: string;
  width?: number;
  height?: number;
};

type VkAttachment = {
  type?: string;
  photo?: {
    id?: number;
    sizes?: VkPhotoSize[];
    src_big?: string;
    src?: string;
  };
  video?: {
    id?: number;
    owner_id?: number;
    title?: string;
    image?: VkPhotoSize[];
    photo_800?: string;
    photo_640?: string;
    photo_320?: string;
    photo_130?: string;
  };
  doc?: {
    id?: number;
    title?: string;
    ext?: string;
    url?: string;
    preview?: {
      photo?: {
        sizes?: VkPhotoSize[];
      };
    };
  };
};

type VkWallResponse = {
  count: number;
  items: VkWallPost[];
};

type VkPhotoItem = {
  id: number;
  date: number;
  text?: string;
  likes?: { count?: number };
  reposts?: { count?: number };
};

type VkPhotoCommentItem = {
  id: number;
  date: number;
  text?: string;
};

type VkVideoItem = {
  id: number;
  date?: number;
  adding_date?: number;
  title?: string;
  likes?: { count?: number };
  reposts?: { count?: number };
  comments?: number;
  views?: number;
};

type VkListResponse<T> = {
  count: number;
  items: T[];
};


function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function sumStats(stats: VkStatsDay[]) {
  return stats.reduce(
    (acc, day) => ({
      subscribed: acc.subscribed + (day.activity?.subscribed ?? 0),
      unsubscribed: acc.unsubscribed + (day.activity?.unsubscribed ?? 0),
      visitors: acc.visitors + (day.visitors?.visitors ?? 0),
      views: acc.views + (day.visitors?.views ?? 0),
      reachSubscribers: acc.reachSubscribers + (day.reach?.reach_subscribers ?? 0),
      reach: acc.reach + (day.reach?.reach ?? 0)
    }),
    {
      subscribed: 0,
      unsubscribed: 0,
      visitors: 0,
      views: 0,
      reachSubscribers: 0,
      reach: 0
    }
  );
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function getPostActions(post: VkWallPost) {
  return (post.likes?.count ?? 0) + (post.reposts?.count ?? 0) + (post.comments?.count ?? 0);
}

function getPostEr(post: VkWallPost, membersCount: number) {
  if (!membersCount) {
    return 0;
  }

  return round((getPostActions(post) / membersCount) * 100, 3);
}

function formatDayLabel(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${day}.${month}.${date.getFullYear()}`;
}

function getBestPhotoUrl(sizes?: VkPhotoSize[]) {
  return [...(sizes ?? [])].sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0]?.url;
}

function mapPostMedia(post: VkWallPost) {
  return (post.attachments ?? [])
    .map((attachment) => {
      if (attachment.type === 'photo' && attachment.photo) {
        const url = getBestPhotoUrl(attachment.photo.sizes) ?? attachment.photo.src_big ?? attachment.photo.src;

        return url ? { type: 'photo', url, title: 'Фото' } : null;
      }

      if (attachment.type === 'video' && attachment.video) {
        const url =
          getBestPhotoUrl(attachment.video.image) ??
          attachment.video.photo_800 ??
          attachment.video.photo_640 ??
          attachment.video.photo_320 ??
          attachment.video.photo_130;

        return url ? { type: 'video', url, title: attachment.video.title ?? 'Видео' } : null;
      }

      if (attachment.type === 'doc' && attachment.doc?.ext === 'gif') {
        const url = attachment.doc.url ?? getBestPhotoUrl(attachment.doc.preview?.photo?.sizes);

        return url ? { type: 'gif', url, title: attachment.doc.title ?? 'GIF' } : null;
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 4);
}

function getPostContentType(post: VkWallPost) {
  const types = new Set((post.attachments ?? []).map((attachment) => attachment.type));
  if (types.has('video')) return 'Видео';
  if (types.has('photo')) return 'Фото';
  if (types.has('doc') && post.attachments?.some((attachment) => attachment.doc?.ext === 'gif')) return 'GIF';
  if (types.has('poll')) return 'Опрос';
  if (types.has('link')) return 'Ссылка';
  return post.text ? 'Текст' : 'Без вложений';
}

function summarizeWall(
  wall: VkWallResponse,
  unixFrom: number,
  unixTo: number,
  membersCount: number,
  groupId: number
) {
  const posts = wall.items.filter((post) => post.date >= unixFrom && post.date <= unixTo);
  const totals = posts.reduce(
    (acc, post) => ({
      likes: acc.likes + (post.likes?.count ?? 0),
      reposts: acc.reposts + (post.reposts?.count ?? 0),
      comments: acc.comments + (post.comments?.count ?? 0),
      views: acc.views + (post.views?.count ?? 0)
    }),
    { likes: 0, reposts: 0, comments: 0, views: 0 }
  );
  const actions = totals.likes + totals.reposts + totals.comments;
  const postErs = posts.map((post) => getPostEr(post, membersCount));
  const period = {
    key: 'custom' as const,
    dateFrom: new Date(unixFrom * 1000),
    dateTo: new Date(unixTo * 1000),
    unixFrom,
    unixTo
  };
  const dayGroups = buildDailySeries(period, posts, (post) => ({
    actions: getPostActions(post),
    views: post.views?.count ?? 0,
    er: getPostEr(post, membersCount)
  }));

  return {
    totalPosts: wall.count,
    periodPosts: posts.length,
    actions,
    likes: totals.likes,
    reposts: totals.reposts,
    comments: totals.comments,
    views: totals.views,
    averageActionsPerPost: posts.length ? Number((actions / posts.length).toFixed(1)) : 0,
    averageActionsPerDay: dayGroups.length ? round(actions / dayGroups.length, 1) : 0,
    averagePostsPerDay: dayGroups.length ? round(posts.length / dayGroups.length, 1) : 0,
    averageViewsPerPost: posts.length ? round(totals.views / posts.length, 1) : 0,
    maxViews: posts.reduce((max, post) => Math.max(max, post.views?.count ?? 0), 0),
    minViews: posts.reduce<number | null>((min, post) => {
      const views = post.views?.count;
      if (!views) {
        return min;
      }

      return min === null ? views : Math.min(min, views);
    }, null) ?? 0,
    adsPosts: posts.filter((post) => Boolean(post.marked_as_ads)).length,
    erAverage: posts.length ? round(postErs.reduce((sum, er) => sum + er, 0) / posts.length, 3) : 0,
    erMax: postErs.length ? Math.max(...postErs) : 0,
    dayGroups,
    topPosts: [...posts]
      .sort((a, b) => {
        return getPostActions(b) - getPostActions(a);
      })
      .map((post) => ({
        id: post.id,
        date: new Date(post.date * 1000).toISOString(),
        text: post.text ?? '',
        url: `https://vk.com/wall-${Math.abs(groupId)}_${post.id}`,
        likes: post.likes?.count ?? 0,
        reposts: post.reposts?.count ?? 0,
        comments: post.comments?.count ?? 0,
        views: post.views?.count ?? 0,
        er: getPostEr(post, membersCount),
        isAd: Boolean(post.marked_as_ads),
        media: mapPostMedia(post),
        contentType: getPostContentType(post)
      }))
  };
}

function emptyMediaSummary() {
  return {
    total: 0,
    period: 0,
    likes: 0,
    reposts: 0,
    comments: 0,
    views: 0
  };
}

function summarizePhotos(photos: VkListResponse<VkPhotoItem>, unixFrom: number, unixTo: number) {
  const periodPhotos = photos.items.filter((photo) => photo.date >= unixFrom && photo.date <= unixTo);
  const totals = periodPhotos.reduce(
    (acc, photo) => ({
      likes: acc.likes + (photo.likes?.count ?? 0),
      reposts: acc.reposts + (photo.reposts?.count ?? 0)
    }),
    { likes: 0, reposts: 0 }
  );

  return {
    ...emptyMediaSummary(),
    total: photos.count,
    period: periodPhotos.length,
    likes: totals.likes,
    reposts: totals.reposts
  };
}

function summarizePhotoComments(comments: VkListResponse<VkPhotoCommentItem>, unixFrom: number, unixTo: number) {
  return comments.items.filter((comment) => comment.date >= unixFrom && comment.date <= unixTo).length;
}

function summarizeVideos(videos: VkListResponse<VkVideoItem>, unixFrom: number, unixTo: number) {
  const periodVideos = videos.items.filter((video) => {
    const date = video.date ?? video.adding_date ?? 0;
    return date >= unixFrom && date <= unixTo;
  });
  const totals = periodVideos.reduce(
    (acc, video) => ({
      likes: acc.likes + (video.likes?.count ?? 0),
      reposts: acc.reposts + (video.reposts?.count ?? 0),
      comments: acc.comments + (video.comments ?? 0),
      views: acc.views + (video.views ?? 0)
    }),
    { likes: 0, reposts: 0, comments: 0, views: 0 }
  );

  return {
    total: videos.count,
    period: periodVideos.length,
    likes: totals.likes,
    reposts: totals.reposts,
    comments: totals.comments,
    views: totals.views
  };
}

async function optionalVkRequest<T>(
  warnings: string[],
  label: string,
  request: Promise<T>,
  fallback: T
) {
  try {
    return await request;
  } catch (error) {
    if (error instanceof VkApiError) {
      warnings.push(`${label}: ${error.message}`);
      return fallback;
    }

    throw error;
  }
}

async function getStatsForPeriod(
  accessToken: string,
  groupId: number,
  period: ReturnType<typeof getAnalyticsPeriod>,
  onUnavailable: () => void
) {
  const stats = await vkApiRequest<VkStatsDay[]>('stats.get', accessToken, {
    group_id: groupId,
    timestamp_from: period.unixFrom,
    timestamp_to: period.unixTo,
    stats_groups: 'visitors,reach,activity'
  }).catch((error) => {
    if (error instanceof VkApiError && error.vkCode === 7) {
      onUnavailable();
      return [] as VkStatsDay[];
    }

    throw error;
  });

  return sumStats(stats);
}

export async function getCommunityAnalytics(
  userId: string,
  groupId: string,
  periodValue: unknown,
  dateFromValue?: unknown,
  dateToValue?: unknown
) {
  const accessToken = await getVkAccessToken(userId);

  if (!accessToken) {
    throw new VkApiError('VK token is required', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }

  let period: ReturnType<typeof getAnalyticsPeriod>;
  try {
    period = getAnalyticsPeriod(periodValue, dateFromValue, dateToValue);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_ANALYTICS_PERIOD';
    throw new VkApiError(code === 'ANALYTICS_PERIOD_TOO_LONG' ? 'Произвольный период не может быть длиннее 93 дней.' : 'Укажите корректный период без будущих дат.', { status: 400, code });
  }
  const previousPeriod = getPreviousAnalyticsPeriod(period);
  const warnings: string[] = [];
  const groupInfoList = await vkApiRequest<VkGroupInfo[]>('groups.getById', accessToken, {
    group_id: groupId,
    fields: 'members_count,counters,description,photo_100,photo_200,screen_name'
  });
  const groupInfo = groupInfoList[0];

  if (!groupInfo) {
    throw new VkApiError('VK group was not found', {
      status: 404,
      code: 'VK_GROUP_NOT_FOUND'
    });
  }

  let statsUnavailable = false;
  const stats = await getStatsForPeriod(accessToken, groupInfo.id, period, () => {
    statsUnavailable = true;
  });
  const previousStats = await getStatsForPeriod(accessToken, groupInfo.id, previousPeriod, () => {
    statsUnavailable = true;
  });
  if (statsUnavailable) {
    warnings.push('VK не выдал право stats, прирост, посещения и охват сообщества недоступны.');
  }

  const WALL_PAGE_SIZE = 100;
  const WALL_MAX_POSTS = 1_000;
  let wallCount = 0;
  const wallPosts: VkWallPost[] = [];
  let offset = 0;
  let needMore = true;
  while (needMore && offset < WALL_MAX_POSTS) {
    const page = await vkApiRequest<VkWallResponse>('wall.get', accessToken, {
      owner_id: -groupInfo.id,
      count: WALL_PAGE_SIZE,
      offset
    });
    wallCount = page.count;
    wallPosts.push(...page.items);
    offset += page.items.length;
    const oldestLoadedPostDate = wallPosts.reduce((oldest, post) => Math.min(oldest, post.date), Number.POSITIVE_INFINITY);
    needMore = page.items.length === WALL_PAGE_SIZE && wallPosts.length < wallCount && oldestLoadedPostDate > previousPeriod.unixFrom;
  }
  const wall = { count: wallCount, items: wallPosts };
  const currentWallAvailable = getWallCompleteness(wall.count, wall.items, period);
  const previousWallAvailable = getWallCompleteness(wall.count, wall.items, previousPeriod);
  if (!currentWallAvailable || !previousWallAvailable) {
    warnings.push('Для выбранного сравнения VK не отдал достаточно публикаций из истории стены. Метрики неполной выборки не используются в сравнениях и выводах.');
  }
  const photos = await optionalVkRequest(
    warnings,
    'Фотографии VK недоступны',
    vkApiRequest<VkListResponse<VkPhotoItem>>('photos.getAll', accessToken, {
      owner_id: -groupInfo.id,
      count: 200,
      offset: 0,
      extended: 1,
      no_service_albums: 1
    }),
    { count: 0, items: [] }
  );
  const photoComments = await optionalVkRequest(
    warnings,
    'Комментарии к фотографиям VK недоступны',
    vkApiRequest<VkListResponse<VkPhotoCommentItem>>('photos.getAllComments', accessToken, {
      owner_id: -groupInfo.id,
      count: 200,
      offset: 0
    }),
    { count: 0, items: [] }
  );
  const videos = await optionalVkRequest(
    warnings,
    'Видео VK недоступны',
    vkApiRequest<VkListResponse<VkVideoItem>>('video.get', accessToken, {
      owner_id: -groupInfo.id,
      count: 200,
      offset: 0,
      extended: 1
    }),
    { count: 0, items: [] }
  );

  const photoSummary = summarizePhotos(photos, period.unixFrom, period.unixTo);
  photoSummary.comments = summarizePhotoComments(photoComments, period.unixFrom, period.unixTo);

  return {
    period: {
      key: period.key,
      dateFrom: formatDate(period.dateFrom),
      dateTo: formatDate(period.dateTo)
    },
    group: {
      id: groupInfo.id,
      name: groupInfo.name,
      screenName: groupInfo.screen_name,
      description: groupInfo.description,
      photo: groupInfo.photo_200 ?? groupInfo.photo_100,
      membersCount: groupInfo.members_count ?? 0
    },
    stats: {
      unavailable: statsUnavailable,
      growth: stats.subscribed - stats.unsubscribed,
      subscribed: stats.subscribed,
      unsubscribed: stats.unsubscribed,
      visitors: stats.visitors,
      views: stats.views,
      reach: stats.reach,
      reachSubscribers: stats.reachSubscribers
    },
    wall: {
      ...summarizeWall(wall, period.unixFrom, period.unixTo, groupInfo.members_count ?? 0, groupInfo.id),
      isComplete: currentWallAvailable
    },
    previous: {
      period: {
        dateFrom: formatDate(previousPeriod.dateFrom),
        dateTo: formatDate(previousPeriod.dateTo)
      },
      stats: statsUnavailable
        ? null
        : {
            growth: previousStats.subscribed - previousStats.unsubscribed,
            visitors: previousStats.visitors,
            reach: previousStats.reach
          },
      wall: {
        ...summarizeWall(wall, previousPeriod.unixFrom, previousPeriod.unixTo, groupInfo.members_count ?? 0, groupInfo.id),
        isComplete: previousWallAvailable,
        available: previousWallAvailable
      }
    },
    photos: photoSummary,
    videos: summarizeVideos(videos, period.unixFrom, period.unixTo),
    warnings
  };
}
