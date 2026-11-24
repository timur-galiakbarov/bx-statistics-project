import assert from 'node:assert/strict';
import test from 'node:test';
import { formatActivityDuration } from './activityFormat.js';

test('formatActivityDuration shows minutes and hours for visits', () => {
  assert.equal(formatActivityDuration(0), 'меньше минуты');
  assert.equal(formatActivityDuration(59), 'меньше минуты');
  assert.equal(formatActivityDuration(60), '1 мин');
  assert.equal(formatActivityDuration(90), '2 мин');
  assert.equal(formatActivityDuration(3_600), '1 ч');
  assert.equal(formatActivityDuration(5_400), '1 ч 30 мин');
});

test('formatActivityDuration treats broken values as a very short visit', () => {
  assert.equal(formatActivityDuration(-10), 'меньше минуты');
  assert.equal(formatActivityDuration(Number.NaN), 'меньше минуты');
});
