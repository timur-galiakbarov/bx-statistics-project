import { ArrowDownUp, FileText, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, PostsAnalysisPost, PostsAnalysisResult, VkGroup, VkListResponse } from '../api/types';
import { PostCard } from '../components/PostCard';

const periods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: 'Неделя' },
  { key: 'twoWeek', label: 'Две недели' },
  { key: 'month', label: 'Последние 30 дней' }
];

const sortOptions = [
  { key: 'likes', label: 'Лайки' },
  { key: 'reposts', label: 'Репосты' },
  { key: 'comments', label: 'Комментарии' },
  { key: 'actions', label: 'Все реакции' },
  { key: 'views', label: 'Просмотры' },
  { key: 'er', label: 'ER' },
  { key: 'date', label: 'Дата' }
] as const;

const filterOptions = [
  { key: 'all', label: 'Все' },
  { key: 'media', label: 'С вложениями' },
  { key: 'photo', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'gif', label: 'GIF' },
  { key: 'ad', label: 'Реклама' },
  { key: 'text', label: 'Без вложений' }
] as const;

const POSTS_PAGE_SIZE = 18;

type PostSort = (typeof sortOptions)[number]['key'];
type PostFilter = (typeof filterOptions)[number]['key'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/vk\.com\//, '')
    .replace(/^vk\.com\//, '');
}

function getPostSortValue(post: PostsAnalysisPost, sort: PostSort) {
  if (sort === 'date') {
    return new Date(post.date).getTime();
  }

  return post[sort];
}

function postMatchesFilter(post: PostsAnalysisPost, filter: PostFilter) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'media') {
    return post.media.length > 0;
  }

  if (filter === 'text') {
    return post.media.length === 0;
  }

  if (filter === 'ad') {
    return post.isAd;
  }

  return post.media.some((item) => item.type === filter);
}

export function PostsPage() {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [sortBy, setSortBy] = useState<PostSort>('likes');
  const [filterBy, setFilterBy] = useState<PostFilter>('all');
  const [visibleCount, setVisibleCount] = useState(POSTS_PAGE_SIZE);
  const [searchResults, setSearchResults] = useState<VkGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<VkGroup[]>([]);
  const [analysis, setAnalysis] = useState<PostsAnalysisResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sortedPosts = useMemo(() => {
    const posts = analysis?.posts ?? [];

    return posts
      .filter((post) => postMatchesFilter(post, filterBy))
      .sort((left, right) => getPostSortValue(right, sortBy) - getPostSortValue(left, sortBy));
  }, [analysis?.posts, filterBy, sortBy]);
  const visiblePosts = sortedPosts.slice(0, visibleCount);
  const hiddenPostsCount = Math.max(sortedPosts.length - visiblePosts.length, 0);

  useEffect(() => {
    setVisibleCount(POSTS_PAGE_SIZE);
  }, [analysis, filterBy, sortBy]);

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

  const addGroup = (group: VkGroup) => {
    setMessage(null);

    if (selectedGroups.some((item) => item.id === group.id)) {
      setMessage('Сообщество уже добавлено в анализ публикаций.');
      return;
    }

    setSelectedGroups((groups) => [...groups, group].slice(0, 10));
    setAnalysis(null);
  };

  const removeGroup = (groupId: number) => {
    setSelectedGroups((groups) => groups.filter((group) => group.id !== groupId));
    setAnalysis(null);
  };

  const clearGroups = () => {
    setSelectedGroups([]);
    setAnalysis(null);
    setMessage(null);
  };

  const runAnalysis = async () => {
    if (selectedGroups.length === 0) {
      setMessage('Добавьте хотя бы одно сообщество для анализа.');
      return;
    }

    setIsAnalyzing(true);
    setMessage(null);

    try {
      const groupIds = selectedGroups.map((group) => group.id).join(',');
      const data = await apiGet<PostsAnalysisResult>(
        `/api/posts/analyze?groupIds=${encodeURIComponent(groupIds)}&period=${encodeURIComponent(period)}`
      );
      setAnalysis(data);
      setFilterBy('all');
    } catch (error) {
      setAnalysis(null);
      setMessage(error instanceof Error ? error.message : 'Не удалось выполнить анализ публикаций.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="page-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Выбор сообществ</h2>
            <p>Найдите группы, публикации которых нужно сравнить между собой.</p>
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
              <button className="analytics-result" key={group.id} type="button" onClick={() => addGroup(group)}>
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

      <div className="panel">
        <div className="panel-header compact">
          <div>
            <h2>Список анализа</h2>
            <p>{selectedGroups.length ? `${selectedGroups.length} из 10` : 'Нет добавленных сообществ.'}</p>
          </div>
          {selectedGroups.length > 0 && (
            <button className="icon-button danger" type="button" aria-label="Очистить список" onClick={clearGroups}>
              <Trash2 size={17} />
            </button>
          )}
        </div>

        <div className="period-tabs">
          {periods.map((item) => (
            <button
              className={period === item.key ? 'active' : undefined}
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key)}
              disabled={isAnalyzing}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="stack">
          {selectedGroups.map((group) => (
            <div className="group-line" key={group.id}>
              <span>
                <strong>{group.name}</strong>
                <span>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}</span>
              </span>
              <button className="icon-button danger" type="button" onClick={() => removeGroup(group.id)}>
                <X size={17} />
              </button>
            </div>
          ))}
          {selectedGroups.length === 0 && <div className="empty-state">Добавьте сообщества из поиска.</div>}
        </div>

        <button className="primary-button compare-submit" type="button" onClick={runAnalysis} disabled={isAnalyzing}>
          <FileText size={18} />
          {isAnalyzing ? 'Анализируем' : 'Начать анализ'}
        </button>
      </div>

      {analysis && (
        <div className="panel span-2">
          <div className="panel-header compact">
            <div>
              <h2>Анализ публикаций</h2>
              <p>
                Период: {new Date(analysis.period.dateFrom).toLocaleDateString('ru-RU')} -{' '}
                {new Date(analysis.period.dateTo).toLocaleDateString('ru-RU')}
              </p>
            </div>
          </div>

          {analysis.groups.some((item) => item.error) &&
            analysis.groups
              .filter((item) => item.error)
              .map((item) => (
                <div className="debug-error" key={item.groupId}>
                  {item.groupId}: {item.error?.message}
                </div>
              ))}

          <div className="compare-sections">
            <div className="table analytics-posts">
              <div className="table-row table-head posts-group-row">
                <span>Группа</span>
                <span>Посты</span>
                <span>Реакции</span>
                <span>На пост</span>
                <span>Охват</span>
                <span>ER ср.</span>
              </div>
              {analysis.groups
                .filter((item) => item.group && item.summary)
                .map((item) => (
                  <div className="table-row posts-group-row" key={item.groupId}>
                    <span className="compare-group-cell">
                      {item.group?.photo && <img src={item.group.photo} alt="" />}
                      <span>
                        <strong>{item.group?.name}</strong>
                        <small>{formatNumber(item.group?.membersCount ?? 0)} участников</small>
                      </span>
                    </span>
                    <span>{formatNumber(item.summary?.periodPosts ?? 0)}</span>
                    <span>{formatNumber(item.summary?.actions ?? 0)}</span>
                    <span>{item.summary?.averageActionsPerPost ?? 0}</span>
                    <span>{formatNumber(item.summary?.averageViewsPerPost ?? 0)}</span>
                    <span>{item.summary?.erAverage ?? 0}%</span>
                  </div>
                ))}
            </div>

            <div className="posts-toolbar">
              <label>
                <ArrowDownUp size={16} />
                <span>Сортировка</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as PostSort)}>
                  {sortOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="post-filter-tabs">
              {filterOptions.map((option) => (
                <button
                  className={filterBy === option.key ? 'active' : undefined}
                  key={option.key}
                  type="button"
                  onClick={() => setFilterBy(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {sortedPosts.length === 0 && <div className="empty-state">За выбранный период публикаций нет.</div>}

            {sortedPosts.length > 0 && (
              <>
                <div className="post-list-summary">
                  Показано {formatNumber(visiblePosts.length)} из {formatNumber(sortedPosts.length)}
                </div>

                <div className="posts-list">
                  {visiblePosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>

                {hiddenPostsCount > 0 && (
                  <button
                    className="secondary-button load-more-button"
                    type="button"
                    onClick={() => setVisibleCount((count) => count + POSTS_PAGE_SIZE)}
                  >
                    Показать ещё {formatNumber(Math.min(hiddenPostsCount, POSTS_PAGE_SIZE))}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
