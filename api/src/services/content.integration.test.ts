import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { contentRouter } from '../routes/content.js';
import { ContentProjectModel } from '../models/ContentProject.js';
import { ContentIdeaModel } from '../models/ContentIdea.js';
import { VkTokenModel } from '../models/VkToken.js';
import { DomainError } from '../errors/domainError.js';

// Запускайте только с отдельной тестовой базой. Внешние ВК и DeepSeek заменены ответами.
test('контент: доступ администраторов, изоляция проектов, повторы, блокировки и сохранение черновика', { skip: !process.env.CONTENT_TEST_MONGO_URI }, async () => {
  const uri = process.env.CONTENT_TEST_MONGO_URI!;
  assert.match(uri, /socstat_content_test(?:[/?]|$)/, 'Нужна отдельная база socstat_content_test');
  await mongoose.connect(uri);
  await Promise.all([ContentProjectModel.init(), ContentIdeaModel.init(), VkTokenModel.init()]);
  const user = String(new mongoose.Types.ObjectId()), other = String(new mongoose.Types.ObjectId());
  await VkTokenModel.create({ userId: user, accessToken: 'test-only' });
  const originalFetch = globalThis.fetch, previousKey = env.deepseekApiKey;
  env.deepseekApiKey = 'test-only';
  const group = { id: 123, name: 'Финансовый дневник', screen_name: 'finance_test', is_closed: 0, members_count: 1500, description: 'Личный бюджет и опыт' };
  let aiCalls = 0, invalidAi = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://api.vk.com/')) {
      const method = new URL(url).pathname.split('/').pop();
      return Response.json({ response: method === 'groups.getById' ? [group] : method === 'groups.search' ? { items: [group] } : { count: 1, items: [{ id: 1, date: Math.floor(Date.now() / 1000) - 2 * 86400, text: 'Подробный дневник семейного бюджета: как учитывать регулярные расходы и не забывать о небольших покупках. Практический пример с категориями.', views: { count: 130 }, likes: { count: 10 } }] } });
    }
    if (url.startsWith('https://api.deepseek.com/')) {
      aiCalls++;
      if (invalidAi) return Response.json({ choices: [{ message: { content: 'invalid json' } }] });
      const body = JSON.parse(String(init?.body)), prompt: string = body.messages[0].content;
      const result = prompt.includes('3–5') ? { audience: 'Семьи', style: 'Просто', exclusions: 'Без рекламы', rubrics: [{ name: 'Бюджет', description: 'Кейсы расходов' }] }
        : prompt.includes('до 6') ? { queries: ['бюджет'] }
        : prompt.includes('до 12') ? { ids: [123, 999] }
        : prompt.includes('Оцени источник') ? { suitable: true, reason: 'Практические кейсы бюджета', exampleIds: [1, 999] }
        : prompt.includes('самостоятельную публикацию') ? { draft: 'Как вести бюджет: выделите регулярные расходы. Источник: https://vk.com/wall-123_1' }
        : { items: [{ title: 'Как не терять мелкие расходы', rubric: 'Бюджет', reason: 'Понятный кейс', angle: 'Дать пример категорий', checks: 'Проверить исходные данные', postKeys: ['123_1'] }] };
      return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }], usage: { total_tokens: 100 } });
    }
    return originalFetch(input, init);
  };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    const actor = req.header('test-user');
    if (actor) {
      req.user = {
        id: actor,
        isAdmin: actor === user || actor === other,
        activeTo: actor === 'paid' ? '2099-01-01' : '2000-01-01'
      } as Express.Request['user'];
    }
    next();
  });
  app.use('/api/content', contentRouter);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof DomainError ? error.status : 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const call = async (path: string, method = 'GET', body?: unknown, actor = user) => {
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/content${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { 'test-user': actor } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, ...(await response.json() as { data?: any; message?: string }) };
  };
  try {
    assert.equal((await call('/projects', 'GET', undefined, '')).status, 401);
    assert.equal((await call('/projects', 'GET', undefined, 'expired')).status, 403);
    assert.equal((await call('/projects', 'GET', undefined, 'paid')).status, 403);
    assert.equal((await call('/projects', 'POST', { name: 'Чужой проект', brief: 'Проверка доступа' }, 'paid')).status, 403);
    assert.equal((await call('/projects')).status, 200);
    assert.equal((await call('/projects', 'POST', { name: 'Без задачи' })).status, 400);
    const created = await call('/projects', 'POST', { name: 'Тест контента', brief: 'Финансовые кейсы' });
    assert.equal(created.status, 200); const id = created.data.id, base = `/projects/${id}`;
    assert.equal((await call(base, 'GET', undefined, other)).status, 404);
    const profile = await call(`${base}/profile`, 'POST'); assert.equal(profile.data.rubrics.length, 1);
    await call(base, 'PATCH', { ...created.data, ...profile.data });
    const discovered = await call(`${base}/discover`, 'POST'); assert.equal(discovered.status, 200); assert.equal(discovered.data.project.sources.length, 1);
    assert.deepEqual(discovered.data.project.sources[0].examples, ['https://vk.com/wall-123_1']);
    await call(`${base}/sources/123`, 'PATCH', { status: 'excluded' });
    const repeated = await call(`${base}/discover`, 'POST'); assert.equal(repeated.data.project.sources[0].status, 'excluded');
    await call(`${base}/sources/123`, 'PATCH', { status: 'selected' });
    const scan = await call(`${base}/scan`, 'POST', { days: 7 }); assert.equal(scan.status, 200); assert.equal(scan.data.ideas.length, 1);
    const idea = scan.data.ideas[0], path = `${base}/ideas/${idea._id}`;
    assert.equal((await call(`${base}/scan`, 'POST', { days: 999 })).status, 400);
    const draft = await call(`${path}/draft`, 'POST'); assert.ok(draft.data.draft.includes('бюджет'));
    await call(path, 'PATCH', { draft: 'Моя редактура', status: 'published', feedback: 'Больше таких кейсов' });
    assert.equal((await call(`${path}/draft`, 'POST')).status, 400);
    assert.equal((await call(path, 'PATCH', { status: 'wrong' })).status, 400);
    assert.equal((await call(path, 'PATCH', { draft: 'Чужая правка' }, other)).status, 404);
    const before = aiCalls;
    const rescanned = await call(`${base}/scan`, 'POST', { days: 7 });
    assert.equal(aiCalls, before, 'Знакомые материалы повторно в ИИ не отправляются');
    assert.equal(rescanned.data.ideas.length, 1); assert.equal(rescanned.data.ideas[0].draft, 'Моя редактура'); assert.equal(rescanned.data.ideas[0].status, 'published');
    invalidAi = true;
    assert.equal((await call(`${base}/profile`, 'POST')).status, 503);
    assert.equal((await ContentProjectModel.findById(id))!.busyUntil, null, 'Ошибка ИИ освобождает блокировку');
    invalidAi = false;
    await ContentProjectModel.updateOne({ _id: id }, { $set: { busyUntil: new Date(Date.now() + 60000) } });
    assert.equal((await call(`${base}/scan`, 'POST', { days: 7 })).status, 429);
    assert.equal((await call(base, 'PATCH', created.data)).status, 400);
    await ContentProjectModel.updateOne({ _id: id }, { $set: { busyUntil: null, usageDay: new Date().toISOString().slice(0, 10), usageCount: 20 } });
    assert.equal((await call(`${base}/profile`, 'POST')).status, 429);
    assert.equal((await call(`${base}/sources/123`, 'DELETE', undefined, other)).status, 404);
    assert.equal((await call(`${base}/sources/123`, 'DELETE')).data.sources.length, 0);
    assert.equal((await call(base, 'DELETE', undefined, other)).status, 404);
    assert.equal((await call(base, 'DELETE')).status, 200);
    assert.equal((await call(base)).status, 404);
    assert.equal(await ContentIdeaModel.countDocuments({ projectId: id }), 0);
  } finally {
    globalThis.fetch = originalFetch; env.deepseekApiKey = previousKey;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([ContentProjectModel.deleteMany({ userId: user }), ContentIdeaModel.deleteMany({ userId: user }), VkTokenModel.deleteMany({ userId: user })]);
    await mongoose.disconnect();
  }
});
