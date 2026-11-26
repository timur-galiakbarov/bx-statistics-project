import { DomainError } from '../errors/domainError.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { ContentPlanChannelModel } from '../models/ContentPlanChannel.js';
import { VkTokenModel } from '../models/VkToken.js';
import { VkApiError, vkApiRequest } from './vkClient.js';

const WALL_PERMISSION_BIT = 8192;

export type VkManagedGroup = {
  id: number;
  name: string;
  screenName: string;
  membersCount: number;
  photo: string;
};

export type VkGroupsResult = { items: VkManagedGroup[]; wallScope: boolean };

async function requireVkToken(userId: string) {
  const token = await getVkAccessToken(userId);
  if (!token) {
    throw new DomainError('Подключите ВК в профиле, чтобы публиковать в группы.', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }
  return token;
}

export async function hasVkWallScope(userId: string): Promise<boolean> {
  const token = await requireVkToken(userId);
  const stored = await VkTokenModel.findOne({ userId }).sort({ updatedAt: -1 }).lean<{ scopes?: string[] }>();
  if (stored?.scopes?.includes('wall')) return true;
  try {
    const mask = await vkApiRequest<number>('account.getAppPermissions', token, {});
    return Boolean(mask & WALL_PERMISSION_BIT);
  } catch (error) {
    if (error instanceof VkApiError) {
      throw new DomainError('Не удалось проверить права ВК. Переподключите ВК и повторите.', {
        status: 502,
        code: 'VK_PERMISSIONS_UNAVAILABLE'
      });
    }
    throw error;
  }
}

async function requireVkPublishingToken(userId: string) {
  const token = await requireVkToken(userId);
  if (!(await hasVkWallScope(userId))) {
    throw new DomainError('Чтобы публиковать в ВК, переподключите ВК и разрешите публикацию на стене.', {
      status: 409,
      code: 'VK_WALL_SCOPE_REQUIRED'
    });
  }
  return token;
}

async function managedGroups(token: string) {
  const data = await vkApiRequest<{ items: Array<Record<string, unknown> & { id: number }> }>('groups.get', token, {
    filter: 'moder',
    extended: 1,
    fields: 'members_count,screen_name,photo_200',
    count: 1000
  });
  return data.items;
}

export async function listVkGroups(userId: string): Promise<VkGroupsResult> {
  const token = await requireVkToken(userId);
  const [items, wallScope] = await Promise.all([managedGroups(token), hasVkWallScope(userId)]);
  return {
    wallScope,
    items: items.map((group) => ({
      id: group.id,
      name: String(group.name ?? ''),
      screenName: String(group.screen_name ?? ''),
      membersCount: Number(group.members_count ?? 0),
      photo: String(group.photo_200 ?? '')
    }))
  };
}

export async function connectVkGroup(userId: string, groupId: unknown) {
  const id = Number(groupId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DomainError('Не удалось определить группу ВК.', { status: 400, code: 'VK_GROUP_INVALID' });
  }
  const token = await requireVkPublishingToken(userId);
  const groups = await managedGroups(token);
  const group = groups.find((item) => Number(item.id) === id);
  if (!group) {
    throw new DomainError('Вы не администратор этой группы ВК.', { status: 422, code: 'VK_GROUP_NOT_ADMIN' });
  }
  const screenName = String(group.screen_name ?? '');
  const doc = await ContentPlanChannelModel.findOneAndUpdate(
    { userId, platform: 'vk', externalId: String(id) },
    {
      $set: {
        botId: null,
        title: String(group.name ?? 'Группа ВК'),
        handle: screenName ? 'vk.com/' + screenName : '',
        status: 'connected',
        canPost: true,
        lastCheckedAt: new Date(),
        error: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return {
    id: String(doc._id),
    platform: 'vk' as const,
    title: doc.title,
    handle: doc.handle ?? '',
    status: doc.status,
    canPost: doc.canPost,
    error: doc.error ?? ''
  };
}

export async function getVkTokenForChannel(channel: { userId: any }): Promise<string> {
  return requireVkPublishingToken(String(channel.userId));
}

export async function sendVkPost(token: string, groupId: string, text: string) {
  try {
    const result = await vkApiRequest<{ post_id: number }>(
      'wall.post',
      token,
      {
        owner_id: -Math.abs(Number(groupId)),
        from_group: 1,
        message: text
      },
      'POST'
    );
    return {
      postId: result.post_id,
      url: `https://vk.com/wall-${Math.abs(Number(groupId))}_${result.post_id}`
    };
  } catch (error) {
    if (error instanceof VkApiError) {
      if (error.vkCode === 5) {
        throw new DomainError('ВК не принял токен. Переподключите ВК.', { status: 401, code: 'VK_TOKEN_INVALID' });
      }
      if (error.vkCode === 6) {
        throw new DomainError('ВК ограничил частоту запросов. Повторите через минуту.', { status: 429, code: 'VK_RATE_LIMITED' });
      }
      if ([7, 15, 214, 219].includes(error.vkCode ?? -1)) {
        throw new DomainError('Нет прав на публикацию в этой группе. Проверьте, что вы админ и стена открыта.', {
          status: 422,
          code: 'VK_PERMISSION_DENIED'
        });
      }
      if (error.vkCode === 100) {
        throw new DomainError('ВК отклонил текст поста. Проверьте разметку и длину.', {
          status: 422,
          code: 'VK_POST_INVALID'
        });
      }
    }
    throw new DomainError('ВК не подтвердил публикацию. Проверьте группу перед повтором.', {
      status: 502,
      code: 'VK_PUBLISH_FAILED'
    });
  }
}
