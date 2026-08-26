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
