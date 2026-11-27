import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Schema, model } from 'mongoose';
import { DomainError } from '../errors/domainError.js';
import { ContentPlanPostModel } from '../models/ContentPlanPost.js';

const host = 'storage.yandexcloud.net';
const maxBytes = 5 * 1024 * 1024;
const day = 86_400_000;
const types = ['image/jpeg', 'image/png'];
const uploads = model('ContentPlanMedia', new Schema({
  _id: String,
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  writableUntil: { type: Date, required: true },
  cleanupAt: { type: Date, required: true, index: true },
  deleting: { type: Boolean, default: false }
}));

function settings() {
  const { CONTENT_PLAN_MEDIA_BUCKET: bucket, CONTENT_PLAN_MEDIA_ACCESS_KEY: access, CONTENT_PLAN_MEDIA_SECRET_KEY: secret } = process.env;
  return bucket && /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(bucket) && access && secret ? { bucket, access, secret } : null;
}

export const mediaEnabled = () => Boolean(settings());

function signing() {
  const config = settings();
  if (!config) throw new DomainError('Хранилище изображений не настроено.', { status: 503, code: 'MEDIA_DISABLED' });
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const short = date.slice(0, 8);
  const scope = short + '/ru-central1/s3/aws4_request';
  const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
  const key = ['ru-central1', 's3', 'aws4_request'].reduce(hmac, hmac('AWS4' + config.secret, short));
  return { ...config, date, scope, credential: config.access + '/' + scope, sign: (value: string) => hmac(key, value).toString('hex') };
}

function signedUrl(method: 'GET' | 'HEAD' | 'DELETE', key: string) {
  const auth = signing();
  const path = '/' + auth.bucket + '/' + key;
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': auth.credential,
    'X-Amz-Date': auth.date,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': 'host'
  }).toString();
  const request = [method, path, query, 'host:' + host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const signature = auth.sign(['AWS4-HMAC-SHA256', auth.date, auth.scope, createHash('sha256').update(request).digest('hex')].join('\n'));
  return 'https://' + host + path + '?' + query + '&X-Amz-Signature=' + signature;
}

export async function createMediaUpload(userId: string, type: unknown) {
  if (typeof type !== 'string' || !types.includes(type)) {
    throw new DomainError('Выберите изображение JPEG или PNG.', { status: 400, code: 'MEDIA_TYPE' });
  }
  if (await uploads.countDocuments({ userId, writableUntil: { $gt: new Date() } }) >= 10) {
    throw new DomainError('Слишком много загрузок. Попробуйте через несколько минут.', { status: 429, code: 'MEDIA_UPLOAD_LIMIT' });
  }
  const auth = signing();
  const writableUntil = new Date(Date.now() + 5 * 60_000);
  const id = 'content-plan/' + randomUUID();
  const fields = {
    key: id, 'Content-Type': type, 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': auth.credential, 'X-Amz-Date': auth.date
  };
  const policy = Buffer.from(JSON.stringify({
    expiration: writableUntil.toISOString(),
    conditions: [{ bucket: auth.bucket }, ...Object.entries(fields).map(([name, value]) => ({ [name]: value })), ['content-length-range', 1, maxBytes]]
  })).toString('base64');
  await uploads.create({ _id: id, userId, type, writableUntil, cleanupAt: new Date(Date.now() + day) });
  return { id, url: 'https://' + host + '/' + auth.bucket, fields: { ...fields, policy, 'X-Amz-Signature': auth.sign(policy) } };
}

export const mediaReadUrl = (id: string) => signedUrl('GET', id);

export async function confirmMedia(userId: string, id: unknown) {
  if (typeof id !== 'string' || !/^content-plan\/[a-f0-9-]{36}$/.test(id)) {
    throw new DomainError('Изображение не найдено.', { status: 404, code: 'MEDIA_NOT_FOUND' });
  }
  // Продлеваем срок перед проверкой, чтобы фоновая очистка не забрала объект во время сохранения.
  const media = await uploads.findOneAndUpdate({ _id: id, userId, deleting: false }, { cleanupAt: new Date(Date.now() + day) });
  if (!media) throw new DomainError('Изображение не найдено. Загрузите его снова.', { status: 404, code: 'MEDIA_NOT_FOUND' });
  const object = await fetch(signedUrl('HEAD', id), { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!object || object.status >= 500 || object.status === 403) {
    throw new DomainError('Хранилище изображений недоступно. Попробуйте позже.', { status: 503, code: 'MEDIA_STORAGE_UNAVAILABLE' });
  }
  const size = Number(object.headers.get('content-length'));
  if (!object.ok || object.headers.get('content-type') !== media.type || !size || size > maxBytes) {
    throw new DomainError('Не удалось подтвердить загрузку изображения.', { status: 422, code: 'MEDIA_UPLOAD_INVALID' });
  }
  return { id, previewUrl: mediaReadUrl(id) };
}

async function erase(id: string) {
  const result = await fetch(signedUrl('DELETE', id), { method: 'DELETE', signal: AbortSignal.timeout(5000) });
  if (!result.ok && result.status !== 404) throw new Error('Image cleanup failed: ' + result.status);
  await uploads.deleteOne({ _id: id });
}

export async function discardMedia(id: string) {
  const media = await uploads.findById(id).lean();
  if (!media) return;
  // Пока форма действительна, тот же ключ можно загрузить повторно.
  const cleanupAt = new Date(Math.max(Date.now(), media.writableUntil.getTime() + 60_000));
  await uploads.updateOne({ _id: id }, { deleting: true, cleanupAt });
  if (cleanupAt.getTime() <= Date.now()) await erase(id);
}

export async function cleanupMedia() {
  if (!mediaEnabled()) return;
  const now = new Date();
  for (const media of await uploads.find({ cleanupAt: { $lte: now } }).sort({ cleanupAt: 1 }).limit(5).lean()) {
    if (!media._id) continue;
    const post = await ContentPlanPostModel.findOne({ mediaId: media._id }).select('status updatedAt').lean();
    const keep = post && ['draft', 'scheduled', 'publishing'].includes(post.status);
    const retry = post?.status === 'failed' && now.getTime() - post.updatedAt.getTime() < 7 * day;
    if ((keep || retry) && !media.deleting) {
      await uploads.updateOne({ _id: media._id, cleanupAt: media.cleanupAt }, { cleanupAt: new Date(now.getTime() + day) });
      continue;
    }
    const claimed = await uploads.updateOne({ _id: media._id, cleanupAt: media.cleanupAt }, { deleting: true, cleanupAt: new Date(now.getTime() + 60_000) });
    if (claimed.matchedCount) await erase(media._id).catch(() => undefined);
  }
}
