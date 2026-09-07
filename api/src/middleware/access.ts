import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { vkApiRequest } from '../services/vkClient.js';

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

async function hasBonusCommunityAccess(user: NonNullable<Express.Request['user']>, groupId: string) {
  const savedGroup = await SavedGroupModel.findOne({
    userId: user.id,
    vkGroupId: groupId,
    source: { $in: ['free', 'bonus'] }
  }).lean<{ source: 'free' | 'bonus' }>();

  if (!savedGroup) {
    return false;
  }

  if (savedGroup.source === 'free') {
    return true;
  }

  const accessToken = await getVkAccessToken(user.id);
  if (!accessToken) {
    return false;
  }

  try {
    return Boolean(await vkApiRequest<0 | 1>('groups.isMember', accessToken, {
      group_id: env.socstatVkGroupId,
      user_id: user.vkId
    }));
  } catch {
    return false;
  }
}

/** Allows a saved basic/bonus community after paid or trial access has ended. */
export async function requireCommunityAccess(req: Request, res: Response, next: NextFunction) {
  if (hasActiveAccess(req.user)) {
    next();
    return;
  }

  try {
    if (req.user && await hasBonusCommunityAccess(req.user, req.params.groupId)) {
      next();
      return;
    }
  } catch (error) {
    next(error);
    return;
  }

  res.status(402).json({
    success: false,
    error: 'ACCESS_EXPIRED',
    message: 'Для анализа этого сообщества нужен активный тариф.'
  });
}
