import { Router } from 'express';
import { addGroup, getAdminStat, getGroups, getNews, removeSession } from '../repositories/accountRepository.js';
import { requireUser } from '../middleware/auth.js';
import { env } from '../config/env.js';

export const legacyRouter = Router();

legacyRouter.get('/account/isAuth.php', (req, res) => {
  res.json({ success: Boolean(req.user) });
});

legacyRouter.get('/account/getUserInfo.php', requireUser, (req, res) => {
  const user = req.user!;
  res.json({
    success: true,
    data: {
      user: {
        activeTo: user.activeTo,
        userFullName: `${user.firstName} ${user.lastName}`,
        first_name: user.firstName,
        last_name: user.lastName,
        photo_200: user.photo,
        isAdmin: user.isAdmin
      }
    }
  });
});

legacyRouter.get('/account/freeGroups/getList.php', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getGroups(req.user!.id, 'free') });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/account/freeGroups/add.php', requireUser, async (req, res, next) => {
  try {
    const group = await addGroup(req.user!.id, {
      source: 'free',
      vkGroupId: req.body.group?.id ?? req.body.group,
      name: req.body.group?.name ?? String(req.body.group ?? 'Новая группа')
    });
    res.json({ success: true, id: group.id, data: group });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/account/statList/save.php', requireUser, (_req, res) => {
  res.json({ success: true, id: 'dev-stat-list' });
});

legacyRouter.get('/account/getNewsList.php', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await getNews() });
  } catch (error) {
    next(error);
  }
});

legacyRouter.get('/account/bookmarks/getBookmarksList.php', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getGroups(req.user!.id, 'bookmark') });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/account/bookmarks/addBookmark.php', requireUser, async (req, res, next) => {
  try {
    const group = await addGroup(req.user!.id, { source: 'bookmark', ...req.body });
    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/account/bookmarks/removeBookmark.php', (_req, res) => {
  res.json({ success: true });
});

legacyRouter.post('/account/favorites/getList.php', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getGroups(req.user!.id, 'favorite') });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/account/favorites/add.php', requireUser, async (req, res, next) => {
  try {
    const group = await addGroup(req.user!.id, { source: 'favorite', ...req.body });
    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/account/favorites/remove.php', (_req, res) => {
  res.json({ success: true });
});

legacyRouter.get('/account/admin/getStat.php', requireUser, async (req, res, next) => {
  try {
    res.json({ success: true, data: await getAdminStat(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

legacyRouter.get('/account/logout.php', async (req, res, next) => {
  try {
    await removeSession(req.cookies?.[env.sessionCookie]);
    res.clearCookie(env.sessionCookie, { path: '/' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

legacyRouter.post('/stat/getContentSections.php', (_req, res) => {
  res.json({ success: true, data: [] });
});

legacyRouter.post('/common/generateXLSX_getBannedList.php', (_req, res) => {
  res.json({ success: true, data: { url: null, rows: [] } });
});

legacyRouter.post('/common/generateXLSX_getCompareList.php', (_req, res) => {
  res.json({ success: true, data: { url: null, rows: [] } });
});

legacyRouter.post('/common/generateXLSX_getFindAnalogList.php', (_req, res) => {
  res.json({ success: true, data: { url: null, rows: [] } });
});
