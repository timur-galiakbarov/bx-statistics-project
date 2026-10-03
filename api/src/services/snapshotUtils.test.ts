import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubscriberHistory, hoursSince, snapshotDateKey, snapshotHour, telegramUsernameFromSource } from './snapshotUtils.js';

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
