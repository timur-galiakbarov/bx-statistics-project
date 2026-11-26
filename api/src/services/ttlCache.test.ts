import assert from 'node:assert/strict';
import test from 'node:test';
import { TtlCache } from './ttlCache.js';

test('returns an entry until its TTL expires', () => {
  let now = 1_000;
  const cache = new TtlCache<string>(900_000, () => now);

  cache.set('group', 'cached analytics');
  assert.equal(cache.get('group'), 'cached analytics');

  now += 900_000;
  assert.equal(cache.get('group'), undefined);
});

test('uses a per-entry TTL when given', () => {
  let now = 1_000;
  const cache = new TtlCache<string>(900_000, () => now);

  cache.set('group', 'cached analytics', 1_000);
  now += 1_000;
  assert.equal(cache.get('group'), undefined);
});

test('cleans expired entries every five minutes without reading their keys', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let now = 0;
  const cache = new TtlCache<string>(1_000, () => now);
  cache.set('expired', 'old report');
  cache.set('fresh', 'fresh report', 900_000);

  now = 299_999;
  t.mock.timers.tick(299_999);
  assert.equal(cache.size, 2);
  now = 300_000;
  t.mock.timers.tick(1);
  assert.equal(cache.size, 1);
  assert.equal(cache.get('fresh'), 'fresh report');

  now = 900_000;
  t.mock.timers.tick(600_000);
  assert.equal(cache.size, 0);

  // Cleanup starts again after an empty cache receives a new entry.
  cache.set('new', 'new report');
  now += 300_000;
  t.mock.timers.tick(300_000);
  assert.equal(cache.size, 0);
});

test('evicts the least recently used entry without extending its TTL on reads', () => {
  let now = 0;
  const cache = new TtlCache<string>(1_000, () => now, 2);
  cache.set('a', 'A');
  cache.set('b', 'B');
  now = 500;
  assert.equal(cache.get('a'), 'A');
  cache.set('c', 'C');
  assert.equal(cache.size, 2);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 'A');
  now = 1_000;
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), 'C');
});

test('removes expired entries before evicting fresh ones at capacity', () => {
  let now = 0;
  const cache = new TtlCache<string>(10_000, () => now, 2);
  cache.set('fresh', 'keep');
  cache.set('expired', 'remove', 1_000);
  now = 1_000;
  cache.set('new', 'new');
  assert.equal(cache.size, 2);
  assert.equal(cache.get('fresh'), 'keep');
  assert.equal(cache.get('expired'), undefined);
  assert.equal(cache.get('new'), 'new');
});

test('replacing an entry at capacity preserves other entries', () => {
  const cache = new TtlCache<string>(10_000, Date.now, 2);
  cache.set('a', 'A');
  cache.set('b', 'B');
  cache.set('b', 'updated');
  assert.equal(cache.size, 2);
  assert.equal(cache.get('a'), 'A');
  assert.equal(cache.get('b'), 'updated');
});

test('limits each cache to 200 entries by default', () => {
  const cache = new TtlCache<number>(10_000);
  for (let i = 0; i < 201; i++) cache.set(String(i), i);
  assert.equal(cache.size, 200);
  assert.equal(cache.get('0'), undefined);
  assert.equal(cache.get('200'), 200);
});
