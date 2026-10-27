import { env } from '../config/env.js';
import { deepseekJson } from './deepseekClient.js';
import { RedisJsonCache } from './redisJsonCache.js';

export const placementCategories = ['news', 'overheard', 'classifieds', 'jobs', 'events', 'district', 'theme', 'business', 'official', 'other'] as const;
export type PlacementCategory = (typeof placementCategories)[number];

/** fit — how well the community suits an ad of the user's topic: 0 no, 1 maybe, 2 yes. */
export type PlacementLabel = { local: boolean; category: PlacementCategory; fit: 0 | 1 | 2 };
export type PlacementGroupText = { id: number; name: string; description?: string };
export type PlacementPlace = { cityId: number; city: string; region: string; district: string; topic: string };

const CLASSIFY_CHUNK = 60;
const MAX_TOPIC_QUERIES = 8;
const DESCRIPTION_LIMIT = 160;
// Words of region names that say nothing about the place and only add other regions to the search.
const GENERIC_REGION_WORDS = /^(республика|область|край|автономный|автономная|округ|ао|город|г\.?)$/i;

/** Region name without the generic part: «Республика Хакасия» → «Хакасия»; «Курская область» stays as is. */
export function cleanRegion(region: string) {
  const words = region.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => !GENERIC_REGION_WORDS.test(word));
  if (!meaningful.length) return '';
  // «Курская область» reads better as a query than «Курская».
  return /ская|цкая|ский/i.test(meaningful.join(' ')) && words.length > meaningful.length ? words.join(' ') : meaningful.join(' ');
}

/** Lowercase word without the ending, so «Казань» matches «Казани», «Хакасия» — «Хакасии». */
export function stem(word: string) {
  const lower = word.toLowerCase().replace(/ё/g, 'е');
  const cut = lower.replace(/(ская|ский|ское|цкая|цкий|ия|ья|ь|а|я|ы|и|о|е|й)$/u, '');
  return cut.length >= 4 ? cut : lower;
}

export function placeStems(place: Pick<PlacementPlace, 'city' | 'region' | 'district'>) {
  const words = [place.city, cleanRegion(place.region), place.district].join(' ').split(/[\s-]+/).filter((word) => word.length >= 4);
  return [...new Set(words.map(stem))];
}

// \b in JS regexps knows only Latin letters, so whole short words are matched with Unicode letter boundaries.
const word = (value: string) => `(?<!\\p{L})${value}(?!\\p{L})`;
const rule = (pattern: string) => new RegExp(pattern, 'u');
const categoryRules: Array<[PlacementCategory, RegExp]> = [
  ['official', rule(`администрац|правительств|министерств|управлени[ея]|депутат|мэри[яи]|госуслуг|глава (города|района)`)],
  ['jobs', rule(`работа|ваканси|подработк`)],
  ['classifieds', rule(`барахолк|объявлени|авторынок|продам|куплю|отдам даром`)],
  ['events', rule(`афиша|куда пойти|мероприяти|концерт`)],
  ['district', rule(`микрорайон|район|${word('жк')}|посел|поселок|${word('село')}|деревн`)],
  ['overheard', rule(`подслушано|типичн|нетипичн|интересн|настоящ|уютн`)],
  ['news', rule(`новост|${word('чп')}|дтп|инцидент|происшеств|жесть|сводк|${word('сми')}|вести|${word('тв')}|онлайн|live`)],
  ['business', rule(`салон|магазин|студи|${word('ооо')}|компани|доставк|ресторан|кафе`)]
];

/** Fallback when DeepSeek is off or failed: the place in the name or description and keyword categories. */
export function ruleLabel(group: PlacementGroupText, place: PlacementPlace): PlacementLabel {
  const name = group.name.toLowerCase().replace(/ё/g, 'е');
  const text = `${name} ${(group.description ?? '').toLowerCase().replace(/ё/g, 'е')}`;
  const local = placeStems(place).some((item) => text.includes(item));
  // The name decides the category first: descriptions of city publics often mention the administration or districts.
  const byName = categoryRules.find(([, pattern]) => pattern.test(name))?.[0];
  const category = byName ?? categoryRules.find(([, pattern]) => pattern.test(text))?.[0] ?? (local ? 'other' : 'theme');
  if (!place.topic.trim()) return { local, category, fit: local ? 2 : 0 };
  const topicHit = place.topic.split(/\s+/).filter((word) => word.length >= 4).some((word) => text.includes(stem(word)));
  return { local, category, fit: !local ? 0 : topicHit ? 2 : 1 };
}

/** Queries proposed by the model: short unique strings only. */
export function sanitizeQueries(data: unknown): string[] {
  const list = (data as { queries?: unknown } | null)?.queries;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const query = item.trim().replace(/\s+/g, ' ');
    const key = query.toLowerCase();
    if (query.length < 2 || query.length > 40 || seen.has(key)) continue;
    seen.add(key);
    result.push(query);
    if (result.length === MAX_TOPIC_QUERIES) break;
  }
  return result;
}

/** Model labels for the asked ids; anything malformed is dropped and falls back to the rules. */
export function parseLabels(data: unknown, ids: number[]): Map<number, PlacementLabel> {
  const asked = new Set(ids);
  const labels = new Map<number, PlacementLabel>();
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return labels;
  for (const item of items as Array<Record<string, unknown>>) {
    const id = Number(item?.id);
    if (!asked.has(id) || typeof item.local !== 'boolean') continue;
    const category = placementCategories.includes(item.category as PlacementCategory) ? item.category as PlacementCategory : 'other';
    const fit = Math.max(0, Math.min(2, Math.round(Number(item.fit)))) as 0 | 1 | 2;
    labels.set(id, { local: item.local, category, fit: Number.isFinite(fit) ? fit : 0 });
  }
  return labels;
}

const EXPAND_PROMPT = 'Ты помогаешь подобрать сообщества ВКонтакте для рекламы местного бизнеса. По городу и теме бизнеса предложи '
  + 'до 8 коротких поисковых запросов (1-2 слова) для поиска сообществ, где сидит целевая аудитория: не конкуренты, '
  + 'а площадки (жилые комплексы, районы, ремонт, мамы и т.п.). Ответ JSON: {"queries": ["..."]}';
const CLASSIFY_PROMPT = 'Ты оцениваешь сообщества ВКонтакте как рекламные площадки для города. Для каждого сообщества по id верни: '
  + 'local — true, если аудитория в основном из этого города или региона (городской/районный паблик, местные новости, '
  + 'барахолка, местная работа); false — если это федеральное или тематическое сообщество без привязки к месту; '
  + 'category — одно из: news (новости, ЧП, инциденты), overheard (подслушано, типичный, интересный), classifieds '
  + '(барахолка, объявления, авторынок), jobs (работа), events (афиша, куда пойти), district (район, ЖК, посёлок), '
  + 'theme (тематическое), business (страница компании), official (органы власти), other; '
  + 'fit — 0-2, насколько подходит для рекламы темы пользователя (если темы нет — 2 для local, 0 для остальных). '
  + 'Ответ JSON: {"items": [{"id": 1, "local": true, "category": "news", "fit": 2}]}';

function placeLine(place: PlacementPlace) {
  return `Город: ${place.city}${place.region ? ` (${place.region})` : ''}${place.district ? `, район: ${place.district}` : ''}. Тема: ${place.topic.trim() || 'нет'}.`;
}

export type AiUsage = { calls: number; tokens: number; ms: number; failed: number };

/** Topic → queries where the audience sits. Throws when DeepSeek fails; the search goes on without them. */
export async function expandTopic(place: PlacementPlace, usage: AiUsage) {
  usage.calls += 1;
  try {
    const answer = await deepseekJson(EXPAND_PROMPT, placeLine(place));
    usage.tokens += answer.tokens;
    usage.ms += answer.ms;
    return sanitizeQueries(answer.data);
  } catch (error) {
    usage.failed += 1;
    throw error;
  }
}

const labelCache = new RedisJsonCache<PlacementLabel>('socstat:placements:label', env.placementLabelCacheTtlMs);

function labelKey(place: PlacementPlace, id: number) {
  return `${place.cityId}|${place.district.trim().toLowerCase()}|${place.topic.trim().toLowerCase()}|${id}`;
}

/**
 * Labels for every group: cached ones, then DeepSeek in parallel chunks, then the rules for whatever is left.
 * aiUsed is false when any group had to be labelled by the rules.
 */
export async function classifyGroups(place: PlacementPlace, groups: PlacementGroupText[], useAi: boolean, usage: AiUsage) {
  const labels = new Map<number, PlacementLabel>();
  await Promise.all(groups.map(async (group) => {
    const cached = await labelCache.get(labelKey(place, group.id));
    if (cached) labels.set(group.id, cached);
  }));
  const missing = groups.filter((group) => !labels.has(group.id));
  let aiUsed = true;
  if (missing.length && useAi) {
    const chunks: PlacementGroupText[][] = [];
    for (let index = 0; index < missing.length; index += CLASSIFY_CHUNK) chunks.push(missing.slice(index, index + CLASSIFY_CHUNK));
    await Promise.all(chunks.map(async (chunk) => {
      usage.calls += 1;
      try {
        const lines = chunk.map((group) => `${group.id}: ${group.name.slice(0, 80)} — ${(group.description ?? '').replace(/\s+/g, ' ').slice(0, DESCRIPTION_LIMIT)}`).join('\n');
        const answer = await deepseekJson(CLASSIFY_PROMPT, `${placeLine(place)}\n${lines}`);
        usage.tokens += answer.tokens;
        usage.ms += answer.ms;
        for (const [id, label] of parseLabels(answer.data, chunk.map((group) => group.id))) {
          labels.set(id, label);
          void labelCache.set(labelKey(place, id), label);
        }
      } catch (error) {
        usage.failed += 1;
        console.error('DeepSeek classification failed', error instanceof Error ? error.message : error);
      }
    }));
  }
  for (const group of groups) {
    if (labels.has(group.id)) continue;
    aiUsed = false;
    labels.set(group.id, ruleLabel(group, place));
  }
  return { labels, aiUsed };
}
