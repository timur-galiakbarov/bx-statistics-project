import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnalyticsPeriod } from './analyticsUtils.js';
import { normalizeTelegramChannelInput, summarizeTelegramPosts, type TelegramChannel, type TelegramPost } from './telegramClient.js';

test('normalizeTelegramChannelInput accepts username and Telegram links', () => {
  assert.equal(normalizeTelegramChannelInput('@durov'), 'durov');
  assert.equal(normalizeTelegramChannelInput('https://t.me/durov/123'), 'durov');
  assert.equal(normalizeTelegramChannelInput('telegram.me/durov'), 'durov');
});

test('normalizeTelegramChannelInput rejects private invite links', () => {
  assert.throws(() => normalizeTelegramChannelInput('https://t.me/+secret'), /публичный username/);
});

test('summarizeTelegramPosts calculates public channel metrics', () => {
  const channel: TelegramChannel = { id: '1', username: 'durov', title: 'Test', description: '', subscribers: 1000, url: 'https://t.me/durov', verified: true, canViewAdminStats: false };
  const posts: TelegramPost[] = [
    { id: 1, date: '2026-09-01T10:00:00.000Z', timestamp: 1788256800, text: 'One', url: 'https://t.me/durov/1', views: 500, forwards: 5, reactions: 40, comments: 5, engagement: 50, mediaType: null },
    { id: 2, date: '2026-09-02T10:00:00.000Z', timestamp: 1788343200, text: 'Two', url: 'https://t.me/durov/2', views: 300, forwards: 3, reactions: 20, comments: 2, engagement: 25, mediaType: 'photo' }
  ];
  const period = getAnalyticsPeriod('custom', '2026-09-01', '2026-09-07', new Date('2026-09-10T00:00:00Z'));
  const result = summarizeTelegramPosts(channel, posts, period);
  assert.equal(result.summary.posts, 2);
  assert.equal(result.summary.views, 800);
  assert.equal(result.summary.actions, 75);
  assert.equal(result.summary.averageViews, 400);
  assert.equal(result.summary.averageReachRate, 40);
  assert.equal(result.daily.length, 7);
});
