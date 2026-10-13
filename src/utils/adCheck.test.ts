import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PostViewCurves } from '../api/types';
import { adSample, communityAdPosts, costPerThousand, maturePostStats, positiveAmount, publicationDay, quantile } from './adCheck';

const curves = (values: Array<number | null>): PostViewCurves => ({
  days: 90, snapshotPosts: values.length, curve: [], milestones: [],
  posts: values.map((value, index) => ({ postId: String(index), publishedAt: '2026-10-01T12:00:00Z', latestViews: value, latestHours: 72, milestones: { '24': value, '48': value, '72': value } }))
});

test('median and interpolated quartiles resist a single viral publication', () => {
  const values = [100, 200, 300, 400, 100_000];
  assert.equal(quantile(values, 0.5), 300);
  assert.equal(quantile(values, 0.25), 200);
  assert.equal(quantile(values, 0.75), 400);
  assert.equal(quantile([100, 200, 300, 400], 0.5), 250);
  assert.equal(quantile([NaN, Infinity, -1], 0.5), null);
});

test('missing snapshots do not become zeros and small samples do not yield a forecast', () => {
  assert.equal(adSample(curves([100, 200, null]), '2026-10-01', '2026-10-02', 48).median, null);
  const sample = adSample(curves([0, 100, 200, null]), '2026-10-01', '2026-10-02', 48);
  assert.equal(sample.count, 3);
  assert.equal(sample.median, 100);
  assert.equal(sample.lower, 50);
  assert.equal(sample.upper, 150);
  assert.equal(adSample(curves([0, 0, 0]), '2026-10-01', '2026-10-02', 48).median, 0);
});

test('each milestone has its own eligible sample and filters publications by Moscow date', () => {
  const data = curves([100, 200, 300]);
  data.posts[0].milestones['72'] = null;
  assert.equal(adSample(data, '2026-10-01', '2026-10-02', 72).sufficient, false);
  assert.equal(adSample(data, '2026-10-02', '2026-10-03', 48).count, 0);
  assert.equal(publicationDay('2026-09-30T22:30:00Z'), '2026-10-01');
  assert.equal(publicationDay('invalid'), '');
  data.posts.forEach((post) => { post.publishedAt = '2026-09-30T22:30:00Z'; });
  assert.equal(adSample(data, '2026-10-01', '2026-10-01', 48).count, 3);
  assert.equal(adSample(null, '2026-10-01', '2026-10-02', 48).count, 0);
});

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

test('context excludes young posts and unknown views, weights ER by views', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const posts = [
    { id: 1, date: '2026-10-01T12:00:00Z', views: 100, actions: 10 },
    { id: 2, date: '2026-10-02T12:00:00Z', views: 900, actions: 10 },
    { id: 3, date: '2026-10-07T12:00:00Z', views: 0, actions: 0 },
    { id: 4, date: '2026-10-10T11:00:00Z', views: 1_000_000, actions: 100 },
    { id: 5, date: '2026-10-01T12:00:00Z', views: null, actions: 10 }
  ];
  const stats = maturePostStats(posts, now);
  assert.deepEqual(stats, { count: 3, median: 100, engagement: 2 });
  assert.equal(maturePostStats([{ ...posts[0], actions: null }], now).engagement, null);
  assert.equal(maturePostStats([{ ...posts[0], views: 0 }], now).engagement, null);
  assert.equal(maturePostStats([], now).median, null);
});

test('community context preserves unavailable counters instead of converting them to zeros', () => {
  const post = { id: 1, date: '2026-10-01T12:00:00Z', text: '', url: '', views: 100, likes: 10, comments: 2, reposts: 1, media: [], er: 1, isAd: false, contentType: 'Текст' };
  const wall = { topPosts: [post], availability: { views: false, likes: true, comments: true, reposts: false } };
  assert.equal(communityAdPosts({ platform: 'vk', wall })[0].views, null);
  assert.equal(communityAdPosts({ platform: 'vk', wall })[0].actions, null);
  assert.equal(communityAdPosts({ platform: 'youtube', wall })[0].actions, 12);
});

test('YouTube context counts likes and comments without requiring reposts', () => {
  const post = { id: 1, date: '2026-10-01T12:00:00Z', text: '', url: '', views: 100, likes: 10, comments: 2 as number | null, reposts: null };
  const wall = { topPosts: [post] };
  assert.equal(communityAdPosts({ platform: 'youtube', wall })[0].actions, 12);
  assert.equal(communityAdPosts({ platform: 'vk', wall })[0].actions, null);
  post.comments = null;
  assert.equal(communityAdPosts({ platform: 'youtube', wall })[0].actions, null);
});
