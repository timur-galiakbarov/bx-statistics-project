import { Router } from 'express';
import {
  addGroup,
  getAdminStat,
  getGroups,
  getNews,
  removeGroup,
  removeSession
} from '../repositories/accountRepository.js';
import { requireUser } from '../middleware/auth.js';
import { env } from '../config/env.js';

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
        isAdmin: user.isAdmin
      }
    }
  });
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
    const group = await addGroup(req.user!.id, {
      source: 'free',
      vkGroupId: req.body.group?.id ?? req.body.group?.screen_name ?? req.body.group,
      name: req.body.group?.name ?? req.body.group?.screen_name ?? String(req.body.group ?? 'Новая группа'),
      photo: req.body.group?.photo,
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
