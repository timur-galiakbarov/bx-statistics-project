import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailySeries, getAnalyticsPeriod, getPreviousAnalyticsPeriod, getWallCompleteness } from './analyticsUtils.js';

const at = (value: string) => Math.floor(new Date(`${value}T12:00:00`).getTime() / 1000);
const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

test('строит периоды 7, 14 и 30 дней включительно', () => {
  const now = localDate(2026, 8, 25);
  assert.equal(dateKey(getAnalyticsPeriod('week', undefined, undefined, now).dateFrom), '2026-08-19');
  assert.equal(dateKey(getAnalyticsPeriod('twoWeek', undefined, undefined, now).dateFrom), '2026-08-12');
  assert.equal(dateKey(getAnalyticsPeriod('month', undefined, undefined, now).dateFrom), '2026-07-27');
});

test('текущий и предыдущий месяцы не переносят 29–31 число в следующий месяц', () => {
  for (const day of [29, 30, 31]) {
    const period = getAnalyticsPeriod('currentMonth', undefined, undefined, localDate(2026, 3, day));
    const previous = getPreviousAnalyticsPeriod(period);
    assert.equal(dateKey(previous.dateFrom), '2026-02-01');
    assert.equal(dateKey(previous.dateTo), '2026-02-28');
  }
  const previousMonth = getPreviousAnalyticsPeriod(getAnalyticsPeriod('previousMonth', undefined, undefined, localDate(2026, 3, 31)));
  assert.equal(dateKey(previousMonth.dateFrom), '2026-01-01');
  assert.equal(dateKey(previousMonth.dateTo), '2026-01-31');
});

test('валидирует произвольный период, будущие даты и максимальную длину', () => {
  const now = localDate(2026, 8, 25);
  assert.throws(() => getAnalyticsPeriod('custom', '2026-08-20', '2026-08-10', now), /INVALID_ANALYTICS_PERIOD/);
  assert.throws(() => getAnalyticsPeriod('custom', '2026-08-20', '2026-08-26', now), /INVALID_ANALYTICS_PERIOD/);
  assert.throws(() => getAnalyticsPeriod('custom', '2026-01-01', '2026-05-01', now), /ANALYTICS_PERIOD_TOO_LONG/);
  assert.equal(dateKey(getAnalyticsPeriod('custom', '2026-08-01', '2026-08-25', now).dateFrom), '2026-08-01');
});

test('временной ряд включает дни без публикаций без синтетических ER и просмотров', () => {
  const period = getAnalyticsPeriod('custom', '2026-08-01', '2026-08-03', localDate(2026, 8, 10));
  const series = buildDailySeries(period, [{ date: at('2026-08-02') }], () => ({ actions: 5, likes: 3, reposts: 1, comments: 1, views: 100, er: 1.2 }));
  assert.deepEqual(series.map((item) => [item.dayIndex, item.posts, item.actions, item.averageViews, item.er]), [[1, 0, 0, null, null], [2, 1, 5, 100, 1.2], [3, 0, 0, null, null]]);
});

test('полнота стены учитывает границу периода и достигнутый лимит', () => {
  const period = getAnalyticsPeriod('custom', '2026-08-01', '2026-08-07', localDate(2026, 8, 10));
  assert.equal(getWallCompleteness(250, [{ date: at('2026-08-08') }], period), false);
  assert.equal(getWallCompleteness(250, [{ date: at('2026-07-31') }], period), true);
  assert.equal(getWallCompleteness(1, [{ date: at('2026-08-08') }], period), true);
});
