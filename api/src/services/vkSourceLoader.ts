import { env } from '../config/env.js';
import { DomainError } from '../errors/domainError.js';
import { getVkAccessToken } from '../repositories/accountRepository.js';
import { detectAdMarker } from './adDetection.js';
import { AD_CHECK_WINDOW_DAYS, type AdCheckPost } from './adCheckUtils.js';
import { VkApiError, vkApiRequest } from './vkClient.js';

// VK loading shared by the pre-ad check and the placement search.

export const VK_WALL_PAGE = 100;
export const POST_TEXT_LIMIT = 280;

export type VkGroup = { id: number; name: string; screen_name?: string; photo_200?: string; members_count?: number; is_closed?: number; deactivated?: string };
export type VkPost = {
  id: number;
  date: number;
  text?: string;
  is_pinned?: number;
  marked_as_ads?: number;
  attachments?: Array<{ type?: string; link?: { url?: string } }>;
  copy_history?: Array<{ text?: string; attachments?: Array<{ type?: string; link?: { url?: string } }> }>;
  likes?: { count?: number };
  reposts?: { count?: number };
  comments?: { count?: number };
  views?: { count?: number };
};

export type SourcePayload = {
  platform: 'vk' | 'telegram';
  /** Id in the snapshot base: VK group id, lowercase Telegram username. */
  externalId: string;
  name: string;
  url: string;
  photo: string | null;
  subscribers: number | null;
  /** All posts of the window are loaded; VK returns at most the last 100. */
  complete: boolean;
  loadedAt: string;
  posts: Array<AdCheckPost & { text: string; url: string }>;
};

/** The user's own token first (own quota), then the app service key. */
export async function vkRequest<T>(userId: string, method: string, params: Record<string, string | number>) {
  const userToken = await getVkAccessToken(userId);
  const tokens = [userToken, env.vkServiceKey].filter((token): token is string => Boolean(token));
  if (!tokens.length) throw new DomainError('Проверка VK временно недоступна.', { status: 503, code: 'VK_TOKEN_REQUIRED' });
  for (const [index, token] of tokens.entries()) {
    try {
      return await vkApiRequest<T>(method, token, params);
    } catch (error) {
      // An expired or limited user token: retry with the service key.
      const retry = error instanceof VkApiError && [5, 6, 29].includes(error.vkCode ?? -1) && index < tokens.length - 1;
      if (!retry) throw error;
    }
  }
  throw new DomainError('Проверка VK временно недоступна.', { status: 503, code: 'VK_TOKEN_REQUIRED' });
}

function vkLinks(attachments: VkPost['attachments']) {
  return (attachments ?? []).map((item) => item.type === 'link' ? item.link?.url : undefined).filter((url): url is string => Boolean(url));
}

/** VK group and its last wall page → the check payload. Pinned posts do not decide completeness: they can be old. */
export function mapVkSource(group: VkGroup, items: VkPost[], now: number, pageSize = VK_WALL_PAGE): SourcePayload {
  const windowStart = now / 1000 - AD_CHECK_WINDOW_DAYS * 86_400;
  const complete = items.length < pageSize || items.some((post) => !post.is_pinned && post.date < windowStart);
  const posts = items
    .filter((post) => post.date >= windowStart)
    .map((post) => {
      const repost = post.copy_history?.[0];
      const text = [post.text, repost?.text].filter(Boolean).join('\n\n');
      return {
        id: String(post.id),
        date: new Date(post.date * 1000).toISOString(),
        text: text.slice(0, POST_TEXT_LIMIT),
        url: `https://vk.com/wall-${group.id}_${post.id}`,
        views: post.views?.count ?? null,
        reactions: post.likes?.count ?? null,
        comments: post.comments?.count ?? null,
        forwards: post.reposts?.count ?? null,
        ad: detectAdMarker({ text, links: [...vkLinks(post.attachments), ...vkLinks(repost?.attachments)], markedAsAds: Boolean(post.marked_as_ads) })
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date));
  return {
    platform: 'vk',
    externalId: String(group.id),
    name: group.name,
    url: `https://vk.com/${group.screen_name ?? `club${group.id}`}`,
    photo: group.photo_200 ?? null,
    subscribers: group.members_count ?? null,
    complete,
    loadedAt: new Date(now).toISOString(),
    posts
  };
}
