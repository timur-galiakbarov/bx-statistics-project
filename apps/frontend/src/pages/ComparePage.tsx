import { ArrowDownUp, BarChart3, Search, Trash2, X } from 'lucide-react';
import { FormEvent, Suspense, lazy, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, CommunityAnalytics, CompareItem, CompareResult, VkGroup, VkListResponse } from '../api/types';

const CompareChart = lazy(() => import('../components/CompareChart'));

const periods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: 'Неделя' },
  { key: 'twoWeek', label: 'Две недели' },
  { key: 'month', label: 'Последние 30 дней' }
];

const sortOptions = [
  { key: 'actions', label: 'Реакции' },
  { key: 'erAverage', label: 'ER ср.' },
  { key: 'averageViewsPerPost', label: 'Средний охват' },
  { key: 'periodPosts', label: 'Посты' },
  { key: 'membersCount', label: 'Участники' }
] as const;

type CompareSort = (typeof sortOptions)[number]['key'];
type ComparedItem = CompareItem & { analytics: CommunityAnalytics };

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/vk\.com\//, '')
    .replace(/^vk\.com\//, '');
}

export function ComparePage() {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [sortBy, setSortBy] = useState<CompareSort>('actions');
  const [searchResults, setSearchResults] = useState<VkGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<VkGroup[]>([]);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const comparedItems = useMemo<ComparedItem[]>(() => {
    const items = (compare?.items.filter((item): item is ComparedItem => Boolean(item.analytics)) ?? []).slice();

    return items.sort((left, right) => getSortValue(right.analytics, sortBy) - getSortValue(left.analytics, sortBy));
  }, [compare, sortBy]);
  const failedItems = compare?.items.filter((item) => item.error) ?? [];
  const compareChartData = comparedItems.map((item) => ({
    id: item.groupId,
    name: item.analytics.group.name,
    reactions: item.analytics.wall.actions,
    er: item.analytics.wall.erAverage,
    averageViews: item.analytics.wall.averageViewsPerPost
  }));

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
      setMessage('Сообщество уже добавлено в сравнение.');
      return;
    }

    setSelectedGroups((groups) => [...groups, group].slice(0, 10));
    setCompare(null);
  };

  const removeGroup = (groupId: number) => {
    setSelectedGroups((groups) => groups.filter((group) => group.id !== groupId));
    setCompare(null);
  };

  const clearGroups = () => {
    setSelectedGroups([]);
    setCompare(null);
    setMessage(null);
  };

  const runCompare = async () => {
    if (selectedGroups.length < 2) {
      setMessage('Добавьте минимум два сообщества для сравнения.');
      return;
    }

    setIsComparing(true);
    setMessage(null);

    try {
      const groupIds = selectedGroups.map((group) => group.id).join(',');
      const data = await apiGet<CompareResult>(
        `/api/compare?groupIds=${encodeURIComponent(groupIds)}&period=${encodeURIComponent(period)}`
      );
      setCompare(data);
    } catch (error) {
      setCompare(null);
      setMessage(error instanceof Error ? error.message : 'Не удалось сравнить сообщества.');
    } finally {
      setIsComparing(false);
    }
  };

  const renderGroupCell = (item: CommunityAnalytics) => (
    <span className="compare-group-cell">
      {item.group.photo && <img src={item.group.photo} alt="" />}
      <span>
        <strong>{item.group.name}</strong>
        <small>{formatNumber(item.group.membersCount)} участников</small>
      </span>
    </span>
  );

  return (
    <section className="page-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Выбор сообществ</h2>
            <p>Найдите группы и добавьте их в список сравнения.</p>
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
            <h2>Список сравнения</h2>
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
              disabled={isComparing}
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

        <button className="primary-button compare-submit" type="button" onClick={runCompare} disabled={isComparing}>
          <BarChart3 size={18} />
          {isComparing ? 'Сравниваем' : 'Сравнить'}
        </button>
      </div>

      {compare && (
        <div className="panel span-2">
          <div className="panel-header compact">
            <div>
              <h2>Результаты сравнения</h2>
              <p>Сравнение построено по доступным VK-данным за выбранный период.</p>
            </div>
          </div>

          {failedItems.map((item) => (
            <div className="debug-error" key={item.groupId}>
              {item.groupId}: {item.error?.message}
            </div>
          ))}

          {comparedItems.length === 0 && <div className="empty-state">Нет данных для сравнения.</div>}

          {comparedItems.length > 0 && (
            <div className="compare-sections">
              <div className="compare-toolbar">
                <label>
                  <ArrowDownUp size={16} />
                  <span>Сортировка</span>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value as CompareSort)}>
                    {sortOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Suspense fallback={<div className="chart-panel">Загрузка графика...</div>}>
                <CompareChart data={compareChartData} />
              </Suspense>

              <div className="table analytics-posts">
                <div className="table-row table-head compare-row activity">
                  <span>Группа</span>
                  <span>Реакции</span>
                  <span>На пост</span>
                  <span>В день</span>
                  <span>Лайки</span>
                  <span>Репосты</span>
                  <span>Комментарии</span>
                </div>
                {comparedItems.map((item) => (
                  <div className="table-row compare-row activity" key={item.groupId}>
                    {renderGroupCell(item.analytics)}
                    <span>{formatNumber(item.analytics.wall.actions)}</span>
                    <span>{item.analytics.wall.averageActionsPerPost}</span>
                    <span>{item.analytics.wall.averageActionsPerDay}</span>
                    <span>{formatNumber(item.analytics.wall.likes)}</span>
                    <span>{formatNumber(item.analytics.wall.reposts)}</span>
                    <span>{formatNumber(item.analytics.wall.comments)}</span>
                  </div>
                ))}
              </div>

              <div className="table analytics-posts">
                <div className="table-row table-head compare-row reach">
                  <span>Группа</span>
                  <span>Средний охват</span>
                  <span>Максимум</span>
                  <span>Минимум</span>
                  <span>Рекламные посты</span>
                  <span>Посты</span>
                </div>
                {comparedItems.map((item) => (
                  <div className="table-row compare-row reach" key={item.groupId}>
                    {renderGroupCell(item.analytics)}
                    <span>{formatNumber(item.analytics.wall.averageViewsPerPost)}</span>
                    <span>{formatNumber(item.analytics.wall.maxViews)}</span>
                    <span>{formatNumber(item.analytics.wall.minViews)}</span>
                    <span>{formatNumber(item.analytics.wall.adsPosts)}</span>
                    <span>{formatNumber(item.analytics.wall.periodPosts)}</span>
                  </div>
                ))}
              </div>

              <div className="table analytics-posts">
                <div className="table-row table-head compare-row content">
                  <span>Группа</span>
                  <span>ER ср.</span>
                  <span>ER макс.</span>
                  <span>Фото</span>
                  <span>Видео</span>
                  <span>Warnings</span>
                </div>
                {comparedItems.map((item) => (
                  <div className="table-row compare-row content" key={item.groupId}>
                    {renderGroupCell(item.analytics)}
                    <span>{item.analytics.wall.erAverage}%</span>
                    <span>{item.analytics.wall.erMax}%</span>
                    <span>{formatNumber(item.analytics.photos.period)}</span>
                    <span>{formatNumber(item.analytics.videos.period)}</span>
                    <span>{item.analytics.warnings.length ? item.analytics.warnings.length : 'нет'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getSortValue(analytics: CommunityAnalytics, sortBy: CompareSort) {
  if (sortBy === 'membersCount') {
    return analytics.group.membersCount;
  }

  return analytics.wall[sortBy];
}
