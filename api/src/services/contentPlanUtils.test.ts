import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../errors/domainError.js';
import { markdownToTelegramHtml, normalizeTelegramChannelRef } from './contentPlanUtils.js';

test('normalizeTelegramChannelRef принимает @username и ссылки', () => {
  assert.equal(normalizeTelegramChannelRef('@money_planner'), '@money_planner');
  assert.equal(normalizeTelegramChannelRef('https://t.me/money_planner'), '@money_planner');
  assert.equal(normalizeTelegramChannelRef('t.me/money_planner/123'), '@money_planner');
  assert.equal(normalizeTelegramChannelRef('https://telegram.me/money_planner?single'), '@money_planner');
});

test('normalizeTelegramChannelRef принимает числовой chat_id', () => {
  assert.equal(normalizeTelegramChannelRef('-1001234567890'), '-1001234567890');
});

test('normalizeTelegramChannelRef отклоняет пустую строку и приватные ссылки', () => {
  assert.throws(() => normalizeTelegramChannelRef('   '), (error) => error instanceof DomainError && error.code === 'TELEGRAM_CHANNEL_REF_REQUIRED');
  assert.throws(() => normalizeTelegramChannelRef('https://t.me/+abcdef'), (error) => error instanceof DomainError && error.code === 'TELEGRAM_PRIVATE_CHANNEL');
});

test('normalizeTelegramChannelRef отклоняет мусор', () => {
  assert.throws(() => normalizeTelegramChannelRef('ab'), (error) => error instanceof DomainError && error.code === 'TELEGRAM_CHANNEL_REF_INVALID');
});


test('markdownToTelegramHtml экранирует HTML и форматирует текст', () => {
  assert.equal(markdownToTelegramHtml('**жирный** и <b>'), '<b>жирный</b> и &lt;b&gt;');
  assert.equal(markdownToTelegramHtml('[ссылка](https://example.com)'), '<a href="https://example.com">ссылка</a>');
  assert.equal(markdownToTelegramHtml('- один\n> цитата'), '• один\n<blockquote>цитата</blockquote>');
});
