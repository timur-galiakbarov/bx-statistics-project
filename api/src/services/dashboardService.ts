import { getGroups, getVkAccessToken } from '../repositories/accountRepository.js';
import { DomainError } from '../errors/domainError.js';
import type { SavedGroup } from '../store/types.js';
import { isVkPermissionDeniedError, VkApiError, vkApiRequest } from './vkClient.js';
import { TtlCache } from './ttlCache.js';
import { getYoutubeVideos, resolveYoutubeChannel } from './youtubeClient.js';

type DashboardPeriod = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'currentMonth';

type VkGroupInfo = {
  id: number;
  name: string;
  screen_name?: string;
  photo_100?: string;
  photo_200?: string;
  members_count?: number;
};

type VkGroupsGetResponse = {
  count: number;
  items: Array<number | VkGroupInfo>;
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

type VkWallResponse = {
  count: number;
  items: Array<{
    date: number;
    likes?: { count?: number };
    reposts?: { count?: number };
    comments?: { count?: number };
  }>;
};

export type DashboardSummaryItem = {
  savedGroupId: string;
  source: string;
  platform: 'vk' | 'youtube';
  group: {
    id: number | string;
    name: string;
    screenName?: string;
    photo?: string;
  };
  membersCount: number | null;
  isManagedByUser: boolean;
  statsAvailable: boolean | null;
  growth: {
    total: number;
    subscribed: number;
    unsubscribed: number;
  };
  traffic: {
    visitors: number;
    views: number;
  };
  reach: {
    subscribers: number;
    total: number;
  };
  activity: {
    likes: number;
    reposts: number;
    comments: number;
  };
  warnings: string[];
  error: null | {
    code: string;
    message: string;
    vkCode?: number;
  };
};

type DashboardSummaryResult = {
  period: {
    key: DashboardPeriod;
    dateFrom: string;
    dateTo: string;
  };
  groups: DashboardSummaryItem[];
};

const DASHBOARD_SUMMARY_CACHE_TTL_MS = 60 * 60 * 1_000;
const dashboardSummaryCache = new TtlCache<DashboardSummaryResult>(DASHBOARD_SUMMARY_CACHE_TTL_MS);
const dashboardSummaryItemCache = new TtlCache<DashboardSummaryItem>(DASHBOARD_SUMMARY_CACHE_TTL_MS);
const managedGroupIdsCache = new TtlCache<Set<number>>(DASHBOARD_SUMMARY_CACHE_TTL_MS);
const pendingSummaryItems = new Map<string, Promise<DashboardSummaryItem>>();
const pendingManagedGroupIds = new Map<string, Promise<Set<number>>>();

function getPeriod(period: unknown) {
  const now = new Date();
  const value = typeof period === 'string' ? period : 'last7days';
  const normalized: DashboardPeriod = ['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'currentMonth'].includes(value)
    ? (value as DashboardPeriod)
    : 'last7days';

  const start = new Date(now);
  const end = new Date(now);

  if (normalized === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (normalized === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  }

  if (normalized === 'last7days') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (normalized === 'last30days' || normalized === 'last90days') {
    start.setDate(start.getDate() - (normalized === 'last30days' ? 29 : 89));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (normalized === 'currentMonth') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return {
    key: normalized,
    dateFrom: start,
    dateTo: end,
    unixFrom: Math.floor(start.getTime() / 1000),
    unixTo: Math.floor(end.getTime() / 1000)
  };
}

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

function sumWallActivity(wall: VkWallResponse, unixFrom: number, unixTo: number) {
  return wall.items
    .filter((post) => post.date >= unixFrom && post.date <= unixTo)
    .reduce(
      (acc, post) => ({
        likes: acc.likes + (post.likes?.count ?? 0),
        reposts: acc.reposts + (post.reposts?.count ?? 0),
        comments: acc.comments + (post.comments?.count ?? 0)
      }),
      { likes: 0, reposts: 0, comments: 0 }
    );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emptySummaryItem(savedGroupId: string, source: string, platform: 'vk' | 'youtube', groupId: string, name: string, isManagedByUser: boolean): DashboardSummaryItem {
  return {
    savedGroupId,
    source,
    platform,
    group: {
      id: groupId,
      name
    },
    membersCount: platform === 'youtube' ? null : 0,
    isManagedByUser,
    statsAvailable: null,
    growth: {
      total: 0,
      subscribed: 0,
      unsubscribed: 0
    },
    traffic: {
      visitors: 0,
      views: 0
    },
    reach: {
      subscribers: 0,
      total: 0
    },
    activity: {
      likes: 0,
      reposts: 0,
      comments: 0
    },
    warnings: [],
    error: null
  };
}

function formatPeriod(period: ReturnType<typeof getPeriod>) {
  return {
    key: period.key,
    dateFrom: formatDate(period.dateFrom),
    dateTo: formatDate(period.dateTo)
  };
}

function getSummaryItemCacheKey(userId: string, savedGroup: SavedGroup, period: ReturnType<typeof getPeriod>) {
  return [userId, period.key, savedGroup.id, savedGroup.platform, savedGroup.externalId, savedGroup.source].join(':');
}

async function getManagedGroupIds(userId: string, accessToken: string, forceRefresh: boolean) {
  if (!forceRefresh) {
    const cached = managedGroupIdsCache.get(userId);
    if (cached) return cached;
  }

  const pending = pendingManagedGroupIds.get(userId);
  if (pending) return pending;

  const request = vkApiRequest<VkGroupsGetResponse>('groups.get', accessToken, {
    extended: 0,
    filter: 'moder',
    count: 1000
  })
    .then((response) => new Set(response.items.map((group) => typeof group === 'number' ? group : group.id)))
    .catch(() => new Set<number>())
    .then((ids) => {
      managedGroupIdsCache.set(userId, ids);
      return ids;
    })
    .finally(() => pendingManagedGroupIds.delete(userId));

  pendingManagedGroupIds.set(userId, request);
  return request;
}

async function buildDashboardSummaryItem(
  savedGroup: SavedGroup,
  period: ReturnType<typeof getPeriod>,
  accessToken: string | undefined,
  managedGroupIds: Set<number>,
  forceRefresh: boolean
): Promise<DashboardSummaryItem> {
  const groupId = String(savedGroup.externalId);

  if (savedGroup.platform === 'youtube') {
    const fallback = emptySummaryItem(savedGroup.id, savedGroup.source, 'youtube', groupId, savedGroup.name, false);
    try {
      const channel = await resolveYoutubeChannel(groupId, forceRefresh);
      const videos = await getYoutubeVideos(channel, period.dateFrom, period.dateTo, forceRefresh);
      const likes = videos.reduce((sum, video) => sum + (video.likes ?? 0), 0);
      const comments = videos.reduce((sum, video) => sum + (video.comments ?? 0), 0);
      return {
        ...fallback,
        group: { id: channel.id, name: channel.name, screenName: channel.handle, photo: channel.photo },
        membersCount: channel.followersCount,
        statsAvailable: true,
        traffic: { visitors: 0, views: videos.reduce((sum, video) => sum + (video.views ?? 0), 0) },
        activity: { likes, reposts: 0, comments },
        warnings: ['Просмотры и реакции YouTube — текущие накопительные показатели видео, опубликованных в выбранном периоде. Репосты и динамика аудитории недоступны.']
      };
    } catch (error) {
      return { ...fallback, error: { code: error instanceof Error ? error.name : 'YOUTUBE_DASHBOARD_FAILED', message: error instanceof Error ? error.message : 'Не удалось получить данные YouTube-канала.' } };
    }
  }

  const isManagedByUser = managedGroupIds.has(Number(groupId)) || savedGroup.source === 'managed';
  const fallback = emptySummaryItem(savedGroup.id, savedGroup.source, 'vk', groupId, savedGroup.name, isManagedByUser);

  try {
    const groupInfoList = await vkApiRequest<VkGroupInfo[]>('groups.getById', accessToken!, {
      group_id: groupId,
      fields: 'members_count,counters,description,photo_100,photo_200,screen_name'
    });
    const groupInfo = groupInfoList[0];

    if (!groupInfo) {
      return { ...fallback, error: { code: 'VK_GROUP_NOT_FOUND', message: 'Группа не найдена.' } };
    }

    let statsUnavailable = false;
    const stats = await vkApiRequest<VkStatsDay[]>('stats.get', accessToken!, {
      group_id: groupInfo.id,
      timestamp_from: period.unixFrom,
      timestamp_to: period.unixTo,
      stats_groups: 'visitors,reach,activity'
    }).catch((error) => {
      if (isVkPermissionDeniedError(error)) {
        statsUnavailable = true;
        return [] as VkStatsDay[];
      }
      throw error;
    });

    await delay(350);

    const wall = await vkApiRequest<VkWallResponse>('wall.get', accessToken!, {
      owner_id: -groupInfo.id,
      count: 100,
      offset: 0
    });
    const stat = sumStats(stats);
    const activity = sumWallActivity(wall, period.unixFrom, period.unixTo);

    await delay(350);

    return {
      savedGroupId: savedGroup.id,
      source: savedGroup.source,
      platform: 'vk',
      group: {
        id: groupInfo.id,
        name: groupInfo.name,
        screenName: groupInfo.screen_name,
        photo: groupInfo.photo_100 ?? groupInfo.photo_200
      },
      membersCount: groupInfo.members_count ?? savedGroup.membersCount ?? 0,
      isManagedByUser,
      statsAvailable: !statsUnavailable,
      growth: {
        total: stat.subscribed - stat.unsubscribed,
        subscribed: stat.subscribed,
        unsubscribed: stat.unsubscribed
      },
      traffic: { visitors: stat.visitors, views: stat.views },
      reach: { subscribers: stat.reachSubscribers, total: stat.reach },
      activity,
      warnings: statsUnavailable ? ['Статистика группы недоступна в VK.'] : [],
      error: null
    };
  } catch (error) {
    if (error instanceof VkApiError) {
      return { ...fallback, error: { code: error.code, message: error.message, vkCode: error.vkCode } };
    }
    return { ...fallback, error: { code: 'DASHBOARD_GROUP_FAILED', message: 'Не удалось получить статистику группы.' } };
  }
}

async function loadDashboardSummaryItem(
  userId: string,
  savedGroup: SavedGroup,
  period: ReturnType<typeof getPeriod>,
  accessToken: string | undefined,
  managedGroupIds: Set<number>,
  forceRefresh: boolean
) {
  const cacheKey = getSummaryItemCacheKey(userId, savedGroup, period);
  if (!forceRefresh) {
    const cached = dashboardSummaryItemCache.get(cacheKey);
    if (cached) return cached;
  }

  const pendingKey = forceRefresh ? `${cacheKey}:refresh` : cacheKey;
  const pending = pendingSummaryItems.get(pendingKey);
  if (pending) return pending;

  const request = buildDashboardSummaryItem(savedGroup, period, accessToken, managedGroupIds, forceRefresh)
    .then((item) => {
      dashboardSummaryItemCache.set(cacheKey, item);
      return item;
    })
    .finally(() => pendingSummaryItems.delete(pendingKey));
  pendingSummaryItems.set(pendingKey, request);
  return request;
}

export async function getDashboardSummaryItem(userId: string, savedGroupId: string, periodValue: unknown, forceRefresh = false): Promise<DashboardSummaryResult> {
  const period = getPeriod(periodValue);
  const savedGroup = (await getGroups(userId)).find((group) => group.id === savedGroupId && group.isTracked);
  if (!savedGroup) {
    throw new DomainError('Сообщество не найдено в списке отслеживаемых.', { status: 404, code: 'DASHBOARD_GROUP_NOT_FOUND' });
  }

  const accessToken = savedGroup.platform === 'vk' ? await getVkAccessToken(userId) : undefined;
  if (savedGroup.platform === 'vk' && !accessToken) {
    throw new VkApiError('VK token is required', { status: 409, code: 'VK_TOKEN_REQUIRED' });
  }
  // Ownership changes much less frequently than metrics. Reuse it across per-row refreshes
  // so every next worker does not add another groups.get request to VK.
  const managedGroupIds = accessToken ? await getManagedGroupIds(userId, accessToken, false) : new Set<number>();
  const item = await loadDashboardSummaryItem(userId, savedGroup, period, accessToken, managedGroupIds, forceRefresh);

  return { period: formatPeriod(period), groups: [item] };
}

export async function getDashboardSummary(userId: string, periodValue: unknown, forceRefresh = false): Promise<DashboardSummaryResult> {
  const period = getPeriod(periodValue);
  const groups = (await getGroups(userId)).filter((group) => group.isTracked);
  const cacheKey = [userId, period.key, groups.map((group) => `${group.id}:${group.platform}:${group.externalId}:${group.source}`).join(',')].join(':');

  if (!forceRefresh) {
    const cached = dashboardSummaryCache.get(cacheKey);
    if (cached) return cached;
  }

  const hasVkGroups = groups.some((group) => group.platform === 'vk');
  const accessToken = hasVkGroups ? await getVkAccessToken(userId) : undefined;

  if (hasVkGroups && !accessToken) {
    throw new VkApiError('VK token is required', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }

  const managedGroupIds = accessToken ? await getManagedGroupIds(userId, accessToken, forceRefresh) : new Set<number>();
  const summaryGroups: DashboardSummaryItem[] = [];

  for (const savedGroup of groups) {
    summaryGroups.push(await loadDashboardSummaryItem(userId, savedGroup, period, accessToken, managedGroupIds, forceRefresh));
  }

  const summary = {
    period: formatPeriod(period),
    groups: summaryGroups
  };
  dashboardSummaryCache.set(cacheKey, summary);

  return summary;
}
