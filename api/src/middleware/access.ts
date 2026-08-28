import type { NextFunction, Request, Response } from 'express';

function getAccessEnd(activeTo: string) {
  const date = new Date(`${activeTo}T23:59:59.999Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasActiveAccess(user: Express.Request['user']) {
  if (!user) {
    return false;
  }

  if (user.isAdmin && !user.enforceAccessRestrictions) {
    return true;
  }

  const accessEnd = getAccessEnd(user.activeTo);

  return Boolean(accessEnd && accessEnd.getTime() >= Date.now());
}

export function requireActiveAccess(req: Request, res: Response, next: NextFunction) {
  if (hasActiveAccess(req.user)) {
    next();
    return;
  }

  res.status(402).json({
    success: false,
    error: 'ACCESS_EXPIRED',
    message: 'Доступ к аналитике истёк. Продлите доступ в разделе оплаты.',
    data: {
      activeTo: req.user?.activeTo ?? null
    }
  });
}
