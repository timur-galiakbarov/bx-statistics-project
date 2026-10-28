import assert from 'node:assert/strict';
import test from 'node:test';
import { wellFormed } from './deepseekClient.js';
import { fallbackPlan, parsePlan, parsePrefilter, parseVerdicts, ruleVerdict, stem, type PlacementPlan } from './placementClassifier.js';
import { buildQueries, buildRow, extractGroupRef, lockRows, pickShortlist, postTexts, sizeRangeFor, sortRows, type PlacementRow } from './placementSearchService.js';
import { parseSearchLabel } from './placementStatsService.js';

const now = new Date('2026-10-28T12:00:00Z').getTime();
const plan = (overrides: Partial<PlacementPlan> = {}): PlacementPlan => ({ type: 'business', local: true, city: 'Уфа', audience: '', queries: ['автолюбители', 'шины'], competitors: [], ...overrides });
const ufa = { id: 151, title: 'Уфа', region: 'Республика Башкортостан', area: '' };

test('задача от модели: тип, город и запросы проверяются, у сообщества нет конкурентов', () => {
  assert.deepEqual(parsePlan({ type: 'business', local: true, city: 'Уфа', audience: 'Автомобилисты', queries: ['шины', ' шины ', 'x', 'автоновости'], competitors: ['шиномонтаж'] }),
    { type: 'business', local: true, city: 'Уфа', audience: 'Автомобилисты', queries: ['шины', 'автоновости'], competitors: ['шиномонтаж'] });
  const community = parsePlan({ type: 'community', local: true, city: 'Москва', queries: ['Nintendo Switch'], competitors: ['Nintendo Switch'] })!;
  assert.equal(community.type, 'community');
  assert.deepEqual(community.competitors, []);
  assert.equal(parsePlan({ type: 'business', queries: [] }), null);
  assert.equal(parsePlan('oops'), null);
  assert.equal(parsePlan({ local: false, city: 'Уфа', queries: ['мемы'] })!.city, null);
});

test('без модели описание становится запросом, а выбранный город делает задачу местной', () => {
  const local = fallbackPlan('Шиномонтаж на Проспекте, Уфа', true);
  assert.equal(local.local, true);
  assert.equal(local.type, 'business');
  assert.deepEqual(local.queries, ['Шиномонтаж на Проспекте, Уфа', 'шиномонтаж', 'проспекте']);
  assert.equal(fallbackPlan('мемы', false).type, 'community');
});

test('отбор и вердикты модели: чужие id и записи без fit отбрасываются, kind и fit нормализуются', () => {
  const prefilter = parsePrefilter({ items: [{ id: 1, fit: 2, competitor: true }, { id: 2, fit: 9 }, { id: 3 }, { id: 99, fit: 2 }] }, [1, 2, 3]);
  assert.deepEqual(prefilter.get(1), { fit: 2, competitor: true });
  assert.deepEqual(prefilter.get(2), { fit: 2, competitor: false });
  assert.equal(prefilter.has(3), false);
  assert.equal(prefilter.has(99), false);
  const verdicts = parseVerdicts({ items: [{ id: 1, fit: 1, kind: 'city', reason: '  Новости   Уфы ', advertisers: 'автосалоны' }, { id: 2, fit: 2, kind: 'spam' }] }, [1, 2]);
  assert.deepEqual(verdicts.get(1), { fit: 1, kind: 'city', reason: 'Новости Уфы', advertisers: 'автосалоны', competitor: false });
  assert.equal(verdicts.get(2)!.kind, 'none');
  assert.equal(parseVerdicts({ items: 'oops' }, [1]).size, 0);
});

test('запасные правила: страница компании — не площадка, в городе нужно упоминание места', () => {
  const stems = [stem('Уфа'), stem('Башкортостан')];
  assert.equal(ruleVerdict({ id: 1, name: 'Подслушано Уфа' }, 'city', stems).fit, 1);
  assert.equal(ruleVerdict({ id: 2, name: 'Салон красоты Уфа' }, 'topic', stems).fit, 0);
  assert.equal(ruleVerdict({ id: 3, name: 'Мемы', description: 'про всё' }, 'topic', stems).kind, 'none');
  assert.equal(ruleVerdict({ id: 4, name: 'Мемы' }, 'topic', []).fit, 1);
  assert.equal(ruleVerdict({ id: 5, name: 'Чайный бар Уфа' }, 'topic', stems).fit, 0);
  assert.equal(ruleVerdict({ id: 6, name: 'Барахолка Уфа' }, 'city', stems).fit, 1);
});

test('запросы: в городе — запросы модели и слова городских пабликов, без города — только запросы модели', () => {
  const local = buildQueries(plan(), ufa);
  assert.ok(local.some((query) => query.q === 'шины' && query.cityId === 151 && query.source === 'topic'));
  assert.ok(local.some((query) => query.q === 'подслушано' && query.cityId === 151 && query.source === 'city'));
  assert.ok(local.some((query) => query.q === 'Уфа' && !query.cityId && query.source === 'city'));
  const online = buildQueries(plan({ type: 'community', local: false, queries: ['мемы', 'Мемы', 'юмор'] }), null);
  assert.deepEqual(online, [{ q: 'мемы', cityId: undefined, source: 'topic' }, { q: 'юмор', cityId: undefined, source: 'topic' }]);
});

test('на чтение постов идут подходящие не-конкуренты: сначала лучшая оценка, потом крупные', () => {
  const groups = [
    { id: 1, name: 'Авто Уфа', members_count: 500_000 },
    { id: 2, name: 'Шиномонтаж на Ленина', members_count: 90_000 },
    { id: 3, name: 'БашДТП', members_count: 300_000 },
    { id: 4, name: 'Рецепты', members_count: 1_000_000 },
    { id: 5, name: 'Тачки Уфа', members_count: 40_000 }
  ];
  const labels = new Map([[1, { fit: 1 as const, competitor: false }], [2, { fit: 2 as const, competitor: false }], [3, { fit: 2 as const, competitor: false }], [4, { fit: 0 as const, competitor: false }], [5, { fit: 2 as const, competitor: true }]]);
  assert.deepEqual(pickShortlist(groups, labels, ['шиномонтаж']).map((group) => group.id), [3, 1]);
});

const wall = (texts: Array<[string, number]>) => texts.map(([text, views], index) => ({
  id: index + 1,
  date: Math.round((now - (index + 4) * 86_400_000) / 1000),
  text,
  views: { count: views },
  likes: { count: 10 },
  reposts: { count: 1 },
  comments: { count: 1 }
}));

test('строка таблицы: метрики как в проверке перед рекламой, мало просмотров — мёртвая', () => {
  const posts = wall([['Реклама. ООО «Шины»', 1_000], ['ДТП на Проспекте', 2_000], ['Пробки', 3_000], ['Погода', 4_000], ['Новости', 5_000], ['Итоги', 6_000]]);
  const group = { id: 7, name: 'БашДТП', screen_name: 'bashdtp', members_count: 100_000, contacts: [{ user_id: 5, desc: 'Реклама' }, { desc: 'без ссылки' }] };
  const row = buildRow(group, posts, { fit: 2, kind: 'topic', reason: 'Водители Уфы', advertisers: 'автосалоны', competitor: false }, now);
  assert.equal(row.views, 3_500);
  assert.equal(row.viewsToSubscribers, 3.5);
  assert.equal(row.dead, false);
  assert.equal(row.reason, 'Водители Уфы');
  assert.deepEqual(row.contacts, [{ label: 'Реклама', url: 'https://vk.com/id5' }]);
  const dead = buildRow({ ...group, members_count: 5_000_000 }, posts, { fit: 2, kind: 'topic', reason: '', advertisers: '', competitor: false }, now);
  assert.equal(dead.dead, true);
});

test('модель читает обычные и рекламные посты отдельно', () => {
  const texts = postTexts({ id: 1, name: 'A' }, wall([['Реклама. ООО «Шины»', 1], ['ДТП', 1], ['', 1]]), now);
  assert.deepEqual(texts, { posts: ['ДТП'], ads: ['Реклама. ООО «Шины»'] });
});

test('порядок строк: живые, затем блок темы, оценка, просмотры; без тарифа открыты первые строки', () => {
  const base = buildRow({ id: 1, name: 'A', members_count: 10 }, [], { fit: 1, kind: 'topic', reason: '', advertisers: '', competitor: false }, now);
  const row = (id: number, patch: Partial<PlacementRow>): PlacementRow => ({ ...base, id, ...patch });
  const sorted = sortRows([row(1, { kind: 'city', fit: 2, views: 9_000 }), row(2, { dead: true, fit: 2 }), row(3, { fit: 1, views: 100 }), row(4, { fit: 2, views: 50 })]);
  assert.deepEqual(sorted.map((item) => item.id), [4, 3, 1, 2]);
  const locked = lockRows(sorted, false, 2);
  assert.equal(locked[1].locked, false);
  assert.deepEqual(locked[2], { id: 1, name: 'A', url: base.url, photo: null, members: 10, kind: 'city', sizeMatch: false, locked: true });
  assert.ok(lockRows(sorted, true, 1).every((item) => !item.locked));
});

test('метка подбора разбирается с концов: описание может содержать «|», город может быть пустым', () => {
  assert.deepEqual(parseSearchLabel('|группа про мемы|ai|30'), { city: '', brief: 'группа про мемы', ai: true, rows: 30, group: false });
  assert.deepEqual(parseSearchLabel('Уфа|окна|двери|rules|4|text'), { city: 'Уфа', brief: 'окна|двери', ai: false, rows: 4, group: false });
  assert.deepEqual(parseSearchLabel('|Switch Russia · постарше|ai|27|group'), { city: '', brief: 'Switch Russia · постарше', ai: true, rows: 27, group: true });
  assert.equal(parseSearchLabel('мусор'), null);
});

test('для DeepSeek из текста убираются половинки разрезанных эмодзи, целые остаются', () => {
  assert.equal(wellFormed('Пост 😀'.slice(0, 6) + ' конец'), 'Пост  конец');
  assert.equal(wellFormed('Пост 😀 конец'), 'Пост 😀 конец');
  assert.equal(JSON.stringify(wellFormed('\udc00a')), '"a"');
});

test('ссылка на свою группу находится в описании, остальной текст — пожелания', () => {
  assert.deepEqual(extractGroupRef('https://vk.com/switch_ru, хочу подписчиков постарше'), { ref: 'switch_ru', rest: 'хочу подписчиков постарше' });
  assert.deepEqual(extractGroupRef('vk.ru/club123456'), { ref: '123456', rest: '' });
  assert.deepEqual(extractGroupRef('моя группа public777 про мемы'), { ref: '777', rest: 'моя группа про мемы' });
  assert.deepEqual(extractGroupRef('шиномонтаж в Уфе'), { ref: null, rest: 'шиномонтаж в Уфе' });
  assert.equal(extractGroupRef('супермаркет clubhouse').ref, null);
});

test('сопоставимый размер — от половины до 20 размеров своей группы, с нижними границами', () => {
  assert.deepEqual(sizeRangeFor(5_000), { min: 2_500, max: 100_000 });
  assert.deepEqual(sizeRangeFor(300), { min: 1_000, max: 10_000 });
  assert.deepEqual(sizeRangeFor(1_000_000), { min: 500_000, max: 20_000_000 });
});

test('при своей группе сопоставимые по размеру идут первыми и в чтение постов, и в таблице', () => {
  const range = sizeRangeFor(5_000);
  const groups = [{ id: 1, name: 'IGM', members_count: 2_800_000 }, { id: 2, name: 'Switch | 2', members_count: 24_000 }, { id: 3, name: 'Zelda', members_count: 18_000 }];
  const labels = new Map([[1, { fit: 2 as const, competitor: false }], [2, { fit: 2 as const, competitor: false }], [3, { fit: 1 as const, competitor: false }]]);
  assert.deepEqual(pickShortlist(groups, labels, [], range).map((group) => group.id), [2, 3, 1]);
  assert.deepEqual(pickShortlist(groups, labels, []).map((group) => group.id), [1, 2, 3]);
  const verdict = { fit: 2 as const, kind: 'topic' as const, reason: '', advertisers: '', competitor: false };
  const rows = groups.map((group) => ({ ...buildRow(group, [], verdict, now, range), views: group.members_count / 100 }));
  assert.deepEqual(rows.map((row) => row.sizeMatch), [false, true, true]);
  assert.deepEqual(sortRows(rows).map((row) => row.id), [2, 3, 1]);
});
