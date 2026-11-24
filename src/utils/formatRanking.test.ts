import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFormatRanking } from './formatRanking';

function post(contentType: string, views: number | null, er: number | null, isAd = false) {
  return { contentType, views, er, isAd };
}

test('медиана считается по формату, а не по всем постам', () => {
  const ranking = buildFormatRanking([
    post('Фото', 100, 2),
    post('Фото', 300, 4),
    post('Фото', 200, 3),
    post('Видео', 1_000, 1),
    post('Видео', 3_000, 1),
    post('Видео', 2_000, 1)
  ]);
  const photo = ranking.rows.find((row) => row.format === 'Фото');
  const video = ranking.rows.find((row) => row.format === 'Видео');
  assert.equal(photo?.medianViews, 200);
  assert.equal(video?.medianViews, 2_000);
  // По три поста в формате: для «лучшего» нужно пять, панель тоже не показывается.
  assert.equal(ranking.best, null);
  assert.equal(ranking.hasData, false);
});

test('реклама исключается из рейтинга', () => {
  const ranking = buildFormatRanking([
    post('Фото', 100, 2),
    post('Фото', 100, 2, true),
    post('Видео', 500, 1),
    post('Видео', 700, 1)
  ]);
  assert.equal(ranking.totalPosts, 3);
  assert.equal(ranking.rows.find((row) => row.format === 'Фото')?.posts, 1);
});

test('лучший формат — только среди форматов с пятью постами', () => {
  const posts = [
    ...Array.from({ length: 6 }, () => post('Фото', 1_000, 2)),
    ...Array.from({ length: 6 }, () => post('Текст', 200, 1)),
    post('Видео', 5_000, 1), // один пост — красивый, но вывода не даёт
    ...Array.from({ length: 2 }, () => post('Видео', 4_000, 1))
  ];
  const ranking = buildFormatRanking(posts);
  const video = ranking.rows.find((row) => row.format === 'Видео');
  assert.equal(video?.lowSample, true);
  assert.equal(ranking.best?.format, 'Фото');
  assert.equal(ranking.hasData, true);
});

test('отклонение от общей медианы считается по медиане всех постов', () => {
  const ranking = buildFormatRanking([
    ...Array.from({ length: 6 }, () => post('Фото', 300, 2)),
    ...Array.from({ length: 6 }, () => post('Видео', 100, 1))
  ]);
  assert.equal(ranking.overallMedianViews, 200);
  assert.equal(ranking.rows.find((row) => row.format === 'Фото')?.deltaViews, 50);
  assert.equal(ranking.rows.find((row) => row.format === 'Видео')?.deltaViews, -50);
});
