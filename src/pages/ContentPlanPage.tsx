import { CalendarClock, Check, Plus, Send, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiDelete, apiGet, apiPost } from '../api/client';
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
};

type TelegramBot = { configured: boolean; username: string; url: string; name: string; error: string };
type Meta = { channels: PlanChannel[]; posts: PlanPost[]; telegramBot: TelegramBot };
type Notice = { title: string; text: string };

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function isoLocal(value: Date) {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
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
  const date = new Date(iso);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + formatTime(iso);
}

function titleFrom(text: string) {
  const first = String(text || '').split('\n').find((line) => line.trim()) || 'Без названия';
  return first.replace(/[*_`#>\[\]]/g, '').replace(/\|/g, ' ').trim().slice(0, 80);
}

function postsOnDay(posts: PlanPost[], key: string, filter: string) {
  return posts
    .filter((post) => post.scheduledAt && (filter === 'all' || post.channelId === filter))
    .filter((post) => isoLocal(new Date(post.scheduledAt as string)) === key)
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
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

function statusLabel(status: PlanPost['status']) {
  if (status === 'draft') return 'Черновик';
  if (status === 'scheduled') return 'Запланирован';
  if (status === 'published') return 'Опубликован';
  if (status === 'failed') return 'Ошибка';
  return 'Публикуется';
}

export function ContentPlanPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [filter, setFilter] = useState('all');
  const [connectOpen, setConnectOpen] = useState(false);
  const [channelRef, setChannelRef] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

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

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2800);
  };

  const openDay = (key: string) => {
    setNotice({
      title: formatDayKey(key),
      text: 'Редактор поста появится на следующем этапе. Сейчас можно посмотреть план и подключить Telegram-канал.'
    });
  };

  const openPost = (post: PlanPost) => {
    setNotice({
      title: titleFrom(post.title || post.text),
      text: `${statusLabel(post.status)}. ${post.scheduledAt ? formatDateTime(post.scheduledAt) : 'Без даты'}. Редактирование — следующий этап.`
    });
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

  return (
    <div className="content-page cp-page">
      <div className="cp-head">
        <div>
          <div className="cp-eyebrow"><CalendarClock size={14} /> Контент-план</div>
          <h2>План публикаций</h2>
          <p>Календарь и автопубликация. Время — в вашем часовом поясе: {timeZone}. Редактор постов — следующий этап.</p>
          <div className="cp-stats">
            <span><i className="cp-dot blue" /><b>{scheduled.length}</b> в плане</span>
            <span><i className="cp-dot amber" /><b>{drafts.length}</b> черновиков</span>
            <span><i className="cp-dot green" /><b>{published.length}</b> опубликовано</span>
            <span>{meta.channels.length} каналов</span>
          </div>
        </div>
        <div className="cp-actions">
          <span className="content-tag"><ShieldCheck size={13} /> Только для админов</span>
          <button className="primary-button" type="button" onClick={() => setNotice({ title: 'Новый пост', text: 'Редактор поста появится на следующем этапе. Сейчас можно подключить канал и посмотреть календарь.' })}>
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
                  onClick={() => openDay(cell.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDay(cell.key); }}
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
                        onClick={(event) => { event.stopPropagation(); openPost(post); }}
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
                <p>Пока нет каналов. Добавьте бота в Telegram-канал и вставьте ссылку.</p>
              </div>
            )}
            <button className="secondary-button cp-full" type="button" onClick={() => { setConnectError(''); setConnectOpen(true); }}>
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
                <span>{formatDateTime(nextPost.scheduledAt as string)}</span>
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
                    <button className="cp-draft" type="button" key={post.id} onClick={() => openPost(post)}>
                      <span>{titleFrom(post.title || post.text)}</span>
                      <small>{channel?.title || 'Канал'} · {post.scheduledAt ? formatDateTime(post.scheduledAt) : 'Без даты'}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="cp-empty">
                <p>Черновиков нет. Редактор постов — следующий этап.</p>
              </div>
            )}
          </section>
        </aside>
      </div>

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
                <p className="cp-modal-text">Бот для публикации не настроен. Добавьте <code>TELEGRAM_BOT_TOKEN</code> в <code>api/.env</code> и перезапустите API.</p>
                <div className="cp-modal-actions">
                  <button className="secondary-button" type="button" onClick={() => setConnectOpen(false)}>Закрыть</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="cp-modal-overlay" onClick={() => setNotice(null)}>
          <div className="cp-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cp-modal-head">
              <h3>{notice.title}</h3>
              <button className="cp-icon-button" type="button" aria-label="Закрыть" onClick={() => setNotice(null)}><X size={16} /></button>
            </div>
            <p className="cp-modal-text">{notice.text}</p>
            <div className="cp-modal-actions">
              <button className="primary-button" type="button" onClick={() => setNotice(null)}>Понятно</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cp-toast">{toast}</div>}
    </div>
  );
}
