import assert from 'node:assert/strict';
import test from 'node:test';
import { getReportPassState, isReportPassActiveFor, type ReportPassRecord } from './reportPass.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const usedAt = Date.parse('2026-10-01T10:00:00.000Z');
const pass: ReportPassRecord = { platform: 'vk', sourceId: '123', sourceName: 'Группа', usedAt: new Date(usedAt).toISOString() };

test('pass is available when it was never used', () => {
  assert.deepEqual(getReportPassState(undefined, usedAt), { status: 'available' });
});

test('pass is active for 24 hours on its source only', () => {
  const state = getReportPassState(pass, usedAt + 23 * HOUR);
  assert.equal(state.status, 'active');
  assert.equal(state.status === 'active' && state.expiresAt, '2026-10-02T10:00:00.000Z');
  assert.equal(isReportPassActiveFor(pass, 'vk', '123', usedAt + 23 * HOUR), true);
  assert.equal(isReportPassActiveFor(pass, 'vk', '-123', usedAt + 23 * HOUR), true);
  assert.equal(isReportPassActiveFor(pass, 'vk', '456', usedAt + 23 * HOUR), false);
  assert.equal(isReportPassActiveFor(pass, 'youtube', '123', usedAt + 23 * HOUR), false);
});

test('after 24 hours the pass is spent until 30 days pass', () => {
  assert.deepEqual(getReportPassState(pass, usedAt + DAY), { status: 'used', nextAt: '2026-10-31T10:00:00.000Z' });
  assert.equal(isReportPassActiveFor(pass, 'vk', '123', usedAt + DAY), false);
  assert.equal(getReportPassState(pass, usedAt + 29 * DAY).status, 'used');
  assert.deepEqual(getReportPassState(pass, usedAt + 30 * DAY), { status: 'available' });
});
