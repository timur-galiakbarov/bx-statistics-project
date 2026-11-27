const { createHmac, timingSafeEqual } = require('node:crypto');

const maxBytes = 5 * 1024 * 1024;
const reply = (statusCode, value) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(value)
});

function allowedUrl(value, isStorage) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) throw new Error('Invalid URL');
  const valid = isStorage
    ? url.hostname === 'storage.yandexcloud.net' && url.pathname.startsWith('/' + process.env.CONTENT_PLAN_MEDIA_BUCKET + '/content-plan/')
    : /(^|\.)(vk\.com|userapi\.com|vkuserphoto\.ru)$/.test(url.hostname);
  if (!valid) throw new Error('Unsupported host');
  return url;
}

exports.handler = async (event) => {
  const secret = process.env.VK_PHOTO_RELAY_SECRET;
  const signed = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'x-socstat-signature')?.[1];
  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
  if (!secret || typeof body !== 'string' || body.length > 8192 || typeof signed !== 'string' || !/^[a-f0-9]{64}$/.test(signed)) {
    return reply(403, { error: 'Forbidden' });
  }
  if (!timingSafeEqual(Buffer.from(signed, 'hex'), createHmac('sha256', secret).update(body).digest())) {
    return reply(403, { error: 'Forbidden' });
  }

  try {
    const { source, destination, expiresAt } = JSON.parse(body);
    const now = Date.now();
    if (!Number.isFinite(expiresAt) || expiresAt < now || expiresAt > now + 60_000) return reply(403, { error: 'Expired' });
    if (!process.env.CONTENT_PLAN_MEDIA_BUCKET) return reply(503, { error: 'Bucket not configured' });
    const sourceUrl = allowedUrl(source, true);
    const uploadUrl = allowedUrl(destination, false);
    const signal = AbortSignal.timeout(20_000);
    const photo = await fetch(sourceUrl, { redirect: 'error', signal });
    const size = Number(photo.headers.get('content-length'));
    const type = photo.headers.get('content-type');
    if (!photo.ok || !size || size > maxBytes || !['image/jpeg', 'image/png'].includes(type)) {
      return reply(422, { error: 'Invalid image metadata' });
    }
    const blob = await photo.blob();
    if (blob.size !== size) return reply(422, { error: 'Invalid image size' });
    const form = new FormData();
    form.append('photo', blob, type === 'image/png' ? 'photo.png' : 'photo.jpg');
    const result = await fetch(uploadUrl, { method: 'POST', body: form, redirect: 'error', signal });
    if (!result.ok) return reply(502, { error: 'VK upload failed' });
    const data = await result.json();
    if (!Number.isSafeInteger(data.server) || typeof data.photo !== 'string' || data.photo === '[]' ||
        typeof data.hash !== 'string' || !data.hash) return reply(502, { error: 'VK upload failed' });
    return reply(200, { server: data.server, photo: data.photo, hash: data.hash });
  } catch {
    return reply(502, { error: 'Photo transfer failed' });
  }
};
