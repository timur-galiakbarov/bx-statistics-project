import { Button } from '@alfalab/core-components-button';
import { IconButton } from '@alfalab/core-components-icon-button';
import { Input } from '@alfalab/core-components-input';
import { Select } from '@alfalab/core-components-select';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { ArrowDownUp, BookmarkPlus, FileText, FolderOpen, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';
import type { AnalyticsPeriod, ComparisonCollection, PostsAnalysisPost, PostsAnalysisResult, SavedGroup, TelegramAnalytics, VkGroup, VkListResponse, YoutubeChannel } from '../api/types';
import { PostCard } from '../components/PostCard';
import { PlatformSegmentTitle } from '../components/PlatformSegmentTitle';

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
type PostsChannel = { id: string | number; name: string; platform: 'vk' | 'youtube' | 'telegram'; screen_name?: string; photo_50?: string; photo_100?: string; members_count?: number | null };
type PostsPlatform = PostsChannel['platform'];
type Props = { groups: SavedGroup[] };

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

function accountToPostsChannel(group: SavedGroup): PostsChannel | null {
  if (group.platform !== 'vk' && group.platform !== 'youtube' && group.platform !== 'telegram') return null;
  return {
    id: group.platform === 'telegram' ? group.handle ?? group.externalId : group.externalId,
    name: group.name,
    platform: group.platform,
    screen_name: group.handle,
    photo_100: group.photo,
    members_count: group.membersCount ?? group.followersCount
  };
}

function PostsPlatformIcon({ platform }: { platform: PostsPlatform }) {
  return <img className="posts-platform-icon" src={platform === 'youtube' ? '/youtube-logo.png' : platform === 'telegram' ? '/telegram-logo.svg' : '/vk-network-logo.png'} alt="" />;
}

function sourceWord(count: number) {
  const remainder = count % 100;
  if (remainder >= 11 && remainder <= 14) return 'источников';
  if (count % 10 === 1) return 'источник';
  if (count % 10 >= 2 && count % 10 <= 4) return 'источника';
  return 'источников';
}

function publicationWord(count: number) {
  const remainder = count % 100;
  if (remainder >= 11 && remainder <= 14) return 'публикаций';
  if (count % 10 === 1) return 'публикация';
  if (count % 10 >= 2 && count % 10 <= 4) return 'публикации';
  return 'публикаций';
}

export function PostsPage({ groups }: Props) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PostsPlatform>('vk');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [sortBy, setSortBy] = useState<PostSort>('likes');
  const [filterBy, setFilterBy] = useState<PostFilter>('all');
  const [visibleCount, setVisibleCount] = useState(POSTS_PAGE_SIZE);
  const [searchResults, setSearchResults] = useState<PostsChannel[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<PostsChannel[]>([]);
  const [analysis, setAnalysis] = useState<PostsAnalysisResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [collections, setCollections] = useState<ComparisonCollection[]>([]);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(true);
  const searchRequest = useRef(0);

  const savedGroups = useMemo(
    () => Array.from(new Map(
      groups
        .map(accountToPostsChannel)
        .filter((group): group is PostsChannel => group?.platform === platform)
        .map((group) => [`${group.platform}:${group.id}`, group])
    ).values()),
    [groups, platform]
  );
  const postsCollections = collections;

  const sortedPosts = useMemo(() => {
    const posts = analysis?.posts ?? [];

    return posts
      .filter((post) => postMatchesFilter(post, filterBy))
      .sort((left, right) => getPostSortValue(right, sortBy) - getPostSortValue(left, sortBy));
  }, [analysis?.posts, filterBy, sortBy]);
  const visiblePosts = sortedPosts.slice(0, visibleCount);
  const hiddenPostsCount = Math.max(sortedPosts.length - visiblePosts.length, 0);
  const selectedPlatforms = new Set(selectedGroups.map((group) => group.platform));
  const isTelegramOnly = selectedPlatforms.size === 1 && selectedPlatforms.has('telegram');
  const includesTelegramSelection = selectedPlatforms.has('telegram');
  const includesYoutubeSelection = selectedPlatforms.has('youtube');
  const availableFilterOptions = isTelegramOnly
    ? filterOptions.filter((option) => option.key !== 'gif' && option.key !== 'ad')
    : filterOptions;
  const sortSelectOptions = sortOptions.map((option) => ({
    key: option.key,
    content: includesTelegramSelection && option.key === 'likes'
      ? selectedPlatforms.size > 1 ? 'Лайки / реакции' : 'Реакции'
      : includesTelegramSelection && option.key === 'reposts'
        ? selectedPlatforms.size > 1 ? 'Репосты / пересылки' : 'Пересылки'
        : option.label
  }));

  useEffect(() => {
    setVisibleCount(POSTS_PAGE_SIZE);
  }, [analysis, filterBy, sortBy]);

  useEffect(() => {
    apiGet<ComparisonCollection[]>('/api/account/comparison-collections?purpose=posts')
      .then(setCollections)
      .catch((error) => setCollectionsError(error instanceof Error ? error.message : 'Не удалось загрузить подборки.'))
      .finally(() => setIsCollectionsLoading(false));
  }, []);

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
    setHasSearched(true);
    const requestId = ++searchRequest.current;
    const requestedPlatform = platform;

    try {
      if (requestedPlatform === 'telegram') {
        const channel = await apiGet<TelegramAnalytics['channel']>(`/api/telegram/channels/resolve?q=${encodeURIComponent(query.trim())}`);
        if (requestId === searchRequest.current) setSearchResults([{ id: channel.username, name: channel.title, platform: 'telegram', screen_name: channel.username, photo_100: channel.photo, members_count: channel.subscribers }]);
      } else if (requestedPlatform === 'youtube') {
        const data = await apiGet<VkListResponse<YoutubeChannel>>(`/api/youtube/channels/search?q=${encodeURIComponent(query.trim())}`);
        if (requestId === searchRequest.current) setSearchResults(data.items.map((item) => ({ id: item.id, name: item.name, platform: 'youtube', screen_name: item.handle, photo_100: item.photo, members_count: item.followersCount })));
      } else {
        const data = await apiGet<VkListResponse<VkGroup>>(`/api/vk/groups/search?q=${encodeURIComponent(normalized)}&count=10`);
        if (requestId === searchRequest.current) setSearchResults(data.items.map((item) => ({ ...item, platform: 'vk' })));
      }
    } catch (error) {
      if (requestId === searchRequest.current) setMessage(error instanceof Error ? error.message : 'Не удалось найти сообщества.');
    } finally {
      if (requestId === searchRequest.current) setIsSearching(false);
    }
  };

  const addGroup = (group: PostsChannel) => {
    setMessage(null);

    if (selectedGroups.some((item) => item.platform === group.platform && item.id === group.id)) {
      setMessage('Этот источник уже добавлен в анализ публикаций.');
      return;
    }

    if (selectedGroups.length >= 10) {
      setMessage('Можно анализировать не более 10 источников.');
      return;
    }

    setSelectedGroups((current) => [...current, group]);
    setAnalysis(null);
  };

  const removeGroup = (target: PostsChannel) => {
    setSelectedGroups((groups) => groups.filter((group) => group.platform !== target.platform || group.id !== target.id));
    setAnalysis(null);
  };

  const clearGroups = () => {
    setSelectedGroups([]);
    setAnalysis(null);
    setMessage(null);
  };

  const changePlatform = (nextPlatform: PostsPlatform) => {
    if (nextPlatform === platform) return;
    searchRequest.current += 1;
    setPlatform(nextPlatform);
    setSearchResults([]);
    setAnalysis(null);
    setMessage(null);
    setHasSearched(false);
    setIsSearching(false);
    setFilterBy('all');
  };

  const applyCollection = (collection: ComparisonCollection) => {
    const nextPlatform = collection.sources[0]?.platform;
    if (!nextPlatform) {
      setCollectionsError('В подборке нет источников.');
      return;
    }
    setPlatform(nextPlatform);
    setPeriod(collection.period);
    setSelectedGroups(collection.sources.map((source) => ({
      id: source.platform === 'telegram' ? source.handle ?? source.externalId : source.externalId,
      name: source.name,
      platform: source.platform,
      screen_name: source.handle,
      photo_100: source.photo,
      members_count: source.membersCount
    })));
    setSearchResults([]);
    setHasSearched(false);
    setMessage(null);
    setCollectionsError(null);
    setAnalysis(null);
    setFilterBy('all');
  };

  const saveCollection = async () => {
    if (selectedGroups.length < 2) {
      setCollectionsError('Добавьте минимум два источника, чтобы сохранить подборку.');
      return;
    }
    const name = window.prompt('Название подборки');
    if (!name?.trim()) return;
    try {
      const collection = await apiPost<ComparisonCollection>('/api/account/comparison-collections', {
        purpose: 'posts',
        name,
        period,
        sources: selectedGroups.map((group) => ({ platform: group.platform, externalId: String(group.id), name: group.name, handle: group.screen_name, photo: group.photo_100 ?? group.photo_50, membersCount: group.members_count }))
      });
      setCollections((current) => [collection, ...current]);
      setCollectionsError(null);
    } catch (error) {
      setCollectionsError(error instanceof Error ? error.message : 'Не удалось сохранить подборку.');
    }
  };

  const renameCollection = async (collection: ComparisonCollection) => {
    const name = window.prompt('Новое название подборки', collection.name);
    if (!name?.trim() || name.trim() === collection.name) return;
    try {
      const updated = await apiPatch<ComparisonCollection>(`/api/account/comparison-collections/${collection.id}?purpose=posts`, { name });
      setCollections((current) => current.map((item) => item.id === updated.id ? updated : item));
      setCollectionsError(null);
    } catch (error) {
      setCollectionsError(error instanceof Error ? error.message : 'Не удалось переименовать подборку.');
    }
  };

  const deleteCollection = async (collection: ComparisonCollection) => {
    if (!window.confirm(`Удалить подборку «${collection.name}»?`)) return;
    try {
      await apiDelete(`/api/account/comparison-collections/${collection.id}?purpose=posts`);
      setCollections((current) => current.filter((item) => item.id !== collection.id));
      setCollectionsError(null);
    } catch (error) {
      setCollectionsError(error instanceof Error ? error.message : 'Не удалось удалить подборку.');
    }
  };

  const runAnalysis = async () => {
    if (selectedGroups.length === 0) {
      setMessage('Добавьте хотя бы одно сообщество для анализа.');
      return;
    }

    setIsAnalyzing(true);
    setMessage(null);

    try {
      const sources = selectedGroups.map((group) => `${group.platform}:${group.id}`).join(',');
      const data = await apiGet<PostsAnalysisResult>(
        `/api/posts/analyze?sources=${encodeURIComponent(sources)}&period=${encodeURIComponent(period)}`
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
    <section className="page-grid posts-page">
      <div className="panel posts-setup">
        <div className="posts-setup-heading">
          <div>
            <h2>Анализ публикаций</h2>
            <p>Соберите до 10 сообществ или каналов и найдите публикации с лучшей вовлечённостью.</p>
          </div>
          {selectedGroups.length > 0 && <Button type="button" view="secondary" size={40} leftAddons={<RotateCcw size={16} />} onClick={clearGroups} disabled={isAnalyzing}>Начать заново</Button>}
        </div>

        <SegmentedControl className="social-platform-switcher" selectedId={platform} size={40} disabled={isAnalyzing} onChange={(id) => changePlatform(id as PostsPlatform)}>
          <Segment id="vk" title={<PlatformSegmentTitle platform="vk" />} />
          <Segment id="youtube" title={<PlatformSegmentTitle platform="youtube" />} />
          <Segment id="telegram" title={<PlatformSegmentTitle platform="telegram" />} />
        </SegmentedControl>

        <form className="posts-search-form" onSubmit={search}>
          <label htmlFor="posts-search">Найдите источник</label>
          <div>
            <Input
              block
              className="posts-search-input"
              id="posts-search"
              value={query}
              onChange={(_, payload) => setQuery(payload.value)}
              placeholder={platform === 'youtube' ? 'URL, @handle, channel ID или название' : platform === 'telegram' ? '@username или ссылка t.me' : 'Название, screen name или ссылка VK'}
            />
            <Button className="brand-primary-button" type="submit" view="primary" size={48} leftAddons={<Search size={18} />} loading={isSearching} disabled={isAnalyzing}>Найти</Button>
          </div>
        </form>

        {message && <div className="form-message" role="alert">{message}</div>}
        {!isSearching && !message && hasSearched && searchResults.length === 0 && <div className="posts-feedback">Ничего не найдено. Попробуйте другое название или ссылку.</div>}

        {searchResults.length > 0 && <div className="posts-source-section"><strong>Результаты поиска</strong><div className="compare-options">{searchResults.map((group) => {
          const isAdded = selectedGroups.some((item) => item.platform === group.platform && item.id === group.id);
          return <div className="compare-option" key={`${group.platform}:${group.id}`}>{group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}{group.members_count ? ` · ${formatNumber(group.members_count)} ${platform === 'vk' ? 'участников' : 'подписчиков'}` : ''}</small></span><Button type="button" view="secondary" size={40} onClick={() => addGroup(group)} disabled={isAdded || selectedGroups.length >= 10 || isAnalyzing}>{isAdded ? 'Добавлено' : 'Добавить'}</Button></div>;
        })}</div></div>}

        {savedGroups.length > 0 && <div className="posts-source-section posts-saved"><strong>Ваши сохранённые источники</strong><div className="compare-options">{savedGroups.map((group) => {
          const isAdded = selectedGroups.some((item) => item.platform === group.platform && item.id === group.id);
          return <div className="compare-option" key={`saved:${group.platform}:${group.id}`}>{group.photo_100 ? <img src={group.photo_100} alt="" /> : <span className="community-avatar-placeholder" />}<span><strong>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}</small></span><Button type="button" view="secondary" size={40} onClick={() => addGroup(group)} disabled={isAdded || selectedGroups.length >= 10 || isAnalyzing}>{isAdded ? 'Добавлено' : 'Добавить'}</Button></div>;
        })}</div></div>}

        <div className="posts-selection-heading"><strong>Выбрано для анализа</strong><span>{selectedGroups.length} из 10</span></div>
        {selectedGroups.length > 0 ? <div className="posts-selected">{selectedGroups.map((group) => <div className="posts-selected-card" key={`${group.platform}:${group.id}`}><span className="posts-avatar">{group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}<PostsPlatformIcon platform={group.platform} /></span><span><strong title={group.name}>{group.name}</strong><small>{group.screen_name ? `@${group.screen_name}` : `id${group.id}`}</small></span><IconButton aria-label={`Удалить «${group.name}» из анализа`} icon={X} onClick={() => removeGroup(group)} disabled={isAnalyzing} size={32} view="transparent" /></div>)}</div> : <div className="posts-empty-selection">Добавьте хотя бы один источник из поиска или сохранённого списка.</div>}

        {selectedGroups.length > 0 && <div className="posts-run"><div><strong>Период публикаций</strong><div className="period-tabs">{periods.map((item) => <Button className={period === item.key ? 'brand-primary-button' : ''} view={period === item.key ? 'primary' : 'secondary'} key={item.key} type="button" size={40} onClick={() => { setPeriod(item.key); setAnalysis(null); }} disabled={isAnalyzing}>{item.label}</Button>)}</div></div><Button className="posts-submit brand-primary-button" type="button" view="primary" size={48} leftAddons={<FileText size={18} />} onClick={runAnalysis} loading={isAnalyzing}>{isAnalyzing ? 'Собираем публикации…' : `Проанализировать ${selectedGroups.length}`}</Button></div>}
      </div>

      <aside className="panel compare-collections-panel posts-collections-panel">
        <div className="compare-collections-heading"><span><FolderOpen size={17} />Мои подборки</span><Button type="button" view="secondary" size={40} leftAddons={<BookmarkPlus size={16} />} onClick={() => void saveCollection()} disabled={selectedGroups.length < 2 || isAnalyzing}>Сохранить текущую</Button></div>
        {isCollectionsLoading ? <small>Загружаем подборки…</small> : postsCollections.length > 0 ? <div className="compare-collections-list">{postsCollections.map((collection) => <div className="compare-collection" key={collection.id}><Button className="compare-collection-open" type="button" view="secondary" size={40} onClick={() => applyCollection(collection)} disabled={isAnalyzing}><strong>{collection.name}</strong><small>{collection.sources.length} {sourceWord(collection.sources.length)} · {periods.find((item) => item.key === collection.period)?.label}</small></Button><IconButton aria-label={`Переименовать подборку «${collection.name}»`} className="compare-collection-edit" icon={Pencil} size={32} view="transparent" onClick={() => void renameCollection(collection)} /><IconButton aria-label={`Удалить подборку «${collection.name}»`} className="compare-collection-delete" icon={Trash2} size={32} view="transparent" onClick={() => void deleteCollection(collection)} /></div>)}</div> : <small>Сохраните набор источников, чтобы возвращаться к нему позже.</small>}
        {collectionsError && <div className="form-message" role="alert">{collectionsError}</div>}
      </aside>

      {analysis && (
        <div className="panel span-2 posts-results">
          <div className="posts-results-heading">
            <div>
              <h2>Результаты анализа</h2>
              <p>{new Date(analysis.period.dateFrom).toLocaleDateString('ru-RU')} — {new Date(analysis.period.dateTo).toLocaleDateString('ru-RU')}</p>
            </div>
            <div className="posts-results-meta">
              <span><strong>{analysis.groups.filter((item) => item.summary).length}</strong>{sourceWord(analysis.groups.filter((item) => item.summary).length)}</span>
              <span><strong>{formatNumber(analysis.posts.length)}</strong>{publicationWord(analysis.posts.length)}</span>
            </div>
          </div>

          {includesYoutubeSelection && <div className="form-message">Для YouTube просмотры, лайки и комментарии — текущие накопительные значения видео. Репосты недоступны.</div>}
          {includesTelegramSelection && <div className="form-message">Для Telegram используются публичные реакции, комментарии, пересылки и просмотры публикаций.</div>}

          {analysis.groups.some((item) => item.error) &&
            analysis.groups
              .filter((item) => item.error)
              .map((item) => (
                <div className="debug-error" key={item.groupId}>
                  {item.groupId}: {item.error?.message}
                </div>
              ))}

          <div className="compare-sections">
            <div className="table analytics-posts compare-table-card">
              <div className="table-row table-head posts-group-row">
                <span>Источник</span>
                <span>Посты</span>
                <span>Реакции</span>
                <span>На пост</span>
                <span>Ср. просмотры</span>
                <span>ER ср.</span>
              </div>
              {analysis.groups
                .filter((item) => item.group && item.summary)
                .map((item) => (
                  <div className="table-row posts-group-row" key={item.groupId}>
                    <span className="posts-result-source">
                      <span className="posts-result-source-content">
                        <span className="posts-result-avatar">
                          {item.group?.photo ? <img src={item.group.photo} alt="" /> : <span className="community-avatar-placeholder" />}
                          <PostsPlatformIcon platform={(item.platform ?? item.group?.platform ?? 'vk') as PostsPlatform} />
                        </span>
                        <span className="posts-result-identity">
                          <strong title={item.group?.name}>{item.group?.name}</strong>
                          <small>{item.group?.membersCount === null ? 'Подписчики недоступны' : `${formatNumber(item.group?.membersCount ?? 0)} ${(item.platform ?? item.group?.platform) === 'vk' ? 'участников' : 'подписчиков'}`}</small>
                        </span>
                      </span>
                    </span>
                    <span>{formatNumber(item.summary?.periodPosts ?? 0)}</span>
                    <span>{formatNumber(item.summary?.actions ?? 0)}</span>
                    <span>{formatNumber(item.summary?.averageActionsPerPost ?? 0)}</span>
                    <span>{formatNumber(item.summary?.averageViewsPerPost ?? 0)}</span>
                    <span>{item.summary?.erAverage ?? 0}%</span>
                  </div>
                ))}
            </div>

            <div className="posts-content-heading">
              <div><h3>Все публикации</h3><p>Показано {formatNumber(visiblePosts.length)} из {formatNumber(sortedPosts.length)}</p></div>
              <div className="posts-toolbar"><ArrowDownUp size={16} /><span>Сортировка</span><Select className="analytics-post-sort-select" client="desktop" options={sortSelectOptions} optionsListWidth="content" selected={sortBy} size={40} onChange={({ selected }) => selected && setSortBy(selected.key as PostSort)} /></div>
            </div>

            <div className="post-filter-tabs">
              {availableFilterOptions.map((option) => (
                <Button
                  className={filterBy === option.key ? 'post-filter-button active' : 'post-filter-button'}
                  client="desktop"
                  key={option.key}
                  size={40}
                  type="button"
                  view="secondary"
                  onClick={() => setFilterBy(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {sortedPosts.length === 0 && <div className="empty-state">За выбранный период публикаций нет.</div>}

            {sortedPosts.length > 0 && (
              <>
                <div className="posts-list">
                  {visiblePosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>

                {hiddenPostsCount > 0 && (
                  <Button
                    className="load-more-button"
                    client="desktop"
                    size={40}
                    type="button"
                    view="secondary"
                    onClick={() => setVisibleCount((count) => count + POSTS_PAGE_SIZE)}
                  >
                    Показать ещё {formatNumber(Math.min(hiddenPostsCount, POSTS_PAGE_SIZE))}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
