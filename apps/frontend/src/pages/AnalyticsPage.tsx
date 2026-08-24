import {
  BarChart3,
  Eye,
  Heart,
  Image,
  MessageCircle,
  PlaySquare,
  Repeat2,
  Search
} from 'lucide-react';
import { lazy, FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, CommunityAnalytics, VkGroup, VkListResponse } from '../api/types';
import { PostCard } from '../components/PostCard';

type AnalyticsTab = 'summary' | 'activity' | 'engagement' | 'content' | 'posts';
type PostSort = 'actions' | 'likes' | 'comments' | 'views' | 'er' | 'date';

const AnalyticsChart = lazy(() => import('../components/AnalyticsChart'));

const periods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: 'Неделя' },
  { key: 'twoWeek', label: 'Две недели' },
  { key: 'month', label: 'Последние 30 дней' }
];

const analyticsTabs: Array<{ key: AnalyticsTab; label: string }> = [
  { key: 'summary', label: 'Сводный отчет' },
  { key: 'activity', label: 'Активность' },
  { key: 'engagement', label: 'Вовлеченность' },
  { key: 'content', label: 'Контент' },
  { key: 'posts', label: 'Публикации' }
];

const postSortOptions: Array<{ key: PostSort; label: string }> = [
  { key: 'actions', label: 'По реакциям' },
  { key: 'likes', label: 'По лайкам' },
  { key: 'comments', label: 'По комментариям' },
  { key: 'views', label: 'По просмотрам' },
  { key: 'er', label: 'По ER' },
  { key: 'date', label: 'По дате' }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/vk\.com\//, '')
    .replace(/^vk\.com\//, '');
}

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const groupIdParam = searchParams.get('groupId');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VkGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<VkGroup | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [analytics, setAnalytics] = useState<CommunityAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('summary');
  const [postSort, setPostSort] = useState<PostSort>('actions');
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeQuery(query);

    if (!normalized) {
      setMessage('Введите название или адрес сообщества.');
      return;
    }

    setIsSearching(true);
    setMessage(null);
    setSearchResults([]);

    try {
      const data = await apiGet<VkListResponse<VkGroup>>(
        `/api/vk/groups/search?q=${encodeURIComponent(normalized)}&count=10`
      );
      setSearchResults(data.items);
      setMessage(data.items.length ? null : 'Сообщества не найдены.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось найти сообщества.');
    } finally {
      setIsSearching(false);
    }
  };

  const loadAnalytics = async (group: VkGroup = selectedGroup!, nextPeriod: AnalyticsPeriod = period) => {
    if (!group) {
      setMessage('Выберите сообщество для анализа.');
      return;
    }

    setSelectedGroup(group);
    setIsLoadingAnalytics(true);
    setMessage(null);

    try {
      const data = await apiGet<CommunityAnalytics>(
        `/api/analytics/community/${group.id}?period=${encodeURIComponent(nextPeriod)}`
      );
      setAnalytics(data);
      setActiveTab('summary');
    } catch (error) {
      setAnalytics(null);
      setMessage(error instanceof Error ? error.message : 'Не удалось получить анализ сообщества.');
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (!groupIdParam) {
      return;
    }

    const numericGroupId = Number(groupIdParam);
    if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
      setMessage('Некорректный id сообщества в ссылке.');
      return;
    }

    loadAnalytics({
      id: numericGroupId,
      name: `id${numericGroupId}`
    });
  }, [groupIdParam]);

  const sortedPosts = useMemo(() => {
    const posts = analytics?.wall.topPosts ?? [];

    return [...posts].sort((a, b) => {
      if (postSort === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      if (postSort === 'er') {
        return b.er - a.er;
      }

      if (postSort === 'views') {
        return b.views - a.views;
      }

      if (postSort === 'comments') {
        return b.comments - a.comments;
      }

      if (postSort === 'likes') {
        return b.likes - a.likes;
      }

      const aActions = a.likes + a.reposts + a.comments;
      const bActions = b.likes + b.reposts + b.comments;

      return bActions - aActions;
    });
  }, [analytics?.wall.topPosts, postSort]);

  const renderStatsMetrics = () =>
    analytics && (
      <div className="metric-grid muted">
        <div className="metric">
          <span>Прирост</span>
          <strong>{analytics.stats.unavailable ? 'Недоступно' : formatNumber(analytics.stats.growth)}</strong>
        </div>
        <div className="metric">
          <span>Посетители</span>
          <strong>{analytics.stats.unavailable ? 'Недоступно' : formatNumber(analytics.stats.visitors)}</strong>
        </div>
        <div className="metric">
          <span>Охват</span>
          <strong>{analytics.stats.unavailable ? 'Недоступно' : formatNumber(analytics.stats.reach)}</strong>
        </div>
      </div>
    );

  const renderWallMetrics = () =>
    analytics && (
      <div className="metric-grid">
        <div className="metric">
          <BarChart3 size={18} />
          <span>Постов за период</span>
          <strong>{formatNumber(analytics.wall.periodPosts)}</strong>
        </div>
        <div className="metric">
          <Heart size={18} />
          <span>Лайки</span>
          <strong>{formatNumber(analytics.wall.likes)}</strong>
        </div>
        <div className="metric">
          <Repeat2 size={18} />
          <span>Репосты</span>
          <strong>{formatNumber(analytics.wall.reposts)}</strong>
        </div>
        <div className="metric">
          <MessageCircle size={18} />
          <span>Комментарии</span>
          <strong>{formatNumber(analytics.wall.comments)}</strong>
        </div>
        <div className="metric">
          <Eye size={18} />
          <span>Просмотры постов</span>
          <strong>{formatNumber(analytics.wall.views)}</strong>
        </div>
      </div>
    );

  const renderEngagementMetrics = () =>
    analytics && (
      <div className="metric-grid">
        <div className="metric">
          <span>Средний ER поста</span>
          <strong>{analytics.wall.erAverage}%</strong>
        </div>
        <div className="metric">
          <span>Максимальный ER</span>
          <strong>{analytics.wall.erMax}%</strong>
        </div>
        <div className="metric">
          <span>Постов в день</span>
          <strong>{analytics.wall.averagePostsPerDay}</strong>
        </div>
        <div className="metric">
          <span>Реакций на пост</span>
          <strong>{analytics.wall.averageActionsPerPost}</strong>
        </div>
        <div className="metric">
          <span>Средний охват поста</span>
          <strong>{formatNumber(analytics.wall.averageViewsPerPost)}</strong>
        </div>
      </div>
    );

  const renderDayTable = () =>
    analytics && (
      <>
        {analytics.wall.dayGroups.length === 0 && <div className="empty-state">За выбранный период публикаций нет.</div>}
        {analytics.wall.dayGroups.length > 0 && (
          <div className="table analytics-posts">
            <div className="table-row table-head analytics-day-row">
              <span>День</span>
              <span>Посты</span>
              <span>Реакции</span>
              <span>Лайки</span>
              <span>Комментарии</span>
              <span>ER</span>
              <span>Средний охват</span>
            </div>
            {analytics.wall.dayGroups.map((day) => (
              <div className="table-row analytics-day-row" key={day.date}>
                <span>{day.date}</span>
                <span>{formatNumber(day.posts)}</span>
                <span>{formatNumber(day.actions)}</span>
                <span>{formatNumber(day.likes)}</span>
                <span>{formatNumber(day.comments)}</span>
                <span>{day.er}%</span>
                <span>{formatNumber(day.averageViews)}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );

  const renderActivityChart = () => {
    if (!analytics) {
      return null;
    }

    const average = analytics.wall.averageActionsPerDay;
    const data = analytics.wall.dayGroups.map((day) => ({
      date: day.date,
      reactions: day.actions,
      average
    }));

    if (data.length === 0) {
      return <div className="empty-state">Недостаточно данных для графика активности.</div>;
    }

    return <AnalyticsChart data={data} kind="activity" title="Активность по дням" />;
  };

  const renderViewsChart = () => {
    if (!analytics) {
      return null;
    }

    const data = analytics.wall.dayGroups.map((day) => ({
      date: day.date,
      averageViews: day.averageViews,
      views: day.views
    }));

    if (data.length === 0) {
      return <div className="empty-state">Недостаточно данных для графика охвата.</div>;
    }

    return <AnalyticsChart data={data} kind="views" title="Охват постов по дням" />;
  };

  const renderEngagementChart = () => {
    if (!analytics) {
      return null;
    }

    const data = analytics.wall.dayGroups.map((day) => ({
      date: day.date,
      er: day.er,
      average: analytics.wall.erAverage
    }));

    if (data.length === 0) {
      return <div className="empty-state">Недостаточно данных для графика ER.</div>;
    }

    return <AnalyticsChart data={data} kind="engagement" title="ER по дням" />;
  };

  const renderContentMetrics = () =>
    analytics && (
      <div className="media-grid">
        <div className="media-panel">
          <h3>
            <Image size={18} />
            Фотографии
          </h3>
          <div className="metric-grid compact">
            <div className="metric">
              <span>За период</span>
              <strong>{formatNumber(analytics.photos.period)}</strong>
            </div>
            <div className="metric">
              <span>Лайки</span>
              <strong>{formatNumber(analytics.photos.likes)}</strong>
            </div>
            <div className="metric">
              <span>Репосты</span>
              <strong>{formatNumber(analytics.photos.reposts)}</strong>
            </div>
            <div className="metric">
              <span>Комментарии</span>
              <strong>{formatNumber(analytics.photos.comments)}</strong>
            </div>
          </div>
        </div>

        <div className="media-panel">
          <h3>
            <PlaySquare size={18} />
            Видео
          </h3>
          <div className="metric-grid compact">
            <div className="metric">
              <span>За период</span>
              <strong>{formatNumber(analytics.videos.period)}</strong>
            </div>
            <div className="metric">
              <span>Лайки</span>
              <strong>{formatNumber(analytics.videos.likes)}</strong>
            </div>
            <div className="metric">
              <span>Комментарии</span>
              <strong>{formatNumber(analytics.videos.comments)}</strong>
            </div>
            <div className="metric">
              <span>Просмотры</span>
              <strong>{formatNumber(analytics.videos.views)}</strong>
            </div>
          </div>
        </div>
      </div>
    );

  const renderPostsTable = () =>
    analytics && (
      <div className="posts-section">
        <div className="posts-toolbar">
          <label>
            Сортировка
            <select value={postSort} onChange={(event) => setPostSort(event.target.value as PostSort)}>
              {postSortOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sortedPosts.length === 0 && <div className="empty-state">За выбранный период публикаций нет.</div>}
        {sortedPosts.length > 0 && (
          <div className="posts-list">
            {sortedPosts.map((post) => (
              <PostCard key={post.id} post={{ ...post, group: analytics.group }} />
            ))}
          </div>
        )}
      </div>
    );

  const renderActiveTab = () => {
    if (!analytics) {
      return null;
    }

    if (activeTab === 'summary') {
      return (
        <>
          {renderWallMetrics()}
          {renderStatsMetrics()}
          {renderEngagementMetrics()}
          {renderViewsChart()}
        </>
      );
    }

    if (activeTab === 'activity') {
      return (
        <>
          {renderWallMetrics()}
          {renderActivityChart()}
          {renderDayTable()}
        </>
      );
    }

    if (activeTab === 'engagement') {
      return (
        <>
          {renderEngagementMetrics()}
          {renderEngagementChart()}
          {renderDayTable()}
        </>
      );
    }

    if (activeTab === 'content') {
      return renderContentMetrics();
    }

    return renderPostsTable();
  };

  const changePeriod = (nextPeriod: AnalyticsPeriod) => {
    setPeriod(nextPeriod);

    if (selectedGroup) {
      loadAnalytics(selectedGroup, nextPeriod);
    }
  };

  return (
    <section className="page-grid">
      <div className="panel span-2">
        <div className="panel-header">
          <div>
            <h2>Выбор сообщества</h2>
            <p>Найдите группу ВКонтакте и запустите анализ публикаций за период.</p>
          </div>
        </div>

        <form className="search-form" onSubmit={search}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, screen name или ссылка vk.com/..."
          />
          <button type="submit" disabled={isSearching}>
            <Search size={18} />
            {isSearching ? 'Ищем' : 'Найти'}
          </button>
        </form>

        {message && <div className="form-message">{message}</div>}

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((group) => (
              <button className="analytics-result" key={group.id} type="button" onClick={() => loadAnalytics(group)}>
                <img src={group.photo_100 ?? group.photo_50} alt="" />
                <span>
                  <strong>{group.name}</strong>
                  <small>
                    {group.screen_name ? `@${group.screen_name}` : `id${group.id}`}
                    {group.members_count ? ` / ${formatNumber(group.members_count)} участников` : ''}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>{analytics ? `Сообщество «${analytics.group.name}»` : 'Анализ сообщества'}</h2>
            <p>
              {analytics
                ? `Период с ${analytics.period.dateFrom} по ${analytics.period.dateTo}`
                : 'Выберите сообщество, чтобы увидеть отчёт.'}
            </p>
          </div>
          <div className="period-tabs">
            {periods.map((item) => (
              <button
                className={period === item.key ? 'active' : undefined}
                key={item.key}
                type="button"
                onClick={() => changePeriod(item.key)}
                disabled={isLoadingAnalytics}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {isLoadingAnalytics && <div className="empty-state">Загружаем анализ...</div>}

        {analytics && !isLoadingAnalytics && (
          <div className="analytics-layout">
            {analytics.warnings.map((warning) => (
              <div className="debug-error" key={warning}>
                {warning}
              </div>
            ))}

            <div className="analytics-group">
              {analytics.group.photo && <img src={analytics.group.photo} alt="" />}
              <div>
                <strong>{analytics.group.name}</strong>
                <span>
                  {analytics.group.screenName ? `@${analytics.group.screenName}` : `id${analytics.group.id}`} /{' '}
                  {formatNumber(analytics.group.membersCount)} участников
                </span>
              </div>
            </div>

            <div className="analytics-tabs">
              {analyticsTabs.map((tab) => (
                <button
                  className={activeTab === tab.key ? 'active' : undefined}
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Suspense fallback={<div className="empty-state">Загружаем графики...</div>}>
              <div className="analytics-tab-panel">{renderActiveTab()}</div>
            </Suspense>
          </div>
        )}
      </div>
    </section>
  );
}
