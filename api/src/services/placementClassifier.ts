import { deepseekJson } from './deepseekClient.js';

// DeepSeek in the placement search: understands the brief, prefilters communities by name and judges the
// shortlist by their posts. Every answer is validated; whatever is missing falls back to the rules below.

export type AdvertiserType = 'business' | 'community';
/** topic — about the audience's interests; city — a general city public that suits any local business. */
export type PlacementKind = 'topic' | 'city';

export type PlacementPlan = {
  type: AdvertiserType;
  local: boolean;
  city: string | null;
  audience: string;
  queries: string[];
  competitors: string[];
};

export type PlacementPrefilter = { fit: 0 | 1 | 2; competitor: boolean };
export type PlacementVerdict = { fit: 0 | 1 | 2; kind: PlacementKind | 'none'; reason: string; advertisers: string; competitor: boolean };

export type PlacementGroupText = { id: number; name: string; description?: string };
export type PlacementGroupPosts = PlacementGroupText & { members: number; posts: string[]; ads: string[] };

export type AiUsage = { calls: number; tokens: number; ms: number; failed: number };

const MAX_QUERIES = 16;
const PREFILTER_CHUNK = 60;
const JUDGE_CHUNK = 5;
const DESCRIPTION_LIMIT = 140;
const POST_LIMIT = 180;

const RULES = 'Правила: площадка — это медиа, где можно купить рекламный пост: паблик, новости, афиша, подслушано, сообщество по интересам, блог, барахолка. '
  + 'Страница компании, магазина, бара, кафе, клуба, студии, салона, мастера, застройщика — не площадка: fit 0, даже если аудитория похожа. '
  + 'Если рекламодатель — сообщество (type=community), похожие сообщества на ту же тему — лучшие площадки: fit 2, competitor false. '
  + 'Если рекламодатель — бизнес, competitor true для страниц, которые продают то же самое. ';

const PLAN_PROMPT = 'Пользователь хочет купить рекламу в сообществах ВКонтакте. По его описанию определи:\n'
  + 'type — "business", если рекламируется бизнес (товар, услуга, заведение); "community", если рекламируется своё сообщество, блог или канал ради подписчиков.\n'
  + 'local — true, если бизнес работает в конкретном городе и клиенты только оттуда (кафе, сервис, магазин); '
  + 'false — если продукт не привязан к месту (онлайн-сообщество, блог, онлайн-школа, доставка по стране).\n'
  + 'city — город, если local=true (как в описании; если не указан — null).\n'
  + 'audience — одним предложением: кто целевая аудитория.\n'
  + 'queries — 12-16 коротких запросов (1-3 слова) для поиска сообществ ВКонтакте, где сидит эта аудитория. '
  + 'Не сам продукт и не конкуренты, а сообщества по интересам аудитории. Без названия города — фильтр по городу задаётся отдельно. '
  + 'Для type=community включи 3-5 запросов про саму тему сообщества: похожие сообщества — лучшие площадки.\n'
  + 'competitors — только для type=business: 2-4 слова, по которым узнаются конкуренты; для community — пустой список.\n'
  + 'Ответ JSON: {"type": "business", "local": true, "city": "...", "audience": "...", "queries": [], "competitors": []}';

const PREFILTER_PROMPT = `${RULES}Ты отбираешь сообщества ВКонтакте для рекламы. Дано описание рекламодателя, его аудитория и список сообществ `
  + '(id: название — описание). Для каждого верни fit: 2 — аудитория явно совпадает с целевой, 1 — может подойти, '
  + '0 — не подходит; competitor: true, если это конкурент рекламодателя. '
  + 'Ответ JSON: {"items": [{"id": 1, "fit": 2, "competitor": false}]}';

const JUDGE_PROMPT = `${RULES}Ты эксперт по закупке рекламы во ВКонтакте. Дано описание рекламодателя и его аудитории, затем сообщества: `
  + 'название, подписчики, последние обычные посты и рекламные посты. По содержанию постов для каждого сообщества верни:\n'
  + 'fit — 2: аудитория явно совпадает с целевой; 1: может подойти; 0: не подходит;\n'
  + 'kind — "topic", если сообщество про интересы аудитории; "city", если это общегородской паблик (новости, подслушано, афиша), '
  + 'подходящий любому местному бизнесу; "none" — не подходит;\n'
  + 'reason — до 90 символов, почему подходит или нет, по содержанию постов;\n'
  + 'advertisers — до 80 символов: кто рекламируется в рекламных постах (типы бизнеса); пустая строка, если рекламных постов нет;\n'
  + 'competitor — true, если сообщество само продаёт то же, что рекламодатель.\n'
  + 'Ответ JSON: {"items": [{"id": 1, "fit": 2, "kind": "topic", "reason": "...", "advertisers": "...", "competitor": false}]}';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const fitOf = (value: unknown) => {
  const fit = Math.round(Number(value));
  return (Number.isFinite(fit) ? Math.max(0, Math.min(2, fit)) : 0) as 0 | 1 | 2;
};

function uniqueStrings(list: unknown, limit: number, maxLength: number) {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const value = clean(item, 1000);
    if (value.length < 2 || value.length > maxLength || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    result.push(value);
    if (result.length === limit) break;
  }
  return result;
}

/** The model's reading of the brief; null when it is unusable and the rules take over. */
export function parsePlan(data: unknown): PlacementPlan | null {
  const raw = data as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return null;
  const queries = uniqueStrings(raw.queries, MAX_QUERIES, 40);
  if (!queries.length) return null;
  const type: AdvertiserType = raw.type === 'community' ? 'community' : 'business';
  const local = raw.local === true;
  return {
    type,
    local,
    city: local ? clean(raw.city, 60) || null : null,
    audience: clean(raw.audience, 200),
    queries,
    // Similar communities are the best placements for a community, so it has no competitors.
    competitors: type === 'business' ? uniqueStrings(raw.competitors, 4, 40) : []
  };
}

/** Without the model: the brief itself is the query; a chosen city makes it a local business. */
export function fallbackPlan(brief: string, hasCity: boolean): PlacementPlan {
  const words = brief.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((item) => item.length >= 4);
  return {
    type: hasCity ? 'business' : 'community',
    local: hasCity,
    city: null,
    audience: '',
    queries: uniqueStrings([brief.slice(0, 40), ...words], 6, 40),
    competitors: []
  };
}

export function parsePrefilter(data: unknown, ids: number[]): Map<number, PlacementPrefilter> {
  const asked = new Set(ids);
  const result = new Map<number, PlacementPrefilter>();
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return result;
  for (const item of items as Array<Record<string, unknown>>) {
    const id = Number(item?.id);
    if (!asked.has(id) || item.fit === undefined) continue;
    result.set(id, { fit: fitOf(item.fit), competitor: item.competitor === true });
  }
  return result;
}

export function parseVerdicts(data: unknown, ids: number[]): Map<number, PlacementVerdict> {
  const asked = new Set(ids);
  const result = new Map<number, PlacementVerdict>();
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return result;
  for (const item of items as Array<Record<string, unknown>>) {
    const id = Number(item?.id);
    if (!asked.has(id) || item.fit === undefined) continue;
    result.set(id, {
      fit: fitOf(item.fit),
      kind: item.kind === 'topic' || item.kind === 'city' ? item.kind : 'none',
      reason: clean(item.reason, 120),
      advertisers: clean(item.advertisers, 100),
      competitor: item.competitor === true
    });
  }
  return result;
}

function header(brief: string, plan: PlacementPlan, city: string | null) {
  return `Рекламодатель: ${brief}\nТип: ${plan.type}\nАудитория: ${plan.audience || 'не указана'}\nГород: ${city ?? 'не важен'}`;
}

async function ask(system: string, user: string, usage: AiUsage) {
  usage.calls += 1;
  try {
    const answer = await deepseekJson(system, user);
    usage.tokens += answer.tokens;
    usage.ms += answer.ms;
    return answer.data;
  } catch (error) {
    usage.failed += 1;
    console.error('DeepSeek request failed', error instanceof Error ? error.message : error);
    return null;
  }
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/** Runs the requests no more than `limit` at a time. */
export async function inParallel<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function planBrief(brief: string, usage: AiUsage) {
  return parsePlan(await ask(PLAN_PROMPT, brief, usage));
}

/** Labels by name and description; communities the model skipped get no label. */
export async function prefilterGroups(brief: string, plan: PlacementPlan, city: string | null, groups: PlacementGroupText[], usage: AiUsage) {
  const labels = new Map<number, PlacementPrefilter>();
  await inParallel(chunks(groups, PREFILTER_CHUNK), 5, async (chunk) => {
    const lines = chunk.map((group) => `${group.id}: ${group.name.slice(0, 80)} — ${(group.description ?? '').replace(/\s+/g, ' ').slice(0, DESCRIPTION_LIMIT)}`).join('\n');
    const answer = await ask(PREFILTER_PROMPT, `${header(brief, plan, city)}\n${lines}`, usage);
    for (const [id, label] of parsePrefilter(answer, chunk.map((group) => group.id))) labels.set(id, label);
  });
  return labels;
}

/** Verdicts by the latest posts and ad posts: fit, kind, reason and who advertises there. */
export async function judgeGroups(brief: string, plan: PlacementPlan, city: string | null, groups: PlacementGroupPosts[], usage: AiUsage) {
  const verdicts = new Map<number, PlacementVerdict>();
  await inParallel(chunks(groups, JUDGE_CHUNK), 8, async (chunk) => {
    const blocks = chunk.map((group) => `### ${group.id}: ${group.name.slice(0, 80)} (${group.members} подписчиков)\n`
      + `Посты: ${group.posts.map((text) => text.slice(0, POST_LIMIT)).join(' | ') || 'нет'}\n`
      + `Реклама: ${group.ads.map((text) => text.slice(0, POST_LIMIT)).join(' | ') || 'нет'}`).join('\n\n');
    const answer = await ask(JUDGE_PROMPT, `${header(brief, plan, city)}\n\n${blocks}`, usage);
    for (const [id, verdict] of parseVerdicts(answer, chunk.map((group) => group.id))) verdicts.set(id, verdict);
  });
  return verdicts;
}

// --- Rules for whatever the model did not label ---

/** Lowercase word without the ending, so «Казань» matches «Казани», «Хакасия» — «Хакасии». */
export function stem(value: string) {
  const lower = value.toLowerCase().replace(/ё/g, 'е');
  const cut = lower.replace(/(ская|ский|ское|цкая|цкий|ия|ья|ь|а|я|ы|и|о|е|й)$/u, '');
  return cut.length >= 4 ? cut : lower;
}

// \b in JS regexps knows only Latin letters, so whole short words are matched with Unicode letter boundaries.
const word = (value: string) => `(?<!\\p{L})${value}(?!\\p{L})`;
const BUSINESS_PAGE = new RegExp(`салон|магазин|студи|${word('ооо')}|${word('ип')}|компани|под ключ|на заказ|доставк|ресторан|кафе|${word('бар')}|клуб|мастер`, 'u');

/** Fallback verdict: a company page is not a placement; in a city the name or description must mention it. */
export function ruleVerdict(group: PlacementGroupText, source: PlacementKind, cityStems: string[]): PlacementVerdict {
  const name = group.name.toLowerCase().replace(/ё/g, 'е');
  const text = `${name} ${(group.description ?? '').toLowerCase().replace(/ё/g, 'е')}`;
  const local = !cityStems.length || cityStems.some((item) => text.includes(item));
  const fit = BUSINESS_PAGE.test(name) || !local ? 0 : 1;
  return { fit, kind: fit ? source : 'none', reason: '', advertisers: '', competitor: false };
}
