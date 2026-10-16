/**
 * How a post was recognized as an ad:
 * - platform — VK itself marks the post as an ad (`marked_as_ads`);
 * - erid — the advertising token required by the Russian ad labelling law, in the text or a link;
 * - label — an explicit "Реклама" / "#реклама" / "на правах рекламы" / "Рекламодатель:" note.
 * Unlabelled ads are not detected, so counts are a lower bound.
 */
export type AdMarker = 'platform' | 'erid' | 'label';

// erid is a base58-like token: `erid=2VtzqvX…`, `erid: 2Vtz…`, `#erid2Vtz…`.
const ERID_PATTERN = /(?:^|[^a-z0-9])erid\s*[=:]?\s*[a-z0-9]{6,}/i;
const LABEL_PATTERNS = [
  /#реклам[аы]?(?![а-яё])/i,
  /на\s+правах\s+рекламы/i,
  /рекламодатель\s*[:—–-]/i,
  // A line that starts with "Реклама." / "Реклама:" / "Реклама |" — the usual marking line,
  // but not "реклама" inside a sentence.
  /(?:^|\n)\s*реклама\s*[.:|·•—–-]/i
];

export function detectAdMarker(post: { text?: string | null; links?: string[] | null; markedAsAds?: boolean }): AdMarker | null {
  if (post.markedAsAds) return 'platform';
  const text = post.text ?? '';
  if (ERID_PATTERN.test(text) || (post.links ?? []).some((link) => /[?&#]erid=/i.test(link) || ERID_PATTERN.test(link))) return 'erid';
  if (LABEL_PATTERNS.some((pattern) => pattern.test(text))) return 'label';
  return null;
}
