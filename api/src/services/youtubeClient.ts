import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { TtlCache } from './ttlCache.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const VIDEO_BATCH_SIZE = 50;
const PAGE_SIZE = 50;

type YoutubeList<T> = { items?: T[]; nextPageToken?: string; pageInfo?: { totalResults?: number } };
type Thumbnail = { url?: string; width?: number; height?: number };

type ChannelResource = {
  id: string;
  snippet?: { title?: string; description?: string; customUrl?: string; thumbnails?: Record<string, Thumbnail> };
  statistics?: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

type PlaylistItemResource = {
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
  snippet?: { publishedAt?: string; resourceId?: { videoId?: string } };
};

type VideoResource = {
  id: string;
  snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: Record<string, Thumbnail> };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

export type YoutubeChannel = {
  platform: 'youtube';
  externalId: string;
  id: string;
  name: string;
  description: string;
  handle?: string;
  url: string;
  photo?: string;
  followersCount: number | null;
  subscribersHidden: boolean;
  videoCount: number;
  viewCount: number;
  uploadsPlaylistId?: string;
};

export type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  url: string;
  thumbnail?: string;
  duration?: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

export class YoutubeApiError extends DomainError {
  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message, { status: options.status ?? 502, code: options.code ?? 'YOUTUBE_API_ERROR' });
    this.name = 'YoutubeApiError';
  }
}

type NormalizedYoutubeInput =
  | { kind: 'channelId'; value: string }
  | { kind: 'handle'; value: string }
  | { kind: 'search'; value: string };

export function normalizeYoutubeChannelInput(input: string): NormalizedYoutubeInput {
  let value = input.trim();
  if (!value) throw new YoutubeApiError('Укажите ссылку, @handle, ID или название YouTube-канала.', { status: 400, code: 'YOUTUBE_CHANNEL_QUERY_REQUIRED' });

  try {
    const candidate = /^https?:\/\//i.test(value) ? value : /^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(value) ? `https://${value}` : null;
    if (candidate) {
      const url = new URL(candidate);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host !== 'youtube.com' && host !== 'm.youtube.com') throw new Error('unsupported host');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'channel' && parts[1]) value = parts[1];
      else if (parts[0]?.startsWith('@')) value = parts[0];
      else if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) return { kind: 'search', value: parts[1] };
      else throw new YoutubeApiError('Ссылка не похожа на адрес YouTube-канала.', { status: 400, code: 'INVALID_YOUTUBE_CHANNEL_URL' });
    }
  } catch (error) {
    if (error instanceof YoutubeApiError) throw error;
    throw new YoutubeApiError('Некорректная ссылка YouTube.', { status: 400, code: 'INVALID_YOUTUBE_CHANNEL_URL' });
  }

  if (/^UC[\w-]{20,}$/.test(value)) return { kind: 'channelId', value };
  if (value.startsWith('@')) return { kind: 'handle', value: value.slice(1) };
  return { kind: 'search', value };
}

function numberOrNull(value?: string) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bestThumbnail(thumbnails?: Record<string, Thumbnail>) {
  return Object.values(thumbnails ?? {}).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
}

function mapChannel(item: ChannelResource): YoutubeChannel {
  const customUrl = item.snippet?.customUrl;
  const handle = customUrl?.startsWith('@') ? customUrl : undefined;
  return {
    platform: 'youtube',
    externalId: item.id,
    id: item.id,
    name: item.snippet?.title ?? item.id,
    description: item.snippet?.description ?? '',
    handle,
    url: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${item.id}`,
    photo: bestThumbnail(item.snippet?.thumbnails),
    followersCount: item.statistics?.hiddenSubscriberCount ? null : numberOrNull(item.statistics?.subscriberCount),
    subscribersHidden: Boolean(item.statistics?.hiddenSubscriberCount),
    videoCount: numberOrNull(item.statistics?.videoCount) ?? 0,
    viewCount: numberOrNull(item.statistics?.viewCount) ?? 0,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads
  };
}

const responseCache = new TtlCache<unknown>(env.youtubeCacheTtlMs);

async function request<T>(resource: string, params: Record<string, string | number | undefined>, forceRefresh = false): Promise<T> {
  if (!env.youtubeApiKey) throw new YoutubeApiError('YouTube API не настроен: задайте YOUTUBE_API_KEY на сервере.', { status: 503, code: 'YOUTUBE_API_KEY_REQUIRED' });
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value !== undefined && query.set(key, String(value)));
  query.set('key', env.youtubeApiKey);
  const cacheKey = `${resource}?${[...query.entries()].filter(([key]) => key !== 'key').sort().map(([key, value]) => `${key}=${value}`).join('&')}`;
  if (!forceRefresh) {
    const cached = responseCache.get(cacheKey) as T | undefined;
    if (cached) return cached;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.youtubeApiTimeoutMs);
  try {
    const response = await fetch(`${API_BASE}/${resource}?${query}`, { signal: controller.signal });
    const payload = await response.json() as T & { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    if (!response.ok || payload.error) {
      const reason = payload.error?.errors?.[0]?.reason;
      const code = reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' ? 'YOUTUBE_QUOTA_EXCEEDED' : response.status === 403 ? 'YOUTUBE_API_FORBIDDEN' : 'YOUTUBE_API_ERROR';
      throw new YoutubeApiError(payload.error?.message ?? 'YouTube API вернул ошибку.', { status: response.status || 502, code });
    }
    responseCache.set(cacheKey, payload);
    return payload;
  } catch (error) {
    if (error instanceof YoutubeApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new YoutubeApiError('YouTube API не ответил вовремя.', { status: 504, code: 'YOUTUBE_API_TIMEOUT' });
    throw new YoutubeApiError('Не удалось связаться с YouTube API.', { code: 'YOUTUBE_API_UNAVAILABLE' });
  } finally {
    clearTimeout(timeout);
  }
}

async function channels(params: Record<string, string>, forceRefresh = false) {
  const result = await request<YoutubeList<ChannelResource>>('channels', { part: 'snippet,statistics,contentDetails', ...params }, forceRefresh);
  return (result.items ?? []).map(mapChannel);
}

export async function resolveYoutubeChannel(input: string, forceRefresh = false): Promise<YoutubeChannel> {
  const normalized = normalizeYoutubeChannelInput(input);
  let found: YoutubeChannel[] = [];
  if (normalized.kind === 'channelId') found = await channels({ id: normalized.value }, forceRefresh);
  if (normalized.kind === 'handle') found = await channels({ forHandle: normalized.value }, forceRefresh);
  if (!found.length && normalized.kind !== 'channelId') {
    const search = await request<YoutubeList<{ snippet?: { channelId?: string } }>>('search', { part: 'snippet', type: 'channel', maxResults: 10, q: normalized.value }, forceRefresh);
    const ids = [...new Set((search.items ?? []).map((item) => item.snippet?.channelId).filter((id): id is string => Boolean(id)))];
    if (ids.length) found = await channels({ id: ids.join(',') }, forceRefresh);
  }
  if (!found.length) throw new YoutubeApiError('YouTube-канал не найден.', { status: 404, code: 'YOUTUBE_CHANNEL_NOT_FOUND' });
  return found[0];
}

export async function searchYoutubeChannels(input: string, forceRefresh = false): Promise<YoutubeChannel[]> {
  const normalized = normalizeYoutubeChannelInput(input);
  if (normalized.kind !== 'search') return [await resolveYoutubeChannel(input, forceRefresh)];
  const search = await request<YoutubeList<{ snippet?: { channelId?: string } }>>('search', { part: 'snippet', type: 'channel', maxResults: 10, q: normalized.value }, forceRefresh);
  const ids = [...new Set((search.items ?? []).map((item) => item.snippet?.channelId).filter((id): id is string => Boolean(id)))];
  return ids.length ? channels({ id: ids.join(',') }, forceRefresh) : [];
}

export async function getYoutubeVideos(channel: YoutubeChannel, publishedAfter: Date, publishedBefore: Date, forceRefresh = false): Promise<YoutubeVideo[]> {
  if (!channel.uploadsPlaylistId) return [];
  const ids: string[] = [];
  let pageToken: string | undefined;
  let reachedOlderVideos = false;
  do {
    const page = await request<YoutubeList<PlaylistItemResource>>('playlistItems', {
      part: 'contentDetails,snippet', playlistId: channel.uploadsPlaylistId, maxResults: PAGE_SIZE, pageToken
    }, forceRefresh);
    for (const item of page.items ?? []) {
      const publishedAt = item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt;
      const id = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      if (!publishedAt || !id) continue;
      const date = new Date(publishedAt);
      if (date < publishedAfter) reachedOlderVideos = true;
      if (date >= publishedAfter && date <= publishedBefore) ids.push(id);
    }
    pageToken = page.nextPageToken;
  } while (pageToken && !reachedOlderVideos);

  const videos: YoutubeVideo[] = [];
  for (let offset = 0; offset < ids.length; offset += VIDEO_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + VIDEO_BATCH_SIZE);
    const result = await request<YoutubeList<VideoResource>>('videos', { part: 'snippet,statistics,contentDetails', id: batch.join(',') }, forceRefresh);
    for (const item of result.items ?? []) {
      const publishedAt = item.snippet?.publishedAt;
      if (!publishedAt) continue;
      videos.push({
        id: item.id,
        title: item.snippet?.title ?? 'Видео без названия',
        description: item.snippet?.description ?? '',
        publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail: bestThumbnail(item.snippet?.thumbnails),
        duration: item.contentDetails?.duration,
        views: numberOrNull(item.statistics?.viewCount),
        likes: numberOrNull(item.statistics?.likeCount),
        comments: numberOrNull(item.statistics?.commentCount)
      });
    }
  }
  return videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}
