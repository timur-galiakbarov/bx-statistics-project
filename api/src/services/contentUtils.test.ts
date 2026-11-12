import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint, parseIdeas, parseRubrics, projectInput, targetUrl, uniquePosts, vkRef, type ContentPost } from './contentUtils.js';

const post = (key: string, text = 'Полезная история о бюджете семьи') : ContentPost => ({ key, text, sourceId: 1, sourceName: 'Автор', url: 'https://vk.com/wall-1_2', date: new Date().toISOString(), views: 100, actions: 10, relative: null });
test('ссылки назначения ограничены ВК и Telegram, источник — только ВК', () => {
  assert.equal(targetUrl('vk.com/club123/'), 'https://vk.com/club123');
  assert.equal(targetUrl('https://t.me/test_channel'), 'https://t.me/test_channel');
  for (const bad of ['javascript:alert(1)', 'https://vk.com.evil.org/a', 'https://evil@vk.com/a', 'https://vk.com:8080/a', 'https://vk.com/a/b']) assert.throws(() => targetUrl(bad));
  assert.equal(vkRef('https://vk.com/public123'), '123');
  assert.equal(vkRef('https://vk.ru/author'), 'author');
  assert.throws(() => vkRef('https://t.me/author'));
});
test('проект требует название и задачу, рубрики проверяются и ограничиваются', () => {
  assert.throws(() => projectInput({ name: 'Тест' }));
  assert.equal(projectInput({ name: 'Тест', brief: 'Идеи' }).rubrics.length, 0);
  assert.throws(() => parseRubrics([{ name: 'Вклады' }, { name: 'вклады' }]));
  assert.throws(() => parseRubrics([{ name: '' }]));
  assert.throws(() => parseRubrics(Array.from({ length: 9 }, (_, i) => ({ name: String(i) }))));
});
test('повторы текста объединяются независимо от ссылок, регистра и знаков', () => {
  assert.equal(fingerprint('Бюджет семьи! https://example.org'), fingerprint('бюджет семьи'));
  assert.equal(uniquePosts([post('a'), post('b'), post('c', 'Другая тема и содержание')]).length, 2);
});
test('идеи принимают только реальные посты и рубрики, ссылки берутся из данных сервера', () => {
  const candidate = { title: 'Кейс', rubric: 'Бюджет', reason: 'Полезно', angle: 'Разбор', postKeys: ['a'], url: 'https://evil.org' };
  const result = parseIdeas({ items: [candidate, { ...candidate, postKeys: ['unknown'] }, { ...candidate, rubric: 'Выдуманная' }, candidate] }, [post('a')], [{ name: 'Бюджет', description: '' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].references[0].url, 'https://vk.com/wall-1_2');
  assert.throws(() => parseIdeas({ items: 'wrong' }, [], []));
  assert.deepEqual(parseIdeas({ items: [] }, [], []), []);
});
