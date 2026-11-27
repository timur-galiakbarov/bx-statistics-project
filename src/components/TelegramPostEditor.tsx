import { useLayoutEffect, useRef, useState } from 'react';
import { normalizeTelegramRichText } from '../../api/src/services/telegramRichText';
import { renderContentPlanMarkdown } from '../utils/contentPlanMarkdown';

const styles = [
  ['bold', 'Жирный', 'Ж'],
  ['italic', 'Курсив', 'К'],
  ['underline', 'Подчёркнутый', 'Ч'],
  ['strikeThrough', 'Зачёркнутый', 'З'],
  ['insertUnorderedList', 'Список', '•'],
  ['formatBlock', 'Цитата', '❝'],
] as const;

export function TelegramPostEditor({ text, html, disabled, onChange }: {
  text: string;
  html?: string;
  disabled: boolean;
  onChange: (text: string, html: string) => void;
}) {
  const field = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string | undefined>(undefined);
  const selection = useRef<Range | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);

  useLayoutEffect(() => {
    if (!field.current || (html !== undefined && html === lastHtml.current)) return;
    field.current.innerHTML = html === undefined
      ? normalizeTelegramRichText(renderContentPlanMarkdown(text).split('<div class="cp-empty-line"></div>').join('<br>')).html.replace(/\n/g, '<br>')
      : normalizeTelegramRichText(html).html.replace(/\n/g, '<br>');
    lastHtml.current = html;
  }, [text, html]);

  const saveSelection = () => {
    const current = window.getSelection();
    if (current?.rangeCount && field.current?.contains(current.getRangeAt(0).commonAncestorContainer)) {
      selection.current = current.getRangeAt(0).cloneRange();
    }
  };

  const sync = () => {
    if (!field.current) return;
    const normalized = normalizeTelegramRichText(field.current.innerHTML);
    lastHtml.current = normalized.html;
    onChange(normalized.text, normalized.html);
  };

  const apply = (command: string, value?: string) => {
    if (disabled || !field.current) return;
    field.current.focus();
    const current = window.getSelection();
    if (selection.current && field.current.contains(selection.current.commonAncestorContainer)) {
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
    if (command === 'formatBlock') {
      const node = current?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      value = element?.closest('blockquote') ? 'div' : 'blockquote';
    }
    document.execCommand(command, false, value);
    saveSelection();
    sync();
  };

  return <>
    <div className="cp-md-toolbar" role="group" aria-label="Форматирование текста">
      {styles.map(([command, label, icon]) => (
        <button key={command} disabled={disabled} type="button" title={label} aria-label={label}
          onMouseDown={(event) => event.preventDefault()} onClick={() => apply(command)}>{icon}</button>
      ))}
      <button disabled={disabled} type="button" title="Вставить ссылку" aria-label="Вставить ссылку"
        onMouseDown={(event) => event.preventDefault()} onClick={() => { saveSelection(); setLink(''); setLinkError(false); }}>↗</button>
    </div>
    {link !== null && <div className="cp-rich-link">
      <label>Адрес ссылки<input autoFocus type="url" value={link} placeholder="https://…" onChange={(event) => setLink(event.target.value)} /></label>
      <button type="button" className="secondary-button" onClick={() => {
        const url = link.trim();
        if (!/^https?:\/\/[^\s<>"]+$/i.test(url)) { setLinkError(true); return; }
        const selected = selection.current && !selection.current.collapsed;
        apply(selected ? 'createLink' : 'insertText', url);
        setLink(null);
      }}>Вставить</button>
      <button type="button" className="secondary-button" onClick={() => { setLink(null); field.current?.focus(); }}>Отмена</button>
      {linkError && <span role="alert">Введите адрес с https:// или http://.</span>}
    </div>}
    <div ref={field} contentEditable={!disabled} suppressContentEditableWarning
      className="cp-md-textarea cp-rich-editor" role="textbox" aria-label="Текст поста" aria-multiline="true"
      aria-disabled={disabled} onInput={sync} onBlur={saveSelection} onMouseUp={saveSelection} onKeyUp={saveSelection}
      onPaste={(event) => {
        event.preventDefault();
        saveSelection();
        apply('insertText', event.clipboardData.getData('text/plain'));
      }}
      onDrop={(event) => event.preventDefault()} />
    <p className="cp-md-hint">Выделите текст, чтобы применить форматирование.</p>
  </>;
}
