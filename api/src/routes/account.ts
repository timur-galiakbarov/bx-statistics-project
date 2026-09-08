import { Router } from 'express';
import {
  addGroup,
  getRecentAdminUsers,
  getAdminStat,
  getGroups,
  getNews,
  removeGroup,
  removeFreeGroups,
  removeSession
} from '../repositories/accountRepository.js';
import { requireUser } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { subscribeToAccountEvents } from '../services/accountEvents.js';
import { publishAccountUpdated } from '../services/accountEvents.js';
import { UserModel } from '../models/User.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { VkApiError, vkApiRequest } from '../services/vkClient.js';
import { DomainError } from '../errors/domainError.js';

export const accountRouter = Router();

accountRouter.get('/auth/status', (req, res) => {
  res.json({ success: Boolean(req.user), data: { isAuth: Boolean(req.user) } });
});

accountRouter.get('/me', requireUser, (req, res) => {
  const user = req.user!;
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        vkId: user.vkId,
        first_name: user.firstName,
        last_name: user.lastName,
        userFullName: `${user.firstName} ${user.lastName}`,
        photo_200: user.photo,
        activeTo: user.activeTo,
        trialEndsAt: user.trialEndsAt,
        isAdmin: user.isAdmin,
        enforceAccessRestrictions: user.enforceAccessRestrictions
      }
    }
  });
});

accountRouter.get('/events', requireUser, (req, res) => {
  subscribeToAccountEvents(req.user!.id, res);
});

accountRouter.post('/admin/access-restrictions', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }

  if (typeof req.body?.enabled !== 'boolean') {
    res.status(400).json({ success: false, error: 'INVALID_ACCESS_RESTRICTIONS_VALUE' });
    return;
  }

  try {
    const user = await UserModel.findByIdAndUpdate(
      req.user!.id,
      { enforceAccessRestrictions: req.body.enabled },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      return;
    }

    publishAccountUpdated(user.id);
    res.json({ success: true, data: { enforceAccessRestrictions: user.enforceAccessRestrictions } });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/admin/users/:userId/groups/reset', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }

  try {
    const user = await UserModel.findById(req.params.userId).select({ _id: 1 }).lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      return;
    }

    const deletedCount = await removeFreeGroups(req.params.userId);
    publishAccountUpdated(req.params.userId);
    res.json({ success: true, data: { deletedCount } });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/admin/users', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }

  const vkId = typeof req.body?.vkId === 'string' ? req.body.vkId.trim() : '';
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
  const activeTo = typeof req.body?.activeTo === 'string' ? new Date(`${req.body.activeTo}T00:00:00.000Z`) : null;

  if (!/^\d+$/.test(vkId) || !firstName || !lastName || !activeTo || Number.isNaN(activeTo.getTime())) {
    res.status(400).json({ success: false, error: 'INVALID_USER_DATA' });
    return;
  }

  try {
    const exists = await UserModel.exists({ vkId });
    if (exists) {
      res.status(409).json({ success: false, error: 'VK_USER_ALREADY_EXISTS' });
      return;
    }

    const createdAt = new Date();
    const user = await UserModel.create({
      vkId,
      firstName,
      lastName,
      activeTo,
      trialEndsAt: activeTo,
      isAdmin: false,
      lastLoginAt: createdAt
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          vkId: user.vkId,
          name: `${user.firstName} ${user.lastName}`,
          hasActiveAccess: activeTo.getTime() >= Date.now(),
          lastLoginAt: createdAt.toISOString(),
          activeTo: activeTo.toISOString().slice(0, 10)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/logout', async (req, res, next) => {
  try {
    await removeSession(req.cookies?.[env.sessionCookie]);
    res.clearCookie(env.sessionCookie, { path: '/' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

accountRouter.get('/news', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getNews() });
  } catch (error) {
    next(error);
  }
});

accountRouter.get('/groups', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getGroups(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

accountRouter.get('/groups/free', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getGroups(req.user!.id, 'free') });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/groups/free', requireUser, async (req, res, next) => {
  try {
    const group = await addGroup(
      req.user!.id,
      {
        source: 'free',
        vkGroupId: req.body.group?.id ?? req.body.group?.screen_name ?? req.body.group,
        name: req.body.group?.name ?? req.body.group?.screen_name ?? String(req.body.group ?? 'Новая группа'),
        photo: req.body.group?.photo,
        membersCount: req.body.group?.members_count
      },
      {}
    );

    res.status(201).json({ success: true, data: group, id: group.id });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/groups/bonus', requireUser, async (req, res, next) => {
  try {
    const accessToken = await getVkAccessToken(req.user!.id);
    if (!accessToken) {
      throw new VkApiError('Для проверки участия в сообществе подключите аккаунт ВКонтакте.', {
        status: 409,
        code: 'VK_TOKEN_REQUIRED'
      });
    }

    const isMember = await vkApiRequest<0 | 1>('groups.isMember', accessToken, {
      group_id: env.socstatVkGroupId,
      user_id: req.user!.vkId
    });
    if (!isMember) {
      throw new DomainError('Подпишитесь на сообщество Socstat во ВКонтакте, чтобы добавить второе сообщество.', {
        status: 403,
        code: 'BONUS_GROUP_SUBSCRIPTION_REQUIRED'
      });
    }

    const group = await addGroup(
      req.user!.id,
      {
        source: 'bonus',
        vkGroupId: req.body.group?.id ?? req.body.group?.screen_name ?? req.body.group,
        name: req.body.group?.name ?? req.body.group?.screen_name ?? String(req.body.group ?? 'Новое сообщество'),
        photo: req.body.group?.photo,
        membersCount: req.body.group?.members_count
      },
      { allowBonusGroup: true }
    );

    res.status(201).json({ success: true, data: group, id: group.id });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/groups', requireUser, async (req, res, next) => {
  try {
    const source = req.body?.source;

    if (source !== 'managed' && source !== 'bookmark') {
      res.status(400).json({ success: false, error: 'INVALID_GROUP_SOURCE' });
      return;
    }

    const group = await addGroup(req.user!.id, {
      source,
      vkGroupId: req.body.group?.id ?? req.body.group?.screen_name,
      name: req.body.group?.name ?? req.body.group?.screen_name ?? 'Новое сообщество',
      photo: req.body.group?.photo_100 ?? req.body.group?.photo_50,
      membersCount: req.body.group?.members_count
    });

    res.status(201).json({ success: true, data: group, id: group.id });
  } catch (error) {
    next(error);
  }
});

accountRouter.post('/groups/:source', requireUser, async (req, res, next) => {
  try {
    const group = await addGroup(req.user!.id, {
      source: req.params.source === 'favorites' ? 'favorite' : 'bookmark',
      vkGroupId: req.body.vkGroupId ?? req.body.group_id ?? req.body.id,
      name: req.body.name ?? req.body.title ?? String(req.body.vkGroupId ?? req.body.id ?? 'Новая группа')
    });

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
});

accountRouter.delete('/groups/:groupId', requireUser, async (req, res, next) => {
  try {
    await removeGroup(req.user!.id, req.params.groupId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

accountRouter.get('/admin/stat', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }

  try {
    res.json({ success: true, data: await getAdminStat(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

accountRouter.get('/admin/users/recent', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }

  try {
    res.json({ success: true, data: await getRecentAdminUsers(300) });
  } catch (error) {
    next(error);
  }
});
