import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStatsWindows,
  fetchContentStatsAllTime,
  fetchContentStatsByPeriod,
  fetchGeneralStatsByPeriod,
  fetchGeneralStatsTotal,
  mergeStatsIntervals,
  toCommunityOwnerId,
  toProfileOwnerId,
  type PartnerStatsRequest
} from './partnerStatsClient.js';
import { VkApiError } from './vkClient.js';

const DAY = 86_400;
const MSK_OFFSET = 3 * 3_600;

/** Начало московских суток: VK режет статистику по Москве. */
function mskDay(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day) / 1_000 - MSK_OFFSET;
}

type Call = {
  method: string;
  token: string;
  params: Record<string, string | number | boolean | undefined>;
  httpMethod?: 'GET' | 'POST';
};

function recordingRequest(handler: (call: Call, index: number) => unknown) {
  const calls: Call[] = [];
  const request = (async (method: string, token: string, params: Call['params'], httpMethod?: 'GET' | 'POST') => {
    const call = { method, token, params, httpMethod };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as unknown as PartnerStatsRequest;

  return { calls, request };
}

test('режет семидневный период на одно окно', () => {
  const from = mskDay(2026, 11, 5);
  const to = from + 7 * DAY - 1;

  assert.deepEqual(buildStatsWindows(from, to), [{ from, to }]);
});

test('режет 90 дней на три окна без пересечений и дыр', () => {
  const from = mskDay(2026, 8, 1);
  const to = from + 90 * DAY - 1;
  const windows = buildStatsWindows(from, to);

  assert.equal(windows.length, 3);
  assert.equal(windows[0].from, from);
  assert.equal(windows[windows.length - 1].to, to);
  for (let index = 1; index < windows.length; index += 1) {
    assert.equal(windows[index].from, windows[index - 1].to + 1);
  }

  const coveredSeconds = windows.reduce((sum, window) => sum + (window.to - window.from + 1), 0);
  assert.equal(coveredSeconds, 90 * DAY);
});

test('каждое окно начинается с московских суток', () => {
  const from = mskDay(2026, 11, 5);
  const windows = buildStatsWindows(from, from + 45 * DAY - 1);

  for (const window of windows) {
    assert.equal((window.from + MSK_OFFSET) % DAY, 0);
  }
});

test('для недельного и месячного интервала окна больше', () => {
  const from = mskDay(2026, 1, 1);

  assert.equal(buildStatsWindows(from, from + 200 * DAY, 'week').length, 2);
  assert.equal(buildStatsWindows(from, from + 365 * DAY, 'month').length, 2);
  assert.equal(buildStatsWindows(from, from + 60 * DAY, 'month').length, 1);
});

test('возвращает пусто на некорректном периоде', () => {
  assert.deepEqual(buildStatsWindows(100, 99), []);
  assert.deepEqual(buildStatsWindows(Number.NaN, 100), []);
});

test('склеивает интервалы по дню и сортирует по возрастанию', () => {
  const merged = mergeStatsIntervals([
    { period_from: 300, owner: { reach: { all: 3 } } },
    { period_from: 100 },
    { period_from: 100, owner: { reach: { all: 1 } } },
    { period_from: 200 },
    { period_from: 200 },
    { period_from: undefined }
  ]);

  assert.deepEqual(merged.map((interval) => interval.period_from), [100, 200, 300]);
  assert.deepEqual(merged[0].owner, { reach: { all: 1 } });
});

test('нормализует owner_id сообщества и профиля', () => {
  assert.equal(toCommunityOwnerId(125792332), -125792332);
  assert.equal(toCommunityOwnerId(-125792332), -125792332);
  assert.equal(toProfileOwnerId(30647716), 30647716);
  assert.equal(toProfileOwnerId(-30647716), 30647716);
});

test('запрашивает период по окнам и склеивает дни на стыке', async () => {
  const from = mskDay(2026, 11, 5);
  const to = from + 45 * DAY - 1;
  // VK отдаёт дни голым массивом, но иногда заворачивает их в items — клиент понимает оба вида.
  const { calls, request } = recordingRequest((_call, index) => {
    if (index === 0) {
      return [{ period_from: from, owner: { reach: { all: 10 } } }, { period_from: from + DAY, owner: { reach: { all: 20 } } }];
    }
    return { items: [{ period_from: from + DAY, owner: { reach: { all: 20 } } }, { period_from: from + 2 * DAY, owner: { reach: { all: 30 } } }] };
  });

  const intervals = await fetchGeneralStatsByPeriod('token', { ownerId: 125792332, unixFrom: from, unixTo: to }, request);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.method), ['partnerStats.getGeneralStatsByPeriod', 'partnerStats.getGeneralStatsByPeriod']);
  assert.equal(calls[0].params.owner_id, -125792332);
  assert.equal(calls[0].params.interval, 'day');
  assert.equal(calls[0].params.filters, 'owner');
  assert.equal(calls[0].params.fields, 'reach,views,subscribe_action,unsubscribe_action');
  assert.equal(typeof calls[0].params.timestamp_from, 'string');
  assert.equal(typeof calls[0].params.timestamp_to, 'string');
  assert.equal(calls[1].params.timestamp_from, String(from + 30 * DAY));
  assert.deepEqual(intervals.map((interval) => interval.period_from), [from, from + DAY, from + 2 * DAY]);
  assert.deepEqual(intervals.map((interval) => interval.owner?.reach?.all), [10, 20, 30]);
});

test('не передаёт filters, когда запрошены все типы контента', async () => {
  const from = mskDay(2026, 11, 5);
  const { calls, request } = recordingRequest(() => ({ items: [] }));

  await fetchGeneralStatsByPeriod('token', { ownerId: 1, unixFrom: from, unixTo: from + DAY, filters: null }, request);

  assert.equal('filters' in calls[0].params, false);
});

test('итоги за период — один запрос с дедуплицированным охватом', async () => {
  const from = mskDay(2026, 11, 5);
  const to = from + 7 * DAY - 1;
  const { calls, request } = recordingRequest(() => ({ owner: { reach: { all: 15 }, subscribe_action: 2 } }));

  const total = await fetchGeneralStatsTotal('token', { ownerId: 125792332, unixFrom: from, unixTo: to }, request);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'partnerStats.getGeneralStatsTotal');
  assert.equal(calls[0].params.timestamp_from, String(from));
  assert.equal(calls[0].params.timestamp_to, String(to));
  assert.deepEqual(total.owner?.reach, { all: 15 });
});

test('режет content_ids на чанки и отправляет их POST-ом', async () => {
  const from = mskDay(2026, 8, 1);
  const ids = Array.from({ length: 250 }, (_value, index) => index + 1);
  const { calls, request } = recordingRequest((call) => {
    const requested = String(call.params.content_ids).split(',').map(Number);
    return { items: requested.map((id) => ({ id, views: id })) };
  });

  const stats = await fetchContentStatsByPeriod(
    'token',
    { ownerId: 125792332, contentType: 'post', contentIds: ids, unixFrom: from, unixTo: from + 30 * DAY },
    request
  );

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.httpMethod), ['POST', 'POST', 'POST']);
  assert.equal(calls[0].params.content_type, 'post');
  assert.equal(String(calls[0].params.content_ids).split(',').length, 100);
  assert.equal(String(calls[2].params.content_ids).split(',').length, 50);
  assert.equal(stats.length, 250);
  assert.deepEqual(stats[0], { id: 1, views: 1 });
});

test('убирает повторяющиеся id перед запросом контента', async () => {
  const from = mskDay(2026, 8, 1);
  const { calls, request } = recordingRequest(() => ({ items: [] }));

  await fetchContentStatsByPeriod(
    'token',
    { ownerId: 1, contentType: 'post', contentIds: [5, 5, 7], unixFrom: from, unixTo: from + DAY },
    request
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.content_ids, '5,7');
});

test('накопительная статистика за всё время тоже режется на чанки', async () => {
  const ids = Array.from({ length: 120 }, (_value, index) => index + 1);
  const { calls, request } = recordingRequest(() => ({ items: [] }));

  await fetchContentStatsAllTime('token', { ownerId: 125792332, contentType: 'post', contentIds: ids }, request);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'partnerStats.getContentStatsAllTime');
  assert.equal(calls[0].httpMethod, 'POST');
  assert.equal('timestamp_from' in calls[0].params, false);
});

test('пробрасывает отказ VK как VkApiError', async () => {
  const from = mskDay(2026, 11, 5);
  const { request } = recordingRequest(() => {
    throw new VkApiError('Access denied', { vkCode: 15 });
  });

  await assert.rejects(
    fetchGeneralStatsByPeriod('token', { ownerId: 69537711, unixFrom: from, unixTo: from + DAY }, request),
    (error: unknown) => error instanceof VkApiError && error.vkCode === 15
  );
});
