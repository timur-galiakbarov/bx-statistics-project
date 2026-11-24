import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeSubscriptionFlow } from './subscriptionFlow';

test('суммы, чистый прирост и максимум считаются по всем дням', () => {
  const flow = summarizeSubscriptionFlow([
    { date: '2026-11-01', subscribed: 12, unsubscribed: 5 },
    { date: '2026-11-02', subscribed: 3, unsubscribed: 21 },
    { date: '2026-11-03', subscribed: 0, unsubscribed: 0 }
  ]);
  assert.equal(flow.subscribed, 15);
  assert.equal(flow.unsubscribed, 26);
  assert.equal(flow.net, -11);
  assert.equal(flow.daysWithData, 3);
  assert.equal(flow.daysTotal, 3);
  assert.equal(flow.max, 21);
  assert.deepEqual(flow.bars.map((bar) => [bar.up, bar.down]), [[12 / 21, 5 / 21], [3 / 21, 1], [0, 0]]);
});

test('день без событий VK остаётся в шкале времени нулём, но помечен как день без данных', () => {
  const flow = summarizeSubscriptionFlow([
    { date: '2026-11-01', subscribed: null, unsubscribed: null },
    { date: '2026-11-02', subscribed: 4, unsubscribed: null },
    { date: '2026-11-03', subscribed: null, unsubscribed: null }
  ]);
  assert.equal(flow.bars.length, 3);
  assert.equal(flow.daysWithData, 1);
  assert.deepEqual(flow.bars.map((bar) => [bar.date, bar.hasData]), [
    ['2026-11-01', false],
    ['2026-11-02', true],
    ['2026-11-03', false]
  ]);
  assert.equal(flow.subscribed, 4);
  assert.equal(flow.unsubscribed, 0);
  assert.equal(flow.net, 4);
  assert.equal(flow.max, 4);
});

test('без данных панель не показывается, деления на ноль нет', () => {
  const flow = summarizeSubscriptionFlow([]);
  assert.equal(flow.hasData, false);
  assert.equal(flow.max, 1);
  assert.deepEqual(flow.bars, []);

  const blank = summarizeSubscriptionFlow([{ date: '2026-11-01', subscribed: null, unsubscribed: null }]);
  assert.equal(blank.hasData, false);
});
