import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { getUserBySession, type AccountUser } from '../repositories/accountRepository.js';

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
    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  next();
}
