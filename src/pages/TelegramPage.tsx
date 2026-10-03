import { Button } from '@alfalab/core-components-button';
import { Select } from '@alfalab/core-components-select';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import {
  Activity, ArrowDownUp, ArrowLeftRight, BarChart3, Eye, ExternalLink, FileText,
  Forward, Image, MessageCircle, RefreshCw, Search, Send, SmilePlus, TrendingUp,
  Users, Video, type LucideIcon
} from 'lucide-react';
import { lazy, FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, TelegramAnalytics } from '../api/types';
import { TelegramAvatar, TelegramLogo } from '../components/TelegramLogo';
import { SubscriberHistoryPanel } from '../components/SubscriberHistoryPanel';
import { PostViewsCurvePanel } from '../components/PostViewsCurvePanel';
import { formatDate } from '../utils/date';

type TelegramSection = 'summary' | 'audience' | 'posts';
type TelegramSort = 'date' | 'views' | 'engagement' | 'reactions' | 'comments' | 'forwards';
type TelegramPostFilter = 'all' | 'media' | 'photo' | 'video' | 'text';
type TelegramPost = TelegramAnalytics['posts'][number];

const AnalyticsChart = lazy(() => import('../components/AnalyticsChart'));
const POSTS_PAGE_SIZE = 18;
const RECENT_GROUPS_STORAGE_KEY = 'socstat.analytics.recent-groups';
const MAX_RECENT_GROUPS = 5;
const quickPeriods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: 'Последние 7 дней' },
  { key: 'month', label: 'Последние 30 дней' },
  { key: 'currentMonth', label: 'Текущий месяц' }
];
const otherPeriods = [
  { key: 'twoWeek', content: 'Последние 14 дней' },
  { key: 'previousMonth', content: 'Предыдущий месяц' }
];
const sortOptions = [
  { key: 'views', content: 'Просмотры' },
  { key: 'engagement', content: 'Все реакции' },
  { key: 'reactions', content: 'Реакции' },
  { key: 'comments', content: 'Комментарии' },
  { key: 'forwards', content: 'Пересылки' },
  { key: 'date', content: 'Дата' }
];
const filters: Array<{ key: TelegramPostFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'media', label: 'С вложениями' },
  { key: 'photo', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'text', label: 'Без вложений' }
];
const loadingSteps = ['Подключаемся к Telegram', 'Загружаем публикации', 'Считаем показатели', 'Собираем отчёт'];

function number(value: number, digits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
}

function percent(value: number | null) {
  return value === null ? 'Недоступно' : `${number(value, 2)}%`;
}

function periodLabel(analytics: TelegramAnalytics) {
  return `${formatDate(analytics.period.dateFrom)} — ${formatDate(analytics.period.dateTo)}`;
}

function postMediaLabel(type: TelegramPost['mediaType']) {
  if (!type) return 'Текст';
  return { photo: 'Фото', video: 'Видео', document: 'Файл', poll: 'Опрос', other: 'Медиа' }[type];
}

function postMediaIcon(type: TelegramPost['mediaType']) {
  if (type === 'photo') return Image;
  if (type === 'video') return Video;
  if (type === 'document') return FileText;
  return Send;
}

function TelegramKpi({ icon: Icon, label, value, caption }: { icon: LucideIcon; label: string; value: string; caption: string }) {
  return <article className="analytics-kpi steady telegram-analytics-kpi"><div className="analytics-kpi-heading"><Icon size={18} /><span>{label}</span></div><strong>{value}</strong><small>Текущие данные</small><em>{caption}</em></article>;
}

function TelegramPostCard({ channel, post }: { channel: TelegramAnalytics['channel']; post: TelegramPost }) {
  const MediaIcon = postMediaIcon(post.mediaType);
  const er = post.views ? post.engagement / post.views * 100 : 0;
  const [mediaFailed, setMediaFailed] = useState(false);
  useEffect(() => setMediaFailed(false), [post.mediaUrl]);
  return <article className="post-card telegram-post-card">
    <div className="post-card-media telegram-post-card-media">{post.mediaUrl && !mediaFailed ? <img src={post.mediaUrl} alt="" loading="lazy" onError={() => setMediaFailed(true)} /> : <div className="post-card-media-empty"><MediaIcon size={34} /></div>}<span className="post-media-kind">{postMediaLabel(post.mediaType)}</span></div>
    <div className="post-card-body">
      <div className="post-card-header"><span className="post-group-mini"><TelegramAvatar className="telegram-post-avatar" src={channel.photo} size={34} /><span><strong>{channel.title}</strong><small>{new Date(post.date).toLocaleString('ru-RU')}</small></span></span><a className="icon-button" href={post.url} rel="noreferrer" target="_blank" aria-label="Открыть публикацию"><ExternalLink size={17} /></a></div>
      <div className="post-card-tags"><span>{postMediaLabel(post.mediaType)}</span><span className="telegram-public-badge">Публичные данные</span></div>
      <p>{post.text.trim() || 'Публикация без текста'}</p>
      <div className="post-metrics"><span title="Реакции"><SmilePlus size={15} />{number(post.reactions)}</span><span title="Комментарии"><MessageCircle size={15} />{number(post.comments)}</span><span title="Пересылки"><Forward size={15} />{number(post.forwards)}</span><span title="Просмотры"><Eye size={15} />{number(post.views)}</span><span title="Вовлечённость по просмотрам"><Activity size={15} />{number(er, 2)}%</span></div>
    </div>
  </article>;
}

export function TelegramPage() {
  const [searchParams] = useSearchParams();
  const requestedChannel = searchParams.get('channel')?.trim() ?? '';
  const lastRequestedChannel = useRef('');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [analytics, setAnalytics] = useState<TelegramAnalytics | null>(null);
  const [section, setSection] = useState<TelegramSection>('summary');
  const [sort, setSort] = useState<TelegramSort>('views');
  const [filter, setFilter] = useState<TelegramPostFilter>('all');
  const [visibleCount, setVisibleCount] = useState(POSTS_PAGE_SIZE);
  const [isPickerOpen, setIsPickerOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (channel: string, nextPeriod = period, refresh = false) => {
    const normalized = channel.trim();
    if (!normalized) return setMessage('Введите @username или ссылку на публичный канал.');
    setIsLoading(true);
    setLoadingStep(0);
    setMessage(null);
    const timer = window.setInterval(() => setLoadingStep((current) => Math.min(current + 1, loadingSteps.length - 1)), 800);
    try {
      const data = await apiGet<TelegramAnalytics>(`/api/telegram/channels/${encodeURIComponent(normalized)}/analytics?period=${nextPeriod}${refresh ? '&refresh=1' : ''}`);
      setAnalytics(data);
      setQuery(`@${data.channel.username}`);
      setIsPickerOpen(false);
      try {
        const saved = JSON.parse(window.localStorage.getItem(RECENT_GROUPS_STORAGE_KEY) ?? '[]') as Array<{ id: string | number; platform?: string }>;
        const channel = {
          id: data.channel.id,
          name: data.channel.title,
          platform: 'telegram',
          screen_name: data.channel.username,
          photo_100: data.channel.photo,
          members_count: data.channel.subscribers,
          url: data.channel.url
        };
        window.localStorage.setItem(
          RECENT_GROUPS_STORAGE_KEY,
          JSON.stringify([channel, ...saved.filter((item) => `${item.platform}:${item.id}` !== `telegram:${channel.id}`)].slice(0, MAX_RECENT_GROUPS))
        );
      } catch {
        // Недавние источники не влияют на доступность отчёта.
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось получить аналитику Telegram.');
    } finally {
      window.clearInterval(timer);
      setIsLoading(false);
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void load(query); };
  const changePeriod = (nextPeriod: AnalyticsPeriod) => { setPeriod(nextPeriod); if (analytics) void load(analytics.channel.username, nextPeriod); };

  useEffect(() => {
    if (!requestedChannel || lastRequestedChannel.current === requestedChannel) return;
    lastRequestedChannel.current = requestedChannel;
    void load(requestedChannel);
  }, [requestedChannel]);

  const posts = useMemo(() => [...(analytics?.posts ?? [])]
    .filter((post) => filter === 'all' || (filter === 'media' ? post.mediaType !== null : filter === 'text' ? post.mediaType === null : post.mediaType === filter))
    .sort((left, right) => sort === 'date' ? right.timestamp - left.timestamp : right[sort] - left[sort]), [analytics, filter, sort]);

  useEffect(() => setVisibleCount(POSTS_PAGE_SIZE), [analytics, filter, sort]);

  const daily = useMemo(() => (analytics?.daily ?? []).map((day) => {
    const actions = day.reactions + day.comments + day.forwards;
    return { date: day.date, views: day.posts ? day.views / day.posts : null, activity: day.posts ? actions / day.posts : null, comments: day.posts ? day.comments / day.posts : null, engagement: day.views ? actions / day.views * 100 : null };
  }), [analytics]);

  const insights = useMemo(() => {
    if (!analytics || !analytics.posts.length) return [];
    const strongest = [...analytics.posts].sort((left, right) => right.engagement - left.engagement)[0];
    const mostViewed = [...analytics.posts].sort((left, right) => right.views - left.views)[0];
    const mediaPosts = analytics.posts.filter((post) => post.mediaType).length;
    return [
      { icon: TrendingUp, tone: 'good', title: `Лидер по вовлечению — публикация от ${formatDate(strongest.date.slice(0, 10))}`, text: `${number(strongest.engagement)} действий и ${number(strongest.views)} просмотров. Используйте её тему и подачу как ориентир для следующих публикаций.` },
      { icon: Eye, tone: 'neutral', title: `Максимум просмотров — ${number(mostViewed.views)}`, text: `Публикация от ${formatDate(mostViewed.date.slice(0, 10))} заметно влияет на средние показатели периода. Сравните её формат и время выхода с остальными.` },
      { icon: BarChart3, tone: 'neutral', title: `Публикаций с вложениями: ${number(mediaPosts)}`, text: `${number(mediaPosts / analytics.posts.length * 100, 1)}% контента периода содержит медиа. Сопоставьте этот показатель с лидерами по просмотрам и реакциям.` }
    ];
  }, [analytics]);

  const selectedPeriodLabel = analytics ? periodLabel(analytics) : '';
  const averageReactions = analytics?.summary.posts ? analytics.summary.reactions / analytics.summary.posts : 0;
  const averageComments = analytics?.summary.posts ? analytics.summary.comments / analytics.summary.posts : 0;
  const averageForwards = analytics?.summary.posts ? analytics.summary.forwards / analytics.summary.posts : 0;
  const visiblePosts = posts.slice(0, visibleCount);
  const hiddenPosts = Math.max(0, posts.length - visiblePosts.length);

  return <section className="page-grid analytics-page telegram-page telegram-analytics-page">
    <div className="panel span-2 analytics-workbench telegram-workbench">
      <div className="panel-header analytics-controls-header"><div className="analytics-heading"><h2>Аналитика Telegram</h2><p>Оцените аудиторию, результативность контента и публикации канала за один рабочий проход.</p><div className="period-tabs">{quickPeriods.map((item) => <Button className={`period-tab-button ${period === item.key ? 'period-tab-button-active' : ''}`} client="desktop" disabled={isLoading} key={item.key} size={40} type="button" view="secondary" onClick={() => changePeriod(item.key)}>{item.label}</Button>)}<Select className="analytics-period-select" client="desktop" disabled={isLoading} options={otherPeriods} optionsListWidth="content" placeholder="Другой период" selected={quickPeriods.some((item) => item.key === period) ? null : period} size={40} onChange={({ selected }) => selected && changePeriod(selected.key as AnalyticsPeriod)} /></div></div></div>
      {analytics && <div className="selected-community-control"><TelegramAvatar className="telegram-selected-avatar" src={analytics.channel.photo} size={40} /><span><small className="analytics-platform-label"><TelegramLogo className="telegram-platform-icon" size={15} />Telegram</small><strong>{analytics.channel.title}</strong></span><div className="analytics-actions"><Button className="analytics-action-button" client="desktop" leftAddons={<ArrowLeftRight size={16} />} size={40} type="button" view="secondary" onClick={() => setIsPickerOpen((value) => !value)}>Сменить</Button><Button className="analytics-action-button" client="desktop" disabled={isLoading} leftAddons={<RefreshCw size={16} />} size={40} type="button" view="secondary" onClick={() => void load(analytics.channel.username, period, true)}>Обновить</Button><Button className="analytics-action-button" client="desktop" href={analytics.channel.url} leftAddons={<ExternalLink size={16} />} rel="noreferrer" size={40} target="_blank" view="secondary">Открыть Telegram</Button></div></div>}
      {isPickerOpen && <div className="community-picker telegram-picker"><div className="community-picker-intro"><h3>{analytics ? 'Сменить канал' : 'Выберите канал'}</h3><p>Введите публичный @username или ссылку вида t.me/channel.</p></div><form className="search-form" onSubmit={submit}><input autoFocus={!analytics} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="@channel или t.me/channel" /><button type="submit" disabled={isLoading}><Search size={18} />{isLoading ? 'Загружаем' : 'Анализировать'}</button></form></div>}
      {message && <div className="form-message telegram-message-error">{message}</div>}
    </div>

    {analytics && <div className="span-2 analytics-community-heading"><h2>Аналитика канала «{analytics.channel.title}»</h2><p>За период {selectedPeriodLabel} · публичные данные Telegram на момент обновления</p></div>}
    {isLoading && <div className="panel span-2 analytics-loading" aria-live="polite" role="status"><div><strong>Готовим аналитику Telegram</strong><span>{loadingSteps[loadingStep]}</span></div><div aria-label={loadingSteps[loadingStep]} className="analytics-loading-progress" role="progressbar"><span /></div></div>}
    {!analytics && !isLoading && <div className="panel span-2 telegram-start-state"><TelegramLogo size={36} /><h3>Введите публичный канал</h3><p>Socstat загрузит публикации и представит их в том же формате, что и аналитику сообществ ВКонтакте.</p></div>}

    {analytics && !isLoading && <>
      <div className="span-2 analytics-section-switcher"><SegmentedControl selectedId={section} size={40} onChange={(id) => setSection(id as TelegramSection)}><Segment id="summary" title="Сводная" /><Segment id="audience" title="Аудитория" /><Segment id="posts" title="Посты" /></SegmentedControl></div>
      {section === 'summary' && <>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Сводка за период</h2><p>{selectedPeriodLabel}. Telegram показывает текущие публичные счётчики без сравнения с предыдущим периодом.</p></div></div><div className="analytics-kpi-grid"><TelegramKpi icon={MessageCircle} label="Публикации" value={number(analytics.summary.posts)} caption={`${number(analytics.summary.postsPerWeek, 1)} в неделю`} /><TelegramKpi icon={Eye} label="Просмотры" value={number(analytics.summary.views)} caption="Сумма просмотров публикаций" /><TelegramKpi icon={Eye} label="Средние просмотры поста" value={number(analytics.summary.averageViews)} caption="На момент обновления" /><TelegramKpi icon={Activity} label="Действия" value={number(analytics.summary.actions)} caption="Реакции, комментарии и пересылки" /><TelegramKpi icon={BarChart3} label="ER по просмотрам" value={percent(analytics.summary.engagementRate)} caption="Доля действий от просмотров" /><TelegramKpi icon={SmilePlus} label="Реакции" value={number(analytics.summary.reactions)} caption="На публикациях периода" /><TelegramKpi icon={Forward} label="Пересылки" value={number(analytics.summary.forwards)} caption="Публичный счётчик Telegram" /></div></div>
        <SubscriberHistoryPanel platform="telegram" sourceId={analytics.channel.username} period={analytics.period} currentSubscribers={analytics.channel.subscribers} />
        <PostViewsCurvePanel platform="telegram" sourceId={analytics.channel.username} subscribers={analytics.channel.subscribers} knownPosts={analytics.posts} />
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Динамика видимости</h2><p>Средние просмотры публикации по дате выхода.</p></div></div>{daily.some((day) => day.views !== null) ? <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind="views" title="Средние просмотры поста по дате публикации" data={daily.map((day) => ({ date: day.date, current: day.views }))} currentPeriodLabel={selectedPeriodLabel} connectNulls={false} /></Suspense> : <div className="empty-state">Нет публикаций для графика. Выберите другой период.</div>}<p className="visibility-chart-note">Просмотры накопительные и показаны на момент загрузки данных. Свежие публикации ещё набирают аудиторию.</p></div>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Инсайты</h2></div></div>{insights.length ? <div className={`insight-grid insight-grid-count-${insights.length}`}>{insights.map(({ icon: Icon, tone, title, text }) => <div className={`insight-card ${tone}`} key={title}><Icon size={18} /><div><strong>{title}</strong><span>{text}</span></div></div>)}</div> : <div className="empty-state">Недостаточно публикаций для выводов. Выберите более длинный период.</div>}</div>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Публикации</h2><p>Самые просматриваемые публикации за выбранный период.</p></div></div>{analytics.posts.length ? <div className="posts-list posts-carousel">{[...analytics.posts].sort((left, right) => right.views - left.views).slice(0, 6).map((post) => <TelegramPostCard channel={analytics.channel} key={post.id} post={post} />)}</div> : <div className="empty-state">За выбранный период публикаций не найдено.</div>}</div>
      </>}
      {section === 'audience' && <>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Вовлечённость аудитории</h2><p>Действия пользователей относительно просмотров публикаций.</p></div></div><div className="analytics-kpi-grid audience-er-kpi-grid"><TelegramKpi icon={BarChart3} label="ER по просмотрам" value={percent(analytics.summary.engagementRate)} caption="Все действия относительно просмотров" /><TelegramKpi icon={Eye} label="Средний охват подписчиков" value={percent(analytics.summary.averageReachRate)} caption="Средние просмотры относительно аудитории" /></div>{daily.some((day) => day.engagement !== null) ? <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind="engagement" title="ER публикаций по дням" data={daily.map((day) => ({ date: day.date, current: day.engagement }))} currentPeriodLabel={selectedPeriodLabel} /></Suspense> : <div className="empty-state">Нет публикаций для графика.</div>}</div>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Реакции</h2><p>Средняя активность на одну публикацию.</p></div></div><div className="analytics-chart-item"><div className="analytics-chart-kpis"><TelegramKpi icon={Activity} label="Действий на пост" value={number(analytics.summary.posts ? analytics.summary.actions / analytics.summary.posts : 0, 1)} caption="Реакции, комментарии и пересылки" /><TelegramKpi icon={SmilePlus} label="Реакций на пост" value={number(averageReactions, 1)} caption="Среднее значение периода" /><TelegramKpi icon={Forward} label="Пересылок на пост" value={number(averageForwards, 1)} caption="Среднее значение периода" /></div>{daily.some((day) => day.activity !== null) && <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind="activity" title="Действия на публикацию по дням" data={daily.map((day) => ({ date: day.date, current: day.activity }))} currentPeriodLabel={selectedPeriodLabel} /></Suspense>}</div></div>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Комментарии</h2><p>Комментарии в привязанных обсуждениях Telegram.</p></div></div><div className="analytics-chart-item"><div className="analytics-chart-kpis"><TelegramKpi icon={MessageCircle} label="Всего комментариев" value={number(analytics.summary.comments)} caption="На публикациях периода" /><TelegramKpi icon={MessageCircle} label="Комментариев на пост" value={number(averageComments, 1)} caption="Среднее значение периода" /></div>{daily.some((day) => day.comments !== null) && <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind="comments" title="Комментарии на публикацию по дням" data={daily.map((day) => ({ date: day.date, current: day.comments }))} currentPeriodLabel={selectedPeriodLabel} /></Suspense>}</div></div>
      </>}
      {section === 'posts' && <>
        <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Показатели публикаций</h2><p>Публичные данные Telegram за выбранный период.</p></div></div><div className="analytics-kpi-grid posts-kpi-grid"><TelegramKpi icon={MessageCircle} label="Публикации" value={number(analytics.summary.posts)} caption={`${number(analytics.summary.postsPerWeek, 1)} в неделю`} /><TelegramKpi icon={Eye} label="Просмотры постов" value={number(analytics.summary.views)} caption="Сумма по публикациям периода" /><TelegramKpi icon={Eye} label="Средние просмотры" value={number(analytics.summary.averageViews)} caption="На одну публикацию" /></div></div>
        <div className="panel span-2 posts-section"><div className="section-title"><div><h2>Все публикации</h2><p>Показано {number(visiblePosts.length)} из {number(posts.length)}.</p></div></div><div className="posts-toolbar"><ArrowDownUp size={16} /><span>Сортировка</span><Select className="analytics-post-sort-select" client="desktop" options={sortOptions} optionsListWidth="content" selected={sort} size={40} onChange={({ selected }) => selected && setSort(selected.key as TelegramSort)} /></div><div className="post-filter-tabs">{filters.map((item) => <Button className={filter === item.key ? 'post-filter-button active' : 'post-filter-button'} client="desktop" key={item.key} size={40} type="button" view="secondary" onClick={() => setFilter(item.key)}>{item.label}</Button>)}</div>{posts.length ? <><div className="posts-list">{visiblePosts.map((post) => <TelegramPostCard channel={analytics.channel} key={post.id} post={post} />)}</div>{hiddenPosts > 0 && <Button className="load-more-button" client="desktop" size={40} type="button" view="secondary" onClick={() => setVisibleCount((count) => count + POSTS_PAGE_SIZE)}>Показать ещё {number(Math.min(hiddenPosts, POSTS_PAGE_SIZE))}</Button>}</> : <div className="empty-state">За выбранный период публикаций не найдено.</div>}</div>
      </>}
    </>}
  </section>;
}
