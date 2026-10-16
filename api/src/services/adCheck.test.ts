import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAdMarker } from './adDetection.js';
import { mapVkSource, normalizeVkSource, parseAdCheckSource } from './adCheckService.js';
import { coverageDays, engagementRate, estimateViews, quantile, summarizeAds, summarizeAdCheck, type AdCheckPost } from './adCheckUtils.js';

const now = new Date('2026-10-14T12:00:00Z').getTime();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

function post(id: number, ageDays: number, views: number | null, ad: AdCheckPost['ad'] = null): AdCheckPost {
  return { id: String(id), date: daysAgo(ageDays), views, reactions: 10, comments: 2, forwards: 3, ad };
}

test('реклама распознаётся по отметке VK, erid и строке маркировки', () => {
  assert.equal(detectAdMarker({ text: 'Обычный пост', markedAsAds: true }), 'platform');
  assert.equal(detectAdMarker({ text: 'Скидки тут', links: ['https://shop.ru/?utm_source=tg&erid=2VtzqwHmP3k'] }), 'erid');
  assert.equal(detectAdMarker({ text: 'Подробнее на сайте\n\nerid: 2VtzqvXcQ1a' }), 'erid');
  assert.equal(detectAdMarker({ text: 'Курс по дизайну\n\nРеклама. ООО «Ромашка», ИНН 7700000000' }), 'label');
  assert.equal(detectAdMarker({ text: 'Новый курс #реклама' }), 'label');
  assert.equal(detectAdMarker({ text: 'Публикуется на правах рекламы' }), 'label');
  assert.equal(detectAdMarker({ text: 'Рекламодатель: ИП Иванов' }), 'label');
});

test('упоминание рекламы в обычном тексте не считается маркировкой', () => {
  assert.equal(detectAdMarker({ text: 'Как работает реклама в Telegram: разбор кейса' }), null);
  assert.equal(detectAdMarker({ text: 'Рекламная кампания бренда провалилась' }), null);
  assert.equal(detectAdMarker({ text: 'Где купить рекламу? #рекламный_кейс' }), null);
  assert.equal(detectAdMarker({ text: 'Читайте про vertical', links: ['https://example.com/?ref=meridian'] }), null);
});

test('квантили интерполируются между соседними значениями', () => {
  assert.equal(quantile([10, 20, 30, 40], 0.5), 25);
  assert.equal(quantile([10, 20, 30, 40], 0.25), 17.5);
  assert.equal(quantile([], 0.5), null);
});

test('без срезов типичные просмотры считаются по постам старше 72 часов', () => {
  const posts = [post(1, 1, 50_000), post(2, 4, 1_000), post(3, 5, 2_000), post(4, 6, 3_000), post(5, 7, 4_000)];
  assert.deepEqual(estimateViews(posts, null, now), { source: 'current', hours: null, views: 2_500, lower: 1_750, upper: 3_250, posts: 4 });
  assert.equal(estimateViews(posts.slice(0, 3), null, now), null);
});

test('со срезами берётся медиана за 48 часов из цепочки срезов', () => {
  const curves = {
    milestones: [{ hours: 24, median: 800, posts: 3 }, { hours: 48, median: 1_000, posts: 3 }, { hours: 72, median: 1_100, posts: 3 }],
    posts: [900, 1_000, 1_200].map((value, index) => ({ postId: String(index), milestones: { 24: null, 48: value, 72: null } }))
  };
  const estimate = estimateViews([post(1, 5, 5_000)], curves, now);
  assert.equal(estimate?.source, 'snapshots');
  assert.equal(estimate?.views, 1_000);
  assert.equal(estimate?.posts, 3);
});

test('частота рекламы считается по покрытым дням, медианы — по зрелым постам', () => {
  const posts = [post(1, 1, 9_999, 'erid'), post(2, 4, 600, 'erid'), post(3, 5, 400, 'label'), post(4, 6, 1_000), post(5, 8, 1_200), post(6, 9, 1_400)];
  const ads = summarizeAds(posts, 14, now);
  assert.equal(ads.posts, 3);
  assert.equal(ads.perWeek, 1.5);
  assert.equal(ads.share, 50);
  assert.equal(ads.medianViews, 500);
  assert.equal(ads.organicMedianViews, 1_200);
  assert.deepEqual(ads.markers, { platform: 0, erid: 2, label: 1 });
});

test('неполная загрузка покрывает дни до самого старого поста', () => {
  const posts = [post(1, 1, 100), post(2, 10, 100)];
  assert.equal(coverageDays(posts, 30, true, now), 30);
  assert.equal(coverageDays(posts, 30, false, now), 10);
  assert.equal(coverageDays([post(1, 0.1, 100)], 30, false, now), 1);
});

test('вовлечённость не считается, если у поста неизвестен счётчик', () => {
  const posts = [post(1, 4, 1_000), post(2, 5, 1_000), post(3, 6, 1_000)];
  assert.equal(engagementRate(posts, now), 1.5);
  assert.equal(engagementRate([...posts, { ...post(4, 7, 1_000), forwards: null }], now), null);
});

test('сводка проверки: отношение просмотров к подписчикам и посты в день', () => {
  const posts = [post(1, 4, 1_000), post(2, 5, 2_000), post(3, 6, 3_000)];
  const summary = summarizeAdCheck({ posts, subscribers: 10_000, curves: null, windowDays: 30, complete: true, now });
  assert.equal(summary.viewsToSubscribers, 20);
  assert.equal(summary.postsPerDay, 0.1);
  assert.equal(summary.milestones, null);
});

test('источник проверки определяется по ссылке, а @name — по выбранной площадке', () => {
  assert.deepEqual(parseAdCheckSource('https://t.me/Durov', 'vk'), { platform: 'telegram', id: 'durov' });
  assert.deepEqual(parseAdCheckSource('vk.com/socstat?w=wall-1_2', undefined), { platform: 'vk', id: 'socstat' });
  assert.deepEqual(parseAdCheckSource('@durov', 'telegram'), { platform: 'telegram', id: 'durov' });
  assert.throws(() => parseAdCheckSource('@durov', undefined), /площадку/);
  assert.throws(() => parseAdCheckSource('https://youtube.com/@x', 'vk'), /YouTube/);
});

test('ссылки VK приводятся к id или короткому имени', () => {
  assert.equal(normalizeVkSource('https://vk.com/club125792332'), '125792332');
  assert.equal(normalizeVkSource('public42'), '42');
  assert.equal(normalizeVkSource('-42'), '42');
  assert.equal(normalizeVkSource('m.vk.com/SocStat'), 'socstat');
  assert.throws(() => normalizeVkSource('vk.com/привет'), /сообщество VK/);
});

test('стена VK: окно 30 дней, реклама в репосте, старый закреп не делает выборку полной', () => {
  const unix = (days: number) => Math.floor((now - days * 86_400_000) / 1000);
  const group = { id: 42, name: 'Сообщество', screen_name: 'club_name', members_count: 1_000 };
  const items = [
    { id: 1, date: unix(400), is_pinned: 1, text: 'Правила' },
    { id: 2, date: unix(2), text: 'Новость', views: { count: 500 }, likes: { count: 5 } },
    { id: 3, date: unix(5), text: '', copy_history: [{ text: 'Скидка', attachments: [{ type: 'link', link: { url: 'https://a.ru/?erid=2VtzqwHmP3k' } }] }], views: { count: 300 } },
    { id: 4, date: unix(6), text: 'Пост', marked_as_ads: 1 },
    ...Array.from({ length: 96 }, (_, index) => ({ id: 10 + index, date: unix(7 + index * 0.1), text: 'Обычный' }))
  ];
  const source = mapVkSource(group, items, now);
  assert.equal(source.posts.length, 99);
  assert.equal(source.complete, false);
  assert.equal(source.url, 'https://vk.com/club_name');
  assert.deepEqual(source.posts.slice(0, 3).map((post) => post.ad), [null, 'erid', 'platform']);
  assert.equal(source.posts[0].reactions, 5);
  assert.equal(source.posts[0].comments, null);
});
