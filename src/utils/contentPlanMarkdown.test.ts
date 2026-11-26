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
