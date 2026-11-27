import assert from 'node:assert/strict';
import test from 'node:test';
import { renderContentPlanMarkdown } from './contentPlanMarkdown';

test('content plan markdown escapes HTML', () => {
  assert.equal(renderContentPlanMarkdown('<script>alert(1)</script>'), '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>');
});

test('content plan markdown renders bold, italic and links', () => {
  assert.equal(renderContentPlanMarkdown('**жирный** и _курсив_'), '<div><strong>жирный</strong> и <em>курсив</em></div>');
  assert.equal(
    renderContentPlanMarkdown('[ссылка](https://example.com)'),
    '<div><a href="https://example.com" target="_blank" rel="noreferrer">ссылка</a></div>'
  );
});

test('content plan markdown renders lists and quotes', () => {
  assert.equal(renderContentPlanMarkdown('- один\n- два'), '<ul><li>один</li><li>два</li></ul>');
  assert.equal(renderContentPlanMarkdown('> цитата'), '<blockquote>цитата</blockquote>');
});


test('content plan markdown renders VK links', () => {
  assert.equal(
    renderContentPlanMarkdown('[https://example.com|ссылка]'),
    '<div><a href="https://example.com" target="_blank" rel="noreferrer">ссылка</a></div>'
  );
});

test('VK preview shows the wall text instead of Telegram formatting', () => {
  assert.equal(
    renderContentPlanMarkdown('**жирный** _курсив_ __линия__ ~~удалено~~ `код`\n- пункт\n> цитата', 'vk'),
    '<div style="white-space: pre-wrap">**жирный** *курсив* __линия__ ~~удалено~~ код\n• пункт\n— цитата</div>'
  );
});

test('VK preview converts both supported link forms and preserves line breaks', () => {
  assert.equal(
    renderContentPlanMarkdown('[сайт](https://example.com)\n\n[https://example.org|другой сайт]', 'vk'),
    '<div style="white-space: pre-wrap"><a href="https://example.com" target="_blank" rel="noreferrer">сайт</a>\n\n<a href="https://example.org" target="_blank" rel="noreferrer">другой сайт</a></div>'
  );
});

test('VK preview escapes HTML and never turns an unsafe URL into a link', () => {
  const html = renderContentPlanMarkdown('<img src=x onerror=alert(1)>\n[javascript:alert(1)|нажми]\n[текст](javascript:alert(1))', 'vk');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<a'));
});

test('Telegram preview keeps both italic syntaxes and its default platform', () => {
  const text = '*курсив* и _курсив_';
  assert.equal(renderContentPlanMarkdown(text, 'telegram'), '<div><em>курсив</em> и <em>курсив</em></div>');
  assert.equal(renderContentPlanMarkdown(text), renderContentPlanMarkdown(text, 'telegram'));
});
