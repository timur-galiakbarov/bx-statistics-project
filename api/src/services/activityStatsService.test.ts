import assert from 'node:assert/strict';
import test from 'node:test';
import { isBounce, mskDayKey, mskDayStart } from './activityStatsService.js';

test('buckets dates by the Moscow calendar day', () => {
  // 22:30 UTC is already the next day in Moscow.
  const lateEvening = new Date('2026-10-04T22:30:00Z');
  assert.equal(mskDayKey(lateEvening), '2026-10-05');
  assert.equal(mskDayStart(lateEvening).toISOString(), '2026-10-04T21:00:00.000Z');
  assert.equal(mskDayStart(lateEvening, -1).toISOString(), '2026-10-03T21:00:00.000Z');
});

test('treats only short single-page visits without actions as bounces', () => {
  const startedAt = new Date('2026-10-05T10:00:00Z');
  const after = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);

  assert.equal(isBounce({ startedAt, lastSeenAt: after(5), pageViews: 1, actions: 0 }), true);
  assert.equal(isBounce({ startedAt, lastSeenAt: after(20), pageViews: 1, actions: 0 }), false);
  assert.equal(isBounce({ startedAt, lastSeenAt: after(5), pageViews: 2, actions: 0 }), false);
  assert.equal(isBounce({ startedAt, lastSeenAt: after(5), pageViews: 1, actions: 1 }), false);
});

test('management share excludes unavailable and unverified users', async () => {
  const { summarizeVkManagement } = await import('./activityStatsService.js');
  assert.deepEqual(summarizeVkManagement([
    { status: 'checked', managesCommunity: true },
    { status: 'checked', managesCommunity: false },
    { status: 'unavailable', managesCommunity: true },
    undefined,
    { status: 'checked' }
  ]), { total: 5, managers: 1, nonManagers: 1, unknown: 3, managerShare: 0.5 });
  assert.deepEqual(summarizeVkManagement([]), {
    total: 0, managers: 0, nonManagers: 0, unknown: 0, managerShare: null
  });
});
