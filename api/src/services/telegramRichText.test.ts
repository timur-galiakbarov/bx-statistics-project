import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTelegramRichText } from './telegramRichText.js';

test('Telegram formatting preserves nested marks, paragraphs, blank lines and list bullets', () => {
  const result = normalizeTelegramRichText('<div><strong>Один <em>&amp; два</em></strong></div><div><br></div><ul><li>Три</li></ul>');
  assert.deepEqual(result, { html: '<b>Один <i>&amp; два</i></b>\n\n• Три', text: 'Один & два\n\n• Три' });
  assert.deepEqual(normalizeTelegramRichText(result.html), result);
});

test('Telegram rich text drops executable tags and attributes but keeps HTTPS links', () => {
  const result = normalizeTelegramRichText('<img src="x" onerror="bad()"><a href="javascript:bad()">опасно</a><a onclick="bad()" href="https://example.org/?a=1&amp;b=2"> ссылка</a><b onclick="bad()">&lt;img&gt;</b>');
  assert.equal(result.html, 'опасно<a href="https://example.org/?a=1&amp;b=2"> ссылка</a><b>&lt;img&gt;</b>');
  assert.equal(result.text, 'опасно ссылка<img>');
});
