import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPostingHeatmap, moscowWeekdayAndHour, POSTING_BUCKETS } from './postingTimes';

test('дата переводится в московские день недели и час', () => {
  // 2026-11-24 09:00 UTC = вторник 12:00 МСК
  assert.deepEqual(moscowWeekdayAndHour('2026-11-24T09:00:00.000Z'), { weekday: 1, hour: 12 });
  // 2026-11-22 21:30 UTC = понедельник 00:30 МСК
  assert.deepEqual(moscowWeekdayAndHour('2026-11-22T21:30:00.000Z'), { weekday: 0, hour: 0 });
});

test('посты раскладываются по окнам, нули не теряются', () => {
  const heatmap = buildPostingHeatmap([
    { date: '2026-11-24T09:00:00.000Z', er: 5, views: 100 },  // вт, 12:00–14:00
    { date: '2026-11-24T09:30:00.000Z', er: 7, views: 300 },  // вт, то же окно
    { date: '2026-11-24T15:00:00.000Z', er: 3, views: 50 }    // вт, 18:00–20:00
  ]);
  assert.equal(heatmap.totalPosts, 3);
  assert.equal(heatmap.cells.length, 7);
  assert.equal(heatmap.cells[1].length, POSTING_BUCKETS);
  assert.equal(heatmap.cells[1][6].posts, 2);
  assert.equal(heatmap.cells[1][6].medianEr, 6);
  assert.equal(heatmap.cells[1][6].averageViews, 200);
  assert.equal(heatmap.cells[1][9].posts, 1);
});

test('лучшие окна — только там, где хватает постов, и по медиане ER', () => {
  const posts = [
    ...Array.from({ length: 3 }, () => ({ date: '2026-11-24T09:00:00.000Z', er: 6, views: 100 })),
    ...Array.from({ length: 3 }, () => ({ date: '2026-11-24T15:00:00.000Z', er: 4, views: 900 })),
    { date: '2026-11-24T20:00:00.000Z', er: 9, views: 10 } // одно окно ночью — мало данных
  ];
  const heatmap = buildPostingHeatmap(posts);
  assert.equal(heatmap.best.length, 2);
  assert.deepEqual(heatmap.best.map((cell) => cell.bucket), [6, 9]);
  assert.equal(heatmap.best[0].medianEr, 6);
  assert.equal(heatmap.maxMedianEr, 6);
});

test('панель не показывается без достаточной выборки', () => {
  const few = buildPostingHeatmap([{ date: '2026-11-24T09:00:00.000Z', er: 5, views: 100 }]);
  assert.equal(few.hasData, false);
  const empty = buildPostingHeatmap([]);
  assert.equal(empty.hasData, false);
  assert.equal(empty.maxMedianEr, null);
  assert.deepEqual(empty.best, []);
});
