import assert from 'node:assert/strict';
import test from 'node:test';
import { isVkPermissionDeniedError, VkApiError } from './vkClient.js';

test('recognizes VK permission-denied responses used for restricted community statistics', () => {
  assert.equal(isVkPermissionDeniedError(new VkApiError('Permission denied', { vkCode: 7 })), true);
  assert.equal(isVkPermissionDeniedError(new VkApiError('Access denied', { vkCode: 15 })), true);
});

test('does not hide unrelated VK errors as unavailable statistics', () => {
  assert.equal(isVkPermissionDeniedError(new VkApiError('Too many requests', { vkCode: 6 })), false);
  assert.equal(isVkPermissionDeniedError(new Error('Access denied')), false);
});
