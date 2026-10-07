import assert from 'node:assert/strict';
import test from 'node:test';
import { competitorGrowth, competitorPlatform, competitorSource, storedCompetitors, summarizeCompetitorReport, validateCompetitors } from './competitorUtils.js';

test('конкуренты: сервер отклоняет чужую платформу, дубли, своё сообщество и превышение лимита', () => {
  assert.throws(() => competitorPlatform('other'));
  assert.throws(() => competitorSource('vk', '1,2'));
  assert.throws(() => validateCompetitors('vk', '1', [{ externalId: '1', name: 'Своя' }]));
  assert.throws(() => validateCompetitors('telegram', 'owner', [{ externalId: 'News', name: 'A' }, { externalId: 'news', name: 'B' }]));
  assert.throws(() => validateCompetitors('vk', '1', Array.from({ length: 6 }, (_, i) => ({ externalId: String(i + 2), name: 'A' }))));
  assert.throws(() => validateCompetitors('vk', '1', [{ externalId: '2', name: ' ' }]));
  assert.deepEqual(validateCompetitors('telegram', 'owner', [{ externalId: 'News', name: ' Новости ' }]), [{ platform: 'telegram', externalId: 'news', name: 'Новости' }]);
  assert.deepEqual(validateCompetitors('vk', '1', []), []);
});

test('конкуренты: набор может смешивать платформы, а свой источник сравнивается с учётом платформы', () => {
  assert.deepEqual(validateCompetitors('vk', '1', [{ platform: 'telegram', externalId: 'News', name: 'Новости' }, { platform: 'youtube', externalId: 'UC' + 'a'.repeat(22), name: 'Канал' }, { externalId: '2', name: 'Группа' }]), [
    { platform: 'telegram', externalId: 'news', name: 'Новости' },
    { platform: 'youtube', externalId: 'UC' + 'a'.repeat(22), name: 'Канал' },
    { platform: 'vk', externalId: '2', name: 'Группа' }
  ]);
  assert.throws(() => validateCompetitors('vk', '1', [{ platform: 'other', externalId: '2', name: 'A' }]));
  assert.throws(() => validateCompetitors('vk', '1', [{ platform: 'telegram', externalId: '123', name: 'A' }]));
  assert.throws(() => validateCompetitors('telegram', 'owner', [{ platform: 'telegram', externalId: 'Owner', name: 'Своя' }]));
  assert.deepEqual(validateCompetitors('telegram', 'owner', [{ platform: 'vk', externalId: '5', name: 'VK' }]), [{ platform: 'vk', externalId: '5', name: 'VK' }]);
  assert.deepEqual(storedCompetitors({ platform: 'vk', competitors: [{ externalId: '2', name: 'Старый' }, { platform: 'telegram', externalId: 'news', name: 'Новый' }] }), [
    { platform: 'vk', externalId: '2', name: 'Старый' },
    { platform: 'telegram', externalId: 'news', name: 'Новый' }
  ]);
});

test('рост конкурентов не подменяет неполную историю, скрытых подписчиков и нулевую базу нулями', () => {
  const points = [{ date: '2026-10-01', subscribers: 100 }, { date: '2026-10-02', subscribers: 120 }];
  assert.deepEqual(competitorGrowth(points, '2026-10-01', 130), { total: 30, percent: 30 });
  assert.deepEqual(competitorGrowth(points, '2026-09-30', 130), { total: null, percent: null });
  assert.deepEqual(competitorGrowth(points, '2026-10-01', null), { total: null, percent: null });
  assert.deepEqual(competitorGrowth([{ date: '2026-10-01', subscribers: 0 }], '2026-10-01', 10), { total: 10, percent: null });
  assert.deepEqual(competitorGrowth(points, '2026-10-01', 80), { total: -20, percent: -20 });
  assert.deepEqual(competitorGrowth(points, '2026-10-01', 100), { total: 0, percent: 0 });
});

test('сводка конкурентов: место по просмотрам среди всех, по ER только внутри одной базы, без данных — пропуск', () => {
  const wall = (views: number, er: number) => ({ isComplete: true, periodPosts: 10, views: views * 10, averageViewsPerPost: views, erAverage: er });
  const summary = summarizeCompetitorReport([
    { platform: 'vk', groupId: '1', analytics: { group: { membersCount: 1000 }, wall: wall(500, 2) }, growth: { percent: null } },
    { platform: 'vk', groupId: '2', analytics: { group: { membersCount: 1000 }, wall: wall(900, 1) }, growth: { percent: 3 } },
    { platform: 'telegram', groupId: 'news', analytics: { group: { membersCount: 1000 }, wall: wall(100, 9) }, growth: { percent: 1 } },
    { platform: 'youtube', groupId: 'UC' + 'a'.repeat(22), analytics: null, growth: { percent: null } }
  ], 'vk', '1', 'month');
  assert.deepEqual(summary.views, { place: 2, total: 3 });
  assert.deepEqual(summary.er, { place: 1, total: 2 });
  assert.equal(summary.growth, null);
});
