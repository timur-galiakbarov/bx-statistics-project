import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  acquisitionCookieName,
  getUserBySession,
  hasAdMarks,
  parseAcquisitionCookie,
  recordAdReturn,
  touchUserActivity,
  type AccountUser
} from '../repositories/accountRepository.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccountUser;
    }
  }
}

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.[env.sessionCookie] ?? req.header('x-socstat-session');
    req.user = await getUserBySession(sessionId);

    // Залогиненный пользователь пришёл на сайт по ссылке с метками: лендинг
    // положил их в cookie, фиксируем возврат по рекламе и забираем cookie.
    const rawAcquisition = req.cookies?.[acquisitionCookieName];
    if (req.user && rawAcquisition) {
      const acquisition = parseAcquisitionCookie(rawAcquisition);
      if (acquisition && hasAdMarks(acquisition)) {
        void recordAdReturn(req.user.id, acquisition).catch((error) => console.error('Failed to record ad return', error));
      }
      res.clearCookie(acquisitionCookieName, { path: '/' });
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  try {
    await touchUserActivity(req.user.id);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'ADMIN_REQUIRED',
      message: 'Раздел доступен только администратору.'
    });
    return;
  }

  next();
}
