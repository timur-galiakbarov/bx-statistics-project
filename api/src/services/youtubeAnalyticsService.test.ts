import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeYoutubeVideos } from './youtubeAnalyticsService.js';

const period = {
  key: 'week' as const,
  dateFrom: new Date('2026-09-01T00:00:00Z'),
  dateTo: new Date('2026-09-07T23:59:59Z'),
  unixFrom: 1_756_684_800,
  unixTo: 1_757_289_599
};

const channel = {
  platform: 'youtube' as const,
  id: 'UCtest', externalId: 'UCtest', name: 'Test', description: '', url: 'https://youtube.com/channel/UCtest',
  followersCount: 1000, subscribersHidden: false, videoCount: 10, viewCount: 10_000
};

test('YouTube public metrics calculate totals, median, reactions and ER', () => {
  const summary = summarizeYoutubeVideos(channel, [
    { id: 'a', title: 'A', description: '', publishedAt: '2026-09-02T10:00:00Z', url: 'https://youtu.be/a', views: 100, likes: 10, comments: 5 },
    { id: 'b', title: 'B', description: '', publishedAt: '2026-09-03T10:00:00Z', url: 'https://youtu.be/b', views: 300, likes: 20, comments: 5 }
  ], period);
  assert.equal(summary.periodPosts, 2);
  assert.equal(summary.views, 400);
  assert.equal(summary.averageViewsPerPost, 200);
  assert.equal(summary.medianViewsPerPost, 200);
  assert.equal(summary.actions, 40);
  assert.equal(summary.averageActionsPerPost, 20);
  assert.equal(summary.erAverage, 2);
  assert.equal(summary.erMax, 2.5);
  assert.equal(summary.availability.reposts, false);
});

test('hidden subscriber and video counters remain unavailable instead of fabricated ER', () => {
  const summary = summarizeYoutubeVideos({ ...channel, followersCount: null, subscribersHidden: true }, [
    { id: 'a', title: 'A', description: '', publishedAt: '2026-09-02T10:00:00Z', url: 'https://youtu.be/a', views: 100, likes: null, comments: null }
  ], period);
  assert.equal(summary.availability.subscribers, false);
  assert.equal(summary.availability.likes, false);
  assert.equal(summary.availability.comments, false);
  assert.equal(summary.availability.er, false);
  assert.equal(summary.topPosts[0].likes, null);
  assert.equal(summary.topPosts[0].er, null);
});
