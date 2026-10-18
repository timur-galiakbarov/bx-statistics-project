import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramTaskTimeoutError, withTaskTimeout } from './telegramProtection.js';

test('withTaskTimeout returns the result of a task that settles in time', async () => {
  let timedOut = false;
  const result = await withTaskTimeout(Promise.resolve(42), 50, () => { timedOut = true; });
  assert.equal(result, 42);
  assert.equal(timedOut, false);
});

test('withTaskTimeout passes through the error of a task that fails in time', async () => {
  await assert.rejects(withTaskTimeout(Promise.reject(new Error('FLOOD_WAIT_10')), 50), /FLOOD_WAIT_10/);
});

test('withTaskTimeout rejects a hung task and calls the timeout handler once', async () => {
  let timeouts = 0;
  const hung = new Promise<never>(() => undefined);
  await assert.rejects(withTaskTimeout(hung, 20, () => { timeouts += 1; }), TelegramTaskTimeoutError);
  assert.equal(timeouts, 1);
});
