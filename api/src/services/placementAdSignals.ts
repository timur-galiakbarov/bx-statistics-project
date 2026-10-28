import type { VkPost } from './vkSourceLoader.js';

// Does a community sell ads, and to whom: by its marked ad posts, posts promoting other communities, its contacts,
// description and pinned post. Only data already loaded for the row — no extra requests.

export type SellsAds = 'yes' | 'likely' | 'unknown';

export type AdSignals = {
  sellsAds: SellsAds;
  /** Why we think so, short: «6 рекламных постов за месяц», «контакт «По вопросам рекламы»». */
  sellsAdsNote: string;
  /** Posts of the window that promote another VK community: reposts from it or links with a call to subscribe. */
  promoPosts: number;
  /** A line with a price from the description or the pinned post, if the community published one. */
  priceHint: string | null;
};

type SignalGroup = { id: number; screen_name?: string; description?: string; contacts?: Array<{ desc?: string }> };

const AD_WORDS = /реклам|сотрудничеств|пиар|размещени|прайс|ads\b|promo/iu;
const PROMO_WORDS = /подпи[сш]|вступ|переход|загляни|рекоменду|взаимопиар|паблик|сообществ|группу|канал/iu;
const VK_MENTION = /\[(?:club|public)(\d+)\|/giu;
const VK_LINK = /(?:https?:\/\/)?(?:m\.)?vk\.(?:com|ru)\/([a-z0-9_.]+)/giu;
// Paths of vk.com that are not communities.
const NOT_COMMUNITY = /^(wall|video|photo|album|topic|market|app|away|feed|im|clip|clips|music|audio|doc|page|story|poll|search|friends|groups|id\d+)/iu;
const PRICE = /(?<!\d)\d{2,3}(?:[\s ]?\d{3})*(?:[.,]\d+)?\s?(?:₽|руб(?:\.|лей|ля)?|р\.|р(?!\p{L}))/iu;
const PRICE_CONTEXT = /реклам|размещ|прайс|пост|пиар|закреп|стоимост/iu;

const WINDOW_DAYS = 30;

function linkedCommunities(text: string, links: string[], self: SignalGroup) {
  const found = new Set<string>();
  for (const match of text.matchAll(VK_MENTION)) if (Number(match[1]) !== self.id) found.add(match[1]);
  for (const source of [text, ...links]) {
    for (const match of source.matchAll(VK_LINK)) {
      const name = match[1].toLowerCase().replace(/\.$/, '');
      if (NOT_COMMUNITY.test(name) || name === self.screen_name?.toLowerCase() || name === `club${self.id}` || name === `public${self.id}`) continue;
      found.add(name);
    }
  }
  return found.size;
}

/** A post promotes another community: a repost from a community, or a mention or link to one with a call to subscribe. */
export function isPromoPost(post: VkPost, self: SignalGroup) {
  const repost = post.copy_history?.[0];
  if (repost?.owner_id !== undefined && repost.owner_id < 0 && repost.owner_id !== -self.id) return true;
  const text = [post.text, repost?.text].filter(Boolean).join('\n');
  const links = [...(post.attachments ?? []), ...(repost?.attachments ?? [])].map((item) => item.link?.url ?? '').filter(Boolean);
  return linkedCommunities(text, links, self) > 0 && PROMO_WORDS.test(text);
}

/** The first line about ads with a price in it, from the description or the pinned post. */
export function findPriceHint(texts: string[]) {
  for (const text of texts) {
    for (const line of text.split(/\n|(?<=[.!?])\s+/u)) {
      const clean = line.trim().replace(/\s+/g, ' ');
      if (clean && PRICE.test(clean) && PRICE_CONTEXT.test(clean)) return clean.length > 100 ? `${clean.slice(0, 99)}…` : clean;
    }
  }
  return null;
}

const plural = (value: number, one: string, few: string, many: string) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/**
 * yes — marked ad posts in the window, or at least two posts promoting other communities;
 * likely — no ads seen, but the contacts or the description speak about advertising; unknown — nothing either way.
 */
export function adSignals(group: SignalGroup, items: VkPost[], adPosts: number, now: number): AdSignals {
  const windowStart = now / 1000 - WINDOW_DAYS * 86_400;
  const recent = items.filter((post) => post.date >= windowStart && !post.is_pinned);
  const promoPosts = recent.filter((post) => isPromoPost(post, group)).length;
  const adContact = (group.contacts ?? []).find((contact) => contact.desc && AD_WORDS.test(contact.desc))?.desc?.trim();
  const describes = AD_WORDS.test(group.description ?? '');
  const pinned = items.filter((post) => post.is_pinned).map((post) => post.text ?? '');
  const notes: string[] = [];
  if (adPosts) notes.push(`${adPosts} ${plural(adPosts, 'рекламный пост', 'рекламных поста', 'рекламных постов')} с маркировкой за месяц`);
  if (promoPosts) notes.push(`${promoPosts} ${plural(promoPosts, 'пост', 'поста', 'постов')} с продвижением сообществ`);
  if (adContact) notes.push(`контакт «${adContact.length > 40 ? `${adContact.slice(0, 39)}…` : adContact}»`);
  else if (describes) notes.push('реклама упомянута в описании');
  return {
    sellsAds: adPosts > 0 || promoPosts >= 2 ? 'yes' : adContact || describes || promoPosts ? 'likely' : 'unknown',
    sellsAdsNote: notes.join(', '),
    promoPosts,
    priceHint: findPriceHint([group.description ?? '', ...pinned])
  };
}
