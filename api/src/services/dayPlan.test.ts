import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_PLAN_DURATION_MS, DAY_PLAN_PERIOD, dayPlanAccessEnd, summarizeDayPlanExperiment } from './dayPlan.js';

test('дневной тариф сохраняет точное время при переходе через полночь', () => {
  const now = new Date('2026-11-10T23:55:00.000Z');
  const past = new Date('2026-11-09T00:00:00.000Z');
  assert.equal(dayPlanAccessEnd(now, past).toISOString(), '2026-11-11T23:55:00.000Z');
  const active = new Date(now.getTime() + DAY_PLAN_DURATION_MS);
  assert.equal(dayPlanAccessEnd(now, active, true).toISOString(), '2026-11-12T23:55:00.000Z');
});

test('выгрузка сравнивает группы по оплатам в полном 30-дневном окне', () => {
  const shownAt = new Date('2026-11-01T10:00:00.000Z');
  const day = (offset: number) => new Date(shownAt.getTime() + offset * DAY_PLAN_DURATION_MS);
  const result = summarizeDayPlanExperiment([
    { id: 'a', group: 'offer', shownAt },
    { id: 'b', group: 'control', shownAt },
    { id: 'c', group: 'offer', shownAt },
    { id: 'd', group: 'offer', shownAt: day(15) }
  ], [
    { userId: 'a', paidAt: day(0), period: DAY_PLAN_PERIOD, amount: 249 },
    { userId: 'a', paidAt: day(1), period: DAY_PLAN_PERIOD, amount: 249 },
    { userId: 'a', paidAt: day(30), period: '1 месяц', amount: 699 },
    { userId: 'b', paidAt: day(-1), period: '1 месяц', amount: 699 },
    { userId: 'b', paidAt: day(29), period: '1 месяц', amount: 699 },
    { userId: 'd', paidAt: day(16), period: DAY_PLAN_PERIOD, amount: 249 }
  ], day(30));
  assert.deepEqual(result.offer, {
    exposedUsers: 3, usersWithFullWindow: 2, revenue: 498, revenuePerUser: 249,
    monthBuyers: 0, dayPurchases: 2, repeatDayBuyers: 1
  });
  assert.equal(result.control.revenuePerUser, 699);
  assert.equal(result.control.monthBuyers, 1);
});
