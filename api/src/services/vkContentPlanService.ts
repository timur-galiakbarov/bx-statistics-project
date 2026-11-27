import { createHmac } from 'node:crypto';
import { mediaReadUrl } from './contentPlanMedia.js';
import { DomainError } from '../errors/domainError.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { ContentPlanChannelModel } from '../models/ContentPlanChannel.js';
import { decryptContentPlanSecret, encryptContentPlanSecret } from './contentPlanSecrets.js';
import { VkApiError, vkApiRequest } from './vkClient.js';

export type VkManagedGroup = {
  id: number;
  name: string;
  screenName: string;
  membersCount: number;
  photo: string;
};

export type VkGroupsResult = { items: VkManagedGroup[] };

async function requireVkToken(userId: string) {
  const token = await getVkAccessToken(userId);
  if (!token) {
    throw new DomainError('Подключите ВК в профиле, чтобы выбрать сообщество.', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }
  return token;
}

async function managedGroups(token: string) {
  const data = await vkApiRequest<{ items: Array<Record<string, unknown> & { id: number }> }>('groups.get', token, {
    filter: 'admin',
    extended: 1,
    fields: 'members_count,screen_name,photo_200',
    count: 1000
  });
  return data.items;
}

function mapGroup(group: Record<string, unknown> & { id: number }): VkManagedGroup {
  return {
    id: group.id,
    name: String(group.name ?? ''),
    screenName: String(group.screen_name ?? ''),
    membersCount: Number(group.members_count ?? 0),
    photo: String(group.photo_200 ?? '')
  };
}

export async function listVkGroups(userId: string): Promise<VkGroupsResult> {
  const token = await requireVkToken(userId);
  const items = await managedGroups(token);
  return { items: items.map(mapGroup) };
}

export async function connectVkGroup(userId: string, groupId: unknown, communityToken: unknown) {
  const id = Number(groupId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DomainError('Не удалось определить группу ВК.', { status: 400, code: 'VK_GROUP_INVALID' });
  }
  const token = typeof communityToken === 'string' ? communityToken.trim() : '';
  if (token.length < 20) {
    throw new DomainError('Вставьте ключ доступа сообщества ВК.', { status: 400, code: 'VK_COMMUNITY_TOKEN_REQUIRED' });
  }

  const oauthToken = await requireVkToken(userId);
  const groups = await managedGroups(oauthToken);
  const group = groups.find((item) => Number(item.id) === id);
  if (!group) {
    throw new DomainError('Вы не администратор этой группы ВК.', { status: 422, code: 'VK_GROUP_NOT_ADMIN' });
  }

  // Проверяем, что ключ вообще рабочий. Для некоторых типов токенов
  // groups.getById закрыт — тогда проверим доступ при первой публикации.
  let verified = true;
  try {
    const info = await vkApiRequest<any>('groups.getById', token, { group_id: id, fields: 'screen_name' });
    const resolved = Array.isArray(info) ? info[0] : info?.groups?.[0] ?? info;
    if (resolved && Number(resolved.id) !== id) {
      throw new DomainError('Ключ принадлежит другому сообществу.', { status: 422, code: 'VK_COMMUNITY_TOKEN_INVALID' });
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof VkApiError && [27, 28, 1051].includes(error.vkCode ?? -1)) {
      verified = false;
    } else if (error instanceof VkApiError) {
      throw new DomainError('Ключ не подошёл. Создайте ключ в настройках этого сообщества.', {
        status: 422,
        code: 'VK_COMMUNITY_TOKEN_INVALID'
      });
    } else {
      throw error;
    }
  }

  const screenName = String(group.screen_name ?? '');
  const doc = await ContentPlanChannelModel.findOneAndUpdate(
    { userId, platform: 'vk', externalId: String(id) },
    {
      $set: {
        botId: null,
        accessTokenEncrypted: encryptContentPlanSecret(token),
        title: String(group.name ?? 'Группа ВК'),
        handle: screenName ? 'vk.com/' + screenName : '',
        status: 'connected',
        canPost: true,
        lastCheckedAt: new Date(),
        error: verified ? '' : 'ВК не подтвердил ключ при подключении; проверим при публикации.'
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

export async function getVkTokenForChannel(channel: { _id?: any; userId: any }): Promise<string> {
  const doc = channel._id
    ? await ContentPlanChannelModel.findById(channel._id).select('+accessTokenEncrypted').lean<{ accessTokenEncrypted?: string }>()
    : null;
  const encrypted = doc?.accessTokenEncrypted;
  if (!encrypted) {
    throw new DomainError('Ключ доступа сообщества не сохранён. Подключите группу заново.', {
      status: 409,
      code: 'VK_COMMUNITY_TOKEN_REQUIRED'
    });
  }
  return decryptContentPlanSecret(encrypted);
}

function relaySettings() {
  const url = process.env.CONTENT_PLAN_VK_PHOTO_RELAY_URL;
  const secret = process.env.CONTENT_PLAN_VK_PHOTO_RELAY_SECRET;
  if (!url || !/^https:\/\/functions\.yandexcloud\.net\/[a-z0-9]+$/.test(url) || !secret || secret.length < 32) return null;
  return { url, secret };
}

export const vkPhotoEnabled = () => Boolean(relaySettings());

export async function uploadVkWallPhoto(userId: string, groupId: string, mediaId: string) {
  const relay = relaySettings();
  if (!relay) throw new DomainError('Загрузка фото в ВК не настроена.', { status: 503, code: 'VK_PHOTO_DISABLED' });
  const token = await requireVkToken(userId);
  try {
    const { upload_url } = await vkApiRequest<{ upload_url: string }>('photos.getWallUploadServer', token, { group_id: groupId });
    const body = JSON.stringify({ source: mediaReadUrl(mediaId), destination: upload_url, expiresAt: Date.now() + 60_000 });
    const response = await fetch(relay.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Socstat-Signature': createHmac('sha256', relay.secret).update(body).digest('hex') },
      body, redirect: 'error', signal: AbortSignal.timeout(25_000)
    });
    if (!response.ok) throw new Error('Photo transfer failed');
    const { server, photo, hash } = await response.json() as { server?: number; photo?: string; hash?: string };
    if (typeof server !== 'number' || !Number.isSafeInteger(server) || typeof photo !== 'string' || typeof hash !== 'string') {
      throw new Error('Invalid VK upload metadata');
    }
    const [saved] = await vkApiRequest<Array<{ id: number; owner_id: number; access_key?: string }>>(
      'photos.saveWallPhoto', token, { group_id: groupId, server, photo, hash }, 'POST'
    );
    if (!saved || !Number.isSafeInteger(saved.id) || !Number.isSafeInteger(saved.owner_id)) throw new Error('Missing VK attachment');
    return `photo${saved.owner_id}_${saved.id}${saved.access_key ? '_' + saved.access_key : ''}`;
  } catch (error) {
    if (error instanceof VkApiError && error.vkCode === 6) {
      throw new DomainError('ВК ограничил частоту запросов. Повторите через минуту.', { status: 429, code: 'VK_RATE_LIMITED' });
    }
    if (error instanceof VkApiError && [3, 5, 7, 15, 27, 28, 1051].includes(error.vkCode ?? -1)) {
      throw new DomainError('ВК не разрешил загрузить фото с доступом профиля. Проверьте права приложения и переподключите профиль ВК.', {
        status: 422, code: 'VK_PHOTO_PERMISSION_DENIED'
      });
    }
    throw new DomainError('Не удалось прикрепить фото в ВК. Запись не отправлена.', { status: 502, code: 'VK_PHOTO_UPLOAD_FAILED' });
  }
}

export async function sendVkPost(token: string, groupId: string, text: string, attachment?: string) {
  try {
    const result = await vkApiRequest<{ post_id: number }>(
      'wall.post',
      token,
      {
        owner_id: -Math.abs(Number(groupId)),
        from_group: 1,
        message: text,
        ...(attachment ? { attachments: attachment } : {})
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
        throw new DomainError('Ключ доступа сообщества недействителен. Создайте новый ключ в настройках сообщества.', {
          status: 401,
          code: 'VK_TOKEN_INVALID'
        });
      }
      if ([27, 28, 1051].includes(error.vkCode ?? -1)) {
        throw new DomainError('ВК не принимает этот ключ для публикации. Создайте ключ в настройках сообщества с правом управления.', {
          status: 422,
          code: 'VK_COMMUNITY_TOKEN_INVALID'
        });
      }
      if (error.vkCode === 6) {
        throw new DomainError('ВК ограничил частоту запросов. Повторите через минуту.', { status: 429, code: 'VK_RATE_LIMITED' });
      }
      if ([7, 15, 214, 219].includes(error.vkCode ?? -1)) {
        throw new DomainError('Нет прав на публикацию в этой группе. Проверьте, что стена открыта и ключ создан администратором.', {
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
