import { getGroups, getVkAccessToken } from '../repositories/accountRepository.js';
import { isVkPermissionDeniedError, VkApiError, vkApiRequest } from './vkClient.js';
import { TtlCache } from './ttlCache.js';

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
  group: {
    id: number | string;
    name: string;
    screenName?: string;
    photo?: string;
  };
  membersCount: number;
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

function emptySummaryItem(savedGroupId: string, source: string, groupId: string, name: string, isManagedByUser: boolean): DashboardSummaryItem {
  return {
    savedGroupId,
    source,
    group: {
      id: groupId,
      name
    },
    membersCount: 0,
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

export async function getDashboardSummary(userId: string, periodValue: unknown, forceRefresh = false): Promise<DashboardSummaryResult> {
  const period = getPeriod(periodValue);
  const groups = await getGroups(userId);
  const cacheKey = [userId, period.key, groups.map((group) => `${group.id}:${group.vkGroupId}:${group.source}`).join(',')].join(':');

  if (!forceRefresh) {
    const cached = dashboardSummaryCache.get(cacheKey);
    if (cached) return cached;
  }

  const accessToken = await getVkAccessToken(userId);

  if (!accessToken) {
    throw new VkApiError('VK token is required', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }

  const managedGroupsResponse = await vkApiRequest<VkGroupsGetResponse>('groups.get', accessToken, {
    extended: 0,
    filter: 'moder',
    count: 1000
  }).catch(() => null);
  const managedGroupIds = new Set(
    (managedGroupsResponse?.items ?? []).map((group) => typeof group === 'number' ? group : group.id)
  );
  const summaryGroups: DashboardSummaryItem[] = [];

  for (const savedGroup of groups) {
      const groupId = String(savedGroup.vkGroupId);
      const isManagedByUser = managedGroupIds.has(Number(groupId)) || savedGroup.source === 'managed';
      const fallback = emptySummaryItem(savedGroup.id, savedGroup.source, groupId, savedGroup.name, isManagedByUser);

      try {
        const groupInfoList = await vkApiRequest<VkGroupInfo[]>('groups.getById', accessToken, {
          group_id: groupId,
          fields: 'members_count,counters,description,photo_100,photo_200,screen_name'
        });
        const groupInfo = groupInfoList[0];

        if (!groupInfo) {
          summaryGroups.push({
            ...fallback,
            error: {
              code: 'VK_GROUP_NOT_FOUND',
              message: 'Группа не найдена.'
            }
          });
          continue;
        }

        let statsUnavailable = false;
        const stats = await vkApiRequest<VkStatsDay[]>('stats.get', accessToken, {
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

        const wall = await vkApiRequest<VkWallResponse>('wall.get', accessToken, {
            owner_id: -groupInfo.id,
            count: 100,
            offset: 0
          });

        const stat = sumStats(stats);
        const activity = sumWallActivity(wall, period.unixFrom, period.unixTo);

        summaryGroups.push({
          savedGroupId: savedGroup.id,
          source: savedGroup.source,
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
          traffic: {
            visitors: stat.visitors,
            views: stat.views
          },
          reach: {
            subscribers: stat.reachSubscribers,
            total: stat.reach
          },
          activity,
          warnings: statsUnavailable ? ['Статистика группы недоступна в VK.'] : [],
          error: null
        });
      } catch (error) {
        if (error instanceof VkApiError) {
          summaryGroups.push({
            ...fallback,
            error: {
              code: error.code,
              message: error.message,
              vkCode: error.vkCode
            }
          });
          continue;
        }

        summaryGroups.push({
          ...fallback,
          error: {
            code: 'DASHBOARD_GROUP_FAILED',
            message: 'Не удалось получить статистику группы.'
          }
        });
      }

      await delay(350);
  }

  const summary = {
    period: {
      key: period.key,
      dateFrom: formatDate(period.dateFrom),
      dateTo: formatDate(period.dateTo)
    },
    groups: summaryGroups
  };
  dashboardSummaryCache.set(cacheKey, summary);

  return summary;
}
