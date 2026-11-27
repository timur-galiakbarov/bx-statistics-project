import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { confirmMedia, createMediaUpload } from './contentPlanMedia.js';

test('photo upload policy restricts the destination, file size and MIME type', async (t) => {
  const names = ['CONTENT_PLAN_MEDIA_BUCKET', 'CONTENT_PLAN_MEDIA_ACCESS_KEY', 'CONTENT_PLAN_MEDIA_SECRET_KEY'];
  const previous = names.map((name) => process.env[name]);
  names.forEach((name, index) => { process.env[name] = ['test-media', 'test-access', 'test-secret'][index]; });
  t.after(() => names.forEach((name, index) => {
    if (previous[index] === undefined) delete process.env[name];
    else process.env[name] = previous[index];
  }));
  const model = mongoose.models.ContentPlanMedia;
  t.mock.method(model, 'countDocuments', async () => 0);
  const create = t.mock.method(model, 'create', async () => ({}));

  await assert.rejects(createMediaUpload('user-a', 'image/svg+xml'), /JPEG или PNG/);
  const result = await createMediaUpload('user-a', 'image/png');
  const policy = JSON.parse(Buffer.from(result.fields.policy, 'base64').toString());
  assert.equal(result.url, 'https://storage.yandexcloud.net/test-media');
  assert.equal(result.fields.key, result.id);
  assert.deepEqual(policy.conditions.slice(0, 3), [{ bucket: 'test-media' }, { key: result.id }, { 'Content-Type': 'image/png' }]);
  assert.deepEqual(policy.conditions.at(-1), ['content-length-range', 1, 5 * 1024 * 1024]);
  assert.match(result.fields['X-Amz-Signature'], /^[a-f\d]{64}$/);
  assert.equal(create.mock.calls.length, 1);

  const lookup = t.mock.method(model, 'findOneAndUpdate', async () => null);
  const fetchSpy = t.mock.method(globalThis, 'fetch', async () => new Response());
  await assert.rejects(confirmMedia('user-b', result.id), /Изображение не найдено/);
  assert.deepEqual(lookup.mock.calls[0].arguments[0], { _id: result.id, userId: 'user-b', deleting: false });
  assert.equal(fetchSpy.mock.calls.length, 0);
});
