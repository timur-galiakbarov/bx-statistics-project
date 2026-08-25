import { DomainError } from '../errors/domainError.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { vkApiRequest, VkApiError } from './vkClient.js';

type PostsPeriod = 'week' | 'twoWeek' | 'month';

type VkGroupInfo = {
  id: number;
  name: string;
  screen_name?: string;
  photo_100?: string;
  photo_200?: string;
  members_count?: number;
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

function getPeriod(value: unknown) {
  const normalized: PostsPeriod = value === 'week' || value === 'twoWeek' || value === 'month' ? value : 'month';
  const now = new Date();
  const start = new Date(now);

  if (normalized === 'week') {
    start.setDate(start.getDate() - 6);
  }

  if (normalized === 'twoWeek') {
    start.setDate(start.getDate() - 13);
  }

  if (normalized === 'month') {
    start.setDate(start.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  now.setHours(23, 59, 59, 999);

  return {
    key: normalized,
    dateFrom: start,
    dateTo: now,
    unixFrom: Math.floor(start.getTime() / 1000),
    unixTo: Math.floor(now.getTime() / 1000)
  };
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function parseGroupIds(value: unknown) {
  if (typeof value !== 'string') {
    throw new DomainError('Не переданы сообщества для анализа.', {
      status: 400,
      code: 'GROUP_IDS_REQUIRED'
    });
  }

  const groupIds = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!groupIds.length) {
    throw new DomainError('Не переданы сообщества для анализа.', {
      status: 400,
      code: 'GROUP_IDS_REQUIRED'
    });
  }

  if (groupIds.length > 10) {
    throw new DomainError('За один раз можно анализировать не больше 10 сообществ.', {
      status: 400,
      code: 'GROUP_IDS_LIMIT_EXCEEDED'
    });
  }

  return [...new Set(groupIds)];
}

function summarizeGroup(wall: VkWallResponse, posts: VkWallPost[], membersCount: number) {
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

  return {
    totalPosts: wall.count,
    periodPosts: posts.length,
    likes: totals.likes,
    reposts: totals.reposts,
    comments: totals.comments,
    views: totals.views,
    actions,
    averageActionsPerPost: posts.length ? round(actions / posts.length, 1) : 0,
    averageViewsPerPost: posts.length ? round(totals.views / posts.length, 1) : 0,
    erAverage: posts.length ? round(postErs.reduce((sum, er) => sum + er, 0) / posts.length, 3) : 0
  };
}

export async function getPostsAnalysis(userId: string, groupIdsValue: unknown, periodValue: unknown) {
  const accessToken = await getVkAccessToken(userId);

  if (!accessToken) {
    throw new VkApiError('VK token is required', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }

  const period = getPeriod(periodValue);
  const groupIds = parseGroupIds(groupIdsValue);
  const groups = [];
  const posts = [];

  for (const groupId of groupIds) {
    try {
      const groupInfoList = await vkApiRequest<VkGroupInfo[]>('groups.getById', accessToken, {
        group_id: groupId,
        fields: 'members_count,photo_100,photo_200,screen_name'
      });
      const groupInfo = groupInfoList[0];

      if (!groupInfo) {
        groups.push({
          groupId,
          group: null,
          summary: null,
          error: {
            code: 'VK_GROUP_NOT_FOUND',
            message: 'Сообщество не найдено.'
          }
        });
        continue;
      }

      const wall = await vkApiRequest<VkWallResponse>('wall.get', accessToken, {
        owner_id: -groupInfo.id,
        count: 100,
        offset: 0
      });
      const periodPosts = wall.items.filter((post) => post.date >= period.unixFrom && post.date <= period.unixTo);
      const group = {
        id: groupInfo.id,
        name: groupInfo.name,
        screenName: groupInfo.screen_name,
        photo: groupInfo.photo_200 ?? groupInfo.photo_100,
        membersCount: groupInfo.members_count ?? 0
      };

      groups.push({
        groupId: String(groupInfo.id),
        group,
        summary: summarizeGroup(wall, periodPosts, group.membersCount),
        error: null
      });

      posts.push(
        ...periodPosts.map((post) => ({
          id: `${groupInfo.id}_${post.id}`,
          vkId: post.id,
          group,
          date: new Date(post.date * 1000).toISOString(),
          text: post.text ?? '',
          url: `https://vk.com/wall-${groupInfo.id}_${post.id}`,
          likes: post.likes?.count ?? 0,
          reposts: post.reposts?.count ?? 0,
          comments: post.comments?.count ?? 0,
          views: post.views?.count ?? 0,
          actions: getPostActions(post),
          er: getPostEr(post, group.membersCount),
          isAd: Boolean(post.marked_as_ads),
          media: mapPostMedia(post)
        }))
      );
    } catch (error) {
      if (error instanceof VkApiError) {
        groups.push({
          groupId,
          group: null,
          summary: null,
          error: {
            code: error.code,
            message: error.message,
            vkCode: error.vkCode
          }
        });
        continue;
      }

      throw error;
    }
  }

  return {
    period: {
      key: period.key,
      dateFrom: formatDate(period.dateFrom),
      dateTo: formatDate(period.dateTo)
    },
    groups,
    posts
  };
}
