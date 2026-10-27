import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { ChannelSnapshotModel } from '../models/ChannelSnapshot.js';
import { CompetitorSetModel } from '../models/CompetitorSet.js';
import { NotificationDeliveryModel } from '../models/NotificationDelivery.js';
import { PostSnapshotModel } from '../models/PostSnapshot.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { UserModel } from '../models/User.js';
import { plans, returningCustomerPlans } from '../routes/payments.js';
import { publishAccountUpdated } from './accountEvents.js';
import { storedCompetitors } from './competitorUtils.js';
import { getFeatureMode, isFeatureEnabledFor } from './featureFlags.js';
import { hasLegacyPricing } from './legacyPricing.js';
import { isWithinSendWindow } from './pushReminders.js';
import { normalizeSourceId, type SnapshotPlatform } from './snapshotService.js';
import { snapshotDateKey, type SubscriberPoint } from './snapshotUtils.js';
import { isVkCannotSendError, isVkMessagesAllowed, isVkMessagesConfigured, sendVkCommunityMessage } from './vkCommunityMessages.js';
import {
  competitorGrowthPlace,
  isMondayKey,
  mskDateStart,
  postUrl,
  reportCommand,
  shiftDateKey,
  vkReportReplies,
  weekGrowth,
  weeklyReportMessage,
  type ReportSourceWeek
} from './vkReportUtils.js';

const DAY_MS = 86_400_000;
const TICK_INTERVAL_MS = 15 * 60_000;
export const WEEKLY_REPORT_KIND = 'weekly_report';
// В отчёт — первые сообщества дашборда, чтобы сообщение читалось с телефона.
const MAX_REPORT_SOURCES = 5;
// После окончания доступа урезанный отчёт приходит ещё 8 недель, потом перестаёт.
const LOCKED_REPORT_DAYS = 56;
const SEND_DELAY_MS = 150;

type ReportUser = {
  _id: Types.ObjectId;
  vkId?: string | null;
  activeTo: Date;
  isAdmin?: boolean | null;
  enforceAccessRestrictions?: boolean | null;
};

type SourceKey = { platform: SnapshotPlatform; externalId: string };
const sourceKey = (source: SourceKey) => `${source.platform}:${source.externalId}`;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasFullAccess(user: ReportUser, now: Date) {
  return (Boolean(user.isAdmin) && !user.enforceAccessRestrictions) || user.activeTo.getTime() > now.getTime();
}

async function loadSubscriberPoints(sources: SourceKey[], fromDate: string, toDate: string) {
  const byKey = new Map<string, SubscriberPoint[]>();
  if (!sources.length) return byKey;
  const snapshots = await ChannelSnapshotModel.find(
    { $or: sources.map(({ platform, externalId }) => ({ platform, externalId })), date: { $gte: fromDate, $lte: toDate } },
    { _id: 0, platform: 1, externalId: 1, date: 1, subscribers: 1 }
  ).lean();
  for (const snapshot of snapshots) {
    const key = sourceKey(snapshot as SourceKey);
    byKey.set(key, [...(byKey.get(key) ?? []), { date: snapshot.date, subscribers: snapshot.subscribers ?? null }]);
  }
  return byKey;
}

/** Самый просматриваемый пост, опубликованный за неделю перед днём отчёта, по последнему срезу каждого поста. */
async function loadBestPosts(sources: SourceKey[], reportDateKey: string) {
  const best = new Map<string, { views: number; url: string }>();
  if (!sources.length) return best;
  const snapshots = await PostSnapshotModel.find(
    {
      $or: sources.map(({ platform, externalId }) => ({ platform, externalId })),
      publishedAt: { $gte: mskDateStart(shiftDateKey(reportDateKey, -7)), $lt: mskDateStart(reportDateKey) }
    },
    { _id: 0, platform: 1, externalId: 1, postId: 1, views: 1 }
  ).lean();
  for (const snapshot of snapshots) {
    if (snapshot.views === null || snapshot.views === undefined) continue;
    const key = sourceKey(snapshot as SourceKey);
    const current = best.get(key);
    // У поста несколько срезов, просмотры только растут — берём максимум.
    if (!current || snapshot.views > current.views) {
      best.set(key, { views: snapshot.views, url: postUrl(snapshot.platform, snapshot.externalId, snapshot.postId) });
    }
  }
  return best;
}

/** Текст еженедельного отчёта для пользователя или null, если отправлять нечего. */
export async function buildWeeklyReport(user: ReportUser, reportDateKey: string, now = new Date()) {
  const isFull = hasFullAccess(user, now);
  if (!isFull && user.activeTo.getTime() < now.getTime() - LOCKED_REPORT_DAYS * DAY_MS) return null;

  const groups = await SavedGroupModel.find(
    { userId: user._id, isTracked: { $ne: false } },
    { platform: 1, externalId: 1, vkGroupId: 1, handle: 1, name: 1 }
  ).sort({ sortOrder: 1, createdAt: 1 }).lean();

  const seen = new Set<string>();
  const sources: Array<SourceKey & { name: string }> = [];
  for (const group of groups) {
    const id = normalizeSourceId(group.platform ?? 'vk', group);
    if (!id || seen.has(sourceKey(id))) continue;
    seen.add(sourceKey(id));
    sources.push({ ...id, name: group.name });
    if (sources.length === MAX_REPORT_SOURCES) break;
  }
  if (!sources.length) return null;

  const fromDate = shiftDateKey(reportDateKey, -14);
  const points = await loadSubscriberPoints(sources, fromDate, reportDateKey);
  const growths = new Map(sources.map((source) => [sourceKey(source), weekGrowth(points.get(sourceKey(source)) ?? [], reportDateKey)]));
  if (![...growths.values()].some((growth) => growth.subscribers !== null)) return null;

  let bestPosts = new Map<string, { views: number; url: string }>();
  const places = new Map<string, ReportSourceWeek['competitors']>();
  if (isFull) {
    bestPosts = await loadBestPosts(sources, reportDateKey);

    const sets = await CompetitorSetModel.find({ userId: user._id }, { platform: 1, externalId: 1, competitors: 1 }).lean();
    const ownSets = sets
      .map((set) => ({ own: normalizeSourceId(set.platform, { externalId: set.externalId }), competitors: storedCompetitors(set) }))
      .filter((set): set is { own: SourceKey; competitors: ReturnType<typeof storedCompetitors> } => Boolean(set.own && seen.has(sourceKey(set.own))));
    const competitorIds = ownSets.flatMap((set) => set.competitors
      .map((competitor) => ({ id: normalizeSourceId(competitor.platform, { externalId: competitor.externalId }), name: competitor.name }))
      .filter((item): item is { id: SourceKey; name: string } => Boolean(item.id)));
    const competitorPoints = await loadSubscriberPoints(competitorIds.map((item) => item.id), shiftDateKey(reportDateKey, -7), reportDateKey);

    for (const set of ownSets) {
      const competitors = set.competitors.map((competitor) => {
        const id = normalizeSourceId(competitor.platform, { externalId: competitor.externalId });
        const growth = id ? weekGrowth(competitorPoints.get(sourceKey(id)) ?? [], reportDateKey) : null;
        return { name: competitor.name, percent: growth?.percent ?? null };
      });
      places.set(sourceKey(set.own), competitorGrowthPlace(growths.get(sourceKey(set.own))?.percent ?? null, competitors));
    }
  }

  const isReturning = !isFull && await hasLegacyPricing(user._id);
  const monthPlan = (isReturning ? returningCustomerPlans : plans).find((plan) => plan.id === 'month')!;

  return {
    variant: isFull ? 'full' as const : 'locked' as const,
    text: weeklyReportMessage({
      reportDateKey,
      variant: isFull ? 'full' : 'locked',
      sources: sources.map((source) => ({
        name: source.name,
        growth: growths.get(sourceKey(source))!,
        bestPost: bestPosts.get(sourceKey(source)) ?? null,
        competitors: places.get(sourceKey(source)) ?? null
      })),
      siteUrl: env.webOrigin,
      monthPriceRub: monthPlan.priceRub,
      isReturning
    })
  };
}

/** Сообщество больше не может писать пользователю — отчёты ему не отправляются. */
async function markVkDisallowed(userId: Types.ObjectId | string) {
  await UserModel.updateOne({ _id: userId }, { $set: { 'notifications.vk.allowed': false, 'notifications.vk.checkedAt': new Date() } });
  publishAccountUpdated(userId.toString());
}

/** Отправляет еженедельный отчёт всем подключившим сообщения. Только по понедельникам по Москве. */
export async function sendWeeklyReports(now = new Date()) {
  const reportDateKey = snapshotDateKey(now);
  if (!isMondayKey(reportDateKey) || !isVkMessagesConfigured()) return 0;
  const mode = await getFeatureMode('vkReports');
  if (mode === 'off') return 0;

  const users = await UserModel.find(
    {
      'notifications.vk.allowed': true,
      'notifications.weeklyReport': { $ne: false },
      isActive: { $ne: false },
      vkId: { $exists: true, $ne: '' },
      ...(mode === 'admins' ? { isAdmin: true } : {})
    },
    { _id: 1, vkId: 1, activeTo: 1, isAdmin: 1, enforceAccessRestrictions: 1 }
  ).lean();
  if (!users.length) return 0;

  const alreadySent = new Set(
    (await NotificationDeliveryModel.distinct('userId', { kind: WEEKLY_REPORT_KIND, periodKey: reportDateKey })).map(String)
  );
  let sent = 0;

  for (const user of users) {
    if (alreadySent.has(user._id.toString())) continue;
    const report = await buildWeeklyReport(user, reportDateKey, now);
    if (!report) continue;

    // Уникальный индекс: если другая реплика уже взяла этот отчёт, вставка упадёт и мы его пропустим.
    let deliveryId: Types.ObjectId;
    try {
      const delivery = await NotificationDeliveryModel.create({
        userId: user._id,
        kind: WEEKLY_REPORT_KIND,
        periodKey: reportDateKey,
        variant: report.variant,
        createdAt: now
      });
      deliveryId = delivery._id;
    } catch {
      continue;
    }

    try {
      await sendVkCommunityMessage(user.vkId!, report.text);
      await NotificationDeliveryModel.updateOne({ _id: deliveryId }, { $set: { status: 'sent', sentAt: new Date() } });
      sent += 1;
    } catch (error) {
      await NotificationDeliveryModel.updateOne(
        { _id: deliveryId },
        { $set: { status: 'failed', error: (error as Error).message.slice(0, 300) } }
      );
      if (isVkCannotSendError(error)) await markVkDisallowed(user._id);
      else console.error('Weekly VK report failed', (error as Error).message);
    }
    await delay(SEND_DELAY_MS);
  }

  return sent;
}

/**
 * Пользователь разрешил сообщения или написал сообществу. Приветствие уходит один раз —
 * при переходе из «не подключён» в «подключён» и только если фича ему включена.
 */
export async function connectVkNotifications(vkUserId: string) {
  const user = await UserModel.findOne({ vkId: vkUserId }, { _id: 1, isAdmin: 1, notifications: 1 }).lean();
  if (!user) return false;
  const wasAllowed = user.notifications?.vk?.allowed === true;
  const now = new Date();
  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        'notifications.vk.allowed': true,
        'notifications.vk.checkedAt': now,
        ...(user.notifications?.vk?.connectedAt ? {} : { 'notifications.vk.connectedAt': now })
      }
    }
  );
  publishAccountUpdated(user._id.toString());

  if (!wasAllowed && await isFeatureEnabledFor('vkReports', user)) {
    await sendVkCommunityMessage(vkUserId, vkReportReplies.connected).catch((error) => {
      console.error('VK welcome message failed', (error as Error).message);
    });
  }
  return true;
}

export async function disconnectVkNotifications(vkUserId: string) {
  const user = await UserModel.findOne({ vkId: vkUserId }, { _id: 1 }).lean();
  if (!user) return;
  await markVkDisallowed(user._id);
}

/** Входящее сообщение сообществу: подключает отчёт и понимает «стоп» / «старт». */
export async function handleVkIncomingMessage(vkUserId: string, text: unknown) {
  const user = await UserModel.findOne({ vkId: vkUserId }, { _id: 1, isAdmin: 1 }).lean();
  if (!user) return;
  const command = reportCommand(text);
  if (!command) {
    await connectVkNotifications(vkUserId);
    return;
  }
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { 'notifications.weeklyReport': command === 'start', 'notifications.vk.allowed': true, 'notifications.vk.checkedAt': new Date() } }
  );
  publishAccountUpdated(user._id.toString());
  if (await isFeatureEnabledFor('vkReports', user)) {
    await sendVkCommunityMessage(vkUserId, command === 'stop' ? vkReportReplies.stopped : vkReportReplies.started).catch((error) => {
      console.error('VK command reply failed', (error as Error).message);
    });
  }
}

/** Кнопка «Проверить» в профиле: спрашивает VK, разрешены ли сообщения от сообщества. */
export async function checkVkNotifications(userId: string, vkUserId: string) {
  const allowed = await isVkMessagesAllowed(vkUserId);
  if (allowed) {
    await connectVkNotifications(vkUserId);
  } else {
    await UserModel.updateOne({ _id: userId }, { $set: { 'notifications.vk.allowed': false, 'notifications.vk.checkedAt': new Date() } });
  }
  return allowed;
}

let isRunning = false;

async function tick() {
  if (isRunning || !isWithinSendWindow(new Date())) return;
  isRunning = true;
  try {
    const sent = await sendWeeklyReports();
    if (sent) console.log(`Weekly VK reports sent: ${sent}`);
  } catch (error) {
    console.error('Weekly VK reports failed', error);
  } finally {
    isRunning = false;
  }
}

export function startWeeklyReportScheduler() {
  if (!env.weeklyReportsEnabled) return;
  if (!isVkMessagesConfigured()) {
    console.warn('Weekly reports enabled but VK_GROUP_TOKEN is missing; reports are off.');
    return;
  }
  console.log(`Weekly VK reports enabled: Mondays, every ${TICK_INTERVAL_MS / 60_000} min within the send window`);
  setTimeout(() => void tick(), 120_000);
  setInterval(() => void tick(), TICK_INTERVAL_MS).unref();
}
