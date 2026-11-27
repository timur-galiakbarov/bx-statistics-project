import { Sparkles, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiError, apiGet, apiPost } from '../../api/client';
import { GenerationRules, ruleLines, type RuleScope, type SaveRules } from './GenerationRules';

type ImageQuota = { remaining: number | null; period: 'trial' | 'day' | 'unlimited' };
type StagedImage = { id: string; previewUrl: string };
type ImageVersion = {
  file: File;
  prompt: string;
  refinement?: string;
  rules: string[];
  staged?: StagedImage;
};
const endpoint = '/api/content-plan/ai/image';

export function PostImageGenerator({ disabled, hasPhoto, channelId, commonRules, channelRules, onSaveRules, onStage, onAttach }: {
  disabled: boolean;
  hasPhoto: boolean;
  channelId: string;
  commonRules: string;
  channelRules: string;
  onSaveRules: SaveRules;
  onStage: (file: File) => Promise<StagedImage>;
  onAttach: (image: StagedImage) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [prompt, setPrompt] = useState('');
  const [note, setNote] = useState('');
  const [refinement, setRefinement] = useState('');
  const [excluded, setExcluded] = useState<Record<RuleScope, string[]>>({ common: [], channel: [] });
  const [versions, setVersions] = useState<ImageVersion[]>([]);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState('');
  const [quota, setQuota] = useState<ImageQuota>();
  const [busy, setBusy] = useState<'generate' | 'attach'>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const version = versions[selected];
  const file = version?.file;
  const canGenerate = quota && (quota.remaining === null || quota.remaining > 0);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function refreshQuota() {
    setChecking(true);
    try {
      setQuota(await apiGet<ImageQuota>(endpoint));
    } catch (reason) {
      setQuota(undefined);
      setError(reason instanceof ApiError ? reason.message : 'Не удалось проверить лимит.');
    } finally {
      setChecking(false);
    }
  }

  async function stage(index: number, source: ImageVersion) {
    if (source.staged) return source.staged;
    const staged = await onStage(source.file);
    setVersions(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, staged } : item));
    return staged;
  }

  async function generate(editing = false) {
    const description = (editing ? version?.prompt : prompt)?.trim();
    if (!description || disabled || busy || !canGenerate || (editing && (!version || !refinement.trim()))) return;
    setBusy('generate');
    setError('');
    setConfirmReplace(false);
    try {
      const source = editing && version ? await stage(selected, version) : undefined;
      const result = await apiPost<ImageQuota & { image: string }>(endpoint, {
        prompt: description, channelId, postNote: note,
        excludeCommonRules: excluded.common, excludeChannelRules: excluded.channel,
        ...(source ? { sourceMediaId: source.id, refinement } : {})
      });
      const bytes = Uint8Array.from(atob(result.image), character => character.charCodeAt(0));
      const rules = [
        ...ruleLines(commonRules).filter(rule => !excluded.common.includes(rule)),
        ...ruleLines(channelRules).filter(rule => !excluded.channel.includes(rule)),
        ...ruleLines(note)
      ];
      setSelected(versions.length);
      setVersions(current => [...current, {
        file: new File([bytes], 'generated-post.jpg', { type: 'image/jpeg' }),
        prompt: description, refinement: source ? refinement.trim() : undefined, rules
      }]);
      setRefinement('');
      setQuota(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сгенерировать изображение.');
      await refreshQuota();
    } finally {
      setBusy(undefined);
    }
  }

  function close() {
    if (busy) return;
    dialog.current?.close();
  }

  async function attach() {
    if (!version || disabled || busy) return;
    if (hasPhoto && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setBusy('attach');
    setError('');
    try {
      const media = version.staged
        ? await apiPost<StagedImage>('/api/content-plan/media/confirm', { id: version.staged.id })
        : await stage(selected, version);
      onAttach(media);
      dialog.current?.close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось прикрепить фото.');
    } finally {
      setBusy(undefined);
    }
  }

  return <>
    <button type="button" className="secondary-button" ref={trigger} disabled={disabled}
      aria-haspopup="dialog" onClick={() => {
        setError('');
        setConfirmReplace(false);
        dialog.current?.showModal();
        void refreshQuota();
      }}><Sparkles size={16} aria-hidden="true" /> {versions.length ? 'Варианты и уточнения' : 'Создать с ИИ'}</button>
    <dialog ref={dialog} className="cp-image-studio" aria-labelledby={id + '-title'}
      onClose={() => trigger.current?.focus()} onCancel={event => { if (busy) event.preventDefault(); }}>
      <header className="cp-image-studio-head">
        <h3 id={id + '-title'}>Изображение для поста</h3>
        <button type="button" className="cp-icon-button" aria-label="Закрыть" disabled={Boolean(busy)} onClick={close}><X size={18} /></button>
      </header>
      <div className="cp-image-studio-body">
        <section className="cp-image-studio-settings">
          <label className="cp-field">
            <span>Что должно быть на изображении?</span>
            <textarea rows={3} maxLength={1000} value={prompt} disabled={Boolean(busy)}
              placeholder="Например, чашка кофе у окна" onChange={event => setPrompt(event.target.value)} />
          </label>
          <section className="cp-image-rules">
            <h4>Правила для картинки</h4>
            <GenerationRules common={commonRules} channel={channelRules} channelId={channelId}
              excluded={excluded} disabled={Boolean(busy)} onSave={onSaveRules}
              onToggle={(scope, rule) => setExcluded(current => ({
                ...current, [scope]: current[scope].includes(rule) ? current[scope].filter(item => item !== rule) : [...current[scope], rule]
              }))}
              onAddLocal={rule => {
                const value = [note.trim(), rule].filter(Boolean).join('\n');
                if (value.length > 1000) return false;
                setNote(value);
                return true;
              }} />
            {note && <label className="cp-field"><span>Только этот пост</span>
              <textarea rows={2} maxLength={1000} value={note} disabled={Boolean(busy)} onChange={event => setNote(event.target.value)} />
            </label>}
          </section>
          <button type="button" className="secondary-button" disabled={disabled || Boolean(busy) || !canGenerate || !prompt.trim()}
            onClick={() => void generate()}>{version ? 'Создать по описанию' : 'Создать изображение'}</button>
          {!quota && error && <button type="button" className="secondary-button" disabled={checking}
            onClick={() => { setError(''); void refreshQuota(); }}>Проверить доступ</button>}
        </section>
        <section className="cp-image-studio-result" aria-label="Предпросмотр изображения">
          {version ? <>
            {preview && <img src={preview} alt={'Сгенерированное изображение, вариант ' + (selected + 1)} />}
            <div className="cp-image-versions" role="group" aria-label="Варианты изображения">
              {versions.map((_, index) => <button type="button" key={index} className="secondary-button"
                aria-pressed={selected === index} disabled={Boolean(busy)} onClick={() => {
                  setSelected(index); setRefinement(''); setConfirmReplace(false);
                }}>Вариант {index + 1}</button>)}
            </div>
            {version.refinement && <small>Уточнение: {version.refinement}</small>}
            {version.rules.length > 0 && <details><summary>Правила этого варианта</summary>
              <ul>{version.rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul>
            </details>}
            <label className="cp-field">
              <span>Что изменить в этом варианте?</span>
              <textarea rows={2} maxLength={1000} value={refinement} disabled={Boolean(busy)}
                placeholder="Например, сделай фон светлее" onChange={event => setRefinement(event.target.value)} />
            </label>
            <button type="button" className="secondary-button" disabled={disabled || Boolean(busy) || !canGenerate || !refinement.trim()}
              onClick={() => void generate(true)}>Создать новый вариант</button>
          </> : <div className="cp-image-empty">Здесь появится изображение</div>}
        </section>
      </div>
      {error && <p className="cp-ai-error cp-image-error" role="alert">{error}</p>}
      <footer className="cp-image-studio-foot">
        <small role="status">{busy === 'generate' ? 'Генерируем изображение…' : busy === 'attach' ? 'Прикрепляем фото…' :
          confirmReplace ? 'Текущее фото поста будет заменено.' : checking ? 'Проверяем лимит…' : quota
            ? quota.remaining === null ? 'Без лимита' : 'Осталось ' + quota.remaining + (quota.period === 'trial' ? ' на весь триал' : ' сегодня') : ''}</small>
        <button type="button" className="primary-button" disabled={!version || disabled || Boolean(busy)}
          onClick={() => void attach()}>{confirmReplace ? 'Заменить фото' : 'Прикрепить к посту'}</button>
      </footer>
    </dialog>
  </>;
}
