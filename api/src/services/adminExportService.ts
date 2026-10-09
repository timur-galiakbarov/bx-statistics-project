import type { Types } from 'mongoose';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { acquisitionSource, type Acquisition } from '../repositories/accountRepository.js';
import { plans, returningCustomerPlans } from '../routes/payments.js';
import { getAdminActivityStats, mskDayKey, mskDayStart } from './activityStatsService.js';
import { getAdminPreviewStats } from './previewStatsService.js';
import { getAdminPushStats } from './pushStatsService.js';

const DAY_MS = 86_400_000;
const MONTHS = 12;

export type AdminExportMonth = {
  month: string;
  registrations: number;
  registrationsBySource: Record<string, number>;
  payments: number;
  revenue: number;
  payers: number;
  firstTimePayers: number;
  firstTimeRevenue: number;
};

export type AdminExportPayment = {
  paidAt: string;
  amount: number;
  period: string;
  userKey: string;
  isFirstPayment: boolean;
  registeredAt: string | null;
  daysFromRegistration: number | null;
  source: string;
  campaign: string;
};

type PaymentRow = { userId: Types.ObjectId; amount: number; period: string; paidAt?: Date; createdAt: Date };
type UserRow = { _id: Types.ObjectId; createdAt: Date; acquisition?: Acquisition };

/** Месяц по Москве в формате YYYY-MM. */
function mskMonthKey(date: Date) {
  return mskDayKey(date).slice(0, 7);
}

/** Начало месяца по Москве, на shiftMonths назад от текущего. */
function mskMonthStart(now: Date, shiftMonths: number) {
  const [year, month] = mskMonthKey(now).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 - shiftMonths, 1) - 3 * 3_600_000);
}

/**
 * Сводка для разговора с агентом о состоянии Socstat: деньги и регистрации по месяцам,
 * посещаемость и воронка за период, платежи с источником и лагом от регистрации.
 * Администраторы исключены, имён и VK ID в выгрузке нет — пользователи различаются по userKey.
 */
export async function getAdminExport(requestedDays: unknown, now = new Date()) {
  const [activity, preview, push] = await Promise.all([
    getAdminActivityStats(requestedDays, now),
    getAdminPreviewStats(requestedDays, now),
    getAdminPushStats(requestedDays, now)
  ]);
  const days = activity.days;
  const rangeStart = mskDayStart(now, -(days - 1));
  const monthsStart = mskMonthStart(now, MONTHS - 1);

  const adminIds = await UserModel.distinct('_id', { isAdmin: true }) as Types.ObjectId[];
  const notAdmin = { $nin: adminIds };

  const [usersTotal, usersWithAccess, allPayments, registrations] = await Promise.all([
    UserModel.countDocuments({ isAdmin: { $ne: true } }),
    UserModel.countDocuments({ isAdmin: { $ne: true }, activeTo: { $gt: now } }),
    PaymentModel.find({ status: 'paid', amount: { $gt: 0 }, userId: notAdmin })
      .select({ userId: 1, amount: 1, period: 1, paidAt: 1, createdAt: 1 })
      .lean<PaymentRow[]>(),
    UserModel.find({ isAdmin: { $ne: true }, createdAt: { $gte: monthsStart } })
      .select({ createdAt: 1, acquisition: 1 })
      .lean<UserRow[]>()
  ]);

  const paidAtOf = (payment: PaymentRow) => payment.paidAt ?? payment.createdAt;
  const payments = [...allPayments].sort((a, b) => paidAtOf(a).getTime() - paidAtOf(b).getTime());
  const firstPaymentAt = new Map<string, number>();
  for (const payment of payments) {
    const id = payment.userId.toString();
    if (!firstPaymentAt.has(id)) firstPaymentAt.set(id, paidAtOf(payment).getTime());
  }
  const isFirst = (payment: PaymentRow) => firstPaymentAt.get(payment.userId.toString()) === paidAtOf(payment).getTime();

  const months = new Map<string, AdminExportMonth & { payerSet: Set<string> }>();
  for (let shift = MONTHS - 1; shift >= 0; shift -= 1) {
    const month = mskMonthKey(mskMonthStart(now, shift));
    months.set(month, {
      month,
      registrations: 0,
      registrationsBySource: {},
      payments: 0,
      revenue: 0,
      payers: 0,
      firstTimePayers: 0,
      firstTimeRevenue: 0,
      payerSet: new Set()
    });
  }
  for (const user of registrations) {
    const row = months.get(mskMonthKey(user.createdAt));
    if (!row) continue;
    const source = acquisitionSource(user.acquisition) ?? 'без меток';
    row.registrations += 1;
    row.registrationsBySource[source] = (row.registrationsBySource[source] ?? 0) + 1;
  }
  for (const payment of payments) {
    const row = months.get(mskMonthKey(paidAtOf(payment)));
    if (!row) continue;
    row.payments += 1;
    row.revenue += payment.amount;
    row.payerSet.add(payment.userId.toString());
    if (isFirst(payment)) {
      row.firstTimePayers += 1;
      row.firstTimeRevenue += payment.amount;
    }
  }

  // Платежи периода с источником первого касания и временем от регистрации до оплаты.
  const periodPayments = payments.filter((payment) => paidAtOf(payment) >= rangeStart).reverse();
  const payers = await UserModel.find({ _id: { $in: [...new Set(periodPayments.map((payment) => payment.userId.toString()))] } })
    .select({ createdAt: 1, acquisition: 1 })
    .lean<UserRow[]>();
  const payerById = new Map(payers.map((user) => [user._id.toString(), user]));
  // Короткий стабильный ключ вместо ID: позволяет видеть повторные оплаты одного человека.
  const userKeys = new Map<string, string>();
  const userKey = (id: string) => {
    if (!userKeys.has(id)) userKeys.set(id, `u${userKeys.size + 1}`);
    return userKeys.get(id)!;
  };
  const recentPayments: AdminExportPayment[] = periodPayments.map((payment) => {
    const id = payment.userId.toString();
    const user = payerById.get(id);
    const paidAt = paidAtOf(payment);
    return {
      paidAt: paidAt.toISOString(),
      amount: payment.amount,
      period: payment.period,
      userKey: userKey(id),
      isFirstPayment: isFirst(payment),
      registeredAt: user?.createdAt.toISOString() ?? null,
      daysFromRegistration: user ? Math.floor((paidAt.getTime() - user.createdAt.getTime()) / DAY_MS) : null,
      source: acquisitionSource(user?.acquisition) ?? 'без меток',
      campaign: user?.acquisition?.utmCampaign ?? ''
    };
  });

  // В ленте действий имена и внутренние ID не нужны агенту.
  const feed = activity.feed.map(({ id: _id, userId, userName: _userName, ...item }) => ({ ...item, userKey: userKey(userId) }));

  return {
    about: {
      product: 'Socstat — сервис статистики сообществ VK, каналов YouTube и Telegram по подписке',
      generatedAt: now.toISOString(),
      periodDays: days,
      timezone: 'Europe/Moscow (UTC+3); дни и месяцы считаются по Москве',
      notes: [
        'Администраторы исключены из всех цифр.',
        'Деньги — в рублях, только успешные платежи с суммой больше нуля.',
        `activity.trackingSince — с этой даты собираются визиты, отказы и действия; регистрации, каналы и оплаты есть за всю историю.`,
        'activity.periods: today/yesterday/week/previousWeek/month — сводки по активным пользователям (users), визитам и деньгам.',
        'activity.funnel — когорта зарегистрировавшихся за periodDays: сколько добавили канал, открыли аналитику, вернулись на другой день и оплатили.',
        'activity.acquisition — та же когорта по источнику первого касания (utm_source, vk_ads по rb_clickid, yandex_direct по yclid или referrer).',
        'Источники регистраций записываются с вечера 2026-10-05; у более ранних регистраций источник — «без меток».',
        'activity.adReturns — уже зарегистрированные, вернувшиеся по рекламной ссылке; оплаты в 30 дней после возврата.',
        'activity.engagement.stickiness — средний DAU за 7 дней / MAU; returnRate — доля когорты, вернувшейся на другой день.',
        'preview — краткий отчёт VK для пользователей без доступа: просмотры, клики по закрытым блокам, оплаты после первого просмотра.',
        'push — подписки на уведомления, воронка мягкого запроса и напоминания об окончании доступа (продление — оплата в 7 дней после пуша).',
        'monthly — последние 12 месяцев: регистрации по источникам, платежи, выручка, плательщики и впервые заплатившие.',
        'recentPayments — платежи за periodDays, новые сверху; userKey одинаков у одного пользователя внутри выгрузки.',
        'pricing.newCustomers — цены для новых; pricing.returningCustomers — старые цены, сохранённые за теми, кто уже платил.'
      ]
    },
    pricing: {
      newCustomers: plans.map(({ id, priceRub, monthlyPriceRub }) => ({ id, priceRub, monthlyPriceRub })),
      returningCustomers: returningCustomerPlans.map(({ id, priceRub, monthlyPriceRub }) => ({ id, priceRub, monthlyPriceRub }))
    },
    totals: {
      users: usersTotal,
      usersWithActiveAccess: usersWithAccess,
      payersAllTime: firstPaymentAt.size,
      paymentsAllTime: payments.length,
      revenueAllTime: payments.reduce((sum, payment) => sum + payment.amount, 0)
    },
    monthly: [...months.values()].map(({ payerSet, ...row }) => ({ ...row, payers: payerSet.size })),
    activity: { ...activity, feed },
    preview,
    push,
    recentPayments
  };
}
