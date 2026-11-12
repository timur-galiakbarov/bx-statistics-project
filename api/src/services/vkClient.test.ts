import assert from 'node:assert/strict';
import test from 'node:test';
import { isVkPermissionDeniedError, isVkStatsUnavailableError, VkApiError } from './vkClient.js';

test('recognizes VK permission-denied responses used for restricted community statistics', () => {
  assert.equal(isVkPermissionDeniedError(new VkApiError('Permission denied', { vkCode: 7 })), true);
  assert.equal(isVkPermissionDeniedError(new VkApiError('Access denied', { vkCode: 15 })), true);
});

test('does not hide unrelated VK errors as unavailable statistics', () => {
  assert.equal(isVkPermissionDeniedError(new VkApiError('Too many requests', { vkCode: 6 })), false);
  assert.equal(isVkPermissionDeniedError(new Error('Access denied')), false);
});

test('treats VK internal error from stats.get as unavailable statistics', () => {
  assert.equal(isVkStatsUnavailableError(new VkApiError('Internal server error', { vkCode: 10 })), true);
  assert.equal(isVkStatsUnavailableError(new VkApiError('Access denied', { vkCode: 15 })), true);
  assert.equal(isVkStatsUnavailableError(new VkApiError('Too many requests', { vkCode: 6 })), false);
  assert.equal(isVkPermissionDeniedError(new VkApiError('Internal server error', { vkCode: 10 })), false);
});
