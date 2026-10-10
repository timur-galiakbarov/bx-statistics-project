import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubscriberHistory, chainedMedians, hoursSince, lockSnapshotGrowth, median, snapshotGrowthForPeriod, viewsAtHour, snapshotDateKey, snapshotHour, secondsUntilNextSnapshotDate, telegramUsernameFromSource } from './snapshotUtils.js';

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

test('просмотры за 24 часа интерполируются между ночными срезами', () => {
  const points = [
    { hoursSincePublished: 6, views: 400 },
    { hoursSincePublished: 30, views: 1_000 },
    { hoursSincePublished: 54, views: 1_240 }
  ];
  assert.equal(viewsAtHour(points, 24), 850);
  assert.equal(viewsAtHour(points, 48), 1_180);
  // Пост ещё не прожил 72 часа.
  assert.equal(viewsAtHour(points, 72), null);
  assert.equal(viewsAtHour([{ hoursSincePublished: 24, views: 77 }], 24), 77);
});

test('без среза до отметки кривая начинается с нуля, но только если следующий срез близко', () => {
  assert.equal(viewsAtHour([{ hoursSincePublished: 30, views: 600 }], 24), 480);
  // Первый срез через 40 часов: оценка за сутки была бы гаданием.
  assert.equal(viewsAtHour([{ hoursSincePublished: 40, views: 600 }], 24), null);
  // Скрытый счётчик не участвует.
  assert.equal(viewsAtHour([{ hoursSincePublished: 10, views: null }, { hoursSincePublished: 30, views: 600 }], 24), 480);
});

test('медиана устойчива к одному вирусному посту', () => {
  assert.equal(median([100, 120, 90, 5_000]), 110);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([]), null);
});

test('типичная кривая не падает, когда до поздних отметок доживают только старые посты', () => {
  const series = [
    [100, 150, 180],
    [120, 180, 210],
    [90, 135, null],
    [400, null, null],
    [300, null, null]
  ];
  // Медиана за 24 ч — по всем постам, дальше — медианный прирост постов, у которых есть обе отметки.
  const result = chainedMedians(series, 2);
  assert.deepEqual(result.map((item) => item.median), [120, 180, 213]);
  assert.deepEqual(result.map((item) => item.posts), [5, 3, 2]);
  assert.equal(chainedMedians(series, 3)[2].median, null);
});

test('lockSnapshotGrowth hides the number and keeps the direction', () => {
  assert.deepEqual(lockSnapshotGrowth({ total: -3, since: null, historySince: '2026-09-01' }), { total: null, since: null, historySince: '2026-09-01', locked: true, direction: 'down' });
  assert.equal(lockSnapshotGrowth({ total: null, since: null, historySince: null }).direction, null);
});

test('пауза Telegram длится до полуночи по Москве', () => {
  assert.equal(secondsUntilNextSnapshotDate(new Date('2026-10-10T20:00:00Z')), 3600);
  assert.equal(secondsUntilNextSnapshotDate(new Date('2026-10-10T21:00:00Z')), 86_400);
  assert.equal(secondsUntilNextSnapshotDate(new Date('2026-10-11T00:30:00Z')), 73_800);
});
