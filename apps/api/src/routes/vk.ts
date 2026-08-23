import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { VkApiError, vkApiRequest } from '../services/vkClient.js';

export const vkRouter = Router();

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

vkRouter.get('/groups/:groupId/stats', requireUser, async (req, res, next) => {
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

vkRouter.get('/groups/:groupId/wall', requireUser, async (req, res, next) => {
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

vkRouter.get('/groups/:groupId/photos', requireUser, async (req, res, next) => {
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

vkRouter.get('/groups/:groupId/videos', requireUser, async (req, res, next) => {
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
