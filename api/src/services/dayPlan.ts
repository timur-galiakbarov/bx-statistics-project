import { createHash } from 'node:crypto';

export const DAY_PLAN_PERIOD = '24 часа';
export const DAY_PLAN_DURATION_MS = 86_400_000;

export function dayPlanGroup(userId: string) {
  const bucket = createHash('sha256').update(`day-plan-v1:${userId}`).digest()[0];
  return bucket < 128 ? 'control' : 'offer';
}

export function dayPlanAccessEnd(now: Date, current: Date, hasExactAccessEnd?: boolean | null) {
  const currentEnd = hasExactAccessEnd
    ? current.getTime()
    : Date.parse(`${current.toISOString().slice(0, 10)}T00:00:00.000Z`) + DAY_PLAN_DURATION_MS;
  return new Date(Math.max(now.getTime(), currentEnd) + DAY_PLAN_DURATION_MS);
}

type DayPlanGroup = ReturnType<typeof dayPlanGroup>;

export function summarizeDayPlanExperiment(
  users: { id: string; group: DayPlanGroup; shownAt: Date }[],
  payments: { userId: string; paidAt: Date; amount: number; period: string }[],
  now: Date
) {
  const windowDays = 30;
  const windowMs = windowDays * DAY_PLAN_DURATION_MS;
  const rows = new Map(users.map((user) => [user.id, {
    ...user, revenue: 0, dayPayments: 0, monthPayments: 0
  }]));
  for (const payment of payments) {
    const row = rows.get(payment.userId);
    if (!row || payment.paidAt < row.shownAt || payment.paidAt.getTime() >= row.shownAt.getTime() + windowMs) continue;
    row.revenue += payment.amount;
    if (payment.period === DAY_PLAN_PERIOD) row.dayPayments += 1;
    if (payment.period === '1 месяц') row.monthPayments += 1;
  }

  const summarize = (group: DayPlanGroup) => {
    const shown = [...rows.values()].filter((row) => row.group === group);
    const completed = shown.filter((row) => row.shownAt.getTime() + windowMs <= now.getTime());
    const revenue = completed.reduce((sum, row) => sum + row.revenue, 0);
    return {
      exposedUsers: shown.length,
      usersWithFullWindow: completed.length,
      revenue,
      revenuePerUser: completed.length ? Math.round(revenue * 100 / completed.length) / 100 : null,
      monthBuyers: completed.filter((row) => row.monthPayments > 0).length,
      dayPurchases: completed.reduce((sum, row) => sum + row.dayPayments, 0),
      repeatDayBuyers: completed.filter((row) => row.dayPayments > 1).length
    };
  };

  return { windowDays, control: summarize('control'), offer: summarize('offer') };
}
