import type { Request } from 'express';
import { ActivityEventModel, type ActivityEventType } from '../models/ActivityEvent.js';
import { UserModel } from '../models/User.js';
import { VisitModel } from '../models/Visit.js';

const VISIT_ID_PATTERN = /^[a-z0-9-]{8,64}$/i;

export function parseVisitId(value: unknown) {
  return typeof value === 'string' && VISIT_ID_PATTERN.test(value) ? value : undefined;
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return undefined;
  }

  // Только pathname: query-параметры содержат id сообществ и не нужны для статистики страниц.
  return value.split(/[?#]/)[0].slice(0, 120) || '/';
}

/**
 * Moves the user's "last activity" forward. Called only for what the user does
 * (page views, heartbeats of a visible tab in use, tracked actions), not for every
 * authenticated request: background requests such as EventSource reconnects of a
 * forgotten tab would otherwise make an idle user look active.
 */
function markUserActive(userId: string, at: Date) {
  return UserModel.updateOne({ _id: userId }, { $max: { lastActivityAt: at } });
}

function detectDevice(userAgent?: string) {
  return userAgent && /Mobi|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' as const : 'desktop' as const;
}

/** Records a page view (creating the visit on first view) or a heartbeat that extends the visit. */
export async function recordVisitHit(options: {
  userId: string;
  visitId: string;
  type: 'page_view' | 'heartbeat';
  path?: unknown;
  userAgent?: string;
}) {
  const now = new Date();
  const filter = { visitId: options.visitId, userId: options.userId };

  if (options.type === 'heartbeat') {
    await Promise.all([
      VisitModel.updateOne(filter, { $set: { lastSeenAt: now } }),
      markUserActive(options.userId, now)
    ]);
    return;
  }

  const path = normalizePath(options.path);

  try {
    await VisitModel.updateOne(
      filter,
      {
        $setOnInsert: { startedAt: now, entryPath: path, device: detectDevice(options.userAgent) },
        $set: { lastSeenAt: now },
        $inc: { pageViews: 1 },
        ...(path ? { $addToSet: { paths: path } } : {})
      },
      { upsert: true }
    );
  } catch (error) {
    // Чужой visitId (коллизия или подделка) упирается в уникальный индекс — такой хит просто пропускаем.
    if ((error as { code?: number }).code !== 11000) {
      throw error;
    }
  }

  await markUserActive(options.userId, now);
}

/**
 * Logs a user action for the admin activity stats. Never throws: statistics must not
 * break the request that triggered them.
 */
export function trackActivity(
  req: Request | { userId: string; visitId?: string },
  type: ActivityEventType,
  details: { platform?: unknown; label?: unknown } = {}
) {
  const userId = 'userId' in req ? req.userId : req.user?.id;
  const visitId = 'userId' in req ? req.visitId : parseVisitId(req.header('x-socstat-visit'));

  if (!userId) {
    return;
  }

  const platform = typeof details.platform === 'string' ? details.platform.slice(0, 20) : undefined;
  const label = typeof details.label === 'string' ? details.label.slice(0, 120) : undefined;

  const now = new Date();
  void Promise.all([
    ActivityEventModel.create({ userId, visitId, type, platform, label, createdAt: now }),
    markUserActive(userId, now),
    visitId
      ? VisitModel.updateOne({ visitId, userId }, { $inc: { actions: 1 }, $set: { lastSeenAt: now } })
      : undefined
  ]).catch((error) => console.error('Failed to track activity', error));
}
