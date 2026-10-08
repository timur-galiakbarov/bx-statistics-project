import webpush from 'web-push';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { PushDeliveryModel } from '../models/PushDelivery.js';
import { PushSubscriptionModel } from '../models/PushSubscription.js';
import { UserModel } from '../models/User.js';
import { plans, returningCustomerPlans } from '../routes/payments.js';
import { getLegacyPricingUserIds } from './legacyPricing.js';

const DAY_MS = 86_400_000;
const TICK_INTERVAL_MS = 15 * 60_000;
// Не будим людей: напоминания уходят с 10 до 21 по Москве.
const SEND_FROM_HOUR_MSK = 10;
const SEND_TO_HOUR_MSK = 21;
// Не больше одного напоминания в сутки, даже если подошли сразу два этапа.
const MIN_GAP_MS = 20 * 60 * 60_000;

export type ExpiryReminderKind = 'expiry_before' | 'expiry_today' | 'expiry_after';

/** Which reminder is due for an access end date, or null. Stages: 3 days before, the day of, 3–7 days after. */
export function expiryReminderKind(activeTo: Date, now: Date): ExpiryReminderKind | null {
  const left = activeTo.getTime() - now.getTime();
  if (left > 0 && left <= 3 * DAY_MS) return 'expiry_before';
  if (left <= 0 && left > -DAY_MS) return 'expiry_today';
  if (left <= -3 * DAY_MS && left > -7 * DAY_MS) return 'expiry_after';
  return null;
}

export function isWithinSendWindow(now: Date) {
  const hourMsk = (now.getUTCHours() + 3) % 24;
  return hourMsk >= SEND_FROM_HOUR_MSK && hourMsk < SEND_TO_HOUR_MSK;
}

function formatDayMonth(date: Date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
}

export function expiryReminderMessage(kind: ExpiryReminderKind, options: { activeTo: Date; isTrial: boolean; isReturning: boolean }) {
  const monthPrice = (options.isReturning ? returningCustomerPlans : plans).find((plan) => plan.id === 'month')!.priceRub;
  const priceNote = options.isReturning ? `Ваша цена сохранена: ${monthPrice} ₽ за месяц.` : `Месяц — ${monthPrice} ₽.`;
  const access = options.isTrial ? 'Пробный доступ' : 'Доступ к socstat';

  if (kind === 'expiry_before') {
    return {
      title: `${access} заканчивается ${formatDayMonth(options.activeTo)}`,
      body: `Продлите, чтобы не потерять аналитику и сравнения. ${priceNote}`
    };
  }
  if (kind === 'expiry_today') {
    return {
      title: `${access} закончился`,
      body: `Аналитика, сравнение и публикации закрыты. Продлить можно за минуту. ${priceNote}`
    };
  }
  return {
    title: 'Ваши каналы продолжают меняться',
    body: `Доступ закончился ${formatDayMonth(options.activeTo)}. Вернитесь, чтобы посмотреть, что произошло. ${priceNote}`
  };
}

let isConfigured = false;

export function isPushConfigured() {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  if (!isConfigured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    isConfigured = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; url: string; deliveryId?: string; tag?: string };

/** Sends a notification to every browser of the user. Drops subscriptions the push service no longer knows. */
export async function sendPushToUser(userId: string | Types.ObjectId, payload: PushPayload) {
  if (!isPushConfigured()) return 0;
  const subscriptions = await PushSubscriptionModel.find({ userId }).lean();
  let delivered = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys!.p256dh, auth: subscription.keys!.auth } },
        JSON.stringify(payload),
        { TTL: 12 * 60 * 60 }
      );
      delivered += 1;
      await PushSubscriptionModel.updateOne({ _id: subscription._id }, { $set: { lastSuccessAt: new Date() } });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ _id: subscription._id });
      } else {
        console.error('Web push failed', statusCode, (error as Error).message);
      }
    }
  }

  return delivered;
}

export async function sendExpiryReminders(now = new Date()) {
  const subscribedUserIds = await PushSubscriptionModel.distinct('userId');
  if (!subscribedUserIds.length) return 0;

  const users = await UserModel.find(
    {
      _id: { $in: subscribedUserIds },
      isActive: { $ne: false },
      activeTo: { $gt: new Date(now.getTime() - 7 * DAY_MS), $lte: new Date(now.getTime() + 3 * DAY_MS) }
    },
    { _id: 1, activeTo: 1, trialEndsAt: 1 }
  ).lean();
  if (!users.length) return 0;

  const returningUserIds = await getLegacyPricingUserIds(users.map((user) => user._id));
  let sent = 0;

  for (const user of users) {
    const kind = expiryReminderKind(user.activeTo, now);
    if (!kind) continue;

    const recent = await PushDeliveryModel.exists({ userId: user._id, createdAt: { $gt: new Date(now.getTime() - MIN_GAP_MS) } });
    if (recent) continue;

    // Уникальный индекс: если другой процесс уже записал это напоминание, вставка упадёт и мы его пропустим.
    let deliveryId: string;
    try {
      const delivery = await PushDeliveryModel.create({ userId: user._id, kind, activeTo: user.activeTo, createdAt: now });
      deliveryId = delivery._id.toString();
    } catch {
      continue;
    }

    const isReturning = returningUserIds.has(user._id.toString());
    const isTrial = !isReturning && Boolean(user.trialEndsAt);
    const message = expiryReminderMessage(kind, { activeTo: user.activeTo, isTrial, isReturning });
    const delivered = await sendPushToUser(user._id, {
      ...message,
      url: `/app/account?from=push_${kind}`,
      deliveryId,
      tag: 'socstat-expiry'
    });
    await PushDeliveryModel.updateOne({ _id: deliveryId }, { $set: { delivered } });
    if (delivered) sent += 1;
  }

  return sent;
}

let isRunning = false;

async function tick() {
  if (isRunning || !isWithinSendWindow(new Date())) return;
  isRunning = true;
  try {
    const sent = await sendExpiryReminders();
    if (sent) console.log(`Expiry push reminders sent: ${sent}`);
  } catch (error) {
    console.error('Expiry push reminders failed', error);
  } finally {
    isRunning = false;
  }
}

export function startPushReminderScheduler() {
  if (!env.pushRemindersEnabled) return;
  if (!isPushConfigured()) {
    console.warn('Push reminders enabled but VAPID keys are missing; reminders are off.');
    return;
  }
  console.log(`Expiry push reminders enabled: every ${TICK_INTERVAL_MS / 60_000} min, ${SEND_FROM_HOUR_MSK}:00–${SEND_TO_HOUR_MSK}:00 MSK`);
  setTimeout(() => void tick(), 90_000);
  setInterval(() => void tick(), TICK_INTERVAL_MS).unref();
}
