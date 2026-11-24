import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatChange, getChange } from './change';

test('рост, падение и отсутствие изменений', () => {
  assert.deepEqual(getChange(1124, 1000), { absolute: 124, percent: 12.4, state: 'up' });
  assert.deepEqual(getChange(900, 1000), { absolute: -100, percent: -10, state: 'down' });
  assert.deepEqual(getChange(1000, 1000), { absolute: 0, percent: 0, state: 'steady' });
});

test('нулевая база: процент не считается, остаётся абсолютная разница', () => {
  const change = getChange(42, 0);
  assert.deepEqual(change, { absolute: 42, percent: null, state: 'up' });
  assert.equal(formatChange(change), '+42');
});

test('нет данных для сравнения', () => {
  assert.equal(getChange(null, 100), null);
  assert.equal(getChange(100, null), null);
  assert.equal(formatChange(null), 'Нет сравнения');
});

test('ER подписывается в пунктах и сравнивается в процентах', () => {
  assert.equal(formatChange(getChange(4.8, 5.2), '', true), '-7,7% к прошлому периоду');
  assert.equal(formatChange(getChange(4.8, 4.8), '', true), 'Без изменений');
});

test('обычная метрика: абсолютное изменение и процент', () => {
  assert.equal(formatChange(getChange(1240, 1103)), '+137 · +12,4%');
  assert.equal(formatChange(getChange(9, 9)), 'Без изменений');
  assert.equal(formatChange(getChange(-5, 10)), '-15 · -150%');
});

test('единицы измерения подставляются в абсолютное изменение', () => {
  assert.equal(formatChange(getChange(130, 100), 'шт'), '+30 шт · +30%');
});
