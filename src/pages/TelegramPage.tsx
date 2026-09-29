import {
  Activity,
  CalendarDays,
  Eye,
  ExternalLink,
  Forward,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  SmilePlus,
  Users
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, TelegramAnalytics } from '../api/types';

type TelegramSort = 'date' | 'views' | 'engagement';

const periods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: '7 дней' },
  { key: 'twoWeek', label: '14 дней' },
  { key: 'month', label: '30 дней' },
  { key: 'currentMonth', label: 'Текущий месяц' },
  { key: 'previousMonth', label: 'Прошлый месяц' }
];

function number(value: number, digits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
}

function shortText(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || 'Публикация без текста';
}

function postMediaLabel(type: TelegramAnalytics['posts'][number]['mediaType']) {
  if (!type) return 'Текст';
  return { photo: 'Фото', video: 'Видео', document: 'Файл', poll: 'Опрос', other: 'Медиа' }[type];
}

export function TelegramPage() {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [analytics, setAnalytics] = useState<TelegramAnalytics | null>(null);
  const [sort, setSort] = useState<TelegramSort>('views');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (channel: string, nextPeriod = period, refresh = false) => {
    const normalized = channel.trim();
    if (!normalized) return setMessage('Введите @username или ссылку на публичный канал.');
    setIsLoading(true);
    setMessage(null);
    try {
      const data = await apiGet<TelegramAnalytics>(`/api/telegram/channels/${encodeURIComponent(normalized)}/analytics?period=${nextPeriod}${refresh ? '&refresh=1' : ''}`);
      setAnalytics(data);
      setQuery(`@${data.channel.username}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось получить аналитику Telegram.');
    } finally {
      setIsLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(query);
  };

  const sortedPosts = useMemo(() => [...(analytics?.posts ?? [])].sort((left, right) => {
    if (sort === 'date') return right.timestamp - left.timestamp;
    return right[sort] - left[sort];
  }), [analytics, sort]);
  const chartDays = analytics?.daily ?? [];
  const chartMax = Math.max(1, ...chartDays.map((day) => day.views));

  return (
    <section className="page-grid telegram-page">
      <article className="panel span-2 telegram-intro telegram-live-intro">
        <div>
          <span className="telegram-eyebrow"><Send size={15} /> Telegram · MTProto</span>
          <h2>Аналитика публичных Telegram-каналов</h2>
          <p>Оцените контент, просмотры и вовлечённость канала по реальным данным публикаций.</p>
        </div>
        <form className="telegram-search" onSubmit={submit}>
          <label htmlFor="telegram-channel">Канал</label>
          <div><Search size={18} /><input id="telegram-channel" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="@channel или t.me/channel" /><button type="submit" disabled={isLoading}>{isLoading ? <LoaderCircle className="spin" size={18} /> : 'Анализировать'}</button></div>
        </form>
      </article>

      {message && <div className="telegram-message telegram-message-error span-2">{message}</div>}

      {!analytics && !isLoading && <article className="panel span-2 telegram-start-state">
        <Send size={36} />
        <h3>Введите публичный канал</h3>
        <p>Socstat загрузит публикации за выбранный период и рассчитает средние просмотры, реакции, комментарии, пересылки и вовлечённость.</p>
      </article>}

      {isLoading && !analytics && <article className="panel span-2 telegram-start-state"><LoaderCircle className="spin" size={36} /><h3>Собираем публикации</h3><p>Для активного канала первая загрузка может занять несколько секунд.</p></article>}

      {analytics && <>
        <article className="panel span-2 telegram-channel-hero">
          <div className="telegram-channel-avatar"><Send size={24} /></div>
          <div><div className="telegram-channel-title"><h2>{analytics.channel.title}</h2>{analytics.channel.verified && <span>Проверен</span>}</div><a href={analytics.channel.url} target="_blank" rel="noreferrer">@{analytics.channel.username} <ExternalLink size={13} /></a><p>{analytics.channel.description || 'Описание канала не указано.'}</p></div>
          <div className="telegram-channel-audience"><Users size={18} /><strong>{analytics.channel.subscribers === null ? '—' : number(analytics.channel.subscribers)}</strong><span>подписчиков</span></div>
        </article>

        <article className="panel span-2 telegram-toolbar">
          <div className="telegram-periods">{periods.map((item) => <button key={item.key} className={period === item.key ? 'active' : ''} type="button" onClick={() => { setPeriod(item.key); void load(analytics.channel.username, item.key); }}>{item.label}</button>)}</div>
          <button className="telegram-refresh" type="button" disabled={isLoading} onClick={() => void load(analytics.channel.username, period, true)}><RefreshCw className={isLoading ? 'spin' : ''} size={16} />Обновить</button>
        </article>

        <div className="telegram-kpis span-2">
          <div><Send size={18} /><span>Публикации</span><strong>{number(analytics.summary.posts)}</strong><small>{number(analytics.summary.postsPerWeek, 1)} в неделю</small></div>
          <div><Eye size={18} /><span>Просмотры</span><strong>{number(analytics.summary.views)}</strong><small>{number(analytics.summary.averageViews)} в среднем</small></div>
          <div><SmilePlus size={18} /><span>Реакции</span><strong>{number(analytics.summary.reactions)}</strong><small>На публикациях периода</small></div>
          <div><MessageCircle size={18} /><span>Комментарии</span><strong>{number(analytics.summary.comments)}</strong><small>Ответы в обсуждениях</small></div>
          <div><Forward size={18} /><span>Пересылки</span><strong>{number(analytics.summary.forwards)}</strong><small>Публичный счётчик</small></div>
          <div><Activity size={18} /><span>ER по просмотрам</span><strong>{number(analytics.summary.engagementRate, 2)}%</strong><small>Реакции, комментарии и пересылки</small></div>
        </div>

        <article className="panel span-2 telegram-chart-panel">
          <div className="panel-header compact"><div><h2>Просмотры по дате публикации</h2><p>{analytics.period.dateFrom.split('-').reverse().join('.')} — {analytics.period.dateTo.split('-').reverse().join('.')}</p></div><CalendarDays size={19} /></div>
          {analytics.summary.posts ? <div className="telegram-chart" aria-label="График просмотров публикаций по дням">{chartDays.map((day) => <div key={day.date} title={`${day.date}: ${number(day.views)} просмотров`}><i style={{ height: `${Math.max(day.views ? 5 : 0, day.views / chartMax * 100)}%` }} /><span>{new Date(`${day.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span></div>)}</div> : <div className="telegram-empty">За выбранный период публикаций нет.</div>}
        </article>

        <article className="panel span-2 telegram-posts">
          <div className="panel-header compact"><div><h2>Публикации</h2><p>Текущие публичные счётчики Telegram.</p></div><select value={sort} onChange={(event) => setSort(event.target.value as TelegramSort)}><option value="views">По просмотрам</option><option value="engagement">По вовлечению</option><option value="date">По дате</option></select></div>
          {sortedPosts.length ? <div className="telegram-post-list">{sortedPosts.map((post) => <a key={post.id} href={post.url} target="_blank" rel="noreferrer" className="telegram-post-row">
            <div><span className="telegram-post-type">{postMediaLabel(post.mediaType)}</span><time>{new Date(post.date).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time><p>{shortText(post.text)}</p></div>
            <span><Eye size={14} />{number(post.views)}</span><span><SmilePlus size={14} />{number(post.reactions)}</span><span><MessageCircle size={14} />{number(post.comments)}</span><span><Forward size={14} />{number(post.forwards)}</span><ExternalLink size={15} />
          </a>)}</div> : <div className="telegram-empty">Публикаций за выбранный период не найдено.</div>}
        </article>
      </>}
    </section>
  );
}
