function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/\[(https?:\/\/[^\]\s|]+)\|([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noreferrer">$2</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<u>$1</u>');
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  return html;
}

/**
 * Мини-markdown для предпросмотра поста. Вход экранируется, поэтому HTML из
 * текста не исполняется. Поддерживает жирный, курсив, подчёркивание,
 * зачёркивание, код, ссылки, списки и цитаты.
 */
export function renderContentPlanMarkdown(text: string, platform: 'telegram' | 'vk' = 'telegram') {
  if (platform === 'vk') {
    // Повторяет markdownToVkText на сервере: предпросмотр показывает текст,
    // который уйдёт на стену, без оформления, доступного только в Telegram.
    const wallText = String(text || '').split('\n').map((line) => {
      let value = line;
      if (/^\s*[-—•]\s+/.test(value)) value = '• ' + value.replace(/^\s*[-—•]\s+/, '');
      else if (/^\s*>\s?/.test(value)) value = '— ' + value.replace(/^\s*>\s?/, '');
      value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '[$2|$1]');
      value = value.replace(/(^|[^_])_([^_\n]+)_/g, '$1*$2*');
      value = value.replace(/`([^`]+)`/g, '$1');
      return value;
    }).join('\n');
    const html = escapeHtml(wallText).replace(
      /\[(https?:\/\/[^\]\s|]+)\|([^\]]+)\]/g,
      '<a href="$1" target="_blank" rel="noreferrer">$2</a>'
    );
    return '<div style="white-space: pre-wrap">' + html + '</div>';
  }
  const lines = String(text || '').split('\n');
  let html = '';
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  for (const line of lines) {
    if (/^\s*[-—•]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += '<li>' + renderInline(line.replace(/^\s*[-—•]\s+/, '')) + '</li>';
      continue;
    }
    closeList();
    if (/^\s*>\s?/.test(line)) {
      html += '<blockquote>' + renderInline(line.replace(/^\s*>\s?/, '')) + '</blockquote>';
      continue;
    }
    if (!line.trim()) {
      html += '<div class="cp-empty-line"></div>';
      continue;
    }
    html += '<div>' + renderInline(line) + '</div>';
  }
  closeList();
  return html;
}
