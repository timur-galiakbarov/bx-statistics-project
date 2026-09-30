import { ArrowDownUp, BarChart3, Search, X } from 'lucide-react';
import { FormEvent, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../api/client';
import type { AnalyticsPeriod, CommunityAnalytics, CompareItem, CompareResult, SavedGroup, TelegramAnalytics, User, VkGroup, VkListResponse, YoutubeChannel } from '../api/types';
import { TelegramLogo } from '../components/TelegramLogo';

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
type CompareChannel = { id: string | number; name: string; platform: 'vk' | 'youtube' | 'telegram'; screen_name?: string; photo_50?: string; photo_100?: string; members_count?: number | null };
type ComparePlatform = CompareChannel['platform'];
type StoredCompareState = { version: 1; platform: ComparePlatform; period: AnalyticsPeriod; selectedGroups: CompareChannel[] };
type Props = { groups: SavedGroup[]; user: User | null };
const COMPARE_STORAGE_PREFIX = 'socstat.compare.v1.';

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '0';
}

function ComparePlatformIcon({ platform }: { platform: ComparePlatform }) {
  if (platform === 'telegram') return <TelegramLogo className="compare-platform-icon" size={14} />;
  return <img className="compare-platform-icon" src={platform === 'youtube' ? '/youtube-logo.png' : '/vk-network-logo.png'} alt="" />;
}

function normalizeQuery(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/vk\.com\//, '')
    .replace(/^vk\.com\//, '');
}

function getStoredState(userId?: string): StoredCompareState | null {
  if (!userId) return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(`${COMPARE_STORAGE_PREFIX}${userId}`) ?? 'null') as Partial<StoredCompareState> | null;
    if (!value || value.version !== 1 || (value.platform !== 'vk' && value.platform !== 'youtube' && value.platform !== 'telegram') || !periods.some((item) => item.key === value.period) || !Array.isArray(value.selectedGroups)) return null;
    const selectedGroups = value.selectedGroups.filter((group): group is CompareChannel => Boolean(group) && (group.platform === 'vk' || group.platform === 'youtube' || group.platform === 'telegram') && (typeof group.id === 'string' || typeof group.id === 'number') && typeof group.name === 'string').slice(0, 10);
    return { version: 1, platform: value.platform, period: value.period as AnalyticsPeriod, selectedGroups };
  } catch {
    return null;
  }
}

function accountToCompareChannel(group: SavedGroup): CompareChannel | null {
  if (group.platform !== 'vk' && group.platform !== 'youtube' && group.platform !== 'telegram') return null;
  return { id: group.platform === 'telegram' ? group.handle ?? group.externalId : group.externalId, name: group.name, platform: group.platform, screen_name: group.handle, photo_100: group.photo, members_count: group.membersCount ?? group.followersCount };
}

function accountWord(count: number) {
  const remainder = count % 100;
  if (remainder >= 11 && remainder <= 14) return 'аккаунтов';
  if (count % 10 === 1) return 'аккаунт';
  if (count % 10 >= 2 && count % 10 <= 4) return 'аккаунта';
  return 'аккаунтов';
}

function comparisonSources(groups: CompareChannel[]) {
  return groups.map((group) => `${group.platform}:${group.id}`).join(',');
}

export function ComparePage({ groups, user }: Props) {
  const storedState = getStoredState(user?.id);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<ComparePlatform>(storedState?.platform ?? 'vk');
  const [period, setPeriod] = useState<AnalyticsPeriod>(storedState?.period ?? 'month');
  const [sortBy, setSortBy] = useState<CompareSort>('actions');
  const [searchResults, setSearchResults] = useState<CompareChannel[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<CompareChannel[]>(storedState?.selectedGroups ?? []);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const searchRequest = useRef(0);
  const compareRequest = useRef(0);
  const requestContext = useRef({ platform, selectedGroups });

  useEffect(() => {
    requestContext.current = { platform, selectedGroups };
  }, [platform, selectedGroups]);

  useEffect(() => {
    if (!user?.id) return;
    const state: StoredCompareState = { version: 1, platform, period, selectedGroups };
    window.localStorage.setItem(`${COMPARE_STORAGE_PREFIX}${user.id}`, JSON.stringify(state));
  }, [period, platform, selectedGroups, user?.id]);

  const savedGroups = useMemo(() => Array.from(new Map(groups.map(accountToCompareChannel).filter((group): group is CompareChannel => group !== null && group.platform === platform).map((group) => [`${group.platform}:${group.id}`, group])).values()), [groups, platform]);

  const comparedItems = useMemo<ComparedItem[]>(() => {
    const items = (compare?.items.filter((item): item is ComparedItem => Boolean(item.analytics)) ?? []).slice();

    return items.sort((left, right) => getSortValue(right.analytics!, sortBy) - getSortValue(left.analytics!, sortBy));
  }, [compare, sortBy]);
  const failedItems = compare?.items.filter((item) => item.error) ?? [];
  const compareChartData = comparedItems.map((item) => ({
    id: `${item.analytics.platform ?? 'vk'}:${item.groupId}`,
    name: item.analytics.group.name,
    reactions: item.analytics.wall.actions,
    er: item.analytics.wall.erAverage,
    averageViews: item.analytics.wall.averageViewsPerPost
  }));

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeQuery(query);

    if (!normalized) {
      setSearchError('Введите название или адрес сообщества.');
      return;
    }

    const requestId = ++searchRequest.current;
    const requestedPlatform = platform;
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      if (requestedPlatform === 'telegram') {
        const channel = await apiGet<TelegramAnalytics['channel']>(`/api/telegram/channels/resolve?q=${encodeURIComponent(query.trim())}`);
        if (requestId === searchRequest.current && requestContext.current.platform === requestedPlatform) {
          setSearchResults([{ id: channel.username, name: channel.title, platform: 'telegram', screen_name: channel.username, photo_100: channel.photo, members_count: channel.subscribers }]);
        }
      } else if (requestedPlatform === 'youtube') {
        const data = await apiGet<VkListResponse<YoutubeChannel>>(`/api/youtube/channels/search?q=${encodeURIComponent(query.trim())}`);
        if (requestId === searchRequest.current && requestContext.current.platform === requestedPlatform) {
          setSearchResults(data.items.map((item) => ({ id: item.id, name: item.name, platform: 'youtube', screen_name: item.handle, photo_100: item.photo, members_count: item.followersCount })));
        }
      } else {
        const data = await apiGet<VkListResponse<VkGroup>>(`/api/vk/groups/search?q=${encodeURIComponent(normalized)}&count=10`);
        if (requestId === searchRequest.current && requestContext.current.platform === requestedPlatform) {
          setSearchResults(data.items.map((item) => ({ ...item, platform: 'vk' })));
        }
      }
    } catch (error) {
      if (requestId === searchRequest.current && requestContext.current.platform === requestedPlatform) setSearchError(error instanceof Error ? error.message : 'Не удалось найти сообщества.');
    } finally {
      if (requestId === searchRequest.current && requestContext.current.platform === requestedPlatform) setIsSearching(false);
    }
  };

  const addGroup = (group: CompareChannel) => {
    setSelectionError(null);

    if (selectedGroups.some((item) => item.platform === group.platform && item.id === group.id)) {
      setSelectionError('Этот аккаунт уже добавлен в сравнение.');
      return;
    }

    if (selectedGroups.length >= 10) {
      setSelectionError('Можно сравнить не более 10 аккаунтов. Удалите один, чтобы добавить другой.');
      return;
    }

    setSelectedGroups((current) => [...current, group]);
    setCompare(null);
    setCompareError(null);
    compareRequest.current += 1;
  };

  const removeGroup = (target: CompareChannel) => {
    setSelectedGroups((groups) => groups.filter((group) => group.platform !== target.platform || group.id !== target.id));
    setCompare(null);
    setCompareError(null);
    compareRequest.current += 1;
  };

  const clearGroups = () => {
    setSelectedGroups([]);
    setCompare(null);
    setSelectionError(null);
    setCompareError(null);
    compareRequest.current += 1;
  };

  const changePlatform = (nextPlatform: ComparePlatform) => {
    if (nextPlatform === platform) return;
    searchRequest.current += 1;
    setPlatform(nextPlatform);
    setSearchResults([]);
    setHasSearched(false);
    setSearchError(null);
    setIsSearching(false);
  };

  const changePeriod = (nextPeriod: AnalyticsPeriod) => {
    setPeriod(nextPeriod);
    setCompare(null);
    setCompareError(null);
  };

  const runCompare = async () => {
    if (selectedGroups.length < 2) {
      setCompareError('Добавьте минимум два аккаунта для сравнения.');
      return;
    }

    const requestId = ++compareRequest.current;
    const requestedSources = comparisonSources(selectedGroups);
    setIsComparing(true);
    setCompareError(null);

    try {
      const data = await apiGet<CompareResult>(
        `/api/compare?sources=${encodeURIComponent(requestedSources)}&period=${encodeURIComponent(period)}`
      );
      if (requestId === compareRequest.current && comparisonSources(requestContext.current.selectedGroups) === requestedSources) setCompare(data);
    } catch (error) {
      if (requestId === compareRequest.current && comparisonSources(requestContext.current.selectedGroups) === requestedSources) {
        setCompare(null);
        setCompareError(error instanceof Error ? error.message : 'Не удалось сравнить аккаунты.');
      }
    } finally {
      if (requestId === compareRequest.current) setIsComparing(false);
    }
  };

  const renderGroupCell = (item: CommunityAnalytics) => (
    <span className="compare-group-cell">
      <span className="compare-avatar">{item.group.photo ? <img src={item.group.photo} alt="" /> : <span className="community-avatar-placeholder" />}<ComparePlatformIcon platform={item.platform ?? 'vk'} /></span>
      <span>
        <strong>{item.group.name}</strong>
        <small>{item.group.membersCount === null ? 'Подписчики: Недоступно' : `${formatNumber(item.group.membersCount)} ${item.platform === 'vk' ? 'участников' : 'подписчиков'}`}</small>
      </span>
    </span>
  );

  return (
    <section className="page-grid">
      <div className="panel compare-setup">
        <div className="compare-setup-heading">
          <div><h2>Сравните бренд с конкурентами</h2><p>Сравните вовлечённость, просмотры и публикации — найдите идеи для своего контента.</p></div>
          {selectedGroups.length > 0 && <button className="compare-reset" type="button" onClick={clearGroups} disabled={isComparing}>Новое сравнение</button>}
        </div>

        <div className="compare-platforms" role="group" aria-label="Платформа">
          <button className={platform === 'vk' ? 'active' : undefined} type="button" onClick={() => changePlatform('vk')} disabled={isComparing}>ВКонтакте</button>
          <button className={platform === 'youtube' ? 'active' : undefined} type="button" onClick={() => changePlatform('youtube')} disabled={isComparing}>YouTube</button>
          <button className={platform === 'telegram' ? 'active' : undefined} type="button" onClick={() => changePlatform('telegram')} disabled={isComparing}>Telegram</button>
        </div>

        <form className="compare-search-form" onSubmit={search}>
          <label htmlFor="compare-search">Кого сравниваем?</label>
          <div><input id="compare-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={platform === 'youtube' ? 'URL, @handle, channel ID или название' : platform === 'telegram' ? '@username или ссылка t.me' : 'Название, screen name или ссылка VK'} /><button type="submit" disabled={isSearching || isComparing}><Search size={18} />{isSearching ? 'Ищем' : 'Найти'}</button></div>
          {searchError && <div className="form-message" role="alert">{searchError} <button type="button" onClick={() => document.getElementById('compare-search')?.closest('form')?.requestSubmit()}>Повторить</button></div>}
        </form>

        {isSearching && <div className="compare-feedback" aria-live="polite">Ищем аккаунты…</div>}
        {!isSearching && !searchError && hasSearched && searchResults.length === 0 && <div className="compare-feedback">Ничего не найдено. Попробуйте другое название или ссылку.</div>}
        {searchResults.length > 0 && <div className="compare-options" aria-label="Результаты поиска">{searchResults.map((group) => {
          const isAdded = selectedGroups.some((item) => item.id === group.id && item.platform === group.platform);
          return <div className="compare-option" key={`${group.platform}:${group.id}`}>{group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}</small></span><button type="button" onClick={() => addGroup(group)} disabled={isAdded || selectedGroups.length >= 10 || isComparing}>{isAdded ? 'Добавлено' : 'Добавить'}</button></div>;
        })}</div>}

        {savedGroups.length > 0 && <div className="compare-saved"><strong>Сохранённые аккаунты</strong><div className="compare-options">{savedGroups.map((group) => {
          const isAdded = selectedGroups.some((item) => item.id === group.id && item.platform === group.platform);
          return <div className="compare-option" key={`saved:${group.platform}:${group.id}`}>{group.photo_100 ? <img src={group.photo_100} alt="" /> : <span className="community-avatar-placeholder" />}<span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}</small></span><button type="button" onClick={() => addGroup(group)} disabled={isAdded || selectedGroups.length >= 10 || isComparing}>{isAdded ? 'Добавлено' : 'Добавить'}</button></div>;
        })}</div></div>}

        <p className="compare-hint">{selectedGroups.length === 1 ? 'Добавьте ещё один аккаунт для сравнения' : 'Добавьте от 2 до 10 аккаунтов'}</p>
        {selectionError && <div className="form-message" role="alert">{selectionError}</div>}

        {selectedGroups.length > 0 && <div className="compare-selected" aria-label="Выбранные аккаунты">{selectedGroups.map((group) => <div className="compare-selected-card" key={`${group.platform}:${group.id}`}><span className="compare-avatar">{group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<ComparePlatformIcon platform={group.platform} /></span><span><strong title={group.name}>{group.name}</strong></span><button className="icon-button danger" type="button" aria-label={`Удалить «${group.name}» из сравнения`} onClick={() => removeGroup(group)} disabled={isComparing}><X size={17} /></button></div>)}</div>}

        {selectedGroups.length >= 2 && <div className="compare-run"><div className="period-tabs">{periods.map((item) => <button className={period === item.key ? 'active' : undefined} key={item.key} type="button" onClick={() => changePeriod(item.key)} disabled={isComparing}>{item.label}</button>)}</div><button className="primary-button compare-submit" type="button" onClick={runCompare} disabled={isComparing}><BarChart3 size={18} />{isComparing ? 'Сравниваем выбранные аккаунты…' : `Сравнить ${selectedGroups.length} ${accountWord(selectedGroups.length)}`}</button>{compareError && <div className="form-message" role="alert">{compareError} <button type="button" onClick={() => void runCompare()}>Повторить</button></div>}</div>}
      </div>

      {compare && (
        <div className="panel span-2">
          <div className="panel-header compact">
            <div>
              <h2>Результаты сравнения</h2>
            <p>Сравнение построено по доступным данным выбранных источников за указанный период. Для YouTube и Telegram используются публичные показатели.</p>
            </div>
          </div>

          {failedItems.map((item) => (
            <div className="debug-error" key={`${item.platform ?? 'vk'}:${item.groupId}`}>
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

              <section className="compare-table-card" aria-labelledby="compare-engagement-title">
                <h3 className="compare-table-title" id="compare-engagement-title">Вовлечённость</h3>
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
                  <div className="table-row compare-row activity" key={`${item.analytics.platform ?? 'vk'}:${item.groupId}`}>
                    {renderGroupCell(item.analytics)}
                    <span>{formatNumber(item.analytics.wall.actions)}</span>
                    <span>{item.analytics.wall.averageActionsPerPost}</span>
                    <span>{item.analytics.wall.averageActionsPerDay}</span>
                    <span>{formatNumber(item.analytics.wall.likes)}</span>
                    <span>{item.analytics.platform === 'youtube' ? 'Недоступно' : formatNumber(item.analytics.wall.reposts)}</span>
                    <span>{formatNumber(item.analytics.wall.comments)}</span>
                  </div>
                ))}
                </div>
              </section>

              <section className="compare-table-card" aria-labelledby="compare-reach-title">
                <h3 className="compare-table-title" id="compare-reach-title">Просмотры и публикации</h3>
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
                  <div className="table-row compare-row reach" key={`${item.analytics.platform ?? 'vk'}:${item.groupId}`}>
                    {renderGroupCell(item.analytics)}
                    <span>{formatNumber(item.analytics.wall.averageViewsPerPost)}</span>
                    <span>{formatNumber(item.analytics.wall.maxViews)}</span>
                    <span>{formatNumber(item.analytics.wall.minViews)}</span>
                    <span>{item.analytics.platform === 'youtube' ? 'Недоступно' : formatNumber(item.analytics.wall.adsPosts)}</span>
                    <span>{formatNumber(item.analytics.wall.periodPosts)}</span>
                  </div>
                ))}
                </div>
              </section>

              <section className="compare-table-card" aria-labelledby="compare-content-title">
                <h3 className="compare-table-title" id="compare-content-title">Форматы и ER</h3>
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
                  <div className="table-row compare-row content" key={`${item.analytics.platform ?? 'vk'}:${item.groupId}`}>
                    {renderGroupCell(item.analytics)}
                    <span>{item.analytics.wall.availability?.er === false ? 'Недоступно' : `${formatPercent(item.analytics.wall.erAverage)}%`}</span>
                    <span>{item.analytics.wall.availability?.er === false ? 'Недоступно' : `${formatPercent(item.analytics.wall.erMax)}%`}</span>
                    <span>{formatNumber(item.analytics.photos.period)}</span>
                    <span>{formatNumber(item.analytics.videos.period)}</span>
                    <span>{item.analytics.warnings.length ? item.analytics.warnings.length : 'нет'}</span>
                  </div>
                ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getSortValue(analytics: CommunityAnalytics, sortBy: CompareSort) {
  if (sortBy === 'membersCount') {
    return analytics.group.membersCount ?? -1;
  }

  return analytics.wall[sortBy];
}
