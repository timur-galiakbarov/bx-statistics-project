import { CalendarClock, Check, Plus, Send, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../api/client';
import { renderContentPlanMarkdown } from '../utils/contentPlanMarkdown';
import './content.css';
import './content-plan.css';

type PlanChannel = {
  id: string;
  platform: 'vk' | 'telegram';
  title: string;
  handle: string;
  status: 'connected' | 'needs_reauth' | 'error';
  canPost: boolean;
  error: string;
};

type PlanPost = {
  id: string;
  channelId: string;
  platform: 'vk' | 'telegram';
  title: string;
  text: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledAt: string | null;
  timeZone: string;
  autoPublish: boolean;
  externalUrl: string;
  error: string;
};

type TelegramBot = { configured: boolean; username: string; url: string; name: string; status: 'connected' | 'needs_reauth' | 'error' | null; error: string };
type Meta = { channels: PlanChannel[]; posts: PlanPost[]; telegramBot: TelegramBot };
type EditorState = { postId: string | null; channelId: string; date: string; time: string; text: string; failure: string };

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
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
  return `${day} ${MONTHS[month - 1].toLowerCase()}, ${WEEKDAYS[(date.getDay() + 6) % 7]}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + formatTime(iso);
}

function titleFrom(text: string) {
  const first = String(text || '').split('\n').find((line) => line.trim()) || 'Без названия';
  return first.replace(/[*_`#>\[\]]/g, '').replace(/\|/g, ' ').trim().slice(0, 80);
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

export function ContentPlanPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [filter, setFilter] = useState('all');
  const [connectOpen, setConnectOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [botError, setBotError] = useState('');
  const [botSaving, setBotSaving] = useState(false);
  const [channelRef, setChannelRef] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorTab, setEditorTab] = useState<'text' | 'preview'>('text');
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const todayKey = isoLocal(new Date());

  useEffect(() => {
    apiGet<Meta>('/api/content-plan')
      .then(setMeta)
      .catch((reason) => {
        setError(
          reason instanceof ApiError && reason.status === 403
            ? 'Раздел пока недоступен. Включите его в «Админке → Настройки → Фичи».'
            : reason instanceof Error
              ? reason.message
              : 'Не удалось загрузить контент-план.'
        );
      });
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const refreshMeta = () => {
    apiGet<Meta>('/api/content-plan').then(setMeta).catch(() => undefined);
  };

  useEffect(() => {
    const timer = window.setInterval(refreshMeta, 30_000);
    window.addEventListener('focus', refreshMeta);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshMeta);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2800);
  };

  const editorChannel = meta && editor ? meta.channels.find((channel) => channel.id === editor.channelId) : undefined;
  const limit = editorChannel?.platform === 'vk' ? 16000 : 4096;
  const textLength = editor?.text.length ?? 0;

  const openNew = (dateKey?: string) => {
    if (!meta) return;
    if (!meta.channels.length) {
      setConnectOpen(true);
      showToast('Сначала подключите канал.');
      return;
    }
    const channelId = filter !== 'all' && meta.channels.some((channel) => channel.id === filter)
      ? filter
      : meta.channels[0].id;
    const slot = dateKey && dateKey !== todayKey ? { date: dateKey, time: '10:00' } : nextSlot();
    if (dateKey && dateKey !== todayKey) setMonth(startOfMonth(new Date(dateKey + 'T00:00:00')));
    setEditor({ postId: null, channelId, date: slot.date, time: slot.time, text: '', failure: '' });
    setEditorTab('text');
    setEditorError('');
  };

  const openEdit = (post: PlanPost) => {
    if (!meta) return;
    if (post.status === 'published' || post.status === 'publishing') {
      showToast('Опубликованный пост нельзя редактировать.');
      return;
    }
    const channel = meta.channels.find((item) => item.id === post.channelId);
    if (!channel) {
      showToast('Канал отключён. Подключите его снова.');
      return;
    }
    setEditor({
      postId: post.id,
      channelId: post.channelId,
      date: localDate(post.scheduledAt),
      time: localTime(post.scheduledAt),
      text: post.text,
      failure: post.error || ''
    });
    setEditorTab('text');
    setEditorError('');
  };

  const save = async (status: 'draft' | 'scheduled') => {
    if (!editor || !meta || saving) return;
    const channel = meta.channels.find((item) => item.id === editor.channelId);
    const text = editor.text.trim();
    if (!channel) {
      setEditorError('Выберите подключённый канал.');
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
    setEditor((current) => current ? { ...current, failure: '' } : current);
    try {
      const payload = {
        channelId: editor.channelId,
        text: editor.text,
        status,
        scheduledAt,
        timeZone
      };
      const post = editor.postId
        ? await apiPatch<PlanPost>(`/api/content-plan/posts/${editor.postId}`, payload)
        : await apiPost<PlanPost>('/api/content-plan/posts', payload);
      setMeta((current) => {
        if (!current) return current;
        const exists = current.posts.some((item) => item.id === post.id);
        return {
          ...current,
          posts: exists ? current.posts.map((item) => item.id === post.id ? post : item) : [...current.posts, post]
        };
      });
      if (post.scheduledAt) setMonth(startOfMonth(new Date(post.scheduledAt)));
      setEditor(null);
      setEditorTab('text');
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
    if (!channel) {
      setEditorError('Выберите подключённый канал.');
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
    setEditor((current) => current ? { ...current, failure: '' } : current);
    let postId = editor.postId;
    try {
      if (!postId) {
        const created = await apiPost<PlanPost>('/api/content-plan/posts', {
          channelId: editor.channelId,
          text: editor.text,
          status: 'draft',
          scheduledAt: null,
          timeZone
        });
        postId = created.id;
        setMeta((current) => current ? { ...current, posts: [...current.posts, created] } : current);
        setEditor((current) => current ? { ...current, postId: created.id } : current);
      }
      const post = await apiPost<PlanPost>(`/api/content-plan/posts/${postId}/publish`);
      setMeta((current) => current ? {
        ...current,
        posts: current.posts.map((item) => item.id === post.id ? post : item)
      } : current);
      setEditor(null);
      setEditorTab('text');
      showToast('Опубликовано в Telegram');
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не удалось опубликовать пост.');
    } finally {
      setSaving(false);
    }
  };

  const removePost = async () => {
    if (!editor?.postId || saving) return;
    if (!window.confirm('Удалить этот пост?')) return;
    setSaving(true);
    setEditorError('');
    try {
      await apiDelete('/api/content-plan/posts/' + editor.postId);
      setMeta((current) => current ? { ...current, posts: current.posts.filter((post) => post.id !== editor.postId) } : current);
      setEditor(null);
      showToast('Пост удалён');
    } catch (reason) {
      setEditorError(reason instanceof Error ? reason.message : 'Не удалось удалить пост.');
    } finally {
      setSaving(false);
    }
  };

  const applyMarkdown = (kind: 'bold' | 'italic' | 'link' | 'list' | 'quote' | 'code') => {
    const textarea = textareaRef.current;
    if (!textarea || !editor) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    if (kind === 'list' || kind === 'quote') {
      const prefix = kind === 'list' ? '- ' : '> ';
      const lines = (selected || 'текст').split('\n').map((line) => prefix + line).join('\n');
      textarea.setRangeText(lines, start, end, 'end');
      textarea.focus();
      setEditor({ ...editor, text: textarea.value });
      return;
    }
    const [before, after, fallback] = kind === 'bold'
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

  const saveBot = async () => {
    if (!botToken.trim() || botSaving) return;
    setBotSaving(true);
    setBotError('');
    try {
      const bot = await apiPost<TelegramBot>('/api/content-plan/bot/telegram', { token: botToken });
      setMeta((current) => current ? { ...current, telegramBot: bot } : current);
      setBotOpen(false);
      setBotToken('');
      showToast('Бот подключён: @' + bot.username);
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
      setMeta((current) => current ? { ...current, telegramBot: { configured: false, username: '', url: '', name: '', status: null, error: '' } } : current);
      setBotOpen(false);
      showToast('Бот отключён');
      refreshMeta();
    } catch (reason) {
      setBotError(reason instanceof Error ? reason.message : 'Не удалось отключить бота.');
    } finally {
      setBotSaving(false);
    }
  };

  const connectChannel = async () => {
    if (!channelRef.trim() || connecting) return;
    setConnecting(true);
    setConnectError('');
    try {
      const channel = await apiPost<PlanChannel>('/api/content-plan/channels/telegram', { ref: channelRef });
      setMeta((current) => current ? {
        ...current,
        channels: [...current.channels.filter((item) => item.id !== channel.id), channel]
      } : current);
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
      setMeta((current) => current ? { ...current, channels: current.channels.filter((item) => item.id !== channel.id) } : current);
      if (filter === channel.id) setFilter('all');
      if (editor?.channelId === channel.id) setEditor(null);
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

  const scheduled = meta.posts.filter((post) => post.status === 'scheduled');
  const drafts = meta.posts.filter((post) => post.status === 'draft');
  const published = meta.posts.filter((post) => post.status === 'published');
  const nextPost = scheduled
    .slice()
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))
    .find((post) => post.scheduledAt && new Date(post.scheduledAt).getTime() >= Date.now()) || scheduled[0];
  const cells = calendarCells(month);
  const filteredDrafts = drafts.filter((post) => filter === 'all' || post.channelId === filter);
  const previewHtml = editor ? renderContentPlanMarkdown(editor.text) : '';

  return (
    <div className="content-page cp-page">
      <div className="cp-head">
        <div>
          <div className="cp-eyebrow"><CalendarClock size={14} /> Контент-план</div>
          <h2>План публикаций</h2>
          <p>Календарь и автопубликация. Время — в вашем часовом поясе: {timeZone}.</p>
          <div className="cp-stats">
            <span><i className="cp-dot blue" /><b>{scheduled.length}</b> в плане</span>
            <span><i className="cp-dot amber" /><b>{drafts.length}</b> черновиков</span>
            <span><i className="cp-dot green" /><b>{published.length}</b> опубликовано</span>
            <span>{meta.channels.length} каналов</span>
          </div>
        </div>
        <div className="cp-actions">
          <span className="content-tag"><ShieldCheck size={13} /> Только для админов</span>
          <button className="primary-button" type="button" onClick={() => openNew(todayKey)}>
            <Plus size={16} /> Новый пост
          </button>
        </div>
      </div>

      <div className="cp-toolbar">
        <div className="cp-filters">
          <button className={'cp-filter' + (filter === 'all' ? ' active' : '')} type="button" onClick={() => setFilter('all')}>Все каналы</button>
          {meta.channels.map((channel) => (
            <button key={channel.id} className={'cp-filter' + (filter === channel.id ? ' active' : '')} type="button" onClick={() => setFilter(channel.id)}>
              <i className={'cp-dot ' + channel.platform} />{channel.title}
            </button>
          ))}
        </div>
        <div className="cp-month">
          <button className="cp-icon-button" type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
          <button className="cp-icon-button" type="button" aria-label="Следующий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          <button className="secondary-button cp-today" type="button" onClick={() => setMonth(startOfMonth(new Date()))}>Сегодня</button>
        </div>
      </div>

      <div className="cp-grid">
        <section className="cp-calendar" aria-label="Календарь публикаций">
          <div className="cp-dow-row">{DOW.map((day) => <div className="cp-dow" key={day}>{day}</div>)}</div>
          <div className="cp-cells">
            {cells.map((cell) => {
              const posts = postsOnDay(meta.posts, cell.key, filter);
              return (
                <div
                  key={cell.key}
                  className={'cp-day' + (cell.inMonth ? '' : ' other') + (cell.key === todayKey ? ' today' : '')}
                  onClick={() => openNew(cell.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openNew(cell.key); }}
                >
                  <span className="cp-day-num">{cell.date.getDate()}</span>
                  {posts.slice(0, 2).map((post) => {
                    const channel = meta.channels.find((item) => item.id === post.channelId);
                    return (
                      <button
                        key={post.id}
                        className={'cp-post ' + post.status}
                        type="button"
                        title={`${channel?.title || 'Канал'} · ${post.scheduledAt ? formatTime(post.scheduledAt) : ''} · ${titleFrom(post.title || post.text)}`}
                        onClick={(event) => { event.stopPropagation(); openEdit(post); }}
                      >
                        <i className={'cp-dot ' + post.platform} />
                        <span className="cp-post-time">{post.scheduledAt ? formatTime(post.scheduledAt) : ''}</span>
                        <span className="cp-post-title">{titleFrom(post.title || post.text)}</span>
                      </button>
                    );
                  })}
                  {posts.length > 2 && <span className="cp-more">+ ещё {posts.length - 2}</span>}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="cp-rail">
          <section className="cp-card">
            <div className="cp-card-head">
              <h3>Каналы для публикации</h3>
              <span className="cp-count">{meta.channels.length}</span>
            </div>
            <div className="cp-bot-row">
              <div className="cp-bot-main">
                <strong>Свой бот</strong>
                <small>{meta.telegramBot.configured ? '@' + meta.telegramBot.username + ' · подключён' : 'не подключён'}</small>
              </div>
              <button className="cp-bot-action" type="button" onClick={() => { setBotError(''); setBotOpen(true); }}>
                {meta.telegramBot.configured ? 'Заменить' : 'Подключить'}
              </button>
            </div>
            {meta.telegramBot.configured && meta.telegramBot.status !== 'connected' && (
              <div className="cp-bot-warning">{meta.telegramBot.error || 'Токен бота нужно проверить.'}</div>
            )}
            {meta.channels.length ? (
              <div className="cp-channels">
                {meta.channels.map((channel) => (
                  <div className="cp-channel" key={channel.id}>
                    <i className={'cp-dot ' + channel.platform} />
                    <div className="cp-channel-main">
                      <strong>{channel.title}</strong>
                      <small>{channel.handle || (channel.platform === 'vk' ? 'ВКонтакте' : 'Telegram')}</small>
                    </div>
                    <span className={'cp-status ' + channel.status}>{channel.status === 'connected' ? 'подключён' : 'проверить'}</span>
                    <button className="cp-channel-remove" type="button" aria-label={'Отключить ' + channel.title} title="Отключить" onClick={() => void disconnectChannel(channel)}><X size={13} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cp-empty">
                <p>Пока нет каналов. {meta.telegramBot.configured ? 'Добавьте бота в Telegram-канал и вставьте ссылку.' : 'Сначала подключите своего бота.'}</p>
              </div>
            )}
            <button
              className="secondary-button cp-full"
              type="button"
              onClick={() => {
                if (!meta.telegramBot.configured) {
                  setBotError('');
                  setBotOpen(true);
                  showToast('Сначала подключите своего бота.');
                  return;
                }
                setConnectError('');
                setConnectOpen(true);
              }}
            >
              <Plus size={15} /> Подключить канал
            </button>
          </section>

          <section className="cp-card">
            <div className="cp-card-head">
              <h3>Автопубликация</h3>
              <span className="cp-on"><Check size={12} /> Включена</span>
            </div>
            <p className="cp-auto-text">Посты выходят по расписанию в вашем часовом поясе.</p>
            {nextPost ? (
              <div className="cp-next">
                <span>{nextPost.scheduledAt ? formatDateTime(nextPost.scheduledAt) : 'Без даты'}</span>
                <strong>{titleFrom(nextPost.title || nextPost.text)}</strong>
              </div>
            ) : (
              <p className="cp-muted">Пока нет запланированных постов.</p>
            )}
            <p className="cp-muted">{scheduled.length} в плане · {published.length} опубликовано</p>
          </section>

          <section className="cp-card">
            <div className="cp-card-head">
              <h3>Черновики</h3>
              <span className="cp-count">{filteredDrafts.length}</span>
            </div>
            {filteredDrafts.length ? (
              <div className="cp-drafts">
                {filteredDrafts.slice(0, 5).map((post) => {
                  const channel = meta.channels.find((item) => item.id === post.channelId);
                  return (
                    <button className="cp-draft" type="button" key={post.id} onClick={() => openEdit(post)}>
                      <span>{titleFrom(post.title || post.text)}</span>
                      <small>{channel?.title || 'Канал'} · {post.scheduledAt ? formatDateTime(post.scheduledAt) : 'Без даты'}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="cp-empty">
                <p>Черновиков нет. Напишите пост и сохраните как черновик.</p>
              </div>
            )}
          </section>
        </aside>
      </div>

      {editor && (
        <div className="cp-editor-overlay" onClick={() => { if (!saving) setEditor(null); }}>
          <aside className="cp-editor" onClick={(event) => event.stopPropagation()}>
            <div className="cp-editor-head">
              <div>
                <span className="cp-eyebrow">{editor.postId ? 'Редактировать пост' : 'Новый пост'}</span>
                <h3>{editor.date ? formatDayKey(editor.date) : 'Без даты'}</h3>
              </div>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={() => { if (!saving) setEditor(null); }}><X size={16} /></button>
            </div>
            <div className="cp-editor-body">
              {editor.failure && <div className="cp-error">Прошлая публикация не удалась: {editor.failure}</div>}
              <label className="cp-field">
                <span>Канал</span>
                <select value={editor.channelId} onChange={(event) => setEditor({ ...editor, channelId: event.target.value })}>
                  {meta.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>{channel.title}</option>
                  ))}
                </select>
              </label>
              <div className="cp-editor-row">
                <label className="cp-field">
                  <span>Дата</span>
                  <input type="date" value={editor.date} onChange={(event) => setEditor({ ...editor, date: event.target.value })} />
                </label>
                <label className="cp-field">
                  <span>Время</span>
                  <input type="time" value={editor.time} onChange={(event) => setEditor({ ...editor, time: event.target.value })} />
                </label>
              </div>
              <div className="cp-auto-row">
                <div className="cp-editor-note"><Check size={13} /> Автопубликация включена · время: {timeZone}</div>
                <button className="cp-publish-now" type="button" disabled={saving || !editor.text.trim()} onClick={() => void publishNowAction()}>Опубликовать сейчас</button>
              </div>
              <div className="cp-editor-tabs">
                <button className={editorTab === 'text' ? 'active' : ''} type="button" onClick={() => setEditorTab('text')}>Текст</button>
                <button className={editorTab === 'preview' ? 'active' : ''} type="button" onClick={() => setEditorTab('preview')}>Предпросмотр</button>
                <span className={textLength > limit ? 'over' : ''}>{textLength.toLocaleString('ru-RU')} / {limit.toLocaleString('ru-RU')}</span>
              </div>
              {editorTab === 'text' ? (
                <>
                  <div className="cp-md-toolbar">
                    <button type="button" title="Жирный" onClick={() => applyMarkdown('bold')}><b>B</b></button>
                    <button type="button" title="Курсив" onClick={() => applyMarkdown('italic')}><i>I</i></button>
                    <button type="button" title="Ссылка" onClick={() => applyMarkdown('link')}>↗</button>
                    <button type="button" title="Список" onClick={() => applyMarkdown('list')}>•</button>
                    <button type="button" title="Цитата" onClick={() => applyMarkdown('quote')}>❝</button>
                    <button type="button" title="Код" onClick={() => applyMarkdown('code')}>`</button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="cp-md-textarea"
                    value={editor.text}
                    onChange={(event) => setEditor({ ...editor, text: event.target.value })}
                    placeholder="Напишите пост…"
                  />
                  <p className="cp-md-hint">Markdown: **жирный**, _курсив_, `код`, [текст](ссылка), списки `- `, цитаты `&gt;`. Для Telegram при отправке преобразуем в HTML.</p>
                </>
              ) : (
                <div className="cp-preview">
                  <div className="cp-preview-head">
                    <span className="cp-preview-ava">TG</span>
                    <div><strong>{editorChannel?.title || 'Канал'}</strong><small>Telegram · предпросмотр</small></div>
                  </div>
                  <div className="cp-preview-text" dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="cp-muted">Текст поста появится здесь.</span>' }} />
                  <div className="cp-preview-foot">{editor.date ? formatDayKey(editor.date) : 'Без даты'} · {editor.time || '—'} · {timeZone}</div>
                </div>
              )}
              {editorError && <div className="cp-error">{editorError}</div>}
            </div>
            <div className="cp-editor-foot">
              <div>{editor.postId && <button className="cp-editor-delete" type="button" onClick={() => void removePost()} disabled={saving}><Trash2 size={15} /> Удалить</button>}</div>
              <div className="cp-editor-actions">
                <button className="secondary-button" type="button" disabled={saving || !editor.text.trim()} onClick={() => void save('draft')}>Черновик</button>
                <button className="primary-button" type="button" disabled={saving || !editor.text.trim() || !editor.date || !editor.time} onClick={() => void save('scheduled')}>
                  {saving ? 'Сохраняем…' : 'Запланировать'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {connectOpen && (
        <div className="cp-modal-overlay" onClick={() => setConnectOpen(false)}>
          <div className="cp-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cp-modal-head">
              <h3>Подключить Telegram-канал</h3>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={() => setConnectOpen(false)}><X size={16} /></button>
            </div>
            {meta.telegramBot.configured ? (
              <>
                <p className="cp-modal-text">
                  1. Добавьте {meta.telegramBot.username ? <a href={meta.telegramBot.url} target="_blank" rel="noreferrer">@{meta.telegramBot.username}</a> : 'бота'} в канал администратором с правом «Публиковать сообщения».
                </p>
                <p className="cp-modal-text">2. Вставьте <b>@username</b> канала или ссылку <b>t.me/…</b>.</p>
                {meta.telegramBot.error && <div className="cp-error">{meta.telegramBot.error}</div>}
                <label className="cp-field">
                  <span>Канал</span>
                  <input
                    value={channelRef}
                    onChange={(event) => setChannelRef(event.target.value)}
                    placeholder="@channel или https://t.me/channel"
                    onKeyDown={(event) => { if (event.key === 'Enter') void connectChannel(); }}
                  />
                </label>
                {connectError && <div className="cp-error">{connectError}</div>}
                <div className="cp-modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setConnectOpen(false)}>Отмена</button>
                  <button className="primary-button" type="button" disabled={connecting || !channelRef.trim()} onClick={() => void connectChannel()}>
                    <Send size={15} /> {connecting ? 'Проверяем…' : 'Подключить'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="cp-modal-text">Сначала подключите своего Telegram-бота — он будет публиковать в канал.</p>
                <div className="cp-modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setConnectOpen(false)}>Закрыть</button>
                  <button className="primary-button" type="button" onClick={() => { setConnectOpen(false); setBotError(''); setBotOpen(true); }}>Подключить бота</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {botOpen && (
        <div className="cp-modal-overlay" onClick={() => { if (!botSaving) setBotOpen(false); }}>
          <div className="cp-modal cp-bot-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cp-modal-head">
              <div>
                <h3>Свой Telegram-бот</h3>
                <p className="cp-modal-text" style={{ margin: '4px 0 0' }}>Публиковать будет ваш бот: вы контролируете доступ и можете отозвать токен в BotFather.</p>
              </div>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={() => { if (!botSaving) setBotOpen(false); }}><X size={16} /></button>
            </div>
            <ol className="cp-bot-steps">
              <li>Откройте <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> и отправьте <code>/newbot</code>.</li>
              <li>Придумайте имя и username бота.</li>
              <li>Скопируйте токен вида <code>123456:ABC…</code>.</li>
              <li>Вставьте сюда. Потом добавьте бота в канал администратором с правом «Публиковать сообщения».</li>
            </ol>
            {meta.telegramBot.configured && (
              <p className="cp-muted">Сейчас подключён <a href={meta.telegramBot.url} target="_blank" rel="noreferrer">@{meta.telegramBot.username}</a>. Новый токен заменит его; каналы нужно будет проверить.</p>
            )}
            <label className="cp-field">
              <span>Токен бота</span>
              <input
                type="password"
                value={botToken}
                onChange={(event) => setBotToken(event.target.value)}
                placeholder="123456:ABC…"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(event) => { if (event.key === 'Enter') void saveBot(); }}
              />
            </label>
            <p className="cp-bot-note">Токен хранится зашифрованным и не показывается после сохранения. Отозвать его можно в BotFather.</p>
            {botError && <div className="cp-error">{botError}</div>}
            <div className="cp-modal-actions">
              {meta.telegramBot.configured && (
                <button className="cp-danger" type="button" disabled={botSaving} onClick={() => void disconnectBot()}>Отключить бота</button>
              )}
              <button className="secondary-button" type="button" disabled={botSaving} onClick={() => setBotOpen(false)}>Отмена</button>
              <button className="primary-button" type="button" disabled={botSaving || !botToken.trim()} onClick={() => void saveBot()}>
                {botSaving ? 'Проверяем…' : meta.telegramBot.configured ? 'Сохранить' : 'Подключить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cp-toast">{toast}</div>}
    </div>
  );
}
