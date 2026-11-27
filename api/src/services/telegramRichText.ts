// The editor sends a small HTML subset. Rebuild every tag and attribute before preview or publication.
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const tags = new Set(['b', 'i', 'u', 's', 'code', 'blockquote']);
const aliases: Record<string, string> = { strong: 'b', em: 'i', strike: 's' };

function decode(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, key: string) => entities[key] ?? "'");
}

function escape(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

export function normalizeTelegramRichText(input: string) {
  let html = '';
  let text = '';
  const open: string[] = [];
  const append = (value: string) => { html += escape(value); text += value; };
  const newline = () => { if (text && !text.endsWith('\n')) append('\n'); };
  for (const part of input.match(/<[^>]*>|[^<]+|</g) ?? []) {
    const tag = /^<(\/?)([a-z]+)(\s[^>]*)?>$/i.exec(part);
    if (!tag) { append(decode(part)); continue; }
    const raw = tag[2].toLowerCase();
    const name = aliases[raw] ?? raw;
    if (name === 'br') { append('\n'); continue; }
    if (name === 'div' || name === 'p' || name === 'ul' || name === 'ol') { newline(); continue; }
    if (name === 'li') { newline(); if (!tag[1]) append('• '); continue; }
    if (tag[1]) {
      if (open[open.length - 1] === name) {
        open.pop();
        html += '</' + name + '>';
      }
      continue;
    }
    if (name === 'a') {
      const attr = /(?:^|\s)href="([^"]*)"/i.exec(tag[3] ?? '');
      const href = attr ? decode(attr[1]) : '';
      if (!/^https?:\/\/[^\s<>"]+$/i.test(href) || open.includes('a')) continue;
      html += '<a href="' + escape(href) + '">';
    } else if (tags.has(name) && !open.includes(name)) {
      if (name === 'blockquote') newline();
      html += '<' + name + '>';
    } else continue;
    open.push(name);
  }
  for (const tag of open.reverse()) html += '</' + tag + '>';
  return { html: html.trim(), text: text.trim() };
}
