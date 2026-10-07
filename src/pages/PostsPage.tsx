import { Button } from '@alfalab/core-components-button';
import { Input } from '@alfalab/core-components-input';
import { Select } from '@alfalab/core-components-select';
import { ArrowDownUp, BookmarkPlus, FileText } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/client';
import type { AnalyticsPeriod, ComparisonCollection, PostsAnalysisPost, PostsAnalysisResult, SavedGroup } from '../api/types';
import { PostCard } from '../components/PostCard';
import { CollectionSaveActions, SourceSetup, matchingCollection, pickUnambiguousSource, searchSources, sourceKey, type SourceChannel, type SourceExample } from '../components/SourceSetup';
import { detectPlatform } from '../utils/sourceQuery';

const periods: Array<{ key: AnalyticsPeriod; label: string }> = [
  { key: 'week', label: '7 дней' },
  { key: 'twoWeek', label: '14 дней' },
  { key: 'month', label: '30 дней' }
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
const postsExample: SourceExample = {
  label: 'Лучшие посты РБК, ТАСС и РИА Новости',
  sources: [{ platform: 'telegram', query: 'rbc_news' }, { platform: 'telegram', query: 'tass_agency' }, { platform: 'telegram', query: 'rian_ru' }]
};

type PostSort = (typeof sortOptions)[number]['key'];
type PostFilter = (typeof filterOptions)[number]['key'];
type PostsChannel = SourceChannel;
type PostsPlatform = PostsChannel['platform'];
type Props = { groups: SavedGroup[] };

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
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
  const [openedCollectionId, setOpenedCollectionId] = useState<string | null>(null);
  // Открытая подборка: та, что выбрали из списка, или та, с которой совпадает текущий выбор.
  const openedCollection = selectedGroups.length ? collections.find((item) => item.id === openedCollectionId) ?? matchingCollection(collections, selectedGroups) : undefined;
  const collectionChanged = Boolean(openedCollection && (!matchingCollection([openedCollection], selectedGroups) || openedCollection.period !== period));
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(true);
  const searchRequest = useRef(0);

  const savedGroups = useMemo(
    () => Array.from(new Map(
      groups
        .map(accountToPostsChannel)
        .filter((group): group is PostsChannel => group !== null)
        .map((group) => [`${group.platform}:${group.id}`, group])
    ).values()),
    [groups]
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
    const text = query.trim();

    if (!text) {
      setMessage('Вставьте ссылку или введите название канала.');
      return;
    }

    const detectedPlatform = detectPlatform(text);
    const requestedPlatform = detectedPlatform ?? platform;
    const requestId = ++searchRequest.current;
    setPlatform(requestedPlatform);
    setIsSearching(true);
    setMessage(null);
    setSearchResults([]);
    setHasSearched(true);

    try {
      const results = await searchSources(text, requestedPlatform);
      if (requestId !== searchRequest.current) return;
      const match = pickUnambiguousSource(results, text, requestedPlatform, Boolean(detectedPlatform));
      if (match) {
        addGroup(match);
        setQuery('');
        setHasSearched(false);
        return;
      }
      setSearchResults(results);
    } catch (error) {
      if (requestId === searchRequest.current) setMessage(error instanceof Error ? error.message : 'Не удалось найти сообщества.');
    } finally {
      if (requestId === searchRequest.current) setIsSearching(false);
    }
  };

  const openExample = async () => {
    const requestId = ++searchRequest.current;
    setIsSearching(true);
    setMessage(null);
    try {
      const results = await Promise.all(postsExample.sources.map((source) => searchSources(source.query, source.platform).then((items) => items[0])));
      if (requestId !== searchRequest.current) return;
      const exampleGroups = results.filter((group): group is PostsChannel => Boolean(group));
      setSelectedGroups(exampleGroups);
      setOpenedCollectionId(null);
      void runAnalysis(exampleGroups);
    } catch (error) {
      if (requestId === searchRequest.current) setMessage(error instanceof Error ? error.message : 'Не удалось загрузить пример.');
    } finally {
      if (requestId === searchRequest.current) setIsSearching(false);
    }
  };

  const addGroup = (group: PostsChannel) => {
    setMessage(null);

    if (selectedGroups.some((item) => sourceKey(item) === sourceKey(group))) {
      setMessage('Этот источник уже добавлен в анализ публикаций.');
      return;
    }

    if (selectedGroups.length >= 10) {
      setMessage('Можно анализировать не более 10 источников.');
      return;
    }

    setSelectedGroups((current) => [...current, group]);
    setSearchResults([]);
    setAnalysis(null);
  };

  const removeGroup = (target: PostsChannel) => {
    setSelectedGroups((groups) => groups.filter((group) => group.platform !== target.platform || group.id !== target.id));
    setAnalysis(null);
  };

  const clearGroups = () => {
    setSelectedGroups([]);
    setOpenedCollectionId(null);
    setAnalysis(null);
    setMessage(null);
  };

  const changePlatform = (nextPlatform: PostsPlatform) => {
    if (nextPlatform === platform) return;
    searchRequest.current += 1;
    setPlatform(nextPlatform);
    setSearchResults([]);
    setMessage(null);
    setHasSearched(false);
    setIsSearching(false);
  };

  const applyCollection = (collection: ComparisonCollection) => {
    const nextPlatform = collection.sources[0]?.platform;
    if (!nextPlatform) {
      setCollectionsError('В подборке нет источников.');
      return;
    }
    setPlatform(nextPlatform);
    setPeriod(collection.period);
    setOpenedCollectionId(collection.id);
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
      setOpenedCollectionId(collection.id);
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

  const updateCollection = async () => {
    if (!openedCollection) return;
    if (selectedGroups.length < 2) {
      setCollectionsError('Добавьте минимум два источника, чтобы сохранить подборку.');
      return;
    }
    try {
      const updated = await apiPatch<ComparisonCollection>(`/api/account/comparison-collections/${openedCollection.id}?purpose=posts`, { name: openedCollection.name, period, sources: selectedGroups.map((group) => ({ platform: group.platform, externalId: String(group.id), name: group.name, handle: group.screen_name, photo: group.photo_100 ?? group.photo_50, membersCount: group.members_count })) });
      setCollections((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      setOpenedCollectionId(updated.id);
      setCollectionsError(null);
    } catch (error) {
      setCollectionsError(error instanceof Error ? error.message : 'Не удалось обновить подборку.');
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

  const runAnalysis = async (groupsToAnalyze: PostsChannel[] = selectedGroups) => {
    if (groupsToAnalyze.length === 0) {
      setMessage('Добавьте хотя бы одно сообщество для анализа.');
      return;
    }

    setIsAnalyzing(true);
    setMessage(null);

    try {
      const sources = groupsToAnalyze.map((group) => `${group.platform}:${group.id}`).join(',');
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
      <SourceSetup
        title="Лучшие публикации"
        description="Соберите до 10 групп и каналов своей ниши и отсортируйте их публикации по вовлечённости — готовые идеи для контент-плана."
        summaryTitle="Что анализируем"
        minSources={1}
        query={query}
        platform={platform}
        isSearching={isSearching}
        searchResults={searchResults}
        searchMessage={<>
          {message && <div className="form-message" role="alert">{message}</div>}
          {!isSearching && !message && hasSearched && searchResults.length === 0 && <div className="posts-feedback">Ничего не найдено. Попробуйте другое название или ссылку.</div>}
          {collectionsError && <div className="form-message" role="alert">{collectionsError}</div>}
        </>}
        selected={selectedGroups}
        savedGroups={savedGroups}
        collections={isCollectionsLoading ? [] : postsCollections}
        example={postsExample}
        disabled={isAnalyzing}
        onQueryChange={setQuery}
        onPlatformChange={changePlatform}
        onSearch={search}
        onAdd={addGroup}
        onRemove={removeGroup}
        onClear={clearGroups}
        onExample={() => void openExample()}
        onApplyCollection={applyCollection}
        onRenameCollection={(collection) => void renameCollection(collection)}
        onDeleteCollection={(collection) => void deleteCollection(collection)}
        activeCollection={openedCollection && { name: openedCollection.name, changed: collectionChanged }}
      >
        {selectedGroups.length > 0 && <div className="source-summary-footer">
          <span className="source-row-title">Период публикаций</span>
          <div className="period-tabs">{periods.map((item) => <Button className={period === item.key ? 'brand-primary-button' : ''} view={period === item.key ? 'primary' : 'secondary'} key={item.key} type="button" size={32} onClick={() => { setPeriod(item.key); setAnalysis(null); }} disabled={isAnalyzing}>{item.label}</Button>)}</div>
          <Button block className="brand-primary-button" type="button" view="primary" size={48} leftAddons={<FileText size={18} />} onClick={() => void runAnalysis()} loading={isAnalyzing}>{`Показать публикации · ${selectedGroups.length} ${sourceWord(selectedGroups.length)}`}</Button>
          {selectedGroups.length >= 2 && <CollectionSaveActions collection={openedCollection} changed={collectionChanged} disabled={isAnalyzing} onSave={() => void saveCollection()} onUpdate={() => void updateCollection()} />}
        </div>}
      </SourceSetup>

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
