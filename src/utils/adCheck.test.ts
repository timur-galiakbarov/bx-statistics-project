import assert from 'node:assert/strict';
import { test } from 'node:test';
import { costPerThousand, positiveAmount } from './adCheck';

test('CPM uses price and nonzero views, with inverse range endpoints', () => {
  assert.equal(costPerThousand(5_000, 10_000), 500);
  assert.equal(costPerThousand(5_000, 20_000), 250);
  assert.equal(costPerThousand(5_000, 5_000), 1_000);
  for (const views of [0, -1, Infinity, null]) assert.equal(costPerThousand(5_000, views), null);
  for (const price of [0, -1, NaN, null]) assert.equal(costPerThousand(price, 10_000), null);
});

test('money accepts pasted grouping and comma decimals, rejects invalid or unlimited amounts', () => {
  assert.equal(positiveAmount('5 000,50'), 5000.5);
  assert.equal(positiveAmount('5\u00a0000'), 5000);
  assert.equal(positiveAmount('5000.50'), 5000.5);
  assert.equal(positiveAmount('1000000000'), 1_000_000_000);
  for (const value of ['', '0', '-5', '1e3', 'NaN', 'Infinity', '1.234', '1,2,3', '1000000001', '500 ₽']) assert.equal(positiveAmount(value), null, value);
});
