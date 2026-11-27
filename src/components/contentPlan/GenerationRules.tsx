import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { ApiError } from '../../api/client';

export type SaveRules = (channelId: string, rules: string, previousRules: string) => Promise<void>;
export type RuleScope = 'common' | 'channel';

export const ruleLines = (text?: string) => (text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function GenerationRules({ common, channel, channelId, excluded, onToggle, onAddLocal, onSave, disabled }: {
  common: string;
  channel: string;
  channelId?: string;
  excluded: Record<RuleScope, string[]>;
  onToggle: (scope: RuleScope, value: string) => void;
  onAddLocal: (value: string) => boolean;
  onSave: SaveRules;
  disabled: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState('post');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    const rule = input.trim().replace(/\r?\n/g, ' ');
    if (!rule || saving) return;
    setError('');
    if (scope === 'post') {
      if (!onAddLocal(rule)) {
        setError('Пожелания к этому посту должны быть не длиннее 1 000 символов.');
        return;
      }
    } else {
      const previous = scope === 'channel' ? channel : common;
      if (!ruleLines(previous).includes(rule)) {
        setSaving(true);
        try {
          await onSave(scope === 'channel' ? channelId ?? '' : '', [...ruleLines(previous), rule].join('\n'), previous);
        } catch (reason) {
          setError(reason instanceof ApiError ? reason.message : 'Не удалось сохранить правило.');
          return;
        } finally {
          setSaving(false);
        }
      }
    }
    setInput('');
    setOpen(false);
  }

  async function remove(scope: RuleScope, rule: string) {
    const previous = scope === 'common' ? common : channel;
    setSaving(true);
    setError('');
    try {
      await onSave(scope === 'common' ? '' : channelId ?? '', ruleLines(previous).filter(value => value !== rule).join('\n'), previous);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Не удалось удалить правило.');
    } finally {
      setSaving(false);
    }
  }

  const groups: { key: RuleScope; label: string; items: string[] }[] = [
    { key: 'common', label: 'Все каналы', items: [...new Set(ruleLines(common))] },
    { key: 'channel', label: 'Этот канал', items: [...new Set(ruleLines(channel))] }
  ];

  return <div className="cp-generation-rules">
    {groups.map(({ key, label, items }) => items.length > 0 && <div key={key}>
      <small>{label}</small>
      {items.map(value => <div key={value} className="cp-rule-row">
        <label className="cp-rule-check">
          <input type="checkbox" checked={!excluded[key].includes(value)} disabled={disabled || saving}
            onChange={() => onToggle(key, value)} />
          <span>{value}</span>
        </label>
        <button type="button" className="cp-icon-button" disabled={disabled || saving}
          title="Удалить сохранённое правило" aria-label={'Удалить правило: ' + value}
          onClick={() => void remove(key, value)}><Trash2 size={14} aria-hidden="true" /></button>
      </div>)}
    </div>)}
    {groups.every(group => !group.items.length) && <small>Сохранённых правил пока нет.</small>}
    <button type="button" className="secondary-button" disabled={disabled || saving} aria-expanded={open}
      aria-controls={id} onClick={() => { setOpen(!open); setError(''); }}>+ Своё правило</button>
    {open && <div id={id} className="cp-rule-form">
      <label htmlFor={id + '-rule'}>Что учитывать?</label>
      <textarea id={id + '-rule'} rows={2} maxLength={300} value={input} disabled={disabled || saving}
        onChange={event => setInput(event.target.value)} />
      <div className="cp-ai-actions">
        <select aria-label="Где применять правило" value={scope} disabled={disabled || saving}
          onChange={event => setScope(event.target.value)}>
          <option value="post">Только этот пост</option>
          {channelId && <option value="channel">Выбранный канал</option>}
          <option value="common">Все каналы</option>
        </select>
        <button type="button" className="secondary-button" disabled={disabled || saving || !input.trim()}
          onClick={() => void add()}>{saving ? 'Сохраняем…' : 'Добавить'}</button>
      </div>
    </div>}
    {error && <p className="cp-ai-error" role="alert">{error}</p>}
  </div>;
}
