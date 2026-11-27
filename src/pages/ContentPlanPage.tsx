import { TelegramPostEditor } from '../components/TelegramPostEditor';
import { normalizeTelegramRichText } from '../../api/src/services/telegramRichText';
import {
  AlertCircle,
  Bot,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  List,
  ImagePlus,
  Plus,
  Pencil,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../api/client';
import { renderContentPlanMarkdown } from '../utils/contentPlanMarkdown';
import { GenerationRules, type RuleScope, type SaveRules } from '../components/contentPlan/GenerationRules';
import { PostImageGenerator } from '../components/contentPlan/PostImageGenerator';
import './content.css';
import './content-plan.css';

type TextQuota = { remaining: number | null; period: 'day' | 'month' | 'unlimited' };
type EditorStep = 1 | 2 | 3;

function PostTextGenerator({ step, platform, caption, disabled, text, channel, commonRules, footerActions, onStartManual, onInsert, onSaveRules }: {
  step: EditorStep;
  platform: 'vk' | 'telegram';
  caption: boolean;
  disabled: boolean;
  text: string;
  channel?: PlanChannel;
  commonRules: string;
  footerActions: HTMLDivElement | null;
  onStartManual: () => void;
  onInsert: (text: string) => void;
  onSaveRules: SaveRules;
}) {
  const id = useId();
  const active = useRef(false);
  const [tone, setTone] = useState('Тепло');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Record<RuleScope, string[]>>({ common: [], channel: [] });
  const [topic, setTopic] = useState('');
  const [postNote, setPostNote] = useState('');
  const [proposal, setProposal] = useState<{ text: string; caption: boolean; style: string[] }>();
  const [appliedStyle, setAppliedStyle] = useState<string[]>([]);
  const [quota, setQuota] = useState<TextQuota>();
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [inserted, setInserted] = useState('');
  const [learning, setLearning] = useState(false);
  const [rule, setRule] = useState('');
  const [scope, setScope] = useState(channel?.id ?? '');
  const [ruleBusy, setRuleBusy] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const result = proposal?.caption === caption ? proposal.text : '';
  const canLearn = inserted.trim() && text.trim() && inserted.trim() !== text.trim();
  const endpoint = '/api/content-plan/ai/text';
  const canGenerate = quota && (quota.remaining === null || quota.remaining > 0);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (step === 1) void refreshQuota();
  }, [step]);

  async function refreshQuota() {
    setChecking(true);
    try {
      setQuota(await apiGet<TextQuota>(endpoint));
    } catch (reason) {
      setQuota(undefined);
      setError(reason instanceof ApiError ? reason.message : 'Не удалось проверить лимит.');
    } finally {
      setChecking(false);
    }
  }

  async function generate() {
    if (busy || disabled || checking || ruleBusy || !topic.trim() || !canGenerate) return;
    setBusy(true);
    setError('');
    setConfirmReplace(false);
    try {
      const response = await apiPost<TextQuota & { text: string }>(endpoint, {
        topic, platform, caption, channelId: channel?.id, postNote,
        tone, preferences, excludeCommonRules: excluded.common, excludeChannelRules: excluded.channel
      });
      if (!active.current) return;
      const style = [tone, ...preferences];
      if (text.trim()) setProposal({ text: response.text, caption, style });
      else applyProposal(response.text, style);
      setQuota(response);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Не удалось сгенерировать текст. Попробуйте снова.');
      await refreshQuota();
    } finally {
      setBusy(false);
    }
  }

  function applyProposal(value: string, style: string[]) {
    setAppliedStyle(style);
    setInserted(value);
    setLearning(false);
    setRule('');
    setProposal(undefined);
    setConfirmReplace(false);
    onInsert(value);
  }

  function insert() {
    if (!result) return;
    if (text.trim() && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    applyProposal(result, proposal?.style ?? []);
  }

  async function suggestRule() {
    if (ruleBusy || disabled) return;
    setLearning(true);
    setRuleBusy(true);
    setRule('');
    setRuleError('');
    try {
      const response = await apiPost<TextQuota & { rule: string }>('/api/content-plan/ai/writing-rule', { original: inserted, edited: text });
      setQuota(response);
      setRule(response.rule);
      if (!response.rule) setRuleError('Подходящего правила не нашлось. Сформулируйте его своими словами.');
    } catch (reason) {
      setRuleError(reason instanceof ApiError ? reason.message : 'Не удалось предложить правило.');
      void refreshQuota();
    } finally {
      setRuleBusy(false);
    }
  }

  async function rememberRule() {
    const previousRules = scope ? channel?.writingRules ?? '' : commonRules;
    setRuleBusy(true);
    setRuleError('');
    try {
      await onSaveRules(scope, [previousRules, rule.trim()].filter(Boolean).join('\n'), previousRules);
      setInserted(text);
      setLearning(false);
    } catch (reason) {
      setRuleError(reason instanceof ApiError ? reason.message : 'Не удалось сохранить правило.');
    } finally {
      setRuleBusy(false);
    }
  }

  return <div className="cp-ai cp-wizard-text-generator" hidden={step === 3}>
    {step === 1 && <div className="cp-wizard-idea" id={id}>
      <label htmlFor={id + '-topic'}>О чём пост?</label>
      <textarea id={id + '-topic'} autoFocus rows={3} maxLength={1000} value={topic}
        disabled={disabled || busy} placeholder="Например, анонс мастер-класса по керамике. Укажи, что можно прийти без опыта."
        onChange={(event) => setTopic(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void generate();
          }
        }} />
      <details className="cp-writing-preview">
        <summary>Как написать этот пост · {tone.toLowerCase()}</summary>
        <fieldset className="cp-tone-options">
          <legend>Тон</legend>
          {['Тепло', 'Нейтрально', 'Бодро'].map(value => <button key={value} type="button"
            className="secondary-button" aria-pressed={tone === value} disabled={busy || disabled}
            onClick={() => setTone(value)}>{value}</button>)}
        </fieldset>
        {['Покороче, только по делу', 'Добавить эмодзи в заголовок', 'Закончить понятным действием'].map(value =>
          <label className="cp-rule-check" key={value}>
            <input type="checkbox" checked={preferences.includes(value)} disabled={busy || disabled}
              onChange={() => setPreferences(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} />{value}
          </label>
        )}
        <GenerationRules common={commonRules} channel={channel?.writingRules ?? ''} channelId={channel?.id}
          excluded={excluded} disabled={busy || disabled} onSave={onSaveRules}
          onToggle={(scope, value) => setExcluded(current => ({
            ...current, [scope]: current[scope].includes(value) ? current[scope].filter(item => item !== value) : [...current[scope], value]
          }))}
          onAddLocal={value => {
            const next = [postNote.trim(), value].filter(Boolean).join('\n');
            if (next.length > 1000) return false;
            setPostNote(next);
            return true;
          }} />
        <label className="cp-field"><span>Пожелание к этому посту</span>
          <textarea rows={2} maxLength={1000} value={postNote} disabled={disabled || busy}
            placeholder="Например, без восклицательных знаков" onChange={event => setPostNote(event.target.value)} />
        </label>
      </details>
      {error && <p className="cp-ai-error" role="alert">{error}</p>}
      {!quota && error && <button className="secondary-button" type="button" disabled={busy || checking}
        onClick={() => { setError(''); void refreshQuota(); }}>Проверить доступ</button>}
      {footerActions && createPortal(<>
        <small className="cp-wizard-quota" role="status">{busy ? 'Генерируем текст…' : checking ? 'Проверяем лимит…' : quota
          ? quota.remaining === null ? 'Без лимита' : 'Осталось ' + quota.remaining + (quota.period === 'day' ? ' сегодня' : ' из 30 за последние 30 дней') : ''}</small>
        <button className="secondary-button cp-manual-writing" type="button" disabled={busy || disabled}
          onClick={onStartManual}><Pencil size={16} aria-hidden="true" /> {text.trim() ? 'К тексту поста' : 'Написать без ИИ'}</button>
        <button className="primary-button" type="button"
          disabled={disabled || busy || checking || ruleBusy || !topic.trim() || !canGenerate}
          onClick={() => void generate()}><Sparkles size={16} aria-hidden="true" /> {result ? 'Другой вариант' : 'Создать текст с ИИ'}</button>
      </>, footerActions)}
      {result && <div className="cp-ai-result">
        <strong>Предложенный текст</strong>
        <p>{result}</p>
        {confirmReplace && <small role="status">Текущий текст поста будет заменён.</small>}
        <div className="cp-ai-actions">
          <button className="primary-button" type="button" disabled={disabled || busy || ruleBusy} onClick={insert}>
            {confirmReplace ? 'Заменить текст' : 'Вставить текст'}
          </button>
          {confirmReplace && <button className="secondary-button" type="button"
            onClick={() => setConfirmReplace(false)}>Отмена</button>}
        </div>
      </div>}
    </div>}
    {step === 2 && appliedStyle.length > 0 && <small className="cp-applied-style">Стиль текста: {appliedStyle.join(' · ')}</small>}
    {step === 2 && canLearn && !learning && <button className="secondary-button cp-remember-rule" type="button"
      title="Подбор правила расходует одну попытку генерации текста"
      disabled={disabled || busy} onClick={() => void suggestRule()}>Запомнить на будущее</button>}
    {step === 2 && learning && <div className="cp-ai-panel">
      <label htmlFor={id + '-rule'}>Правило для будущих постов</label>
      <textarea id={id + '-rule'} rows={2} maxLength={300} value={rule} disabled={ruleBusy}
        onChange={(event) => setRule(event.target.value)} />
      <label htmlFor={id + '-scope'}>Где применять</label>
      <select id={id + '-scope'} value={scope} disabled={ruleBusy} onChange={(event) => setScope(event.target.value)}>
        {channel && <option value={channel.id}>{channel.title}</option>}
        <option value="">Все каналы</option>
      </select>
      {ruleBusy && <small role="status">Подождите…</small>}
      {ruleError && <p className="cp-ai-error" role="alert">{ruleError}</p>}
      <div className="cp-ai-actions">
        <button className="primary-button" type="button" disabled={disabled || ruleBusy || !rule.trim()}
          onClick={() => void rememberRule()}>Сохранить правило</button>
        <button className="secondary-button" type="button" disabled={ruleBusy} onClick={() => setLearning(false)}>Отмена</button>
      </div>
    </div>}
  </div>;
}

type PlanChannel = {
  id: string;
  platform: 'vk' | 'telegram';
  title: string;
  handle: string;
  status: 'connected' | 'needs_reauth' | 'error';
  canPost: boolean;
  error: string;
  writingRules: string;
  imageRules?: string;
};

function WritingRulesSettings({ commonRules, channels, onSave }: {
  commonRules: string;
  channels: PlanChannel[];
  onSave: SaveRules;
}) {
  const id = useId();
  const [scope, setScope] = useState('');
  const [draft, setDraft] = useState<{ rules: string; previousRules: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const channel = channels.find((item) => item.id === scope);
  const savedRules = scope ? channel?.writingRules ?? '' : commonRules;
  const rules = draft?.rules ?? savedRules;
  const changed = Boolean(draft && rules.trim() !== savedRules);
  const sources = channels.filter((item) => item.id !== scope && item.writingRules);

  function edit(rules: string) {
    setDraft({ rules, previousRules: draft?.previousRules ?? savedRules });
  }

  async function save() {
    if (!draft || !changed || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSave(scope, draft.rules, draft.previousRules);
      setDraft(undefined);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Не удалось сохранить правила.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="cp-card">
    <div className="cp-card-head"><h3>Как писать</h3></div>
    <div className="cp-ai-panel cp-writing-settings">
      <label htmlFor={id + '-channel'}>Для каких каналов</label>
      <select id={id + '-channel'} value={scope} disabled={busy || changed} onChange={(event) => {
        setScope(event.target.value);
        setDraft(undefined);
        setError('');
      }}>
        <option value="">Все каналы</option>
        {channels.map((item) => <option key={item.id} value={item.id}>
          {item.title} · {item.platform === 'vk' ? 'ВК' : 'Telegram'}
        </option>)}
      </select>
      {scope && commonRules && <details className="cp-writing-preview">
        <summary>Общие правила</summary><p>{commonRules}</p>
      </details>}
      <label htmlFor={id + '-rules'}>{scope ? 'Правила этого канала' : 'Общие правила'}</label>
      <textarea id={id + '-rules'} rows={4} maxLength={3000} value={rules} disabled={busy}
        placeholder={scope ? 'Например, обращайся на «ты» и добавляй лёгкий юмор.' : 'Например, пиши простыми словами и избегай канцелярита.'}
        onChange={(event) => edit(event.target.value)} />
      {scope && !rules.trim() && sources.length > 0 && <select aria-label="Скопировать правила из другого канала"
        value="" disabled={busy} onChange={(event) => {
          const source = sources.find((item) => item.id === event.target.value);
          if (source) edit(source.writingRules);
        }}>
        <option value="" disabled>Скопировать правила из другого канала</option>
        {sources.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.platform === 'vk' ? 'ВК' : 'Telegram'}</option>)}
      </select>}
      <small>Правила канала уточняют общие. Сохранённые правила применяются при новой генерации текста.</small>
      {error && <p className="cp-ai-error" role="alert">{error}</p>}
      <div className="cp-ai-actions">
        <button className="primary-button" type="button" disabled={busy || !changed || Boolean(scope && !channel)}
          onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить правила'}</button>
        {changed && <button className="secondary-button" type="button" disabled={busy}
          onClick={() => { setDraft(undefined); setError(''); }}>Отменить правки</button>}
      </div>
    </div>
  </section>;
}

type PlanPost = {
  id: string;
  channelId: string;
  platform: 'vk' | 'telegram';
  title: string;
  text: string;
  telegramHtml?: string;
  mediaId?: string;
  mediaPreviewUrl?: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledAt: string | null;
  timeZone: string;
  autoPublish: boolean;
  externalUrl: string;
  error: string;
};

type TelegramBot = {
  configured: boolean;
  username: string;
  url: string;
  name: string;
  status: 'connected' | 'needs_reauth' | 'error' | null;
  error: string;
};
type VkGroup = {
  id: number;
  name: string;
  screenName: string;
  membersCount: number;
  photo: string;
};
type VkGroupsData = { items: VkGroup[] };
type Meta = {
  channels: PlanChannel[];
  posts: PlanPost[];
  telegramBot: TelegramBot;
  writingRules: string;
  imageRules?: string;
  mediaEnabled?: boolean;
  vkPhotoEnabled?: boolean;
};
type EditorState = {
  postId: string | null;
  channelId: string;
  date: string;
  time: string;
  text: string;
  failure: string;
  telegramHtml?: string;
  mediaId?: string;
  mediaPreviewUrl?: string;
};

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

function pad(value: number) {
  return value < 10 ? '0' + value : String(value);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function isoLocal(value: Date) {
  return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
}

function localDate(iso: string | null) {
  return iso ? isoLocal(new Date(iso)) : '';
}

function localTime(iso: string | null) {
  if (!iso) return '10:00';
  const date = new Date(iso);
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function formatDayKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${WEEKDAYS[(date.getDay() + 6) % 7]}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(iso: string) {
  return (
    new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    }) +
    ', ' +
    formatTime(iso)
  );
}

function titleFrom(text: string) {
  const first =
    String(text || '')
      .split('\n')
      .find((line) => line.trim()) || 'Без названия';
  return first
    .replace(/[*_`#>\[\]]/g, '')
    .replace(/\|/g, ' ')
    .trim()
    .slice(0, 80);
}

function nextSlot() {
  const date = new Date(Date.now() + 3_600_000);
  date.setMinutes(0, 0, 0);
  return { date: isoLocal(date), time: pad(date.getHours()) + ':00' };
}

function calendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rows = Math.max(5, Math.ceil((offset + days) / 7));
  return Array.from({ length: rows * 7 }, (_, index) => {
    const day = index - offset + 1;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return { date, key: isoLocal(date), inMonth: day >= 1 && day <= days };
  });
}

function postsOnDay(posts: PlanPost[], key: string, filter: string) {
  return posts
    .filter((post) => post.scheduledAt && (filter === 'all' || post.channelId === filter))
    .filter((post) => isoLocal(new Date(post.scheduledAt as string)) === key)
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
}

const STATUS_LABELS: Record<PlanPost['status'], string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  publishing: 'Публикуется',
  published: 'Опубликован',
  failed: 'Ошибка публикации',
};

export function ContentPlanPage({ adminOnly = false, userId }: { adminOnly?: boolean; userId: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'calendar' | 'list' | 'drafts'>(() =>
    window.matchMedia('(max-width: 760px)').matches ? 'list' : 'calendar',
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [viewedPostId, setViewedPostId] = useState<string | null>(null);
  const viewedPost = meta?.posts.find((post) => post.id === viewedPostId);
  const [publishMode, setPublishMode] = useState<'scheduled' | 'now'>('scheduled');
  const [publishConfirm, setPublishConfirm] = useState(false);
  const draftKey = 'socstat:content-plan:editor:' + userId;
  const [localDraft, setLocalDraft] = useState<EditorState | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(draftKey) || 'null');
      return value &&
        typeof value.text === 'string' &&
        typeof value.channelId === 'string' &&
        typeof value.date === 'string' &&
        typeof value.time === 'string' &&
        (value.postId === null || typeof value.postId === 'string')
        ? { ...value, failure: '' }
        : null;
    } catch {
      return null;
    }
  });
  const [storageError, setStorageError] = useState(false);
  const editorBaseline = useRef('');
  const liveEditor = useRef<EditorState | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [showBotToken, setShowBotToken] = useState(false);
  const [botError, setBotError] = useState('');
  const [botSaving, setBotSaving] = useState(false);
  const [vkOpen, setVkOpen] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [vkGroups, setVkGroups] = useState<VkGroup[]>([]);
  const [vkSelectedGroup, setVkSelectedGroup] = useState<VkGroup | null>(null);
  const [vkToken, setVkToken] = useState('');
  const [showVkToken, setShowVkToken] = useState(false);
  const [vkError, setVkError] = useState('');
  const [vkConnecting, setVkConnecting] = useState(false);
  const [channelRef, setChannelRef] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorStep, setEditorStep] = useState<EditorStep>(1);
  const editorContent = useRef<HTMLDivElement>(null);
  const [wizardFooterActions, setWizardFooterActions] = useState<HTMLDivElement | null>(null);
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayKey = isoLocal(new Date());
  const timeZoneLabel =
    timeZone.replace(/_/g, ' ') +
    ' · UTC' +
    (() => {
      const offset = -new Date().getTimezoneOffset();
      return (
        (offset >= 0 ? '+' : '−') +
        Math.floor(Math.abs(offset) / 60) +
        (offset % 60 ? ':' + pad(Math.abs(offset) % 60) : '')
      );
    })();

  const persistDraft = (value: EditorState | null) => {
    try {
      if (!userId) throw new Error('Account identity unavailable');
      if (value) localStorage.setItem(draftKey, JSON.stringify({ ...value, mediaPreviewUrl: undefined }));
      else localStorage.removeItem(draftKey);
      setStorageError(false);
    } catch {
      setStorageError(true);
      return false;
    }
    setLocalDraft(value);
    return true;
  };

  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(editor) !== editorBaseline.current) persistDraft(editor.text.trim() ? editor : null);
    else if (localDraft && JSON.stringify(localDraft) !== JSON.stringify(editor)) persistDraft(null);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(editor) !== editorBaseline.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [editor]);

  liveEditor.current = editor;

  const closeEditor = () => {
    const editor = liveEditor.current;
    if (saving) return;
    if (
      editor &&
      JSON.stringify(editor) !== editorBaseline.current &&
      !window.confirm(
        'Закрыть редактор? Несохранённый текст останется на этом устройстве, если доступно локальное хранилище.',
      )
    )
      return;
    setPublishConfirm(false);
    setEditor(null);
  };

  const startEditor = (value: EditorState) => {
    let backup = localDraft;
    const saved = meta?.posts.find((post) => post.id === value.postId);
    if (saved && (saved.status === 'published' || saved.status === 'publishing')) {
      value = {
        ...value,
        mediaId: undefined,
        mediaPreviewUrl: undefined,
        postId: null,
        ...nextSlot(),
        failure: 'Исходный пост уже отправлен или отправляется. Несохранённый текст восстановлен как новый черновик.',
      };
      persistDraft(value);
      backup = value;
    }
    if (
      backup &&
      backup.postId !== value.postId &&
      !window.confirm('Открыть другой пост? Незавершённый текст на этом устройстве будет удалён.')
    )
      return;
    if (backup && backup.postId !== value.postId) persistDraft(null);
    if (backup && backup.postId === value.postId) value = backup;
    if (value.mediaId && !value.mediaPreviewUrl) {
      const id = value.mediaId;
      void apiPost<{ previewUrl: string }>('/api/content-plan/media/confirm', { id }).then(({ previewUrl }) => {
        setEditor((current) => current?.mediaId === id ? { ...current, mediaPreviewUrl: previewUrl } : current);
      }).catch(() => setEditorError('Не удалось открыть фото. Попробуйте загрузить его заново.'));
    }
    editorBaseline.current = JSON.stringify(value);
    setEditor(value);
    setEditorStep(value.postId || value.text.trim() || value.mediaId ? 2 : 1);
    setPublishMode('scheduled');
    setEditorError('');
    setSelectedDay(null);
    setViewedPostId(null);
    setPublishConfirm(false);
  };

  useEffect(() => {
    apiGet<Meta>('/api/content-plan')
      .then(setMeta)
      .catch((reason) => {
        setError(
          reason instanceof ApiError && reason.status === 403
            ? 'Раздел пока недоступен. Включите его в «Админке → Настройки → Фичи».'
            : reason instanceof Error
              ? reason.message
              : 'Не удалось загрузить контент-план.',
        );
      });
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const refreshMeta = () => {
    apiGet<Meta>('/api/content-plan')
      .then(setMeta)
      .catch(() => undefined);
  };

  useEffect(() => {
    const timer = window.setInterval(refreshMeta, 30_000);
    window.addEventListener('focus', refreshMeta);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshMeta);
    };
  }, []);

  useEffect(() => {
    if (
      !editor &&
      !selectedDay &&
      !channelsOpen &&
      !connectOpen &&
      !botOpen &&
      !vkOpen &&
      !publishConfirm &&
      !viewedPostId
    )
      return;
    const previous = document.activeElement as HTMLElement | null;
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('.cp-page [role="dialog"]'));
    const dialog = dialogs
      .sort(
        (a, b) =>
          Number(getComputedStyle(a.closest('.cp-modal-overlay, .cp-editor-overlay') || a).zIndex) -
          Number(getComputedStyle(b.closest('.cp-modal-overlay, .cp-editor-overlay') || b).zIndex),
      )
      .pop();
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length);
    dialog.tabIndex = -1;
    (focusable()[0] || dialog).focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector('.cp-image-studio[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (saving || connecting || botSaving || vkConnecting) return;
        if (botOpen) closeBot();
        else if (vkOpen) closeVk();
        else if (connectOpen) setConnectOpen(false);
        else if (publishConfirm) setPublishConfirm(false);
        else if (channelsOpen) setChannelsOpen(false);
        else if (editor) closeEditor();
        else if (viewedPostId) setViewedPostId(null);
        else setSelectedDay(null);
      }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [
    Boolean(editor),
    selectedDay,
    channelsOpen,
    connectOpen,
    botOpen,
    vkOpen,
    publishConfirm,
    viewedPostId,
    saving,
    connecting,
    botSaving,
    vkConnecting,
  ]);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2800);
  };

  const editorChannel = meta && editor ? meta.channels.find((channel) => channel.id === editor.channelId) : undefined;
  const limit = editorChannel?.platform === 'vk' ? 16000 : editor?.mediaId ? 1024 : 4096;
  const canAttachPhoto = editorChannel?.status === 'connected' && editorChannel.canPost && (editorChannel.platform === 'vk' ? meta?.vkPhotoEnabled : meta?.mediaEnabled);
  const isVkEditor = editorChannel?.platform === 'vk';
  const saveRules: SaveRules = async (channelId, rules, previousRules) => {
    const saved = await apiPatch<{ rules: string }>('/api/content-plan/writing-rules', { channelId: channelId || null, rules, previousRules });
    setMeta((current) => {
      if (!current) return current;
      if (!channelId) return { ...current, writingRules: saved.rules };
      return { ...current, channels: current.channels.map((channel) => channel.id === channelId
        ? { ...channel, writingRules: saved.rules }
        : channel) };
    });
    showToast('Правила сохранены');
  };
  const saveImageRules: SaveRules = async (channelId, rules, previousRules) => {
    const saved = await apiPatch<{ rules: string }>('/api/content-plan/image-rules', { channelId: channelId || null, rules, previousRules });
    setMeta(current => current && (channelId
      ? { ...current, channels: current.channels.map(channel => channel.id === channelId ? { ...channel, imageRules: saved.rules } : channel) }
      : { ...current, imageRules: saved.rules }));
    showToast('Правила изображения сохранены');
  };

  function goToEditorStep(step: EditorStep, focusText = false) {
    setEditorStep(step);
    requestAnimationFrame(() => {
      const body = editorContent.current;
      if (!body) return;
      body.scrollTop = 0;
      (focusText ? body.querySelector<HTMLElement>('.cp-wizard-compose textarea.cp-md-textarea, .cp-wizard-compose [contenteditable="true"]')
        : body.querySelector<HTMLElement>('[data-step-heading="' + step + '"]'))?.focus();
    });
  }

  const platformLabel = isVkEditor ? 'ВКонтакте' : 'Telegram';
  const textLength = editor?.text.length ?? 0;

  async function stagePhoto(file: File) {
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
      throw new Error('Выберите JPEG или PNG размером до 5 МБ.');
    }
    const upload = await apiPost<{ id: string; url: string; fields: Record<string, string> }>(
      '/api/content-plan/media/upload', { type: file.type }
    );
    const form = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
    form.append('file', file);
    const result = await fetch(upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
    if (!result.ok) throw new Error('Облако не приняло изображение.');
    return apiPost<{ id: string; previewUrl: string }>('/api/content-plan/media/confirm', { id: upload.id });
  }

  function attachPhoto(photo: { id: string; previewUrl: string }) {
    setEditorError('');
    setEditor(current => current ? { ...current, mediaId: photo.id, mediaPreviewUrl: photo.previewUrl } : current);
  }

  const uploadPhoto = async (file: File) => {
    if (!editor || !canAttachPhoto || saving) return;
    setSaving(true);
    setEditorError('');
    try {
      attachPhoto(await stagePhoto(file));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
    } finally {
      setSaving(false);
    }
  };

  const openNew = (dateKey?: string) => {
    if (!meta) return;
    if (localDraft?.text.trim()) {
      startEditor(localDraft);
      showToast('Восстановлен незавершённый пост. Сохраните его или удалите, чтобы начать новый.');
      return;
    }
    const channelId =
      filter !== 'all' && meta.channels.some((channel) => channel.id === filter)
        ? filter
        : meta.channels.find((channel) => channel.status === 'connected' && channel.canPost)?.id || '';
    const slot = dateKey && dateKey !== todayKey ? { date: dateKey, time: '10:00' } : nextSlot();
    if (dateKey && dateKey !== todayKey) setMonth(startOfMonth(new Date(dateKey + 'T00:00:00')));
    startEditor({
      postId: null,
      channelId,
      date: slot.date,
      time: slot.time,
      text: '',
      failure: '',
    });
    setEditorError('');
  };

  const openEdit = (post: PlanPost) => {
    if (!meta) return;
    if (post.status === 'published' || post.status === 'publishing') {
      setSelectedDay(null);
      setViewedPostId(post.id);
      return;
    }
    const channel = meta.channels.find((item) => item.id === post.channelId);
    startEditor({
      postId: post.id,
      channelId: channel?.id || '',
      date: localDate(post.scheduledAt),
      time: localTime(post.scheduledAt),
      text: post.text,
      telegramHtml: post.telegramHtml,
      mediaId: post.mediaId,
      mediaPreviewUrl: post.mediaPreviewUrl,
      failure: post.error ? 'Прошлая публикация не удалась: ' + post.error : '',
    });
    setEditorError('');
  };

  const save = async (status: 'draft' | 'scheduled') => {
    if (!editor || !meta || saving) return;
    const channel = meta.channels.find((item) => item.id === editor.channelId);
    const text = editor.text.trim();
    if (!channel || channel.status !== 'connected' || !channel.canPost) {
      if (status === 'draft' && editor.text.trim() && !editor.postId) {
        if (!persistDraft(editor)) {
          setEditorError('Не удалось сохранить текст на устройстве. Подключите канал и сохраните черновик на сервере.');
          return;
        }
        setEditor(null);
        showToast('Черновик сохранён на этом устройстве. Подключите канал для публикации.');
      } else setEditorError('Выберите канал с доступом к публикации. Подключения доступны в разделе «Каналы».');
      return;
    }
    if (!text) {
      setEditorError('Добавьте текст поста.');
      return;
    }
    if (text.length > limit) {
      setEditorError(`Текст длиннее лимита ${limit.toLocaleString('ru-RU')} символов.`);
      return;
    }
    let scheduledAt: string | null = null;
    if (editor.date && editor.time) {
      const local = new Date(`${editor.date}T${editor.time}:00`);
      if (Number.isNaN(local.getTime())) {
        setEditorError('Дата или время указаны неверно.');
        return;
      }
      scheduledAt = local.toISOString();
      if (status === 'scheduled' && local.getTime() < Date.now() - 60_000) {
        setEditorError('Дата публикации уже прошла.');
        return;
      }
    }
    if (status === 'scheduled' && !scheduledAt) {
      setEditorError('Выберите дату и время публикации.');
      return;
    }

    setSaving(true);
    setEditorError('');
    setEditor((current) => (current ? { ...current, failure: '' } : current));
    try {
      const payload = {
        channelId: editor.channelId,
        text: editor.text,
        telegramHtml: editor.telegramHtml,
        mediaId: editor.mediaId ?? null,
        status,
        scheduledAt,
        timeZone,
      };
      const post = editor.postId
        ? await apiPatch<PlanPost>(`/api/content-plan/posts/${editor.postId}`, payload)
        : await apiPost<PlanPost>('/api/content-plan/posts', payload);
      setMeta((current) => {
        if (!current) return current;
        const exists = current.posts.some((item) => item.id === post.id);
        return {
          ...current,
          posts: exists ? current.posts.map((item) => (item.id === post.id ? post : item)) : [...current.posts, post],
        };
      });
      if (post.scheduledAt) setMonth(startOfMonth(new Date(post.scheduledAt)));
      persistDraft(null);
      setEditor(null);
      showToast(status === 'draft' ? 'Черновик сохранён' : 'Пост запланирован');
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не удалось сохранить пост.');
    } finally {
      setSaving(false);
    }
  };

  const publishNowAction = async () => {
    if (!editor || !meta || saving) return;
    const channel = meta.channels.find((item) => item.id === editor.channelId);
    const text = editor.text.trim();
    if (!channel || channel.status !== 'connected' || !channel.canPost) {
      setEditorError('Выберите канал с доступом к публикации.');
      return;
    }
    if (!text) {
      setEditorError('Добавьте текст поста.');
      return;
    }
    if (text.length > limit) {
      setEditorError(`Текст длиннее лимита ${limit.toLocaleString('ru-RU')} символов.`);
      return;
    }

    setSaving(true);
    setEditorError('');
    setEditor((current) => (current ? { ...current, failure: '' } : current));
    let postId = editor.postId;
    try {
      if (!postId) {
        const created = await apiPost<PlanPost>('/api/content-plan/posts', {
          channelId: editor.channelId,
          text: editor.text,
          telegramHtml: editor.telegramHtml,
          mediaId: editor.mediaId ?? null,
          status: 'draft',
          scheduledAt: new Date().toISOString(),
          timeZone,
        });
        postId = created.id;
        setMeta((current) => (current ? { ...current, posts: [...current.posts, created] } : current));
        setEditor((current) => (current ? { ...current, postId: created.id } : current));
      }
      // Сначала сохраняем текущую версию: публикация принимает только id поста.
      else {
        const updated = await apiPatch<PlanPost>(`/api/content-plan/posts/${postId}`, {
          channelId: editor.channelId,
          text: editor.text,
          telegramHtml: editor.telegramHtml,
          mediaId: editor.mediaId ?? null,
          status: 'draft',
          scheduledAt: new Date().toISOString(),
          timeZone,
        });
        setMeta((current) =>
          current
            ? {
                ...current,
                posts: current.posts.map((item) => (item.id === updated.id ? updated : item)),
              }
            : current,
        );
      }
      const post = await apiPost<PlanPost>(`/api/content-plan/posts/${postId}/publish`);
      setMeta((current) =>
        current
          ? {
              ...current,
              posts: current.posts.map((item) => (item.id === post.id ? post : item)),
            }
          : current,
      );
      setEditor(null);
      persistDraft(null);
      setPublishConfirm(false);
      showToast('Опубликовано в ' + (channel.platform === 'vk' ? 'ВКонтакте' : 'Telegram'));
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не удалось опубликовать пост.');
    } finally {
      setSaving(false);
    }
  };

  const removePost = async () => {
    if (!editor || saving) return;
    if (!editor.postId) {
      if (!window.confirm('Удалить незавершённый пост с этого устройства?')) return;
      persistDraft(null);
      setEditor(null);
      return;
    }
    if (!window.confirm('Удалить этот пост?')) return;
    setSaving(true);
    setEditorError('');
    try {
      await apiDelete('/api/content-plan/posts/' + editor.postId);
      setMeta((current) =>
        current
          ? {
              ...current,
              posts: current.posts.filter((post) => post.id !== editor.postId),
            }
          : current,
      );
      setEditor(null);
      persistDraft(null);
      showToast('Пост удалён');
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не удалось удалить пост.');
    } finally {
      setSaving(false);
    }
  };

  const applyMarkdown = (kind: 'bold' | 'italic' | 'link' | 'list' | 'quote' | 'code') => {
    const textarea = textareaRef.current;
    if (!textarea || !editor || saving) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    if (kind === 'list' || kind === 'quote') {
      const prefix = kind === 'list' ? '- ' : '> ';
      const lines = (selected || 'текст')
        .split('\n')
        .map((line) => prefix + line)
        .join('\n');
      textarea.setRangeText(lines, start, end, 'end');
      textarea.focus();
      setEditor({ ...editor, text: textarea.value });
      return;
    }
    const [before, after, fallback] =
      kind === 'bold'
        ? ['**', '**', 'текст']
        : kind === 'italic'
          ? ['_', '_', 'текст']
          : kind === 'code'
            ? ['`', '`', 'код']
            : ['[', '](https://)', 'текст'];
    const value = selected || fallback;
    textarea.setRangeText(before + value + after, start, end, 'end');
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + value.length;
    setEditor({ ...editor, text: textarea.value });
  };

  const closeBot = () => {
    if (botSaving) return;
    setBotOpen(false);
    setBotToken('');
    setShowBotToken(false);
    setBotError('');
  };

  const saveBot = async () => {
    if (!botToken.trim() || botSaving) return;
    const firstBot = !meta?.telegramBot.configured;
    setBotSaving(true);
    setBotError('');
    try {
      const bot = await apiPost<TelegramBot>('/api/content-plan/bot/telegram', {
        token: botToken,
      });
      setMeta((current) => (current ? { ...current, telegramBot: bot } : current));
      setBotOpen(false);
      setBotToken('');
      setShowBotToken(false);
      showToast(firstBot ? 'Бот подключён. Теперь добавьте канал.' : 'Бот обновлён: @' + bot.username);
      if (firstBot) {
        setChannelRef('');
        setConnectError('');
        setConnectOpen(true);
      }
      refreshMeta();
    } catch (reason) {
      setBotError(reason instanceof Error ? reason.message : 'Не удалось подключить бота.');
    } finally {
      setBotSaving(false);
    }
  };

  const disconnectBot = async () => {
    if (!meta?.telegramBot.configured || botSaving) return;
    if (!window.confirm('Отключить бота? Каналы нужно будет проверить заново.')) return;
    setBotSaving(true);
    setBotError('');
    try {
      await apiDelete('/api/content-plan/bot/telegram');
      setMeta((current) =>
        current
          ? {
              ...current,
              telegramBot: {
                configured: false,
                username: '',
                url: '',
                name: '',
                status: null,
                error: '',
              },
            }
          : current,
      );
      setBotOpen(false);
      setBotToken('');
      setShowBotToken(false);
      showToast('Бот отключён');
      refreshMeta();
    } catch (reason) {
      setBotError(reason instanceof Error ? reason.message : 'Не удалось отключить бота.');
    } finally {
      setBotSaving(false);
    }
  };

  const openTelegramChannel = () => {
    if (!meta) return;
    if (!meta.telegramBot.configured) {
      setBotError('');
      setBotOpen(true);
      showToast('Сначала подключите своего бота.');
      return;
    }
    setConnectError('');
    setConnectOpen(true);
  };

  const openVk = async () => {
    setVkOpen(true);
    setVkLoading(true);
    setVkError('');
    setVkGroups([]);
    setVkSelectedGroup(null);
    setVkToken('');
    setShowVkToken(false);
    try {
      const data = await apiGet<VkGroupsData>('/api/content-plan/vk/groups');
      setVkGroups(data.items);
    } catch (reason) {
      setVkError(reason instanceof Error ? reason.message : 'Не удалось загрузить группы ВК.');
    } finally {
      setVkLoading(false);
    }
  };

  const closeVk = () => {
    if (vkConnecting) return;
    setVkOpen(false);
    setVkSelectedGroup(null);
    setVkToken('');
    setShowVkToken(false);
    setVkError('');
  };

  const connectVk = async () => {
    if (!vkSelectedGroup || !vkToken.trim() || vkConnecting) return;
    setVkConnecting(true);
    setVkError('');
    try {
      const channel = await apiPost<PlanChannel>('/api/content-plan/channels/vk', {
        groupId: vkSelectedGroup.id,
        token: vkToken,
      });
      setMeta((current) =>
        current
          ? {
              ...current,
              channels: [...current.channels.filter((item) => item.id !== channel.id), channel],
            }
          : current,
      );
      setVkOpen(false);
      setVkSelectedGroup(null);
      setVkToken('');
      setShowVkToken(false);
      showToast('Группа подключена: ' + channel.title);
    } catch (reason) {
      setVkError(reason instanceof Error ? reason.message : 'Не удалось подключить группу.');
    } finally {
      setVkConnecting(false);
    }
  };

  const connectChannel = async () => {
    if (!channelRef.trim() || connecting) return;
    setConnecting(true);
    setConnectError('');
    try {
      const channel = await apiPost<PlanChannel>('/api/content-plan/channels/telegram', { ref: channelRef });
      setMeta((current) =>
        current
          ? {
              ...current,
              channels: [...current.channels.filter((item) => item.id !== channel.id), channel],
            }
          : current,
      );
      setConnectOpen(false);
      setChannelRef('');
      showToast('Канал подключён: ' + channel.title);
    } catch (reason) {
      setConnectError(reason instanceof Error ? reason.message : 'Не удалось подключить канал.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectChannel = async (channel: PlanChannel) => {
    if (!window.confirm(`Отключить «${channel.title}» от публикации?`)) return;
    try {
      await apiDelete('/api/content-plan/channels/' + channel.id);
      setMeta((current) =>
        current
          ? {
              ...current,
              channels: current.channels.filter((item) => item.id !== channel.id),
            }
          : current,
      );
      if (filter === channel.id) setFilter('all');
      if (editor?.channelId === channel.id) setEditor((current) => (current ? { ...current, channelId: '' } : current));
      showToast('Канал отключён');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Не удалось отключить канал.');
    }
  };

  if (error) {
    return (
      <div className="content-page cp-page">
        <div className="content-message content-error">{error}</div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="content-page cp-page">
        <div className="content-message">Загружаем контент-план…</div>
      </div>
    );
  }

  const channelPosts = meta.posts.filter((post) => filter === 'all' || post.channelId === filter);
  const monthPosts = channelPosts.filter(
    (post) =>
      post.scheduledAt &&
      new Date(post.scheduledAt).getFullYear() === month.getFullYear() &&
      new Date(post.scheduledAt).getMonth() === month.getMonth(),
  );
  const drafts = channelPosts.filter((post) => post.status === 'draft');
  const failed = channelPosts.filter((post) => post.status === 'failed');
  const brokenChannels = meta.channels.filter((channel) => channel.status !== 'connected' || !channel.canPost);
  const matches = (post: PlanPost) =>
    (view === 'drafts' || statusFilter === 'all' || post.status === statusFilter) &&
    (!search.trim() ||
      (post.text + ' ' + (meta.channels.find((channel) => channel.id === post.channelId)?.title || ''))
        .toLowerCase()
        .includes(search.trim().toLowerCase()));
  const visiblePosts = (view === 'drafts' ? drafts : statusFilter === 'failed' ? failed : monthPosts)
    .filter(matches)
    .sort((a, b) => (a.scheduledAt || '9999').localeCompare(b.scheduledAt || '9999'));
  const cells = calendarCells(month);
  const previewHtml = editor
    ? !isVkEditor && editor.telegramHtml !== undefined
      ? normalizeTelegramRichText(editor.telegramHtml).html.replace(/\n/g, '<br>')
      : renderContentPlanMarkdown(editor.text, editorChannel?.platform || 'telegram')
    : '';
  const currentPost = meta.posts.find((post) => post.id === editor?.postId);
  const dayPosts = selectedDay ? postsOnDay(channelPosts.filter(matches), selectedDay, 'all') : [];
  const renderPostRow = (post: PlanPost) => {
    const channel = meta.channels.find((item) => item.id === post.channelId);
    return (
      <button className="cp-list-post" type="button" key={post.id} onClick={() => openEdit(post)}>
        <span className="cp-list-date">{post.scheduledAt ? formatDateTime(post.scheduledAt) : 'Без даты'}</span>
        <span className="cp-list-content cp-list-main">
          <strong>{titleFrom(post.text)}</strong>
          <small>
            {post.platform === 'vk' ? 'ВК' : 'Telegram'} · {channel?.title || 'Канал отключён'}
          </small>
          {post.error && <small className="cp-channel-error">{post.error}</small>}
        </span>
        <span className={'cp-post-status cp-status-label ' + post.status}>{STATUS_LABELS[post.status]}</span>
        <ChevronRight size={16} />
      </button>
    );
  };

  return (
    <div className="content-page cp-page">
      <div className="cp-head">
        <div>
          <div className="cp-eyebrow">
            <CalendarClock size={14} /> Публикации
          </div>
          <h2>Контент-план</h2>
          <p>Пишите, планируйте и следите за выходом постов.</p>
        </div>
        <div className="cp-actions">
          {adminOnly && (
            <span className="content-tag">
              <ShieldCheck size={13} /> Только для админов
            </span>
          )}
          <button className="secondary-button" type="button" onClick={() => setChannelsOpen(true)}>
            <Settings2 size={16} /> Каналы <span className="cp-count">{meta.channels.length}</span>
          </button>
          <button className="primary-button" type="button" onClick={() => openNew(todayKey)}>
            <Plus size={16} /> Новый пост
          </button>
        </div>
      </div>

      {localDraft && !editor && (
        <div className="cp-recovery">
          <div>
            <strong>Незавершённый пост на этом устройстве</strong>
            <p>{titleFrom(localDraft.text)}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => startEditor(localDraft)}>
            Продолжить
          </button>
          <button
            className="cp-icon-button"
            type="button"
            aria-label="Удалить незавершённый пост"
            onClick={() => {
              if (window.confirm('Удалить незавершённый пост с этого устройства?')) persistDraft(null);
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      {storageError && (
        <div className="cp-error" role="alert">
          Браузер не разрешил сохранить текст на устройстве. Не закрывайте страницу до сохранения в канал.
        </div>
      )}
      {(failed.length > 0 || brokenChannels.length > 0) && (
        <div className="cp-attention">
          <AlertCircle size={20} />
          <div>
            <strong>Требуется внимание</strong>
            <p>
              {failed.length > 0 ? `Ошибок публикации: ${failed.length}. ` : ''}
              {brokenChannels.length > 0 ? `Проверьте доступ к каналам: ${brokenChannels.length}.` : ''}
            </p>
          </div>
          {failed.length > 0 && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setView('list');
                setStatusFilter('failed');
                setSearch('');
              }}
            >
              Показать ошибки
            </button>
          )}
          {brokenChannels.length > 0 && (
            <button className="secondary-button" type="button" onClick={() => setChannelsOpen(true)}>
              Проверить каналы
            </button>
          )}
        </div>
      )}

      <div className="cp-workspace-bar">
        <div className="cp-view-tabs" role="group" aria-label="Вид плана">
          <button
            type="button"
            aria-pressed={view === 'calendar'}
            className={view === 'calendar' ? 'active' : ''}
            onClick={() => {
              setView('calendar');
              setStatusFilter('all');
              setSearch('');
            }}
          >
            <CalendarClock size={16} /> Календарь
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            className={view === 'list' ? 'active' : ''}
            onClick={() => {
              setView('list');
              setStatusFilter('all');
            }}
          >
            <List size={16} /> Список
          </button>
          <button
            type="button"
            aria-pressed={view === 'drafts'}
            className={view === 'drafts' ? 'active' : ''}
            onClick={() => {
              setView('drafts');
              setStatusFilter('all');
            }}
          >
            Черновики <span className="cp-count">{drafts.length}</span>
          </button>
        </div>
        <span className="cp-timezone">Время: {timeZoneLabel}</span>
      </div>
      <div className="cp-toolbar">
        <div className="cp-filter-fields">
          <label>
            <span className="cp-sr-only">Канал</span>
            <select aria-label="Канал" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Все каналы</option>
              {meta.channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.platform === 'vk' ? 'ВК' : 'Telegram'} · {channel.title}
                </option>
              ))}
            </select>
          </label>
          {view !== 'drafts' && (
            <label>
              <span className="cp-sr-only">Статус</span>
              <select
                aria-label="Статус"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view !== 'calendar' && (
            <input
              type="search"
              aria-label="Поиск постов"
              placeholder="Найти пост…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </div>
        {view !== 'drafts' && !(view === 'list' && statusFilter === 'failed') && (
          <div className="cp-month">
            <button
              className="cp-icon-button"
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </strong>
            <button
              className="cp-icon-button"
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="secondary-button cp-today"
              type="button"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Сегодня
            </button>
          </div>
        )}
      </div>
      {view === 'list' && statusFilter === 'failed' && (
        <p className="cp-muted">Ошибки публикации за всё время · с учётом выбранного канала</p>
      )}
      {view !== 'drafts' && statusFilter !== 'failed' && (
        <div className="cp-stats">
          <span>За {MONTHS[month.getMonth()].toLowerCase()}:</span>
          <span>
            <b>{monthPosts.filter((post) => post.status === 'scheduled').length}</b> запланировано
          </span>
          <span>
            <b>{monthPosts.filter((post) => post.status === 'published').length}</b> опубликовано
          </span>
        </div>
      )}
      {!meta.channels.length && (
        <div className="cp-onboarding">
          <div>
            <strong>Подключите канал для первой публикации</strong>
            <p>Выберите Telegram или ВКонтакте. Написать черновик можно уже сейчас.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => setChannelsOpen(true)}>
            Выбрать площадку
          </button>
        </div>
      )}
      {view === 'calendar' ? (
        <section className="cp-calendar" aria-label="Календарь публикаций">
          <div className="cp-dow-row">
            {DOW.map((day) => (
              <div className="cp-dow" key={day}>
                {day}
              </div>
            ))}
          </div>
          <div className="cp-cells">
            {cells.map((cell) => {
              const posts = postsOnDay(channelPosts.filter(matches), cell.key, 'all');
              return (
                <div
                  key={cell.key}
                  className={'cp-day' + (cell.inMonth ? '' : ' other') + (cell.key === todayKey ? ' today' : '')}
                >
                  <div className="cp-day-top">
                    <button
                      className="cp-day-select"
                      type="button"
                      aria-label={`Публикации: ${formatDayKey(cell.key)}, ${posts.length}`}
                      onClick={() => setSelectedDay(cell.key)}
                    >
                      <span className="cp-day-num">{cell.date.getDate()}</span>
                    </button>
                    <button
                      className="cp-add-day"
                      type="button"
                      aria-label={`Добавить пост: ${formatDayKey(cell.key)}`}
                      onClick={() => openNew(cell.key)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {posts.slice(0, 2).map((post) => {
                    const channel = meta.channels.find((item) => item.id === post.channelId);
                    return (
                      <button
                        key={post.id}
                        className={'cp-post ' + post.status}
                        type="button"
                        onClick={() => openEdit(post)}
                        title={STATUS_LABELS[post.status] + ' · ' + (channel?.title || 'Канал отключён')}
                      >
                        <span className="cp-post-content">
                          <span className="cp-post-channel">
                            {post.platform === 'vk' ? 'ВК' : 'TG'} ·{' '}
                            {post.scheduledAt ? formatTime(post.scheduledAt) : ''}
                          </span>
                          <span className="cp-post-title">{titleFrom(post.text)}</span>
                          <span className="cp-post-channel">{channel?.title || 'Канал отключён'}</span>
                          <span className={'cp-post-status cp-status-label ' + post.status}>
                            {STATUS_LABELS[post.status]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {posts.length > 2 && (
                    <button type="button" className="cp-more" onClick={() => setSelectedDay(cell.key)}>
                      Ещё {posts.length - 2}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section
          className="cp-post-list cp-list"
          aria-label={view === 'drafts' ? 'Все черновики' : 'Публикации списком'}
        >
          {visiblePosts.length ? (
            visiblePosts.map(renderPostRow)
          ) : (
            <div className="cp-list-empty cp-empty-state">
              <CalendarClock size={32} />
              <h3>{view === 'drafts' ? 'Черновиков пока нет' : 'Постов не найдено'}</h3>
              <p>
                {search || statusFilter !== 'all'
                  ? 'Измените поиск или фильтры.'
                  : 'Добавьте пост или выберите другой канал.'}
              </p>
              <button className="secondary-button" type="button" onClick={() => openNew(todayKey)}>
                <Plus size={16} /> Написать пост
              </button>
            </div>
          )}
        </section>
      )}

      {selectedDay && (
        <div className="cp-modal-overlay" onClick={() => setSelectedDay(null)}>
          <section
            className="cp-modal cp-day-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Публикации дня"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <div>
                <h3>{formatDayKey(selectedDay)}</h3>
                <p className="cp-modal-subtitle">Публикаций: {dayPosts.length} · с учётом фильтров</p>
              </div>
              <button
                className="cp-icon-button"
                type="button"
                aria-label="Закрыть"
                onClick={() => setSelectedDay(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="cp-day-posts cp-day-list">
              {dayPosts.length ? (
                dayPosts.map(renderPostRow)
              ) : (
                <p className="cp-muted">На этот день пока ничего не запланировано.</p>
              )}
            </div>
            <div className="cp-modal-actions">
              <button className="primary-button" type="button" onClick={() => openNew(selectedDay)}>
                <Plus size={16} /> Добавить пост
              </button>
            </div>
          </section>
        </div>
      )}
      {channelsOpen && (
        <div className="cp-modal-overlay" onClick={() => setChannelsOpen(false)}>
          <section
            className="cp-modal cp-connections-modal cp-channels-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Каналы и доступ"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <div>
                <h3>Каналы и доступ</h3>
                <p className="cp-modal-subtitle">Подключите площадки для публикации.</p>
              </div>
              <button
                className="cp-icon-button"
                type="button"
                aria-label="Закрыть"
                onClick={() => setChannelsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <WritingRulesSettings commonRules={meta.writingRules} channels={meta.channels} onSave={saveRules} />
            <section className="cp-card">
              <div className="cp-card-head">
                <h3>Свой Telegram-бот</h3>
                <span
                  className={
                    'cp-bot-pill' +
                    (meta.telegramBot.configured && meta.telegramBot.status === 'connected' ? ' connected' : '')
                  }
                >
                  {meta.telegramBot.configured
                    ? meta.telegramBot.status === 'connected'
                      ? 'Подключён'
                      : 'Нужна проверка'
                    : 'Не подключён'}
                </span>
              </div>
              {meta.telegramBot.configured ? (
                <>
                  <div className="cp-bot-status">
                    <span className="cp-bot-status-icon">
                      {meta.telegramBot.status === 'connected' ? <Check size={13} /> : <AlertCircle size={13} />}
                    </span>
                    <div className="cp-bot-main">
                      <strong>@{meta.telegramBot.username}</strong>
                      <small>
                        {meta.telegramBot.status === 'connected'
                          ? 'Доступ бота подтверждён'
                          : 'Восстановите доступ бота'}
                      </small>
                    </div>
                    <button
                      className="cp-bot-action"
                      type="button"
                      onClick={() => {
                        setBotError('');
                        setBotOpen(true);
                      }}
                    >
                      Заменить
                    </button>
                  </div>
                  {meta.telegramBot.status !== 'connected' && (
                    <div className="cp-bot-warning">{meta.telegramBot.error || 'Токен бота нужно проверить.'}</div>
                  )}
                </>
              ) : (
                <>
                  <p className="cp-muted">Создайте бота в BotFather — он будет публиковать в ваши каналы.</p>
                  <button
                    className="secondary-button cp-full"
                    type="button"
                    onClick={() => {
                      setBotError('');
                      setBotOpen(true);
                    }}
                  >
                    <Bot size={15} /> Подключить бота
                  </button>
                </>
              )}
            </section>

            <section className="cp-card">
              <div className="cp-card-head">
                <h3>Каналы для публикации</h3>
                <span className="cp-count">{meta.channels.length}</span>
              </div>
              {meta.channels.length ? (
                <div className="cp-channels">
                  {meta.channels.map((channel) => (
                    <div className="cp-channel" key={channel.id}>
                      <i className={'cp-dot ' + channel.platform} />
                      <div className="cp-channel-main">
                        <strong>{channel.title}</strong>
                        <small>{channel.handle || (channel.platform === 'vk' ? 'ВКонтакте' : 'Telegram')}</small>
                      </div>
                      {channel.error && <small className="cp-channel-error">{channel.error}</small>}
                      <span className={'cp-status ' + (channel.canPost ? channel.status : 'error')}>
                        {channel.status === 'connected' && channel.canPost ? 'подключён' : 'проверить'}
                      </span>
                      <button
                        className="cp-channel-remove"
                        type="button"
                        aria-label={'Отключить ' + channel.title}
                        title="Отключить"
                        onClick={() => void disconnectChannel(channel)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={'cp-empty' + (meta.telegramBot.configured ? ' cp-empty-success' : '')}>
                  {meta.telegramBot.configured && (
                    <span className="cp-empty-check">
                      <Check size={15} />
                    </span>
                  )}
                  <p>
                    {meta.telegramBot.configured
                      ? 'Бот подключён. Осталось добавить канал или группу ВК.'
                      : 'Пока нет каналов. Подключите Telegram-бота или группу ВК.'}
                  </p>
                </div>
              )}
              <div className="cp-connect-row">
                <button className="secondary-button" type="button" onClick={openTelegramChannel}>
                  <Plus size={14} /> Telegram
                </button>
                <button className="secondary-button" type="button" onClick={() => void openVk()}>
                  <Plus size={14} /> ВК
                </button>
              </div>
            </section>
          </section>
        </div>
      )}
      {viewedPost && (
        <div className="cp-modal-overlay" onClick={() => setViewedPostId(null)}>
          <section
            className="cp-modal cp-view-post"
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр публикации"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <div>
                <h3>{STATUS_LABELS[viewedPost.status]}</h3>
                <p className="cp-modal-subtitle">
                  {meta.channels.find((channel) => channel.id === viewedPost.channelId)?.title || 'Канал отключён'} ·{' '}
                  {viewedPost.scheduledAt ? formatDateTime(viewedPost.scheduledAt) : 'Без даты'}
                </p>
              </div>
              <button
                className="cp-icon-button"
                type="button"
                aria-label="Закрыть"
                onClick={() => setViewedPostId(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="cp-preview-text"
              dangerouslySetInnerHTML={{
                __html: viewedPost.telegramHtml !== undefined && viewedPost.platform === 'telegram'
                  ? normalizeTelegramRichText(viewedPost.telegramHtml).html.replace(/\n/g, '<br>')
                  : renderContentPlanMarkdown(viewedPost.text, viewedPost.platform),
              }}
            />
            {viewedPost.externalUrl && /^https?:\/\//.test(viewedPost.externalUrl) && (
              <a href={viewedPost.externalUrl} target="_blank" rel="noreferrer">
                Открыть в {viewedPost.platform === 'vk' ? 'ВКонтакте' : 'Telegram'} <ChevronRight size={16} />
              </a>
            )}
          </section>
        </div>
      )}

      {editor && (
        <div className="cp-editor-overlay cp-wizard-overlay" onClick={closeEditor}>
          <aside className="cp-editor cp-editor-wide cp-post-editor cp-post-wizard" data-step={editorStep} role="dialog"
            aria-modal="true" aria-label="Редактор поста" onClick={event => event.stopPropagation()}>
            <div className="cp-editor-head">
              <div>
                <h3>{editor.postId ? 'Редактировать пост' : 'Новый пост'}</h3>
                {currentPost && <span className="cp-muted">{STATUS_LABELS[currentPost.status]}</span>}
              </div>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={closeEditor}>
                <X size={16} />
              </button>
            </div>
            <ol className="cp-wizard-steps" aria-label="Шаги создания поста">
              {(['Идея', 'Пост', 'Публикация'] as const).map((label, index) => (
                <li key={label} aria-current={editorStep === index + 1 ? 'step' : undefined}>
                  <span>{index + 1}</span>{label}
                </li>
              ))}
            </ol>
            <div className="cp-editor-body" ref={editorContent}>
              {editor.failure && <div className="cp-error">{editor.failure}</div>}
              <section hidden={editorStep !== 1} className="cp-wizard-idea">
                <h3 data-step-heading="1" tabIndex={-1}>Что расскажем подписчикам?</h3>
              <label className="cp-field">
                <span>Канал</span>
                <select
                  disabled={saving}
                  value={editor.channelId}
                  onChange={(event) => setEditor({ ...editor, channelId: event.target.value })}
                >
                  <option value="">Выберите канал</option>
                  {meta.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.title} · {channel.platform === 'vk' ? 'ВК' : 'TG'}
                      {channel.status !== 'connected' || !channel.canPost ? ' · нет доступа' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {(!editorChannel || editorChannel.status !== 'connected' || !editorChannel.canPost) && (
                <div className="cp-editor-note">
                  <AlertCircle size={16} />
                  <span>Для публикации нужен подключённый канал.</span>
                  <button type="button" className="cp-bot-action" onClick={() => setChannelsOpen(true)}>
                    Подключить
                  </button>
                </div>
              )}
              </section>
              <section className="cp-wizard-compose" hidden={editorStep !== 2}>
                <div className="cp-wizard-heading">
                  <h3 data-step-heading="2" tabIndex={-1}>Соберите пост</h3>
                  <button type="button" className="secondary-button" disabled={saving} onClick={() => goToEditorStep(1)}>
                    {editorChannel ? 'Идея и канал' : 'Выбрать канал'}
                  </button>
                </div>
                <div className="cp-wizard-columns">
                  <div className="cp-wizard-copy">
                  <div className="cp-compose-label"><strong>{editor.mediaId ? 'Подпись к фото' : 'Текст поста'}</strong>
                    <span className={textLength > limit ? 'over' : ''}>{textLength.toLocaleString('ru-RU')} / {limit.toLocaleString('ru-RU')}</span>
                  </div>
                  {!isVkEditor ? <TelegramPostEditor key={editor.postId || 'new'}
                    text={editor.text} html={editor.telegramHtml} disabled={saving}
                    onChange={(text, telegramHtml) => setEditor((current) => current ? { ...current, text, telegramHtml } : current)} /> : <>
                    <div className="cp-md-toolbar">
                      <button disabled={saving} type="button" title="Жирный" onClick={() => applyMarkdown('bold')}>
                        <b>B</b>
                      </button>
                      <button disabled={saving} type="button" title="Курсив" onClick={() => applyMarkdown('italic')}>
                        <i>I</i>
                      </button>
                      <button disabled={saving} type="button" title="Ссылка" onClick={() => applyMarkdown('link')}>
                        ↗
                      </button>
                      <button disabled={saving} type="button" title="Список" onClick={() => applyMarkdown('list')}>
                        •
                      </button>
                    </div>
                    <textarea
                      disabled={saving}
                      aria-label="Текст поста"
                      ref={textareaRef}
                      className="cp-md-textarea"
                      value={editor.text}
                      onChange={(event) => setEditor({ ...editor, text: event.target.value, telegramHtml: undefined })}
                      placeholder="Напишите пост…"
                    />
                  </>}
                  </div>
                  <section className="cp-wizard-photo" aria-label="Фото к посту">
                    <h4>Фото <small>необязательно</small></h4>
                    {editor.mediaPreviewUrl
                      ? <img src={editor.mediaPreviewUrl} alt="Фото для поста" referrerPolicy="no-referrer" />
                      : <div className="cp-wizard-photo-empty"><ImagePlus size={24} aria-hidden="true" />
                        <small>{canAttachPhoto ? 'JPEG или PNG до 5 МБ' : 'Фото доступно для подключённого канала с загрузкой изображений.'}</small>
                      </div>}
                    <div className="cp-wizard-photo-actions">
                    {canAttachPhoto && (
                      <label className="secondary-button cp-photo-picker">
                        <input type="file" aria-label={editor.mediaId ? 'Заменить фото' : 'Добавить фото'} accept="image/jpeg,image/png" disabled={saving} onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          if (file) void uploadPhoto(file);
                        }} />
                        <ImagePlus size={16} aria-hidden="true" /> {editor.mediaId ? 'Заменить' : 'Загрузить'}
                      </label>
                    )}
                    {editor.mediaId && (
                      <button className="cp-icon-button" aria-label="Удалить фото" type="button" disabled={saving}
                        onClick={() => setEditor({ ...editor, mediaId: undefined, mediaPreviewUrl: undefined })}><Trash2 size={16} /></button>
                    )}
                      {canAttachPhoto && <PostImageGenerator key={editor.channelId} channelId={editor.channelId}
                        disabled={saving} hasPhoto={Boolean(editor.mediaId)} commonRules={meta.imageRules ?? ''}
                        channelRules={editorChannel?.imageRules ?? ''} onSaveRules={saveImageRules} onStage={stagePhoto} onAttach={attachPhoto} />}
                    </div>
                  </section>
                </div>
              </section>
                  <PostTextGenerator step={editorStep} footerActions={wizardFooterActions} onStartManual={() => goToEditorStep(2, true)}
                    key={`${editor.postId || 'new'}:${editor.channelId}`}
                    platform={isVkEditor ? 'vk' : 'telegram'} caption={Boolean(editor.mediaId)}
                    disabled={saving} text={editor.text} channel={editorChannel} commonRules={meta.writingRules}
                    onSaveRules={saveRules}
                    onInsert={(text) => { setEditor((current) => current ? {
                      ...current,
                      text,
                      telegramHtml: isVkEditor ? undefined : text.replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
                    } : current); goToEditorStep(2, true); }}
                  />
              <section className="cp-wizard-publish" hidden={editorStep !== 3}>
                <div className="cp-wizard-publish-settings">
                  <h3 data-step-heading="3" tabIndex={-1}>Предпросмотр и время</h3>
              {(!editorChannel || editorChannel.status !== 'connected' || !editorChannel.canPost) && (
                <div className="cp-editor-note">
                  <AlertCircle size={16} />
                  <span>Для публикации нужен подключённый канал.</span>
                  <button type="button" className="cp-bot-action" onClick={() => setChannelsOpen(true)}>
                    Подключить
                  </button>
                </div>
              )}
                <div className="cp-schedule-modes" role="group" aria-label="Способ публикации">
                  <button type="button" className="secondary-button" aria-pressed={publishMode === 'scheduled'}
                    disabled={saving} onClick={() => setPublishMode('scheduled')}>По расписанию</button>
                  <button type="button" className="secondary-button" aria-pressed={publishMode === 'now'}
                    disabled={saving} onClick={() => setPublishMode('now')}>Сейчас</button>
                </div>
                {publishMode === 'scheduled' && <>
              <div className="cp-editor-row">
                <label className="cp-field">
                  <span>Дата</span>
                  <input
                    disabled={saving}
                    type="date"
                    value={editor.date}
                    onChange={(event) => setEditor({ ...editor, date: event.target.value })}
                  />
                </label>
                <label className="cp-field">
                  <span>Время</span>
                  <input
                    disabled={saving}
                    type="time"
                    value={editor.time}
                    onChange={(event) => setEditor({ ...editor, time: event.target.value })}
                  />
                </label>
              </div>
                  <p>{timeZoneLabel}</p>
                </>}
                </div>
                  <div className="cp-preview">

                    <div className="cp-preview-head">
                      <span className={'cp-preview-ava' + (isVkEditor ? ' vk' : '')}>{isVkEditor ? 'VK' : 'TG'}</span>
                      <div>
                        <strong>{editorChannel?.title || 'Канал'}</strong>
                        <small>{platformLabel} · предпросмотр</small>
                      </div>
                    </div>
                    {editor.mediaPreviewUrl && <img className="cp-preview-photo" src={editor.mediaPreviewUrl} alt="Фото в публикации" referrerPolicy="no-referrer" />}
                    <div
                      className="cp-preview-text"
                      dangerouslySetInnerHTML={{
                        __html: previewHtml || '<span class="cp-muted">Текст поста появится здесь.</span>',
                      }}
                    />

                  </div>
              </section>
              {storageError && <p className="cp-error" role="alert">Текст не сохранился на этом устройстве. Сохраните черновик.</p>}
              {editorError && <div className="cp-error" role="alert">{editorError}</div>}
            </div>
            <div className="cp-editor-foot cp-composer-footer">
              <div className="cp-draft-actions">
                {(editor.postId || editor.text.trim() || editor.mediaId) && (
                  <button className="cp-editor-delete" type="button" onClick={() => void removePost()}
                    aria-label={editor.postId ? 'Удалить пост' : 'Удалить черновик'} disabled={saving}><Trash2 size={16} /></button>
                )}
                {(editorStep !== 1 || editor.text.trim()) && (
                  <button className="secondary-button" type="button" disabled={saving || !editor.text.trim()}
                    onClick={() => void save('draft')}>Сохранить черновик</button>
                )}
              </div>
              <div className="cp-editor-actions" ref={setWizardFooterActions}>
                {editorStep > 1 && <button type="button" className="secondary-button" disabled={saving}
                  onClick={() => goToEditorStep(editorStep === 3 ? 2 : 1)}>Назад</button>}
                {editorStep === 2 && <button type="button" className="primary-button" disabled={saving || !editor.text.trim() || textLength > limit}
                  onClick={() => goToEditorStep(3)}>К публикации <ChevronRight size={16} /></button>}
                {editorStep === 3 && (
                <button className="primary-button" type="button"
                  disabled={saving || !editor.text.trim() || textLength > limit || !editorChannel ||
                    editorChannel.status !== 'connected' || !editorChannel.canPost ||
                    (publishMode === 'scheduled' && (!editor.date || !editor.time)) ||
                    Boolean(editor.mediaId && isVkEditor && !meta.vkPhotoEnabled)}
                  onClick={() => {
                    if (publishMode === 'now') setPublishConfirm(true);
                    else void save('scheduled');
                  }}>
                  {saving ? 'Подождите…' : publishMode === 'now' ? 'Опубликовать'
                    : currentPost?.status === 'scheduled' ? 'Сохранить изменения' : 'Запланировать'}
                </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {publishConfirm && editor && (
        <div
          className="cp-modal-overlay cp-confirm-overlay"
          onClick={() => {
            if (!saving) setPublishConfirm(false);
          }}
        >
          <section
            className="cp-modal cp-publish-confirm"
            role="dialog"
            aria-modal="true"
            aria-label="Подтверждение публикации"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <h3>Опубликовать сейчас?</h3>
            </div>
            <div className="cp-publish-destination">
              <span className={'cp-preview-ava' + (isVkEditor ? ' vk' : '')} aria-hidden="true">{isVkEditor ? 'VK' : 'TG'}</span>
              <div><small>Канал публикации</small><strong>{editorChannel?.title}</strong></div>
              <span>{platformLabel}</span>
            </div>
            <div className="cp-publish-scroll">
              <article className="cp-publish-card">
                {editor.mediaPreviewUrl && <img src={editor.mediaPreviewUrl} alt="Фото для отправки" referrerPolicy="no-referrer" />}
                <div className="cp-preview-text" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </article>
            </div>
            {editorError && (
              <div className="cp-error" role="alert">
                {editorError}
              </div>
            )}
            <div className="cp-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => setPublishConfirm(false)}
              >
                Вернуться
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={saving}
                onClick={() => void publishNowAction()}
              >
                <Send size={16} aria-hidden="true" /> {saving ? 'Публикуем…' : 'Опубликовать сейчас'}
              </button>
            </div>
          </section>
        </div>
      )}

      {connectOpen && (
        <div className="cp-modal-overlay" onClick={() => setConnectOpen(false)}>
          <div
            className="cp-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Подключить Telegram-канал"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <div className="cp-modal-heading">
                <span className="cp-modal-icon">
                  <Send size={19} />
                </span>
                <div>
                  <h3>Подключить Telegram-канал</h3>
                  <p className="cp-modal-subtitle">Свой бот публикует посты в этот канал.</p>
                </div>
              </div>
              <button
                className="cp-icon-button"
                type="button"
                aria-label="Закрыть"
                onClick={() => setConnectOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            {meta.telegramBot.configured ? (
              <>
                <div className="cp-current-bot">
                  <i className="cp-dot telegram" />
                  <span>
                    Публикует{' '}
                    <a href={meta.telegramBot.url} target="_blank" rel="noreferrer">
                      @{meta.telegramBot.username}
                    </a>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConnectOpen(false);
                      setBotError('');
                      setBotOpen(true);
                    }}
                  >
                    Заменить
                  </button>
                </div>
                <div className="cp-connect-steps">
                  <div className="cp-connect-step">
                    <span>1</span>
                    <p>
                      Добавьте{' '}
                      <a href={meta.telegramBot.url} target="_blank" rel="noreferrer">
                        @{meta.telegramBot.username}
                      </a>{' '}
                      в канал администратором с правом «Публиковать сообщения».
                    </p>
                  </div>
                  <div className="cp-connect-step">
                    <span>2</span>
                    <p>
                      Вставьте <b>@username</b> канала или ссылку <b>t.me/…</b>.
                    </p>
                  </div>
                </div>
                {meta.telegramBot.error && <div className="cp-error">{meta.telegramBot.error}</div>}
                <label className="cp-field">
                  <span>Канал</span>
                  <input
                    value={channelRef}
                    onChange={(event) => setChannelRef(event.target.value)}
                    placeholder="@channel или https://t.me/channel"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void connectChannel();
                    }}
                  />
                </label>
                {connectError && <div className="cp-error">{connectError}</div>}
                <div className="cp-modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setConnectOpen(false)}>
                    Отмена
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={connecting || !channelRef.trim()}
                    onClick={() => void connectChannel()}
                  >
                    <Send size={15} /> {connecting ? 'Проверяем…' : 'Подключить'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="cp-modal-empty">
                  <span className="cp-modal-icon">
                    <Bot size={22} />
                  </span>
                  <h4>Сначала подключите бота</h4>
                  <p>Он будет публиковать посты в канал. Создать бота можно за минуту в BotFather.</p>
                </div>
                <div className="cp-modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setConnectOpen(false)}>
                    Закрыть
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setConnectOpen(false);
                      setBotError('');
                      setBotOpen(true);
                    }}
                  >
                    Подключить бота
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {vkOpen && (
        <div className="cp-modal-overlay" onClick={closeVk}>
          <div
            className="cp-modal cp-vk-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Подключить ВКонтакте"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <div className="cp-modal-heading">
                <span className="cp-modal-icon">
                  <Send size={19} />
                </span>
                <div>
                  <h3>Группа ВКонтакте</h3>
                  <p className="cp-modal-subtitle">
                    {vkSelectedGroup
                      ? 'Осталось добавить ключ доступа сообщества.'
                      : 'Выберите сообщество, где вы администратор.'}
                  </p>
                </div>
              </div>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={closeVk}>
                <X size={16} />
              </button>
            </div>
            {vkLoading ? (
              <p className="cp-muted">Загружаем группы…</p>
            ) : vkSelectedGroup ? (
              <>
                <button
                  className="cp-vk-back"
                  type="button"
                  disabled={vkConnecting}
                  onClick={() => {
                    setVkSelectedGroup(null);
                    setVkToken('');
                    setShowVkToken(false);
                    setVkError('');
                  }}
                >
                  ← К списку групп
                </button>
                <div className="cp-vk-selected">
                  <span className="cp-vk-ava">VK</span>
                  <div className="cp-vk-main">
                    <strong>{vkSelectedGroup.name}</strong>
                    <small>
                      vk.com/{vkSelectedGroup.screenName || vkSelectedGroup.id} ·{' '}
                      {vkSelectedGroup.membersCount.toLocaleString('ru-RU')} участников
                    </small>
                  </div>
                  <a
                    href={`https://vk.com/${vkSelectedGroup.screenName || 'club' + vkSelectedGroup.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть
                  </a>
                </div>
                <div className="cp-connect-steps">
                  <div className="cp-connect-step">
                    <span>1</span>
                    <p>
                      В сообществе откройте <b>Управление → Дополнительно → Работа с API</b>.
                    </p>
                  </div>
                  <div className="cp-connect-step">
                    <span>2</span>
                    <p>Создайте ключ доступа с правом «Управление сообществом» (и «Стена», если есть).</p>
                  </div>
                  <div className="cp-connect-step">
                    <span>3</span>
                    <p>Скопируйте ключ и вставьте его сюда.</p>
                  </div>
                </div>
                <label className="cp-field">
                  <span>Ключ доступа сообщества</span>
                  <div className="cp-token-wrap">
                    <input
                      type={showVkToken ? 'text' : 'password'}
                      value={vkToken}
                      onChange={(event) => setVkToken(event.target.value)}
                      placeholder="vk1.a…"
                      autoComplete="off"
                      spellCheck={false}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void connectVk();
                      }}
                    />
                    <button
                      className="cp-token-toggle"
                      type="button"
                      aria-label={showVkToken ? 'Скрыть ключ' : 'Показать ключ'}
                      aria-pressed={showVkToken}
                      title={showVkToken ? 'Скрыть ключ' : 'Показать ключ'}
                      onClick={() => setShowVkToken((value) => !value)}
                    >
                      {showVkToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <p className="cp-bot-note">
                  Ключ хранится зашифрованным и не показывается после сохранения. Отозвать его можно в настройках
                  сообщества. Фото через такой ключ ВК не принимает — только текст.
                </p>
                {vkError && <div className="cp-error">{vkError}</div>}
                <div className="cp-modal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={vkConnecting}
                    onClick={() => {
                      setVkSelectedGroup(null);
                      setVkToken('');
                      setShowVkToken(false);
                      setVkError('');
                    }}
                  >
                    Назад
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={vkConnecting || !vkToken.trim()}
                    onClick={() => void connectVk()}
                  >
                    {vkConnecting ? 'Подключаем…' : 'Подключить'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {vkError && <div className="cp-error">{vkError}</div>}
                {vkGroups.length ? (
                  <div className="cp-vk-list">
                    {vkGroups.map((group) => (
                      <div className="cp-vk-group" key={group.id}>
                        <span className="cp-vk-ava">VK</span>
                        <div className="cp-vk-main">
                          <strong>{group.name}</strong>
                          <small>
                            vk.com/{group.screenName || group.id} · {group.membersCount.toLocaleString('ru-RU')}{' '}
                            участников
                          </small>
                        </div>
                        <button
                          className="secondary-button cp-vk-connect"
                          type="button"
                          onClick={() => {
                            setVkSelectedGroup(group);
                            setVkToken('');
                            setShowVkToken(false);
                            setVkError('');
                          }}
                        >
                          Подключить
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  !vkError && <p className="cp-muted">Вы не администратор ни одной группы ВК.</p>
                )}
                <div className="cp-modal-actions">
                  <button className="secondary-button" type="button" onClick={closeVk}>
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {botOpen && (
        <div className="cp-modal-overlay" onClick={closeBot}>
          <div
            className="cp-modal cp-bot-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Подключить бота"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cp-modal-head">
              <div className="cp-modal-heading">
                <span className="cp-modal-icon">
                  <Bot size={20} />
                </span>
                <div>
                  <h3>Свой Telegram-бот</h3>
                  <p className="cp-modal-subtitle">
                    Публикует в ваши каналы. Вы контролируете доступ и можете отозвать токен.
                  </p>
                </div>
              </div>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={closeBot}>
                <X size={16} />
              </button>
            </div>
            <ol className="cp-bot-steps">
              <li>
                Откройте{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                  @BotFather
                </a>{' '}
                и отправьте <code>/newbot</code>.
              </li>
              <li>Придумайте имя и username бота.</li>
              <li>
                Скопируйте токен вида <code>123456:ABC…</code>.
              </li>
              <li>Вставьте сюда. Потом добавьте бота в канал администратором с правом «Публиковать сообщения».</li>
            </ol>
            {meta.telegramBot.configured && (
              <div className="cp-current-bot">
                <i className="cp-dot telegram" />
                <span>
                  Сейчас подключён{' '}
                  <a href={meta.telegramBot.url} target="_blank" rel="noreferrer">
                    @{meta.telegramBot.username}
                  </a>
                </span>
                <a href={meta.telegramBot.url} target="_blank" rel="noreferrer">
                  Открыть
                </a>
              </div>
            )}
            {meta.telegramBot.configured && (
              <p className="cp-bot-note">Новый токен заменит текущего бота; каналы нужно будет проверить.</p>
            )}
            <label className="cp-field">
              <span>Токен бота</span>
              <div className="cp-token-wrap">
                <input
                  type={showBotToken ? 'text' : 'password'}
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder="123456:ABC…"
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void saveBot();
                  }}
                />
                <button
                  className="cp-token-toggle"
                  type="button"
                  aria-label={showBotToken ? 'Скрыть токен' : 'Показать токен'}
                  aria-pressed={showBotToken}
                  title={showBotToken ? 'Скрыть токен' : 'Показать токен'}
                  onClick={() => setShowBotToken((value) => !value)}
                >
                  {showBotToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <p className="cp-bot-note">
              Токен хранится зашифрованным и не показывается после сохранения. Отозвать его можно в BotFather.
            </p>
            {botError && <div className="cp-error">{botError}</div>}
            <div className="cp-modal-actions">
              {meta.telegramBot.configured && (
                <button className="cp-danger" type="button" disabled={botSaving} onClick={() => void disconnectBot()}>
                  Отключить бота
                </button>
              )}
              <button className="secondary-button" type="button" disabled={botSaving} onClick={closeBot}>
                Отмена
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={botSaving || !botToken.trim()}
                onClick={() => void saveBot()}
              >
                {botSaving ? 'Проверяем…' : meta.telegramBot.configured ? 'Сохранить' : 'Подключить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="cp-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
