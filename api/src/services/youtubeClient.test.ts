import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import { getYoutubeVideos, normalizeYoutubeChannelInput, resolveYoutubeChannel, YoutubeApiError } from './youtubeClient.js';

test('normalizeYoutubeChannelInput supports channel URLs, handles and ids', () => {
  assert.deepEqual(normalizeYoutubeChannelInput('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'), { kind: 'channelId', value: 'UCabcdefghijklmnopqrstuv' });
  assert.deepEqual(normalizeYoutubeChannelInput('youtube.com/@socstat'), { kind: 'handle', value: 'socstat' });
  assert.deepEqual(normalizeYoutubeChannelInput('@socstat'), { kind: 'handle', value: 'socstat' });
  assert.deepEqual(normalizeYoutubeChannelInput('UCabcdefghijklmnopqrstuv'), { kind: 'channelId', value: 'UCabcdefghijklmnopqrstuv' });
});

test('resolveYoutubeChannel uses channels.forHandle without search fallback', async () => {
  const previousKey = env.youtubeApiKey;
  env.youtubeApiKey = 'server-secret';
  const previousFetch = globalThis.fetch;
  const calls: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    return new Response(JSON.stringify({ items: [{ id: 'UC_handle_test_1234567890', snippet: { title: 'Socstat', customUrl: '@socstat' }, statistics: { subscriberCount: '1200', viewCount: '45000', videoCount: '12' }, contentDetails: { relatedPlaylists: { uploads: 'UU_handle_test' } } }] }), { status: 200 });
  };
  try {
    const channel = await resolveYoutubeChannel('@socstat-test-handle', true);
    assert.equal(channel.name, 'Socstat');
    assert.equal(channel.followersCount, 1200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].searchParams.get('forHandle'), 'socstat-test-handle');
    assert.equal(calls[0].searchParams.get('key'), 'server-secret');
  } finally {
    globalThis.fetch = previousFetch;
    env.youtubeApiKey = previousKey;
  }
});

test('getYoutubeVideos paginates uploads and batches videos.list at 50 ids', async () => {
  const previousKey = env.youtubeApiKey;
  env.youtubeApiKey = 'server-secret';
  const previousFetch = globalThis.fetch;
  const videoBatchSizes: number[] = [];
  const ids = Array.from({ length: 51 }, (_, index) => `video-${index + 1}`);
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/playlistItems')) {
      const second = url.searchParams.get('pageToken') === 'next';
      const pageIds = second ? ids.slice(50) : ids.slice(0, 50);
      return new Response(JSON.stringify({ items: pageIds.map((id) => ({ contentDetails: { videoId: id, videoPublishedAt: '2026-09-10T10:00:00Z' } })), ...(second ? {} : { nextPageToken: 'next' }) }), { status: 200 });
    }
    const batch = url.searchParams.get('id')!.split(',');
    videoBatchSizes.push(batch.length);
    return new Response(JSON.stringify({ items: batch.map((id) => ({ id, snippet: { title: id, publishedAt: '2026-09-10T10:00:00Z' }, statistics: { viewCount: '10', likeCount: '2' }, contentDetails: { duration: 'PT1M' } })) }), { status: 200 });
  };
  try {
    const videos = await getYoutubeVideos({ platform: 'youtube', id: 'UCx', externalId: 'UCx', name: 'Test', description: '', url: 'https://youtube.com/channel/UCx', followersCount: 1, subscribersHidden: false, videoCount: 51, viewCount: 510, uploadsPlaylistId: 'UUx' }, new Date('2026-09-01'), new Date('2026-09-13T23:59:59Z'), true);
    assert.equal(videos.length, 51);
    assert.deepEqual(videoBatchSizes, [50, 1]);
    assert.equal(videos[0].comments, null);
  } finally {
    globalThis.fetch = previousFetch;
    env.youtubeApiKey = previousKey;
  }
});

test('missing API key returns a clear configuration error', async () => {
  const previousKey = env.youtubeApiKey;
  env.youtubeApiKey = '';
  try {
    await assert.rejects(() => resolveYoutubeChannel('@missing-key-test', true), (error: unknown) => error instanceof YoutubeApiError && error.code === 'YOUTUBE_API_KEY_REQUIRED' && error.status === 503);
  } finally {
    env.youtubeApiKey = previousKey;
  }
});
