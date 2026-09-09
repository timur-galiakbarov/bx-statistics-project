import { BarChart3, Bot, CalendarDays, Check, Eye, MessageCircle, Plus, Send, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Snapshot = {
  date: string;
  subscribers: number;
  posts: number;
  views: number;
  reach: number;
};

type TelegramChannel = {
  id: string;
  handle: string;
  snapshots: Snapshot[];
};

const STORAGE_KEY = 'socstat.telegram.channels.v1';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function normalizeHandle(value: string) {
  return value.trim().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').replace(/\/+$/, '');
}

function readChannels(): TelegramChannel[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function TelegramPage() {
  const [channels, setChannels] = useState<TelegramChannel[]>(readChannels);
  const [handle, setHandle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ date: today(), subscribers: 0, posts: 0, views: 0, reach: 0 });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  }, [channels]);

  const selectedChannel = channels.find((channel) => channel.id === selectedId) ?? channels[0] ?? null;
  const snapshots = useMemo(
    () => [...(selectedChannel?.snapshots ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [selectedChannel]
  );
  const latest = snapshots[0];
  const previous = snapshots[1];
  const subscriberGrowth = latest && previous ? latest.subscribers - previous.subscribers : null;

  const addChannel = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeHandle(handle);
    if (!/^[a-zA-Z0-9_]{5,}$/.test(normalized)) {
      setMessage('Введите публичный username канала, например @my_channel.');
      return;
    }
    const existing = channels.find((channel) => channel.handle.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      setSelectedId(existing.id);
      setMessage('Этот канал уже добавлен.');
      return;
    }
    const channel = { id: crypto.randomUUID(), handle: normalized, snapshots: [] };
    setChannels((items) => [...items, channel]);
    setSelectedId(channel.id);
    setHandle('');
    setMessage('Канал добавлен. Сохраните первый срез статистики ниже.');
  };

  const saveSnapshot = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedChannel) return;
    if ([snapshot.subscribers, snapshot.posts, snapshot.views, snapshot.reach].some((value) => !Number.isFinite(value) || value < 0)) {
      setMessage('Проверьте значения статистики: нужны неотрицательные числа.');
      return;
    }
    setChannels((items) => items.map((channel) => channel.id !== selectedChannel.id ? channel : {
      ...channel,
      snapshots: [...channel.snapshots.filter((item) => item.date !== snapshot.date), snapshot]
    }));
    setMessage(`Срез за ${snapshot.date.split('-').reverse().join('.')} сохранён.`);
  };

  const setNumber = (key: Exclude<keyof Snapshot, 'date'>, value: string) => {
    setSnapshot((current) => ({ ...current, [key]: Number(value) }));
  };

  return (
    <section className="page-grid telegram-page">
      <article className="panel span-2 telegram-intro">
        <div>
          <span className="telegram-eyebrow"><Send size={15} /> Telegram · MVP</span>
          <h2>Собирайте статистику своего Telegram-канала</h2>
          <p>Добавьте канал и фиксируйте ежедневные показатели. Динамика и базовые метрики посчитаются автоматически.</p>
        </div>
        <div className="telegram-intro-note"><Bot size={22} /><span>Бот-подключение<br />скоро в следующей версии</span></div>
      </article>

      <article className="panel telegram-connect">
        <div className="panel-header compact"><h2>1. Добавьте канал</h2><span className="limit-badge">{channels.length} каналов</span></div>
        <p>Пока доступны публичные каналы. Вводите ссылку или username — данные остаются в этом браузере.</p>
        <form className="telegram-form" onSubmit={addChannel}>
          <label>Ссылка на канал<input value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@my_channel или t.me/my_channel" /></label>
          <button className="primary-button telegram-submit" type="submit"><Plus size={17} />Добавить</button>
        </form>
        {channels.length > 0 && <div className="telegram-channel-list">
          {channels.map((channel) => <button key={channel.id} type="button" onClick={() => setSelectedId(channel.id)} className={selectedChannel?.id === channel.id ? 'active' : ''}>
            <Send size={15} />@{channel.handle}<span>{channel.snapshots.length ? `${channel.snapshots.length} срез.` : 'Нет срезов'}</span>
          </button>)}
        </div>}
      </article>

      <article className="panel telegram-snapshot">
        <div className="panel-header compact"><h2>2. Сохраните срез</h2><CalendarDays size={19} /></div>
        {!selectedChannel ? <div className="telegram-empty"><MessageCircle size={28} /><span>Сначала добавьте канал, чтобы зафиксировать статистику.</span></div> : <form className="telegram-snapshot-form" onSubmit={saveSnapshot}>
          <label>Дата<input type="date" value={snapshot.date} onChange={(event) => setSnapshot((current) => ({ ...current, date: event.target.value }))} /></label>
          <label>Подписчики<input min="0" type="number" value={snapshot.subscribers || ''} onChange={(event) => setNumber('subscribers', event.target.value)} /></label>
          <label>Посты за день<input min="0" type="number" value={snapshot.posts || ''} onChange={(event) => setNumber('posts', event.target.value)} /></label>
          <label>Просмотры<input min="0" type="number" value={snapshot.views || ''} onChange={(event) => setNumber('views', event.target.value)} /></label>
          <label>Охват<input min="0" type="number" value={snapshot.reach || ''} onChange={(event) => setNumber('reach', event.target.value)} /></label>
          <button className="primary-button telegram-save" type="submit"><Check size={17} />Сохранить срез</button>
        </form>}
      </article>

      {message && <div className="telegram-message span-2">{message}</div>}

      <article className="panel span-2">
        <div className="panel-header compact"><div><h2>Аналитика {selectedChannel ? `@${selectedChannel.handle}` : ''}</h2><p>{latest ? `Последний срез: ${latest.date.split('-').reverse().join('.')}` : 'Добавьте первый срез, чтобы увидеть показатели.'}</p></div></div>
        <div className="telegram-kpis">
          <div><Users size={18} /><span>Подписчики</span><strong>{latest ? formatNumber(latest.subscribers) : '—'}</strong><small>{subscriberGrowth === null ? 'Нет сравнения' : `${subscriberGrowth > 0 ? '+' : ''}${formatNumber(subscriberGrowth)} к прошлому срезу`}</small></div>
          <div><Eye size={18} /><span>Просмотры</span><strong>{latest ? formatNumber(latest.views) : '—'}</strong><small>За выбранный день</small></div>
          <div><BarChart3 size={18} /><span>Средние просмотры поста</span><strong>{latest?.posts ? formatNumber(Math.round(latest.views / latest.posts)) : '—'}</strong><small>По последнему срезу</small></div>
          <div><MessageCircle size={18} /><span>Охват</span><strong>{latest ? formatNumber(latest.reach) : '—'}</strong><small>За выбранный день</small></div>
        </div>
        {snapshots.length > 0 && <div className="telegram-history"><h3>История срезов</h3>{snapshots.map((item) => <div key={item.date}><time>{item.date.split('-').reverse().join('.')}</time><span>{formatNumber(item.subscribers)} подписчиков</span><span>{formatNumber(item.posts)} постов</span><span>{formatNumber(item.views)} просмотров</span><span>{formatNumber(item.reach)} охват</span></div>)}</div>}
      </article>
    </section>
  );
}
