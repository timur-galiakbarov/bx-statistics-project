import assert from 'node:assert/strict';
import test from 'node:test';
import { toAnalyticsPreview } from './analyticsPreview.js';
import type { CommunityAnalyticsResult } from './analyticsService.js';

function post(id: number, contentType: string, er: number, isAd = false) {
  return { id, date: '2026-10-01T10:00:00.000Z', text: `post ${id}`, url: `https://vk.com/wall-1_${id}`, likes: 10, reposts: 2, comments: 3, views: 500, er, isAd, media: [], contentType };
}

function wall(overrides: Partial<CommunityAnalyticsResult['wall']> = {}) {
  return {
    totalPosts: 100, periodPosts: 4, actions: 60, likes: 40, reposts: 8, comments: 12, views: 2000,
    averageActionsPerPost: 15, averageActionsPerDay: 8.6, averagePostsPerDay: 0.6, averageViewsPerPost: 500,
    maxViews: 800, minViews: 200, adsPosts: 1, erAverage: 1.5, erMax: 3,
    dayGroups: [{ date: '01.10.2026', dayIndex: 0, posts: 2, likes: 20, reposts: 4, comments: 6, actions: 30, views: 1000, er: 1.5, averageViews: 500, averageActionsPerPost: 15 }],
    topPosts: [post(1, 'Фото', 3), post(2, 'Фото', 2), post(3, 'Фото', 1.5), post(4, 'Видео', 1, true)],
    isComplete: true,
    ...overrides
  };
}

const analytics = {
  period: { key: 'week', dateFrom: '2026-10-01', dateTo: '2026-10-07' },
  group: { id: 1, name: 'Группа', screenName: 'group', description: '', photo: '', membersCount: 1000, isManagedByCurrentUser: false },
  stats: { unavailable: false, growth: 5, subscribed: 9, unsubscribed: 4, visitors: 300, views: 900, reach: 4000, reachSubscribers: 2000, dayGroups: [{ date: '01.10.2026', dayIndex: 0, reach: 4000 }] },
  wall: wall(),
  previous: {
    period: { dateFrom: '2026-09-24', dateTo: '2026-09-30' },
    stats: { growth: 1, visitors: 200, reach: 3000, dayGroups: [] },
    wall: { ...wall({ periodPosts: 3, erAverage: 2, averageViewsPerPost: 400 }), available: true }
  },
  photos: { total: 10, period: 2, likes: 5, reposts: 1, comments: 2, views: 0 },
  videos: { total: 3, period: 1, likes: 4, reposts: 0, comments: 1, views: 90 },
  warnings: []
} as unknown as CommunityAnalyticsResult;

test('preview hides closed metrics and keeps open ones', () => {
  const preview = toAnalyticsPreview(analytics);
  const json = JSON.stringify({ ...preview, wall: { ...preview.wall, topPosts: [] } });

  assert.equal(preview.group.membersCount, 1000);
  assert.equal(preview.wall.periodPosts, 4);
  assert.equal(preview.previous.wall.periodPosts, 3);
  assert.equal(preview.stats.reach, 0);
  assert.equal(preview.stats.visitors, 0);
  assert.equal(preview.wall.erAverage, 0);
  assert.equal(preview.wall.averageViewsPerPost, 0);
  assert.equal(preview.previous.stats, null);
  assert.equal(preview.wall.dayGroups[0].posts, 2);
  assert.equal(preview.wall.dayGroups[0].views, 0);
  assert.equal(preview.wall.dayGroups[0].er, null);
  assert.ok(!json.includes('4000') && !json.includes('"erAverage":1.5'));
});

test('preview keeps only the best post', () => {
  const preview = toAnalyticsPreview(analytics);
  assert.deepEqual(preview.wall.topPosts.map((item) => item.id), [1]);
  assert.equal(preview.preview.hiddenPosts, 3);
});

test('preview keeps official VK growth but hides snapshot numbers', () => {
  const preview = toAnalyticsPreview(analytics, { total: 42, since: '2026-10-01', historySince: '2026-09-01' });
  assert.equal(preview.stats.growth, 5);
  assert.deepEqual(preview.preview.snapshotGrowth, { total: null, since: '2026-10-01', historySince: '2026-09-01', locked: true, direction: 'up' });
});

test('preview insights carry directions without numbers', () => {
  const titles = toAnalyticsPreview(analytics).preview.insights.map((insight) => insight.title);
  assert.deepEqual(titles, ['ER снизился', 'Средние просмотры поста выросли', 'Фото — сильный формат', 'В ленте есть рекламные публикации']);
  assert.ok(titles.every((title) => !/\d/.test(title)));
});
