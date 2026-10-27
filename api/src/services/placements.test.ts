import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanRegion, parseLabels, placeStems, ruleLabel, sanitizeQueries, stem, type PlacementLabel, type PlacementPlace } from './placementClassifier.js';
import { buildQueries, buildRow, lockRows, pickRows } from './placementSearchService.js';
import { parseSearchLabel } from './placementStatsService.js';

const voronezh: PlacementPlace = { cityId: 42, city: 'Воронеж', region: 'Воронежская область', district: '', topic: '' };
const abakan: PlacementPlace = { cityId: 1, city: 'Абакан', region: 'Республика Хакасия', district: '', topic: '' };
const now = new Date('2026-10-28T12:00:00Z').getTime();

test('из названия региона убирается общая часть, но «область» остаётся у прилагательного', () => {
  assert.equal(cleanRegion('Республика Хакасия'), 'Хакасия');
  assert.equal(cleanRegion('Курская область'), 'Курская область');
  assert.equal(cleanRegion('Ханты-Мансийский автономный округ'), 'Ханты-Мансийский автономный округ');
  assert.equal(cleanRegion(''), '');
});

test('основа слова совпадает с падежами названия', () => {
  assert.equal(stem('Казань'), 'казан');
  assert.equal(stem('Хакасия'), 'хакас');
  assert.equal(stem('Воронеж'), 'воронеж');
  assert.ok('новости казани'.includes(stem('Казань')));
  assert.deepEqual(placeStems(abakan), ['абакан', 'хакас']);
});

test('запасные правила: город в названии — местное, категория по ключевым словам', () => {
  assert.deepEqual(ruleLabel({ id: 1, name: 'Подслушано Воронеж' }, voronezh), { local: true, category: 'overheard', fit: 2 });
  assert.deepEqual(ruleLabel({ id: 2, name: 'Работа Воронеж Вакансии' }, voronezh), { local: true, category: 'jobs', fit: 2 });
  assert.deepEqual(ruleLabel({ id: 3, name: 'Анатомия человека' }, voronezh), { local: false, category: 'theme', fit: 0 });
  assert.equal(ruleLabel({ id: 4, name: 'Жесть Абакан Инцидент ЧП Хакасия' }, abakan).category, 'news');
  assert.equal(ruleLabel({ id: 5, name: 'Новости', description: 'Главное о жизни Хакасии' }, abakan).local, true);
});

test('с темой правила ставят 2 только при совпадении темы', () => {
  const kursk: PlacementPlace = { cityId: 2, city: 'Курск', region: 'Курская область', district: '', topic: 'ремонт квартир' };
  assert.equal(ruleLabel({ id: 1, name: 'Ремонт квартир Курск' }, kursk).fit, 2);
  assert.equal(ruleLabel({ id: 2, name: 'Подслушано Курск' }, kursk).fit, 1);
  assert.equal(ruleLabel({ id: 3, name: 'Ремонт квартир Москва' }, kursk).fit, 0);
});

test('запросы модели: только короткие уникальные строки, не больше восьми', () => {
  assert.deepEqual(sanitizeQueries({ queries: ['ЖК', ' ремонт  Курск ', 'ремонт курск', 5, '', 'x'.repeat(41)] }), ['ЖК', 'ремонт Курск']);
  assert.equal(sanitizeQueries({ queries: Array.from({ length: 12 }, (_, index) => `запрос ${index}`) }).length, 8);
  assert.deepEqual(sanitizeQueries(null), []);
  assert.deepEqual(sanitizeQueries({ queries: 'ЖК' }), []);
});

test('метки модели: чужие id и кривые записи отбрасываются, неизвестная категория — other', () => {
  const labels = parseLabels({ items: [
    { id: 1, local: true, category: 'news', fit: 2 },
    { id: '2', local: false, category: 'spam', fit: 7 },
    { id: 3, local: 'yes', category: 'news', fit: 1 },
    { id: 99, local: true, category: 'news', fit: 2 }
  ] }, [1, 2, 3]);
  assert.deepEqual(labels.get(1), { local: true, category: 'news', fit: 2 });
  assert.deepEqual(labels.get(2), { local: false, category: 'other', fit: 2 });
  assert.equal(labels.has(3), false);
  assert.equal(labels.has(99), false);
  assert.equal(parseLabels({ items: 'oops' }, [1]).size, 0);
});

test('запросы подбора: слова городских пабликов в городе, город и регион без фильтра, без повторов', () => {
  const queries = buildQueries({ ...abakan, topic: 'окна', district: 'Черногорск' }, ['ремонт', 'окна']);
  assert.ok(queries.some((query) => query.q === 'подслушано' && query.cityId === 1));
  assert.ok(queries.some((query) => query.q === 'окна' && query.cityId === 1));
  assert.ok(queries.some((query) => query.q === 'ремонт' && query.cityId === 1));
  assert.deepEqual(queries.filter((query) => !query.cityId).map((query) => query.q), ['Абакан', 'Хакасия', 'Черногорск Абакан']);
  assert.equal(queries.filter((query) => query.q === 'окна').length, 1);
});

test('в таблицу попадают местные с оценкой от 1: сначала лучшая оценка, потом крупные', () => {
  const groups = [{ id: 1, members_count: 500_000 }, { id: 2, members_count: 90_000 }, { id: 3, members_count: 300_000 }, { id: 4, members_count: 1_000_000 }];
  const labels = new Map<number, PlacementLabel>([
    [1, { local: true, category: 'news', fit: 1 }],
    [2, { local: true, category: 'district', fit: 2 }],
    [3, { local: true, category: 'news', fit: 0 }],
    [4, { local: false, category: 'theme', fit: 2 }]
  ]);
  assert.deepEqual(pickRows(groups, labels).map((group) => group.id), [2, 1]);
});

test('строка таблицы: оценки как в проверке перед рекламой, контакты — только со ссылкой', () => {
  const posts = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    date: Math.round((now - (index + 4) * 86_400_000) / 1000),
    text: index === 0 ? 'Реклама. ООО «Окна»' : 'Новости города',
    views: { count: (index + 1) * 1_000 },
    likes: { count: 10 },
    reposts: { count: 1 },
    comments: { count: 1 }
  }));
  const row = buildRow(
    { id: 7, name: 'Типичный Воронеж', screen_name: 'tvrn', members_count: 100_000, contacts: [{ user_id: 5, desc: 'Реклама' }, { desc: 'без ссылки' }] },
    posts,
    { local: true, category: 'overheard', fit: 2 },
    now
  );
  assert.equal(row.views, 3_500);
  assert.equal(row.viewsToSubscribers, 3.5);
  assert.equal(row.url, 'https://vk.com/tvrn');
  assert.equal(row.adsShare, 16.7);
  assert.deepEqual(row.contacts, [{ label: 'Реклама', url: 'https://vk.com/id5' }]);
  assert.equal(row.complete, true);
});

test('без тарифа метрики видны только у первых строк', () => {
  const row = buildRow({ id: 1, name: 'A', members_count: 10 }, [], { local: true, category: 'news', fit: 2 }, now);
  const rows = lockRows([row, { ...row, id: 2 }, { ...row, id: 3 }], false, 2);
  assert.equal(rows[1].locked, false);
  assert.deepEqual(rows[2], { id: 3, name: 'A', url: row.url, photo: null, members: 10, category: 'news', locked: true });
  assert.ok(lockRows([row, { ...row, id: 2 }], true, 1).every((item) => !item.locked));
});

test('метка подбора разбирается с концов: тема может содержать «|»', () => {
  assert.deepEqual(parseSearchLabel('Воронеж||ai|30'), { city: 'Воронеж', topic: '', ai: true, rows: 30 });
  assert.deepEqual(parseSearchLabel('Курск|окна|двери|rules|4'), { city: 'Курск', topic: 'окна|двери', ai: false, rows: 4 });
  assert.equal(parseSearchLabel('мусор'), null);
});
