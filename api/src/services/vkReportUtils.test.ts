import assert from 'node:assert/strict';
import test from 'node:test';
import { isFeatureOnFor } from './featureFlags.js';
import {
  competitorGrowthPlace,
  formatPercent,
  formatSigned,
  isMondayKey,
  mskDateStart,
  postUrl,
  reportCommand,
  shiftDateKey,
  weekGrowth,
  weekLabel,
  weeklyReportMessage
} from './vkReportUtils.js';

const monday = '2026-10-26';

test('date helpers work on Moscow snapshot days', () => {
  assert.equal(shiftDateKey(monday, -7), '2026-10-19');
  assert.equal(shiftDateKey('2026-11-01', -1), '2026-10-31');
  assert.equal(isMondayKey(monday), true);
  assert.equal(isMondayKey('2026-10-27'), false);
  assert.equal(mskDateStart(monday).toISOString(), '2026-10-25T21:00:00.000Z');
  assert.equal(weekLabel(monday), '19–25 октября');
  assert.equal(weekLabel('2026-11-02'), '26 октября – 1 ноября');
});

test('weekGrowth compares Monday snapshots and falls back to the neighbouring day', () => {
  const growth = weekGrowth([
    { date: '2026-10-12', subscribers: 900 },
    { date: '2026-10-19', subscribers: 1000 },
    { date: '2026-10-26', subscribers: 1050 }
  ], monday);
  assert.deepEqual(growth, { subscribers: 1050, change: 50, percent: 5, previousChange: 100 });

  const fallback = weekGrowth([
    { date: '2026-10-20', subscribers: 1000 },
    { date: '2026-10-25', subscribers: 990 }
  ], monday);
  assert.equal(fallback.subscribers, 990);
  assert.equal(fallback.change, -10);
  assert.equal(fallback.previousChange, null);

  const short = weekGrowth([{ date: '2026-10-26', subscribers: 500 }], monday);
  assert.deepEqual(short, { subscribers: 500, change: null, percent: null, previousChange: null });
});

test('competitorGrowthPlace ranks by weekly growth and names a faster leader', () => {
  assert.deepEqual(
    competitorGrowthPlace(1, [{ name: 'A', percent: 3 }, { name: 'B', percent: 0.5 }, { name: 'C', percent: null }]),
    { place: 2, total: 3, leader: { name: 'A', percent: 3 } }
  );
  assert.deepEqual(competitorGrowthPlace(4, [{ name: 'A', percent: 3 }]), { place: 1, total: 2, leader: null });
  assert.equal(competitorGrowthPlace(null, [{ name: 'A', percent: 3 }]), null);
  assert.equal(competitorGrowthPlace(1, [{ name: 'A', percent: null }]), null);
});

test('formatting and post links', () => {
  assert.equal(formatSigned(1234), '+1 234');
  assert.equal(formatSigned(-40), '−40');
  assert.equal(formatPercent(0.254), '+0,25%');
  assert.equal(formatPercent(-12.34), '−12,3%');
  assert.equal(postUrl('vk', '125792332', '77'), 'https://vk.com/wall-125792332_77');
  assert.equal(postUrl('telegram', 'rbc_news', '5'), 'https://t.me/rbc_news/5');
});

const sources = [{
  name: 'Мой и твой Воронеж',
  growth: { subscribers: 125430, change: 312, percent: 0.25, previousChange: 280 },
  bestPost: { views: 18400, url: 'https://vk.com/wall-1_2' },
  competitors: { place: 2, total: 4, leader: { name: 'Конкурент', percent: 0.9 } }
}];

test('full report has growth, best post and competitors', () => {
  const text = weeklyReportMessage({ reportDateKey: monday, variant: 'full', sources, siteUrl: 'https://socstat.ru', monthPriceRub: 699, isReturning: false });
  assert.match(text, /итоги недели 19–25 октября/);
  assert.match(text, /Подписчики: 125 430 \(\+312 за неделю, \+0,25%\)/);
  assert.match(text, /Неделей раньше: \+280/);
  assert.match(text, /Лучший пост: 18 400 просмотров — https:\/\/vk.com\/wall-1_2/);
  assert.match(text, /2-е место из 4, быстрее всех — Конкурент \(\+0,9%\)/);
  assert.match(text, /socstat.ru\/app\/dashboard\?utm_source=vk_msg/);
  assert.match(text, /напишите «стоп»/);
});

test('locked report shows only subscribers and the price', () => {
  const text = weeklyReportMessage({ reportDateKey: monday, variant: 'locked', sources, siteUrl: 'https://socstat.ru', monthPriceRub: 499, isReturning: true });
  assert.match(text, /\+312 за неделю/);
  assert.doesNotMatch(text, /Лучший пост/);
  assert.doesNotMatch(text, /место из/);
  assert.match(text, /Ваша цена сохранена: 499 ₽/);
  assert.match(text, /app\/account\?utm_source=vk_msg/);
});

test('reportCommand understands stop and start', () => {
  assert.equal(reportCommand(' Стоп! '), 'stop');
  assert.equal(reportCommand('старт'), 'start');
  assert.equal(reportCommand('привет'), null);
  assert.equal(reportCommand(undefined), null);
});

test('feature modes: admins-only mode is visible to admins only', () => {
  assert.equal(isFeatureOnFor('off', { isAdmin: true }), false);
  assert.equal(isFeatureOnFor('admins', { isAdmin: true }), true);
  assert.equal(isFeatureOnFor('admins', { isAdmin: false }), false);
  assert.equal(isFeatureOnFor('all', {}), true);
});
