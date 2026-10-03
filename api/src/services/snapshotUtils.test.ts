import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubscriberHistory, hoursSince, snapshotGrowthForPeriod, snapshotDateKey, snapshotHour, telegramUsernameFromSource } from './snapshotUtils.js';

test('дата и час среза считаются по Москве', () => {
  assert.equal(snapshotDateKey(new Date('2026-10-02T21:30:00Z')), '2026-10-03');
  assert.equal(snapshotDateKey(new Date('2026-10-02T20:59:00Z')), '2026-10-02');
  assert.equal(snapshotHour(new Date('2026-10-02T21:30:00Z')), 0);
  assert.equal(snapshotHour(new Date('2026-10-03T00:00:00Z')), 3);
});

test('часы с момента публикации округляются до десятых и не уходят в минус', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  assert.equal(hoursSince(new Date('2026-10-02T12:00:00Z'), now), 24);
  assert.equal(hoursSince(new Date('2026-10-03T11:15:00Z'), now), 0.8);
  assert.equal(hoursSince(new Date('2026-10-03T13:00:00Z'), now), 0);
});

test('история подписчиков сортируется и считает прирост от последнего известного значения', () => {
  const history = buildSubscriberHistory([
    { date: '2026-10-03', subscribers: 1_010 },
    { date: '2026-10-01', subscribers: 1_000 },
    { date: '2026-10-02', subscribers: null },
    { date: '2026-10-04', subscribers: 995 }
  ]);
  assert.deepEqual(history.map((point) => [point.date, point.change]), [
    ['2026-10-01', null],
    ['2026-10-02', null],
    ['2026-10-03', 10],
    ['2026-10-04', -15]
  ]);
});

test('username Telegram берётся из handle, ссылки или externalId', () => {
  assert.equal(telegramUsernameFromSource({ handle: '@Ufa_rb', externalId: '123' }), 'ufa_rb');
  assert.equal(telegramUsernameFromSource({ externalId: 'https://t.me/durov/10' }), 'durov');
  assert.equal(telegramUsernameFromSource({ handle: '', externalId: 'banivlesu_ufa' }), 'banivlesu_ufa');
  assert.equal(telegramUsernameFromSource({ externalId: '1234567890' }), null);
});

test('прирост за период считается от первого среза в периоде', () => {
  const points = [
    { date: '2026-10-03', subscribers: 1_000 },
    { date: '2026-10-04', subscribers: null },
    { date: '2026-10-05', subscribers: 1_020 },
    { date: '2026-10-06', subscribers: 1_015 }
  ];
  // Период до сегодняшнего дня заканчивается живым значением.
  assert.deepEqual(snapshotGrowthForPeriod(points, '2026-09-30', '2026-10-06', '2026-10-06', 1_030, '2026-10-03'), { total: 30, since: '2026-10-03', historySince: '2026-10-03' });
  // «Вчера» закрывается сегодняшним утренним срезом.
  assert.deepEqual(snapshotGrowthForPeriod(points, '2026-10-05', '2026-10-05', '2026-10-06', 1_030, '2026-10-03'), { total: -5, since: '2026-10-05', historySince: '2026-10-03' });
  // Скрытый счётчик: без живого значения берём последний срез.
  assert.equal(snapshotGrowthForPeriod(points, '2026-10-03', '2026-10-06', '2026-10-06', null, '2026-10-03').total, 15);
});

test('без срезов в периоде прирост неизвестен', () => {
  assert.deepEqual(snapshotGrowthForPeriod([], '2026-10-01', '2026-10-06', '2026-10-06', 500, null), { total: null, since: null, historySince: null });
  // Один срез за вчера, а сегодняшнего ещё нет: сравнивать не с чем.
  assert.deepEqual(snapshotGrowthForPeriod([{ date: '2026-10-05', subscribers: 10 }], '2026-10-05', '2026-10-05', '2026-10-06', 12, '2026-10-05'), { total: null, since: '2026-10-05', historySince: '2026-10-05' });
});
