import {
  Activity,
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
  Star,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import { lazy, FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, CommunityAnalytics, SavedGroup, VkGroup, VkListResponse } from '../api/types';
import { PostCard } from '../components/PostCard';

type ChartMetric = 'views' | 'activity' | 'engagement';
type PostSegment = 'top' | 'weak' | 'aboveAverage' | 'belowAverage';
type ContentCriterion = 'er' | 'actions' | 'views' | 'reposts' | 'comments';
type PostFilter = 'all' | 'organic' | 'ad';
type DetailSort = 'date' | 'er' | 'views' | 'actions' | 'reposts' | 'comments';
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

const chartMetrics: Array<{ key: ChartMetric; label: string }> = [
  { key: 'views', label: 'Просмотры поста' },
  { key: 'activity', label: 'Реакции' },
  { key: 'engagement', label: 'ER' }
];

const postSegments: Array<{ key: PostSegment; label: string }> = [
  { key: 'top', label: 'Топ' },
  { key: 'weak', label: 'Слабые' },
  { key: 'aboveAverage', label: 'Выше среднего' },
  { key: 'belowAverage', label: 'Ниже среднего' }
];

const contentCriteria: Array<{ key: ContentCriterion; label: string }> = [
  { key: 'er', label: 'ER' },
  { key: 'actions', label: 'Реакции' },
  { key: 'views', label: 'Просмотры' },
  { key: 'reposts', label: 'Репосты' },
  { key: 'comments', label: 'Комментарии' }
];

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value);
}

function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

function normalizeQuery(value: string) {
  return value.trim().replace(/^https?:\/\/vk\.com\//, '').replace(/^vk\.com\//, '');
}

function getPostActions(post: AnalyticsPost) {
  return post.likes + post.reposts + post.comments;
}

function getCriterionValue(post: AnalyticsPost, criterion: ContentCriterion) {
  if (criterion === 'er') return post.er;
  if (criterion === 'views') return post.views;
  if (criterion === 'reposts') return post.reposts;
  if (criterion === 'comments') return post.comments;
  return getPostActions(post);
}

function getCriterionLabel(criterion: ContentCriterion) {
  return contentCriteria.find((item) => item.key === criterion)?.label.toLowerCase() ?? 'показателю';
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
  return `${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${dateFrom}T00:00:00`))} — ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${dateTo}T00:00:00`))}`;
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

export function AnalyticsPage({ groups }: { groups: SavedGroup[] }) {
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
  const [chartMetric, setChartMetric] = useState<ChartMetric>('views');
  const [postSegment, setPostSegment] = useState<PostSegment>('top');
  const [contentCriterion, setContentCriterion] = useState<ContentCriterion>('er');
  const [postFilter, setPostFilter] = useState<PostFilter>('all');
  const [detailPostFilter, setDetailPostFilter] = useState<PostFilter>('all');
  const [detailSort, setDetailSort] = useState<DetailSort>('date');
  const [detailQuery, setDetailQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

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
  const favoriteGroups = useMemo(() => {
    const ids = new Set(groups.filter((group) => group.source === 'favorite').map((group) => Number(group.vkGroupId)));
    return savedGroups.filter((group) => ids.has(group.id));
  }, [groups, savedGroups]);
  const otherSavedGroups = useMemo(() => {
    const shown = new Set([...recentGroups, ...favoriteGroups].map((group) => group.id));
    return savedGroups.filter((group) => !shown.has(group.id));
  }, [favoriteGroups, recentGroups, savedGroups]);

  const rememberGroup = (group: VkGroup) => setRecentGroups((current) => {
    const next = [group, ...current.filter((item) => item.id !== group.id)].slice(0, MAX_RECENT_GROUPS);
    window.localStorage.setItem(RECENT_GROUPS_STORAGE_KEY, JSON.stringify(next));
    return next;
  });

  const loadAnalytics = async (group: VkGroup = selectedGroup!, nextPeriod: AnalyticsPeriod = period) => {
    if (!group) return setMessage('Выберите сообщество для анализа.');
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
    setMessage(null);
    const customQuery = nextPeriod === 'custom' ? `&dateFrom=${customDateFrom}&dateTo=${customDateTo}` : '';
    try {
      const data = await apiGet<CommunityAnalytics>(`/api/analytics/community/${group.id}?period=${nextPeriod}${customQuery}`);
      setAnalytics(data);
      const analyzedGroup = { id: data.group.id, name: data.group.name, screen_name: data.group.screenName, photo_100: data.group.photo, members_count: data.group.membersCount };
      setSelectedGroup(analyzedGroup);
      rememberGroup(analyzedGroup);
    } catch (error) {
      setAnalytics(null);
      setMessage(error instanceof Error ? error.message : 'Не удалось получить анализ сообщества.');
    } finally {
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

  const filteredPosts = useMemo(() => (analytics?.wall.topPosts ?? []).filter((post) => postFilter === 'all' || (postFilter === 'ad' ? post.isAd : !post.isAd)), [analytics, postFilter]);
  const criterionAverage = useMemo(() => filteredPosts.length ? filteredPosts.reduce((sum, post) => sum + getCriterionValue(post, contentCriterion), 0) / filteredPosts.length : 0, [contentCriterion, filteredPosts]);
  const contentPosts = useMemo(() => {
    if (criterionAverage <= 0) return [];
    const sorted = [...filteredPosts].sort((left, right) => getCriterionValue(right, contentCriterion) - getCriterionValue(left, contentCriterion));
    if (postSegment === 'weak') return sorted.reverse().slice(0, 6);
    if (postSegment === 'aboveAverage') return sorted.filter((post) => getCriterionValue(post, contentCriterion) >= criterionAverage).slice(0, 6);
    if (postSegment === 'belowAverage') return sorted.filter((post) => getCriterionValue(post, contentCriterion) < criterionAverage).slice(0, 6);
    return sorted.slice(0, 6);
  }, [contentCriterion, criterionAverage, filteredPosts, postSegment]);

  const detailPosts = useMemo(() => {
    const normalizedQuery = detailQuery.trim().toLocaleLowerCase('ru-RU');
    const posts = (analytics?.wall.topPosts ?? []).filter((post) => {
      const filterMatches = detailPostFilter === 'all' || (detailPostFilter === 'ad' ? post.isAd : !post.isAd);
      return filterMatches && (!normalizedQuery || post.text.toLocaleLowerCase('ru-RU').includes(normalizedQuery));
    });
    return [...posts].sort((left, right) => {
      if (detailSort === 'date') return new Date(right.date).getTime() - new Date(left.date).getTime();
      if (detailSort === 'er') return right.er - left.er;
      if (detailSort === 'views') return right.views - left.views;
      if (detailSort === 'reposts') return right.reposts - left.reposts;
      if (detailSort === 'comments') return right.comments - left.comments;
      return getPostActions(right) - getPostActions(left);
    });
  }, [analytics, detailPostFilter, detailQuery, detailSort]);

  const postExplanation = (post: AnalyticsPost) => {
    const value = getCriterionValue(post, contentCriterion);
    if (criterionAverage <= 0) return { badge: 'Недостаточно данных для сравнения', reason: 'Среднее значение выбранного критерия равно нулю.' };
    const ratio = criterionAverage > 0 ? value / criterionAverage : 0;
    const label = getCriterionLabel(contentCriterion);
    if (postSegment === 'top' && post === contentPosts[0]) return { badge: `Лучший по ${label}`, reason: `Максимальный результат по критерию «${label}» среди выбранных публикаций.` };
    if (ratio >= 1) return { badge: `${label[0].toUpperCase()}${label.slice(1)} в ${formatNumber(ratio, 1)} раза выше среднего`, reason: `Показатель ${formatNumber(value, contentCriterion === 'er' ? 3 : 0)} выше среднего по выборке.` };
    return { badge: `${label[0].toUpperCase()}${label.slice(1)} на ${formatPercent((1 - ratio) * 100)} ниже среднего`, reason: `Показатель ${formatNumber(value, contentCriterion === 'er' ? 3 : 0)} ниже среднего по выборке.` };
  };

  const chartData = useMemo(() => {
    if (!analytics) return [];
    const previousByDayIndex = new Map(
      (analytics.previous.wall.available ? analytics.previous.wall.dayGroups : []).map((day) => [day.dayIndex, day])
    );
    return analytics.wall.dayGroups.map((day, index) => ({
      date: day.date,
      current: chartMetric === 'views' ? day.averageViews : chartMetric === 'activity' ? day.actions : day.er,
      previous: previousByDayIndex.has(day.dayIndex)
        ? (chartMetric === 'views' ? previousByDayIndex.get(day.dayIndex)?.averageViews : chartMetric === 'activity' ? previousByDayIndex.get(day.dayIndex)?.actions : previousByDayIndex.get(day.dayIndex)?.er)
        : undefined
    }));
  }, [analytics, chartMetric]);

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
    if (denseDay?.posts > 1 && denseDay.averageActionsPerPost !== null) result.push({ tone: 'neutral', title: `Самый плотный день — ${denseDay.date}`, text: `Факт: опубликовано ${formatNumber(denseDay.posts)} поста, ${formatNumber(denseDay.averageActionsPerPost)} реакций на пост. Интерпретация: несколько публикаций в один день могли конкурировать за внимание аудитории. Действие: сопоставьте этот день с обычной частотой и протестируйте разнесение публикаций.` });
    return result.slice(0, 5);
  }, [analytics]);

  const copySummary = async () => {
    if (!analytics) return;
    const summary = `${analytics.group.name}\nПериод: ${analytics.period.dateFrom} — ${analytics.period.dateTo}\nПубликаций: ${analytics.wall.periodPosts}; средний ER: ${formatPercent(analytics.wall.erAverage)}; средние просмотры поста: ${formatNumber(analytics.wall.averageViewsPerPost)}.\n${insights.map((item) => `${item.title}. ${item.text}`).join('\n')}`;
    try { await navigator.clipboard.writeText(summary); setMessage('Вывод скопирован: его можно вставить в отчёт или сообщение клиенту.'); } catch { setMessage('Не удалось скопировать вывод. Проверьте разрешение браузера на буфер обмена.'); }
  };

  const renderCommunityOption = (group: VkGroup, context?: string) => <button className="community-option" key={group.id} type="button" onClick={() => loadAnalytics(group)}>{group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}{context ? ` · ${context}` : ''}</small></span><ChevronRight size={18} /></button>;

  const isStatsUnavailable = Boolean(analytics?.stats.unavailable);
  const currentPeriodLabel = analytics ? periodLabel(analytics.period.dateFrom, analytics.period.dateTo) : '';
  const previousPeriodLabel = analytics ? periodLabel(analytics.previous.period.dateFrom, analytics.previous.period.dateTo) : undefined;

  return <section className="page-grid analytics-page">
    <div className="panel span-2 analytics-workbench">
      <div className="panel-header analytics-controls-header"><div><h2>Анализ сообществ</h2><p>Оцените динамику, контент и следующие действия за один рабочий проход.</p></div><div className="period-tabs">{periods.filter((item) => quickPeriodKeys.includes(item.key)).map((item) => <button className={period === item.key ? 'active' : undefined} key={item.key} type="button" onClick={() => changePeriod(item.key)} disabled={isLoadingAnalytics}>{item.label}</button>)}<select aria-label="Другой период" value={quickPeriodKeys.includes(period) ? '' : period} onChange={(event) => changePeriod(event.target.value as AnalyticsPeriod)} disabled={isLoadingAnalytics}><option value="" disabled>Другой период</option>{periods.filter((item) => !quickPeriodKeys.includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div></div>
      {period === 'custom' && <div className="custom-period-form"><label>С <input type="date" value={customDateFrom} onChange={(event) => setCustomDateFrom(event.target.value)} /></label><label>По <input type="date" value={customDateTo} onChange={(event) => setCustomDateTo(event.target.value)} /></label><button type="button" onClick={() => selectedGroup && loadAnalytics(selectedGroup, 'custom')} disabled={!selectedGroup || isLoadingAnalytics}>Применить период</button></div>}
      {selectedGroup && <div className="selected-community-control">{selectedGroup.photo_100 ?? selectedGroup.photo_50 ? <img src={selectedGroup.photo_100 ?? selectedGroup.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<span><small>Анализируем сообщество</small><strong>{selectedGroup.name}</strong></span><div className="analytics-actions"><button type="button" className="secondary-button" onClick={() => setIsCommunityPickerOpen((value) => !value)}>Сменить</button><button type="button" className="secondary-button" onClick={() => loadAnalytics()} disabled={isLoadingAnalytics}><RefreshCw size={16} />Обновить данные</button><a className="secondary-button" href={`https://vk.com/${analytics?.group.screenName ?? selectedGroup.screen_name ?? `club${selectedGroup.id}`}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Открыть VK</a><button type="button" className="secondary-button" onClick={copySummary} disabled={!analytics}><Copy size={16} />Скопировать вывод</button></div></div>}
      {isCommunityPickerOpen && <div className="community-picker">{!selectedGroup && <div className="community-picker-intro"><h3>Выберите сообщество</h3><p>Продолжите анализ знакомой группы или найдите новую.</p></div>}{recentGroups.length > 0 && <div className="community-picker-section"><div className="community-picker-title"><Clock3 size={17} /><strong>Недавно анализировали</strong></div><div className="community-options">{recentGroups.map((group) => renderCommunityOption(group, 'недавний анализ'))}</div></div>}{favoriteGroups.length > 0 && <div className="community-picker-section"><div className="community-picker-title"><Star size={17} /><strong>Избранные сообщества</strong></div><div className="community-options">{favoriteGroups.map((group) => renderCommunityOption(group, 'избранное'))}</div></div>}{otherSavedGroups.length > 0 && <div className="community-picker-section"><div className="community-picker-title"><Users size={17} /><strong>Сохранённые сообщества</strong></div><div className="community-options">{otherSavedGroups.map((group) => renderCommunityOption(group))}</div></div>}<form className="search-form" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти другое сообщество: название, screen name или ссылка" /><button type="submit" disabled={isSearching}><Search size={18} />{isSearching ? 'Ищем' : 'Найти'}</button></form>{searchResults.length > 0 && <div className="search-results">{searchResults.map((group) => <button className="analytics-result" key={group.id} type="button" onClick={() => loadAnalytics(group)}><img src={group.photo_100 ?? group.photo_50} alt="" /><span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}{group.members_count ? ` · ${formatNumber(group.members_count)} участников` : ''}</small></span></button>)}</div>}</div>}
      {message && <div className="form-message">{message}</div>}
    </div>
    {isLoadingAnalytics && <div className="panel span-2 analytics-skeleton" aria-label="Загружаем анализ"><span /><span /><span /><span /><span /><span /><span /></div>}
    {analytics && !isLoadingAnalytics && <>
      <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Сводка за период</h2><p>{currentPeriodLabel}. Изменения сравниваются с предыдущим аналогичным периодом: {previousPeriodLabel}.</p></div></div>{analytics.warnings.map((warning) => <div className="debug-error" key={warning}>{warning}</div>)}<div className="analytics-kpi-grid"><KpiCard icon={Users} label="Подписчики" value={formatNumber(analytics.group.membersCount)} change={getChange(analytics.group.membersCount, isStatsUnavailable ? null : analytics.group.membersCount - analytics.stats.growth)} tooltip="Текущее число участников. Изменение — чистый прирост или отток относительно начала выбранного периода; VK не отдаёт исторический срез числа подписчиков." comparisonUnavailable={isStatsUnavailable} /><KpiCard icon={TrendingUp} label="Прирост" value={isStatsUnavailable ? 'Недоступно' : formatNumber(analytics.stats.growth)} change={getChange(analytics.stats.growth, analytics.previous.stats?.growth ?? null)} tooltip="Подписавшиеся минус отписавшиеся за период по данным VK; сравнивается с чистым приростом предыдущего аналогичного периода." unavailable={isStatsUnavailable} /><KpiCard icon={Eye} label="Охват сообщества" value={isStatsUnavailable ? 'Недоступно' : formatNumber(analytics.stats.reach)} change={getChange(analytics.stats.reach, analytics.previous.stats?.reach ?? null)} tooltip="Охват сообщества из stats.get VK. Это не равно просмотрам публикаций." unavailable={isStatsUnavailable} /><KpiCard icon={CalendarDays} label="Посещения" value={isStatsUnavailable ? 'Недоступно' : formatNumber(analytics.stats.visitors)} change={getChange(analytics.stats.visitors, analytics.previous.stats?.visitors ?? null)} tooltip="Количество посетителей сообщества за период по данным VK." unavailable={isStatsUnavailable} /><KpiCard icon={Activity} label="Реакции" value={formatNumber(analytics.wall.actions)} change={getChange(analytics.wall.actions, analytics.previous.wall.available ? analytics.previous.wall.actions : null)} tooltip="Сумма лайков, комментариев и репостов публикаций за период." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={BarChart3} label="ER" value={formatPercent(analytics.wall.erAverage)} change={getChange(analytics.wall.erAverage, analytics.previous.wall.available ? analytics.previous.wall.erAverage : null)} tooltip="Средний ER поста: (лайки + комментарии + репосты) / число подписчиков × 100%." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={Eye} label="Средние просмотры поста" value={formatNumber(analytics.wall.averageViewsPerPost)} change={getChange(analytics.wall.averageViewsPerPost, analytics.previous.wall.available ? analytics.previous.wall.averageViewsPerPost : null)} tooltip="Суммарные просмотры публикаций, делённые на число публикаций. Это не охват сообщества." comparisonUnavailable={!analytics.previous.wall.available} /><KpiCard icon={MessageCircle} label="Публикации" value={formatNumber(analytics.wall.periodPosts)} change={getChange(analytics.wall.periodPosts, analytics.previous.wall.available ? analytics.previous.wall.periodPosts : null)} tooltip="Количество публикаций, попавших в выбранный период." comparisonUnavailable={!analytics.previous.wall.available} /></div></div>
      <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Что важно</h2><p>Факт, интерпретация и следующее действие — без общих формулировок.</p></div></div>{insights.length ? <div className="insight-grid">{insights.map((insight) => <div className={`insight-card ${insight.tone}`} key={insight.title}>{insight.tone === 'warn' ? <TrendingDown size={18} /> : insight.tone === 'good' ? <TrendingUp size={18} /> : <BarChart3 size={18} />}<div><strong>{insight.title}</strong><span>{insight.text}</span></div></div>)}</div> : <div className="empty-state">Недостаточно публикаций для выводов. Выберите более длинный период или обновите данные.</div>}</div>
      <div className="panel span-2 analytics-section"><div className="section-title analytics-chart-title"><div><h2>Динамика</h2><p>Сопоставление с предыдущим аналогичным периодом. Охват сообщества не подменяется просмотрами постов.</p></div><div className="analytics-tabs compact-tabs">{chartMetrics.map((metric) => <button className={chartMetric === metric.key ? 'active' : undefined} key={metric.key} type="button" onClick={() => setChartMetric(metric.key)}>{metric.label}</button>)}</div></div>{chartData.length ? <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind={chartMetric} title={chartMetric === 'views' ? 'Средние просмотры публикаций по дням' : chartMetric === 'activity' ? 'Реакции публикаций по дням' : 'ER публикаций по дням'} data={chartData} currentPeriodLabel={currentPeriodLabel} previousPeriodLabel={analytics.previous.wall.available && analytics.previous.wall.dayGroups.length ? previousPeriodLabel : undefined} /></Suspense> : <div className="empty-state">Нет постов для графика. Выберите более длинный период или проверьте доступ к стене VK.</div>}</div>
      <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Контентная эффективность</h2><p>Сравнение отдельных публикаций относительно среднего по выбранной выборке.</p></div><div className="content-controls"><label>Критерий<select value={contentCriterion} onChange={(event) => setContentCriterion(event.target.value as ContentCriterion)}>{contentCriteria.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>Публикации<select value={postFilter} onChange={(event) => setPostFilter(event.target.value as PostFilter)}><option value="all">Все</option><option value="organic">Органические</option><option value="ad">Рекламные</option></select></label></div></div><div className="analytics-tabs compact-tabs content-segments">{postSegments.map((segment) => <button className={postSegment === segment.key ? 'active' : undefined} key={segment.key} type="button" onClick={() => setPostSegment(segment.key)}>{segment.label}</button>)}</div>{contentPosts.length ? <div className="posts-list">{contentPosts.map((post) => { const explanation = postExplanation(post); return <PostCard key={post.id} post={{ ...post, group: analytics.group, resultBadge: explanation.badge, resultReason: explanation.reason }} />; })}</div> : <div className="empty-state">{criterionAverage <= 0 ? 'Недостаточно данных для сравнения: среднее значение выбранного критерия равно нулю.' : 'В этой выборке нет публикаций. Смените фильтр или период.'}</div>}</div>
      <div className="panel span-2 analytics-section">
        <div className="section-title"><div><h2>Все публикации</h2><p>Найдено: {detailPosts.length} из {analytics.wall.topPosts.length}.</p></div><button className="secondary-button" type="button" onClick={() => { setDetailPostFilter('all'); setDetailSort('date'); setDetailQuery(''); }}>Сбросить фильтры</button></div>
        <div className="detail-post-controls"><input value={detailQuery} onChange={(event) => setDetailQuery(event.target.value)} placeholder="Поиск по тексту публикации" /><label>Тип<select value={detailPostFilter} onChange={(event) => setDetailPostFilter(event.target.value as PostFilter)}><option value="all">Все</option><option value="organic">Органические</option><option value="ad">Рекламные</option></select></label><label>Сортировка<select value={detailSort} onChange={(event) => setDetailSort(event.target.value as DetailSort)}><option value="date">По дате</option><option value="er">По ER</option><option value="views">По просмотрам</option><option value="actions">По реакциям</option><option value="reposts">По репостам</option><option value="comments">По комментариям</option></select></label></div>
        {detailPosts.length ? <div className="table analytics-posts"><div className="table-row table-head analytics-post-row"><span>Публикация</span><span>Тип</span><span>Лайки</span><span>Репосты</span><span>Комментарии</span><span>Просмотры</span><span>ER</span><span></span></div>{detailPosts.map((post) => <div className="table-row analytics-post-row" key={post.id}><span data-label="Публикация"><strong>{post.text || 'Без текста'}</strong><small>{new Date(post.date).toLocaleString('ru-RU')}</small></span><span data-label="Тип">{post.contentType}{post.isAd ? ' · реклама' : ''}</span><span data-label="Лайки">{formatNumber(post.likes)}</span><span data-label="Репосты">{formatNumber(post.reposts)}</span><span data-label="Комментарии">{formatNumber(post.comments)}</span><span data-label="Просмотры">{formatNumber(post.views)}</span><span data-label="ER">{formatPercent(post.er)}</span><a className="icon-button" href={post.url} rel="noreferrer" target="_blank" aria-label="Открыть пост VK"><ExternalLink size={17} /></a></div>)}</div> : <div className="empty-state">По активным фильтрам публикаций не найдено. Сбросьте фильтры или измените запрос.</div>}
      </div>
    </>}
  </section>;
}
