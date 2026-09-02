import {
  Activity,
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  Heart,
  Info,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Search,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import { Button } from '@alfalab/core-components-button';
import { CalendarInput } from '@alfalab/core-components-calendar-input';
import { Select } from '@alfalab/core-components-select';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { lazy, FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, CommunityAnalytics, SavedGroup, VkGroup, VkListResponse } from '../api/types';
import { AccessExpiredModal } from '../components/AccessExpiredModal';
import { PostCard } from '../components/PostCard';
import { formatDate } from '../utils/date';

type ChartMetric = 'views' | 'activity' | 'comments' | 'engagement';
type AnalyticsSection = 'summary' | 'audience' | 'posts';
type AnalyticsPostSort = 'likes' | 'reposts' | 'comments' | 'actions' | 'views' | 'er' | 'date';
type AnalyticsPostListFilter = 'all' | 'media' | 'photo' | 'video' | 'gif' | 'text';
type AnalyticsPost = CommunityAnalytics['wall']['topPosts'][number];

const AnalyticsChart = lazy(() => import('../components/AnalyticsChart'));
const RECENT_GROUPS_STORAGE_KEY = 'socstat.analytics.recent-groups';
const MAX_RECENT_GROUPS = 5;

const periods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: 'Последние 7 дней' },
  { key: 'twoWeek', label: 'Последние 14 дней' },
  { key: 'month', label: 'Последние 30 дней' },
  { key: 'currentMonth', label: 'Текущий месяц' },
  { key: 'previousMonth', label: 'Предыдущий месяц' },
  { key: 'custom', label: 'Произвольный период' }
];
const quickPeriodKeys: AnalyticsPeriod[] = ['week', 'month', 'currentMonth'];
const otherPeriodOptions = periods
  .filter((item) => !quickPeriodKeys.includes(item.key))
  .map((item) => ({ key: item.key, content: item.label }));

const chartMetrics: Array<{ key: ChartMetric; label: string }> = [
  { key: 'views', label: 'Просмотры поста' },
  { key: 'activity', label: 'Реакции' },
  { key: 'comments', label: 'Комментарии на пост' },
  { key: 'engagement', label: 'ER' }
];

const analyticsPostSortOptions: Array<{ key: AnalyticsPostSort; label: string }> = [
  { key: 'likes', label: 'Лайки' },
  { key: 'reposts', label: 'Репосты' },
  { key: 'comments', label: 'Комментарии' },
  { key: 'actions', label: 'Все реакции' },
  { key: 'views', label: 'Просмотры' },
  { key: 'er', label: 'ER' },
  { key: 'date', label: 'Дата' }
];
const analyticsPostFilterOptions: Array<{ key: AnalyticsPostListFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'media', label: 'С вложениями' },
  { key: 'photo', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'gif', label: 'GIF' },
  { key: 'text', label: 'Без вложений' }
];
const ANALYTICS_POSTS_PAGE_SIZE = 18;
const analyticsLoadingSteps = [
  { label: 'Получаем данные сообщества' },
  { label: 'Загружаем статистику VK' },
  { label: 'Анализируем публикации' },
  { label: 'Собираем отчёт' }
];

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value);
}

function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

function formatDatePickerValue(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : '';
}

function formatIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeQuery(value: string) {
  return value.trim().replace(/^https?:\/\/vk\.com\//, '').replace(/^vk\.com\//, '');
}

function getPostActions(post: AnalyticsPost) {
  return post.likes + post.reposts + post.comments;
}

function getAnalyticsPostSortValue(post: AnalyticsPost, sort: AnalyticsPostSort) {
  if (sort === 'date') return new Date(post.date).getTime();
  if (sort === 'actions') return getPostActions(post);
  return post[sort];
}

function matchesAnalyticsPostFilter(post: AnalyticsPost, filter: AnalyticsPostListFilter) {
  if (filter === 'all') return true;
  if (filter === 'media') return post.media.length > 0;
  if (filter === 'text') return post.media.length === 0;
  return post.media.some((item) => item.type === filter);
}

function getChange(current: number, previous: number | null) {
  if (previous === null) return null;
  const absolute = current - previous;
  const percent = previous === 0 ? null : (absolute / Math.abs(previous)) * 100;
  const state = absolute === 0 ? 'steady' : absolute > 0 ? 'up' : 'down';
  return { absolute, percent, state };
}

function formatChange(change: ReturnType<typeof getChange>, unit = '', isEr = false) {
  if (!change) return 'Нет сравнения';
  if (change.absolute === 0) return 'Без изменений';
  const absolute = `${change.absolute > 0 ? '+' : ''}${formatNumber(change.absolute, isEr ? 3 : 0)}${isEr ? ' п. п.' : ` ${unit}`}`;
  return change.percent === null ? absolute : `${absolute} · ${change.percent > 0 ? '+' : ''}${formatPercent(change.percent)}`;
}

function parseDayLabel(value: string) {
  const [day, month, year] = value.split('.');
  return `${year}-${month}-${day}`;
}

function periodLabel(dateFrom: string, dateTo: string) {
  return `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  tooltip,
  unavailable = false,
  comparisonUnavailable = false,
  unit = '',
  isEr = false
}: {
  icon: typeof Users;
  label: string;
  value: string;
  change: ReturnType<typeof getChange>;
  tooltip: string;
  unavailable?: boolean;
  comparisonUnavailable?: boolean;
  unit?: string;
  isEr?: boolean;
}) {
  const state = unavailable ? 'unavailable' : change?.state ?? 'steady';
  const stateLabel = unavailable ? 'Данные недоступны' : comparisonUnavailable ? 'Нет сравнения' : state === 'up' ? 'Рост' : state === 'down' ? 'Снижение' : 'Без существенных изменений';

  return (
    <article className={`analytics-kpi ${state}`}>
      <div className="analytics-kpi-heading">
        <Icon size={18} />
        <span>{label}</span>
        <span className="metric-tooltip" title={tooltip} aria-label={tooltip}>
          <Info size={14} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{stateLabel}</small>
      <em>{unavailable ? 'Нужны права stats в VK' : comparisonUnavailable ? 'VK вернул не всю историю стены' : formatChange(change, unit, isEr)}</em>
    </article>
  );
}

export function AnalyticsPage({
  groups,
  hasPaidAccess,
  activeTo
}: {
  groups: SavedGroup[];
  hasPaidAccess: boolean;
  activeTo?: string;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupIdParam = searchParams.get('groupId');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VkGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<VkGroup | null>(null);
  const [recentGroups, setRecentGroups] = useState<VkGroup[]>([]);
  const [isCommunityPickerOpen, setIsCommunityPickerOpen] = useState(true);
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [analytics, setAnalytics] = useState<CommunityAnalytics | null>(null);
  const [analyticsSection, setAnalyticsSection] = useState<AnalyticsSection>('summary');
  const [analyticsPostSort, setAnalyticsPostSort] = useState<AnalyticsPostSort>('likes');
  const [analyticsPostListFilter, setAnalyticsPostListFilter] = useState<AnalyticsPostListFilter>('all');
  const [visibleAnalyticsPostsCount, setVisibleAnalyticsPostsCount] = useState(ANALYTICS_POSTS_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsLoadingStep, setAnalyticsLoadingStep] = useState(0);
  const [isAccessExpiredModalOpen, setIsAccessExpiredModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_GROUPS_STORAGE_KEY) ?? '[]') as VkGroup[];
      if (Array.isArray(saved)) setRecentGroups(saved.filter((group) => Number.isFinite(group.id)).slice(0, MAX_RECENT_GROUPS));
    } catch {
      window.localStorage.removeItem(RECENT_GROUPS_STORAGE_KEY);
    }
  }, []);

  const savedGroups = useMemo(
    () => groups.map<VkGroup | null>((group) => {
      const id = Number(group.vkGroupId);
      return Number.isFinite(id) && id > 0 ? { id, name: group.name, photo_100: group.photo, members_count: group.membersCount } : null;
    }).filter((group): group is VkGroup => group !== null),
    [groups]
  );
  const rememberGroup = (group: VkGroup) => setRecentGroups((current) => {
    const next = [group, ...current.filter((item) => item.id !== group.id)].slice(0, MAX_RECENT_GROUPS);
    window.localStorage.setItem(RECENT_GROUPS_STORAGE_KEY, JSON.stringify(next));
    return next;
  });

  const loadAnalytics = async (group: VkGroup = selectedGroup!, nextPeriod: AnalyticsPeriod = period, forceRefresh = false) => {
    if (!group) return setMessage('Выберите сообщество для анализа.');
    if (!hasPaidAccess) {
      setIsAccessExpiredModalOpen(true);
      return;
    }

    if (nextPeriod === 'custom') {
      const today = new Date().toISOString().slice(0, 10);
      const duration = customDateFrom && customDateTo ? Math.floor((new Date(`${customDateTo}T00:00:00`).getTime() - new Date(`${customDateFrom}T00:00:00`).getTime()) / 86_400_000) + 1 : 0;
      if (!customDateFrom || !customDateTo || customDateFrom > customDateTo || customDateTo > today || duration > 93) return setMessage('Укажите период до 93 дней без будущих дат.');
    }

    setSelectedGroup(group);
    setIsCommunityPickerOpen(false);
    setSearchResults([]);
    if (groupIdParam !== String(group.id)) {
      navigate(`/analytics?groupId=${group.id}`);
    }
    setIsLoadingAnalytics(true);
    setAnalyticsLoadingStep(0);
    const loadingStepTimer = window.setInterval(() => {
      setAnalyticsLoadingStep((current) => Math.min(current + 1, analyticsLoadingSteps.length - 1));
    }, 900);
    setMessage(null);
    const customQuery = nextPeriod === 'custom' ? `&dateFrom=${customDateFrom}&dateTo=${customDateTo}` : '';
    const refreshQuery = forceRefresh ? '&refresh=1' : '';
    try {
      const data = await apiGet<CommunityAnalytics>(`/api/analytics/community/${group.id}?period=${nextPeriod}${customQuery}${refreshQuery}`);
      setAnalytics(data);
      const analyzedGroup = { id: data.group.id, name: data.group.name, screen_name: data.group.screenName, photo_100: data.group.photo, members_count: data.group.membersCount };
      setSelectedGroup(analyzedGroup);
      rememberGroup(analyzedGroup);
    } catch (error) {
      setAnalytics(null);
      setMessage(error instanceof Error ? error.message : 'Не удалось получить анализ сообщества.');
    } finally {
      window.clearInterval(loadingStepTimer);
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (!groupIdParam) return;
    const id = Number(groupIdParam);
    if (!Number.isFinite(id) || id <= 0) return setMessage('Некорректный id сообщества в ссылке.');
    if (selectedGroup?.id === id) return;
    loadAnalytics({ id, name: `id${id}` });
  }, [groupIdParam]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeQuery(query);
    if (!normalized) return setMessage('Введите название или адрес сообщества.');
    setIsSearching(true); setMessage(null); setSearchResults([]);
    try {
      const data = await apiGet<VkListResponse<VkGroup>>(`/api/vk/groups/search?q=${encodeURIComponent(normalized)}&count=10`);
      setSearchResults(data.items); setMessage(data.items.length ? null : 'Сообщества не найдены. Попробуйте название, screen name или ссылку VK.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось найти сообщества.');
    } finally { setIsSearching(false); }
  };

  const changePeriod = (nextPeriod: AnalyticsPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom' && selectedGroup) loadAnalytics(selectedGroup, nextPeriod);
  };

  const analyticsPosts = useMemo(() => [...(analytics?.wall.topPosts ?? [])]
    .filter((post) => matchesAnalyticsPostFilter(post, analyticsPostListFilter))
    .sort((left, right) => getAnalyticsPostSortValue(right, analyticsPostSort) - getAnalyticsPostSortValue(left, analyticsPostSort)), [analytics, analyticsPostListFilter, analyticsPostSort]);
  const visibleAnalyticsPosts = analyticsPosts.slice(0, visibleAnalyticsPostsCount);
  const hiddenAnalyticsPostsCount = Math.max(analyticsPosts.length - visibleAnalyticsPosts.length, 0);

  useEffect(() => {
    setVisibleAnalyticsPostsCount(ANALYTICS_POSTS_PAGE_SIZE);
  }, [analytics, analyticsPostListFilter, analyticsPostSort]);

  const chartData = useMemo(() => {
    if (!analytics) return [];
    const previousByDayIndex = new Map(
      analytics.previous.wall.dayGroups.map((day) => [day.dayIndex, day])
    );
    return analytics.wall.dayGroups.map((day) => ({
      date: day.date,
      views: { current: day.averageViews, previous: previousByDayIndex.get(day.dayIndex)?.averageViews },
      activity: { current: day.actions, previous: previousByDayIndex.get(day.dayIndex)?.actions },
      comments: { current: day.posts ? day.comments / day.posts : null, previous: previousByDayIndex.get(day.dayIndex)?.posts ? previousByDayIndex.get(day.dayIndex)!.comments / previousByDayIndex.get(day.dayIndex)!.posts : null },
      engagement: { current: day.er, previous: previousByDayIndex.get(day.dayIndex)?.er }
    }));
  }, [analytics]);

  const insights = useMemo(() => {
    if (!analytics) return [];
    const previous = analytics.previous.wall;
    const previousWall = previous.available ? previous : null;
    const result: Array<{ tone: 'good' | 'warn' | 'neutral'; title: string; text: string }> = [];
    const erChange = getChange(analytics.wall.erAverage, previousWall?.erAverage ?? null);
    const postChange = getChange(analytics.wall.periodPosts, previousWall?.periodPosts ?? null);
    const viewsChange = getChange(analytics.wall.averageViewsPerPost, previousWall?.averageViewsPerPost ?? null);
    if (erChange && postChange) {
      const direction = erChange.state === 'down' ? 'снизился' : erChange.state === 'up' ? 'вырос' : 'почти не изменился';
      result.push({ tone: erChange.state === 'down' ? 'warn' : erChange.state === 'up' ? 'good' : 'neutral', title: `ER ${direction} ${erChange.percent === null ? '' : `на ${formatPercent(Math.abs(erChange.percent))}`}`.trim(), text: `Факт: ER ${formatPercent(analytics.wall.erAverage)}, публикаций ${formatNumber(analytics.wall.periodPosts)}. Интерпретация: ${postChange.state === 'up' && erChange.state === 'down' ? 'рост частоты не дал сопоставимого интереса аудитории.' : 'изменение вовлечения нужно рассматривать вместе с сильными и слабыми постами.'} Действие: ${erChange.state === 'down' ? 'проверьте слабые посты и повторяющиеся рубрики.' : 'зафиксируйте сильные темы и протестируйте их развитие.'}` });
    }
    if (viewsChange) result.push({ tone: viewsChange.state === 'down' ? 'warn' : viewsChange.state === 'up' ? 'good' : 'neutral', title: `Средние просмотры поста ${viewsChange.state === 'down' ? 'снизились' : viewsChange.state === 'up' ? 'выросли' : 'стабильны'}`, text: `Факт: ${formatNumber(analytics.wall.averageViewsPerPost)} просмотров на пост${viewsChange.percent === null ? '' : `, изменение ${viewsChange.percent > 0 ? '+' : ''}${formatPercent(viewsChange.percent)}`}. Интерпретация: это отражает фактическую видимость публикаций, а не охват сообщества. Действие: сравните время, тему и первые строки сильных и слабых постов.` });
    const eligible = analytics.wall.topPosts.filter((post) => !post.isAd);
    const byFormat = new Map<string, AnalyticsPost[]>();
    eligible.forEach((post) => byFormat.set(post.contentType, [...(byFormat.get(post.contentType) ?? []), post]));
    const formatLeader = [...byFormat.entries()].filter(([, posts]) => posts.length >= 3).map(([name, posts]) => {
      const ers = posts.map((post) => post.er).sort((left, right) => left - right);
      return { name, posts, er: posts.reduce((sum, post) => sum + post.er, 0) / posts.length, medianEr: ers[Math.floor(ers.length / 2)], views: posts.reduce((sum, post) => sum + post.views, 0) / posts.length, actions: posts.reduce((sum, post) => sum + getPostActions(post), 0) / posts.length };
    }).sort((left, right) => right.medianEr - left.medianEr || right.er - left.er || right.actions - left.actions || right.views - left.views)[0];
    if (formatLeader) result.push({ tone: 'good', title: `${formatLeader.name} — сильный формат в текущей выборке`, text: `Факт: ${formatNumber(formatLeader.posts.length)} органических публикаций дали медианный ER ${formatPercent(formatLeader.medianEr)} и средний ER ${formatPercent(formatLeader.er)}. Интерпретация: ${formatLeader.posts.length <= 4 ? 'выборка небольшая, поэтому вывод предварительный.' : 'результат не определяется одним вирусным постом.'} Действие: добавьте 1–2 публикации этого формата в ближайший контент-план и повторно измерьте результат.` });
    const ads = analytics.wall.topPosts.filter((post) => post.isAd);
    if (ads.length) result.push({ tone: 'neutral', title: `Рекламных публикаций: ${formatNumber(ads.length)}`, text: `Факт: реклама составляет ${formatPercent((ads.length / Math.max(analytics.wall.periodPosts, 1)) * 100)} публикаций периода. Интерпретация: её метрики могут заметно отличаться от органического контента. Действие: используйте фильтр «Органические», чтобы оценить редакционный контент отдельно.` });
    const denseDay = [...analytics.wall.dayGroups].sort((left, right) => right.posts - left.posts)[0];
    if (denseDay?.posts > 1 && denseDay.averageActionsPerPost !== null) result.push({ tone: 'neutral', title: `Самый плотный день — ${formatDate(denseDay.date)}`, text: `Факт: опубликовано ${formatNumber(denseDay.posts)} поста, ${formatNumber(denseDay.averageActionsPerPost)} реакций на пост. Интерпретация: несколько публикаций в один день могли конкурировать за внимание аудитории. Действие: сопоставьте этот день с обычной частотой и протестируйте разнесение публикаций.` });
    return result.slice(0, 5);
  }, [analytics]);

  const copySummary = async () => {
    if (!analytics) return;
    const summary = `${analytics.group.name}\nПериод: ${formatDate(analytics.period.dateFrom)} — ${formatDate(analytics.period.dateTo)}\nПубликаций: ${analytics.wall.periodPosts}; средний ER: ${formatPercent(analytics.wall.erAverage)}; средние просмотры поста: ${formatNumber(analytics.wall.averageViewsPerPost)}.\n${insights.map((item) => `${item.title}. ${item.text}`).join('\n')}`;
    try { await navigator.clipboard.writeText(summary); setMessage('Вывод скопирован: его можно вставить в отчёт или сообщение клиенту.'); } catch { setMessage('Не удалось скопировать вывод. Проверьте разрешение браузера на буфер обмена.'); }
  };

  const renderCommunityOption = (group: VkGroup, context?: string) => <button className="community-option" key={group.id} type="button" onClick={() => loadAnalytics(group)}>{group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}{context ? ` · ${context}` : ''}</small></span><ChevronRight size={18} /></button>;

  const isStatsUnavailable = Boolean(analytics?.stats.unavailable);
  const currentPeriodLabel = analytics ? periodLabel(analytics.period.dateFrom, analytics.period.dateTo) : '';
  const previousPeriodLabel = analytics ? periodLabel(analytics.previous.period.dateFrom, analytics.previous.period.dateTo) : undefined;
  const hasPreviousChartData = Boolean(analytics?.previous.wall.dayGroups.length);
  const previousChartLabel = analytics && hasPreviousChartData
    ? `${previousPeriodLabel}${analytics.previous.wall.available ? '' : ' · неполные данные'}`
    : undefined;
  const averageLikesPerPost = analytics && analytics.wall.periodPosts > 0
    ? analytics.wall.likes / analytics.wall.periodPosts
    : 0;
  const previousAverageLikesPerPost = analytics?.previous.wall.available && analytics.previous.wall.periodPosts > 0
    ? analytics.previous.wall.likes / analytics.previous.wall.periodPosts
    : null;

  return <>
    <section className="page-grid analytics-page">
    <div className="panel span-2 analytics-workbench">
      <div className="panel-header analytics-controls-header"><div className="analytics-heading"><h2>Аналитика</h2><p>Оцените динамику, контент и следующие действия за один рабочий проход.</p><div className="period-tabs">{periods.filter((item) => quickPeriodKeys.includes(item.key)).map((item) => <Button className={`period-tab-button ${period === item.key ? 'period-tab-button-active' : ''}`} client="desktop" disabled={isLoadingAnalytics} key={item.key} size={40} type="button" view="secondary" onClick={() => changePeriod(item.key)}>{item.label}</Button>)}<Select className="analytics-period-select" client="desktop" disabled={isLoadingAnalytics} options={otherPeriodOptions} optionsListWidth="content" placeholder="Другой период" selected={quickPeriodKeys.includes(period) ? null : period} size={40} onChange={({ selected }) => selected && changePeriod(selected.key as AnalyticsPeriod)} /></div></div></div>
      {period === 'custom' && <div className="custom-period-form"><CalendarInput className="custom-period-picker" client="desktop" label="С" maxDate={Date.now()} size={40} value={formatDatePickerValue(customDateFrom)} onChange={(_, { date }) => !Number.isNaN(date.getTime()) && setCustomDateFrom(formatIsoDate(date))} /><CalendarInput className="custom-period-picker" client="desktop" label="По" maxDate={Date.now()} size={40} value={formatDatePickerValue(customDateTo)} onChange={(_, { date }) => !Number.isNaN(date.getTime()) && setCustomDateTo(formatIsoDate(date))} /><button type="button" onClick={() => selectedGroup && loadAnalytics(selectedGroup, 'custom')} disabled={!selectedGroup || isLoadingAnalytics}>Применить период</button></div>}
      {selectedGroup && <div className="selected-community-control">{selectedGroup.photo_100 ?? selectedGroup.photo_50 ? <img src={selectedGroup.photo_100 ?? selectedGroup.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<span><small>Анализируем сообщество</small><strong>{selectedGroup.name}</strong></span><div className="analytics-actions"><Button className="analytics-action-button" client="desktop" size={40} type="button" view="secondary" onClick={() => setIsCommunityPickerOpen((value) => !value)}>Сменить</Button><Button className="analytics-action-button" client="desktop" disabled={isLoadingAnalytics} leftAddons={<RefreshCw size={16} />} size={40} type="button" view="secondary" onClick={() => loadAnalytics(selectedGroup, period, true)}>Обновить данные</Button><Button className="analytics-action-button" client="desktop" href={`https://vk.com/${analytics?.group.screenName ?? selectedGroup.screen_name ?? `club${selectedGroup.id}`}`} leftAddons={<ExternalLink size={16} />} rel="noreferrer" size={40} target="_blank" view="secondary">Открыть VK</Button><Button className="analytics-action-button" client="desktop" disabled={!analytics} leftAddons={<Copy size={16} />} size={40} type="button" view="secondary" onClick={copySummary}>Скопировать вывод</Button></div></div>}
      {isCommunityPickerOpen && <div className="community-picker">{!selectedGroup && <div className="community-picker-intro"><h3>Выберите сообщество</h3><p>Продолжите анализ отслеживаемой группы или найдите новую.</p></div>}{recentGroups.length > 0 && <div className="community-picker-section"><div className="community-picker-title"><Clock3 size={17} /><strong>Недавно анализировали</strong></div><div className="community-options">{recentGroups.map((group) => renderCommunityOption(group, 'недавний анализ'))}</div></div>}{savedGroups.length > 0 && <div className="community-picker-section"><div className="community-picker-title"><Users size={17} /><strong>Отслеживаемые сообщества</strong></div><div className="community-options">{savedGroups.map((group) => renderCommunityOption(group))}</div></div>}<form className="search-form" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти другое сообщество: название, screen name или ссылка" /><button type="submit" disabled={isSearching}><Search size={18} />{isSearching ? 'Ищем' : 'Найти'}</button></form>{searchResults.length > 0 && <div className="search-results">{searchResults.map((group) => <button className="analytics-result" key={group.id} type="button" onClick={() => loadAnalytics(group)}><img src={group.photo_100 ?? group.photo_50} alt="" /><span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}{group.members_count ? ` · ${formatNumber(group.members_count)} участников` : ''}</small></span></button>)}</div>}</div>}
      {message && <div className="form-message">{message}</div>}
    </div>
    {isLoadingAnalytics && <div className="panel span-2 analytics-loading" aria-live="polite" role="status"><div><strong>Готовим аналитику</strong><span>{analyticsLoadingSteps[analyticsLoadingStep].label}</span></div><div aria-label={analyticsLoadingSteps[analyticsLoadingStep].label} className="analytics-loading-progress" role="progressbar"><span /></div></div>}
    {analytics && !isLoadingAnalytics && <>
      <div className="span-2 analytics-section-switcher">
        <SegmentedControl selectedId={analyticsSection} size={40} onChange={(id) => setAnalyticsSection(id as AnalyticsSection)}>
          <Segment id="summary" title="Сводная" />
          <Segment id="audience" title="Активность аудитории" />
          <Segment id="posts" title="Посты" />
        </SegmentedControl>
      </div>
      {analyticsSection === 'summary' && <>
      <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Сводка за период</h2><p>{currentPeriodLabel}. Изменения сравниваются с предыдущим аналогичным периодом: {previousPeriodLabel}.</p></div></div>{analytics.warnings.map((warning) => <div className="debug-error" key={warning}>{warning}</div>)}<div className="analytics-kpi-grid"><KpiCard icon={Users} label="Подписчики" value={formatNumber(analytics.group.membersCount)} change={getChange(analytics.group.membersCount, isStatsUnavailable ? null : analytics.group.membersCount - analytics.stats.growth)} tooltip="Текущее число участников. Изменение — чистый прирост или отток относительно начала выбранного периода; VK не отдаёт исторический срез числа подписчиков." comparisonUnavailable={isStatsUnavailable} /><KpiCard icon={TrendingUp} label="Прирост" value={isStatsUnavailable ? 'Недоступно' : formatNumber(analytics.stats.growth)} change={getChange(analytics.stats.growth, analytics.previous.stats?.growth ?? null)} tooltip="Подписавшиеся минус отписавшиеся за период по данным VK; сравнивается с чистым приростом предыдущего аналогичного периода." unavailable={isStatsUnavailable} /><KpiCard icon={Eye} label="Охват сообщества" value={isStatsUnavailable ? 'Недоступно' : formatNumber(analytics.stats.reach)} change={getChange(analytics.stats.reach, analytics.previous.stats?.reach ?? null)} tooltip="Охват сообщества из stats.get VK. Это не равно просмотрам публикаций." unavailable={isStatsUnavailable} /><KpiCard icon={CalendarDays} label="Посещения" value={isStatsUnavailable ? 'Недоступно' : formatNumber(analytics.stats.visitors)} change={getChange(analytics.stats.visitors, analytics.previous.stats?.visitors ?? null)} tooltip="Количество посетителей сообщества за период по данным VK." unavailable={isStatsUnavailable} /><KpiCard icon={Activity} label="Реакции" value={formatNumber(analytics.wall.actions)} change={getChange(analytics.wall.actions, analytics.previous.wall.available ? analytics.previous.wall.actions : null)} tooltip="Сумма лайков, комментариев и репостов публикаций за период." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={BarChart3} label="ER" value={formatPercent(analytics.wall.erAverage)} change={getChange(analytics.wall.erAverage, analytics.previous.wall.available ? analytics.previous.wall.erAverage : null)} tooltip="Средний ER поста: (лайки + комментарии + репосты) / число подписчиков × 100%." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={Eye} label="Средние просмотры поста" value={formatNumber(analytics.wall.averageViewsPerPost)} change={getChange(analytics.wall.averageViewsPerPost, analytics.previous.wall.available ? analytics.previous.wall.averageViewsPerPost : null)} tooltip="Суммарные просмотры публикаций, делённые на число публикаций. Это не охват сообщества." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={MessageCircle} label="Публикации" value={formatNumber(analytics.wall.periodPosts)} change={getChange(analytics.wall.periodPosts, analytics.previous.wall.available ? analytics.previous.wall.periodPosts : null)} tooltip="Количество публикаций, попавших в выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /></div></div>
      <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Инсайты</h2></div></div>{insights.length ? <div className={`insight-grid insight-grid-count-${insights.length}`}>{insights.map((insight) => <div className={`insight-card ${insight.tone}`} key={insight.title}>{insight.tone === 'warn' ? <TrendingDown size={18} /> : insight.tone === 'good' ? <TrendingUp size={18} /> : <BarChart3 size={18} />}<div><strong>{insight.title}</strong><span>{insight.text}</span></div></div>)}</div> : <div className="empty-state">Недостаточно публикаций для выводов. Выберите более длинный период или обновите данные.</div>}</div>
      <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Публикации</h2><p>Самые активные публикации за выбранный период.</p></div></div>{analytics.wall.topPosts.length ? <div className="posts-list posts-carousel">{analytics.wall.topPosts.slice(0, 6).map((post) => <PostCard key={post.id} post={{ ...post, group: analytics.group }} />)}</div> : <div className="empty-state">За выбранный период публикаций не найдено.</div>}</div>
      </>}
      {analyticsSection === 'audience' && <><div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Вовлечённость аудитории</h2><p>Показатели ER за выбранный период и их сравнение с предыдущим периодом.</p></div></div><div className="analytics-kpi-grid audience-er-kpi-grid"><KpiCard icon={BarChart3} label="Средняя вовлечённость на пост (ER)" value={formatPercent(analytics.wall.erAverage)} change={getChange(analytics.wall.erAverage, analytics.previous.wall.available ? analytics.previous.wall.erAverage : null)} tooltip="Средний ER поста: (лайки + комментарии + репосты) / число подписчиков × 100%." comparisonUnavailable={!analytics.previous.wall.available} isEr /><KpiCard icon={TrendingUp} label="Максимальная вовлечённость поста (ER)" value={formatPercent(analytics.wall.erMax)} change={getChange(analytics.wall.erMax, analytics.previous.wall.available ? analytics.previous.wall.erMax : null)} tooltip="Максимальный ER среди публикаций выбранного периода." comparisonUnavailable={!analytics.previous.wall.available} isEr /></div>{chartData.length ? <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind="engagement" title="ER публикаций по дням" data={chartData.map((day) => ({ date: day.date, ...day.engagement }))} currentPeriodLabel={currentPeriodLabel} previousPeriodLabel={previousChartLabel} /></Suspense> : <div className="empty-state">Нет постов для графика. Выберите более длинный период или проверьте доступ к стене VK.</div>}</div><div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Динамика</h2><p>Сопоставление с предыдущим аналогичным периодом. Охват сообщества не подменяется просмотрами постов.</p></div></div>{hasPreviousChartData && !analytics.previous.wall.available && <div className="debug-error">Линия предыдущего периода построена по неполной истории стены VK.</div>}<div className="analytics-kpi-grid audience-kpi-grid"><KpiCard icon={Heart} label="Средние лайки на пост" value={formatNumber(averageLikesPerPost, 1)} change={getChange(averageLikesPerPost, previousAverageLikesPerPost)} tooltip="Среднее число лайков: общее количество лайков, делённое на число публикаций за период." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={MessageCircle} label="Комментарии" value={formatNumber(analytics.wall.comments)} change={getChange(analytics.wall.comments, analytics.previous.wall.available ? analytics.previous.wall.comments : null)} tooltip="Общее количество комментариев к публикациям за выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={Repeat2} label="Репосты" value={formatNumber(analytics.wall.reposts)} change={getChange(analytics.wall.reposts, analytics.previous.wall.available ? analytics.previous.wall.reposts : null)} tooltip="Общее количество репостов публикаций за выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /></div>{chartData.length ? <Suspense fallback={<div className="empty-state">Загружаем графики...</div>}><div className="analytics-charts-grid">{chartMetrics.filter((metric) => metric.key !== 'engagement').map((metric) => <AnalyticsChart key={metric.key} kind={metric.key} title={metric.key === 'views' ? 'Средние просмотры публикаций по дням' : metric.key === 'activity' ? 'Реакции публикаций по дням' : 'Комментарии на пост по дням'} data={chartData.map((day) => ({ date: day.date, ...day[metric.key] }))} currentPeriodLabel={currentPeriodLabel} previousPeriodLabel={previousChartLabel} />)}</div></Suspense> : <div className="empty-state">Нет постов для графика. Выберите более длинный период или проверьте доступ к стене VK.</div>}</div></>}
      {analyticsSection === 'posts' && <><div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Показатели публикаций</h2><p>Данные за выбранный период и сравнение с предыдущим периодом.</p></div></div><div className="analytics-kpi-grid posts-kpi-grid"><KpiCard icon={MessageCircle} label="Публикации" value={formatNumber(analytics.wall.periodPosts)} change={getChange(analytics.wall.periodPosts, analytics.previous.wall.available ? analytics.previous.wall.periodPosts : null)} tooltip="Количество публикаций, попавших в выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={Eye} label="Охват постов" value={formatNumber(analytics.wall.views)} change={getChange(analytics.wall.views, analytics.previous.wall.available ? analytics.previous.wall.views : null)} tooltip="Суммарное количество просмотров публикаций за выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={Eye} label="Средний охват постов" value={formatNumber(analytics.wall.averageViewsPerPost, 1)} change={getChange(analytics.wall.averageViewsPerPost, analytics.previous.wall.available ? analytics.previous.wall.averageViewsPerPost : null)} tooltip="Среднее количество просмотров одной публикации за выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /></div></div><div className="panel span-2 posts-section"><div className="section-title"><div><h2>Все публикации</h2><p>Показано {formatNumber(visibleAnalyticsPosts.length)} из {formatNumber(analyticsPosts.length)}.</p></div></div><div className="posts-toolbar"><label><ArrowDownUp size={16} /><span>Сортировка</span><select value={analyticsPostSort} onChange={(event) => setAnalyticsPostSort(event.target.value as AnalyticsPostSort)}>{analyticsPostSortOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label></div><div className="post-filter-tabs">{analyticsPostFilterOptions.map((option) => <button className={analyticsPostListFilter === option.key ? 'active' : undefined} key={option.key} type="button" onClick={() => setAnalyticsPostListFilter(option.key)}>{option.label}</button>)}</div>{analyticsPosts.length ? <><div className="posts-list">{visibleAnalyticsPosts.map((post) => <PostCard key={post.id} post={{ ...post, group: analytics.group }} />)}</div>{hiddenAnalyticsPostsCount > 0 && <button className="secondary-button load-more-button" type="button" onClick={() => setVisibleAnalyticsPostsCount((count) => count + ANALYTICS_POSTS_PAGE_SIZE)}>Показать ещё {formatNumber(Math.min(hiddenAnalyticsPostsCount, ANALYTICS_POSTS_PAGE_SIZE))}</button>}</> : <div className="empty-state">За выбранный период публикаций не найдено.</div>}</div></>}
    </>}
    </section>
    <AccessExpiredModal activeTo={activeTo} isOpen={isAccessExpiredModalOpen} onClose={() => setIsAccessExpiredModalOpen(false)} />
  </>;
}
