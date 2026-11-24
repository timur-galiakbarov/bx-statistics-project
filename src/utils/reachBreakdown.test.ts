import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reachBreakdown } from './reachBreakdown';

test('виральный охват — остаток после подписчиков', () => {
  assert.deepEqual(reachBreakdown(84_300, 61_400), {
    subscribers: 61_400,
    viral: 22_900,
    subscribersShare: 61_400 / 84_300,
    viralShare: 22_900 / 84_300
  });
});

test('охват подписчиков больше общего — обрезаем по общему', () => {
  const breakdown = reachBreakdown(1_000, 1_200);
  assert.deepEqual(breakdown, { subscribers: 1_000, viral: 0, subscribersShare: 1, viralShare: 0 });
});

test('без охвата или без охвата подписчиков разбивку не строим', () => {
  assert.equal(reachBreakdown(0, 100), null);
  assert.equal(reachBreakdown(100, null), null);
  assert.equal(reachBreakdown(100, 0), null);
  assert.equal(reachBreakdown(Number.NaN, 50), null);
});

test('доли всегда в сумме дают единицу', () => {
  const breakdown = reachBreakdown(12_345, 5_432);
  assert.ok(breakdown);
  assert.equal(Number((breakdown.subscribersShare + breakdown.viralShare).toFixed(10)), 1);
});
