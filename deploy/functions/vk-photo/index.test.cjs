const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');
const { handler } = require('./index.js');

test('relay rejects unsigned requests and destinations outside VK', async (t) => {
  const secret = 'local-test-secret';
  const oldSecret = process.env.VK_PHOTO_RELAY_SECRET;
  const oldBucket = process.env.CONTENT_PLAN_MEDIA_BUCKET;
  process.env.VK_PHOTO_RELAY_SECRET = secret;
  process.env.CONTENT_PLAN_MEDIA_BUCKET = 'test-bucket';
  t.after(() => {
    if (oldSecret === undefined) delete process.env.VK_PHOTO_RELAY_SECRET;
    else process.env.VK_PHOTO_RELAY_SECRET = oldSecret;
    if (oldBucket === undefined) delete process.env.CONTENT_PLAN_MEDIA_BUCKET;
    else process.env.CONTENT_PLAN_MEDIA_BUCKET = oldBucket;
  });
  const http = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('An invalid request must not reach fetch');
  });
  const body = JSON.stringify({
    source: 'https://storage.yandexcloud.net/test-bucket/content-plan/photo',
    destination: 'https://vk.com.example.org/upload',
    expiresAt: Date.now() + 30_000
  });
  assert.equal((await handler({ body })).statusCode, 403);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal((await handler({ body, headers: { 'x-socstat-signature': signature } })).statusCode, 502);
  assert.equal(http.mock.calls.length, 0);
});
