import { Router } from 'express';
import { env } from '../config/env.js';
import { requireActiveAccess } from '../middleware/access.js';
import { requireUser } from '../middleware/auth.js';
import { getVkAccessToken, getVkTokenStatus } from '../repositories/accountRepository.js';
import { VkApiError, vkApiRequest } from '../services/vkClient.js';
import { buildVkAuthorizeUrl } from './auth.js';

export const vkRouter = Router();

const vkPermissionBits = {
  notify: 1,
  friends: 2,
  photos: 4,
  video: 16,
  pages: 128,
  status: 1024,
  notes: 2048,
  messages: 4096,
  wall: 8192,
  ads: 32768,
  offline: 65536,
  docs: 131072,
  groups: 262144,
  notifications: 524288,
  stats: 1048576,
  email: 4194304
};

async function getRequiredVkToken(userId: string) {
  const accessToken = await getVkAccessToken(userId);

  if (!accessToken) {
    throw new VkApiError('VK token is required', {
      status: 409,
      code: 'VK_TOKEN_REQUIRED'
    });
  }

  return accessToken;
}

function toUnixTime(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return Math.floor(date.getTime() / 1000);
}

function toPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function decodePermissions(mask: number) {
  return Object.fromEntries(
    Object.entries(vkPermissionBits).map(([permission, bit]) => [permission, Boolean(mask & bit)])
  );
}

function getManualAccessToken(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new VkApiError('VK token is required', {
      status: 400,
      code: 'VK_TOKEN_REQUIRED'
    });
  }

  return value.trim();
}

function formatPermissions(mask: number) {
  return {
    mask,
    permissions: decodePermissions(mask),
    requiredForDashboard: {
      groups: Boolean(mask & vkPermissionBits.groups),
      stats: Boolean(mask & vkPermissionBits.stats),
      wall: Boolean(mask & vkPermissionBits.wall)
    }
  };
}

async function optionalVkDebugRequest<T>(
  warnings: string[],
  label: string,
  request: Promise<T>
) {
  try {
    return await request;
  } catch (error) {
    if (error instanceof VkApiError) {
      warnings.push(`${label}: ${error.message}`);
      return null;
    }

    throw error;
  }
}

vkRouter.get('/permissions', requireUser, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const mask = await vkApiRequest<number>('account.getAppPermissions', accessToken, {});

    res.json({ success: true, data: formatPermissions(mask) });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/token-status', requireUser, async (req, res, next) => {
  try {
    const data = await getVkTokenStatus(req.user!.id);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.post('/debug/permissions', requireUser, async (req, res, next) => {
  try {
    const accessToken = getManualAccessToken(req.body?.accessToken);
    const mask = await vkApiRequest<number>('account.getAppPermissions', accessToken, {});

    res.json({ success: true, data: formatPermissions(mask) });
  } catch (error) {
    next(error);
  }
});

vkRouter.post('/debug/stats', requireUser, async (req, res, next) => {
  try {
    const accessToken = getManualAccessToken(req.body?.accessToken);
    const groupId = String(req.body?.groupId ?? '').trim();

    if (!groupId) {
      throw new VkApiError('VK group id is required', {
        status: 400,
        code: 'VK_GROUP_ID_REQUIRED'
      });
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);

    const data = await vkApiRequest('stats.get', accessToken, {
      group_id: groupId,
      timestamp_from: Math.floor(twoDaysAgo.getTime() / 1000),
      timestamp_to: Math.floor(yesterday.getTime() / 1000),
      stats_groups: 'visitors,reach,activity'
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/app', requireUser, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const data = await vkApiRequest('apps.get', accessToken, {
      app_id: env.vkClientId,
      app_fields: 'id,title,type,author_id,author_url,screen_name,description'
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/oauth-debug', requireUser, (_req, res) => {
  res.json({
    success: true,
    data: {
      clientId: env.vkClientId,
      scope: env.vkAuthScope,
      forceRevoke: env.vkForceRevoke,
      codeRedirectUrl: env.vkPublicRedirectUrl,
      implicitRedirectUrl: env.vkImplicitRedirectUrl,
      codeAuthorizeUrl: buildVkAuthorizeUrl({
        responseType: 'code',
        redirectUrl: env.vkPublicRedirectUrl,
        state: 'debug-state'
      }),
      implicitAuthorizeUrl: buildVkAuthorizeUrl({
        responseType: 'token',
        redirectUrl: env.vkImplicitRedirectUrl,
        state: 'debug-state'
      }),
      productionLegacyAuthorizeUrl:
        'https://oauth.vk.com/authorize?client_id=5358505&scope=stats,groups,photos,video,offline&redirect_uri=https://socstat.ru/login/getCode.php?site=auth&response_type=token'
    }
  });
});

vkRouter.get('/groups/:groupId/channel-debug', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const warnings: string[] = [];
    const groupInfo = await vkApiRequest<Array<{ id: number }>>('groups.getById', accessToken, {
      group_id: req.params.groupId,
      fields:
        'activity,can_post,can_see_all_posts,can_subscribe_posts,counters,description,has_group_channel,is_admin,is_member,is_subscribed,members_count,photo_100,photo_200,screen_name,status,type,wall'
    });
    const resolvedGroupId = groupInfo[0]?.id;

    if (!resolvedGroupId) {
      throw new VkApiError('VK group was not found', {
        status: 404,
        code: 'VK_GROUP_NOT_FOUND'
      });
    }

    const wall = await optionalVkDebugRequest(
      warnings,
      'wall.get',
      vkApiRequest<{ count?: number; items?: Array<{ id: number }> }>('wall.get', accessToken, {
        owner_id: -resolvedGroupId,
        count: toPositiveInt(req.query.count, 20, 100),
        offset: toPositiveInt(req.query.offset, 0, 10000)
      })
    );
    const postIds = wall?.items?.map((post) => post.id).slice(0, 30).join(',');
    const postReach = postIds
      ? await optionalVkDebugRequest(
          warnings,
          'stats.getPostReach',
          vkApiRequest('stats.getPostReach', accessToken, {
            owner_id: -resolvedGroupId,
            post_ids: postIds
          })
        )
      : null;
    const stats = await optionalVkDebugRequest(
      warnings,
      'stats.get',
      vkApiRequest('stats.get', accessToken, {
        group_id: resolvedGroupId,
        timestamp_from: toUnixTime(req.query.dateFrom),
        timestamp_to: toUnixTime(req.query.dateTo),
        stats_groups: 'visitors,reach,activity'
      })
    );

    res.json({
      success: true,
      data: {
        groupInfo,
        wall,
        postReach,
        stats,
        warnings
      }
    });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/search', requireUser, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const query = typeof req.query.q === 'string' ? req.query.q : '';

    if (!query.trim()) {
      res.status(400).json({ success: false, error: 'QUERY_REQUIRED' });
      return;
    }

    const data = await vkApiRequest('groups.search', accessToken, {
      q: query,
      count: toPositiveInt(req.query.count, 20, 100),
      offset: toPositiveInt(req.query.offset, 0, 1000)
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/subscriptions', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const count = 1000;
    let offset = 0;
    let total = 0;
    const items: unknown[] = [];

    do {
      const data = await vkApiRequest<{ count: number; items: unknown[] }>('groups.get', accessToken, {
        extended: 1,
        fields: 'members_count,counters,description,photo_50,photo_100,photo_200,screen_name',
        count,
        offset
      });

      total = data.count;
      if (!data.items.length) {
        break;
      }

      items.push(...data.items);
      offset += count;
    } while (items.length < total);

    res.json({
      success: true,
      data: {
        count: total,
        items
      }
    });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/:groupId', requireUser, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const data = await vkApiRequest('groups.getById', accessToken, {
      group_id: req.params.groupId,
      fields: 'members_count,counters,description,photo_200,screen_name'
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/:groupId/stats', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const data = await vkApiRequest('stats.get', accessToken, {
      group_id: req.params.groupId,
      timestamp_from: toUnixTime(req.query.dateFrom),
      timestamp_to: toUnixTime(req.query.dateTo),
      stats_groups: 'visitors,reach,activity'
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/:groupId/wall', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const data = await vkApiRequest('wall.get', accessToken, {
      owner_id: `-${req.params.groupId}`,
      offset: toPositiveInt(req.query.offset, 0, 10000),
      count: toPositiveInt(req.query.count, 20, 100)
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/:groupId/photos', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const data = await vkApiRequest('photos.getAll', accessToken, {
      owner_id: `-${req.params.groupId}`,
      offset: toPositiveInt(req.query.offset, 0, 10000),
      count: toPositiveInt(req.query.count, 20, 200),
      extended: req.query.extended === '1' ? 1 : undefined,
      no_service_albums: 1
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

vkRouter.get('/groups/:groupId/videos', requireUser, requireActiveAccess, async (req, res, next) => {
  try {
    const accessToken = await getRequiredVkToken(req.user!.id);
    const data = await vkApiRequest('video.get', accessToken, {
      owner_id: `-${req.params.groupId}`,
      offset: toPositiveInt(req.query.offset, 0, 10000),
      count: toPositiveInt(req.query.count, 20, 200),
      extended: req.query.extended === '1' ? 1 : undefined
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
