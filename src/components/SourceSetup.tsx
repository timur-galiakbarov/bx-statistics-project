import { BookmarkPlus, Check, FolderOpen, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { IconButton } from '@alfalab/core-components-icon-button';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { apiGet } from '../api/client';
import type { ComparisonCollection, TelegramAnalytics, VkGroup, VkListResponse, YoutubeChannel } from '../api/types';
import { PlatformSegmentTitle } from './PlatformSegmentTitle';
import { normalizeVkQuery, type SourcePlatform } from '../utils/sourceQuery';

export type SourceChannel = {
  id: string | number;
  name: string;
  platform: SourcePlatform;
  screen_name?: string;
  photo_50?: string;
  photo_100?: string;
  members_count?: number | null;
};

export type SourceExample = { label: string; sources: Array<{ platform: SourcePlatform; query: string }> };

// Каналы Telegram в сравнении и публикациях адресуются по username.
export async function searchSources(text: string, platform: SourcePlatform): Promise<SourceChannel[]> {
  if (platform === 'telegram') {
    const channel = await apiGet<TelegramAnalytics['channel']>(`/api/telegram/channels/resolve?q=${encodeURIComponent(text.trim())}`);
    return [{ id: channel.username, name: channel.title, platform: 'telegram', screen_name: channel.username, photo_100: channel.photo, members_count: channel.subscribers }];
  }
  if (platform === 'youtube') {
    const data = await apiGet<VkListResponse<YoutubeChannel>>(`/api/youtube/channels/search?q=${encodeURIComponent(text.trim())}`);
    return data.items.map((item) => ({ id: item.id, name: item.name, platform: 'youtube', screen_name: item.handle, photo_100: item.photo, members_count: item.followersCount }));
  }
  const data = await apiGet<VkListResponse<VkGroup>>(`/api/vk/groups/search?q=${encodeURIComponent(normalizeVkQuery(text))}&count=10`);
  return data.items.map((item) => ({ ...item, platform: 'vk' }));
}

export function pickUnambiguousSource(results: SourceChannel[], text: string, platform: SourcePlatform, isLink: boolean) {
  if (platform === 'vk') {
    const screenName = normalizeVkQuery(text).toLowerCase();
    return results.find((item) => item.screen_name?.toLowerCase() === screenName);
  }
  return isLink ? results[0] : undefined;
}

const platformLogos: Record<SourcePlatform, string> = { vk: '/vk-network-logo.png', youtube: '/youtube-logo.png', telegram: '/telegram-logo.svg' };

const searchPlaceholders: Record<SourcePlatform, string> = {
  vk: 'Ссылка VK, t.me или YouTube',
  youtube: 'Ссылка, @handle или название YouTube-канала',
  telegram: 'Ссылка t.me или @username канала'
};

// Подборка, с которой сейчас совпадает выбор: тот же набор каналов без учёта порядка.
// В Telegram источник выбирают по username, поэтому сверяем и handle, и externalId.
export function matchingCollection(collections: ComparisonCollection[], selected: SourceChannel[]) {
  if (!selected.length) return undefined;
  const matches = (group: SourceChannel, source: ComparisonCollection['sources'][number]) => {
    const id = String(group.id).toLowerCase();
    return group.platform === source.platform && (id === source.externalId.toLowerCase() || id === source.handle?.replace(/^@/, '').toLowerCase());
  };
  return collections.find((collection) => collection.sources.length === selected.length && selected.every((group) => collection.sources.some((source) => matches(group, source))));
}

/** Кнопки сохранения в блоке выбора: новая подборка, или обновление открытой, если её изменили. */
export function CollectionSaveActions({ collection, changed, disabled, onSave, onUpdate }: { collection?: ComparisonCollection; changed: boolean; disabled: boolean; onSave: () => void; onUpdate: () => void }) {
  if (!collection) return <button className="source-summary-link" disabled={disabled} type="button" onClick={onSave}><BookmarkPlus size={16} />Сохранить как подборку</button>;
  if (!changed) return null;
  return <div className="source-summary-collection-actions">
    <button className="source-summary-link" disabled={disabled} type="button" onClick={onUpdate}><RefreshCw size={16} />Обновить подборку «{collection.name}»</button>
    <button className="source-summary-link subtle" disabled={disabled} type="button" onClick={onSave}>Сохранить как новую</button>
  </div>;
}

export const sourceKey = (group: Pick<SourceChannel, 'platform' | 'id'>) => `${group.platform}:${group.id}`;

function formatMembers(value?: number | null) {
  return value ? `${new Intl.NumberFormat('ru-RU').format(value)} подписчиков` : '';
}

function SourceAvatar({ group }: { group: SourceChannel }) {
  return (
    <span className="source-avatar">
      {group.photo_100 ?? group.photo_50 ? <img alt="" src={group.photo_100 ?? group.photo_50} /> : <span className="community-avatar-placeholder" />}
      <img alt="" className="source-avatar-platform" src={platformLogos[group.platform]} />
    </span>
  );
}

const platformNames: Record<SourcePlatform, string> = { vk: 'ВКонтакте', youtube: 'YouTube', telegram: 'Telegram' };
const SAVED_PREVIEW_COUNT = 6;

function formatCompactMembers(value?: number | null) {
  return value ? `${new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} подписчиков` : '';
}

export function SourceSetup({
  title,
  description,
  summaryTitle,
  minSources,
  query,
  platform,
  isSearching,
  searchResults,
  searchMessage,
  selected,
  savedGroups,
  collections,
  example,
  maxSources = 10,
  disabled,
  children,
  onQueryChange,
  onPlatformChange,
  onSearch,
  onAdd,
  onRemove,
  onClear,
  onExample,
  onApplyCollection,
  onRenameCollection,
  onDeleteCollection,
  activeCollection
}: {
  title: string;
  description: string;
  summaryTitle: string;
  minSources: number;
  query: string;
  platform: SourcePlatform;
  isSearching: boolean;
  searchResults: SourceChannel[];
  searchMessage?: ReactNode;
  selected: SourceChannel[];
  savedGroups: SourceChannel[];
  collections: ComparisonCollection[];
  example: SourceExample;
  maxSources?: number;
  disabled?: boolean;
  children?: ReactNode;
  onQueryChange: (value: string) => void;
  onPlatformChange: (platform: SourcePlatform) => void;
  onSearch: (event: FormEvent) => void;
  onAdd: (group: SourceChannel) => void;
  onRemove: (group: SourceChannel) => void;
  onClear: () => void;
  onExample: () => void;
  onApplyCollection: (collection: ComparisonCollection) => void;
  onRenameCollection: (collection: ComparisonCollection) => void;
  onDeleteCollection: (collection: ComparisonCollection) => void;
  activeCollection?: { name: string; changed: boolean };
}) {
  const selectedKeys = new Set(selected.map(sourceKey));
  const isFull = selected.length >= maxSources;
  const showExample = selected.length === 0 && savedGroups.length === 0 && collections.length === 0;
  const missingCount = Math.max(minSources - selected.length, 0);
  const [isSavedExpanded, setIsSavedExpanded] = useState(false);

  return (
    <div className="span-2 source-setup">
      <section className="panel source-picker">
        <div className="source-setup-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <form className="analytics-landing-search" onSubmit={onSearch}>
          <Search aria-hidden="true" size={20} />
          <input aria-label="Ссылка или название канала" disabled={disabled} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={searchPlaceholders[platform]} />
          <button disabled={isSearching || disabled || isFull} type="submit">{isSearching ? 'Ищем…' : 'Найти'}</button>
        </form>
        <div className="analytics-landing-platforms">
          <span>Поиск по названию:</span>
          <SegmentedControl className="social-platform-switcher" disabled={disabled} onChange={(id) => onPlatformChange(id as SourcePlatform)} selectedId={platform} size={32}>
            <Segment id="vk" title={<PlatformSegmentTitle platform="vk" />} />
            <Segment id="youtube" title={<PlatformSegmentTitle platform="youtube" />} />
            <Segment id="telegram" title={<PlatformSegmentTitle platform="telegram" />} />
          </SegmentedControl>
        </div>
        {searchMessage}

        {searchResults.length > 0 && (
          <div className="source-results">
            <div className="source-row-title">Результаты поиска</div>
            {searchResults.map((group) => {
              const isAdded = selectedKeys.has(sourceKey(group));
              return (
                <button className="analytics-result source-result" disabled={isAdded || isFull || disabled} key={sourceKey(group)} type="button" onClick={() => onAdd(group)}>
                  {group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}
                  <span><strong>{group.name}</strong><small>{[group.screen_name ? `@${group.screen_name.replace(/^@/, '')}` : `id${group.id}`, formatMembers(group.members_count)].filter(Boolean).join(' · ')}</small></span>
                  <em>{isAdded ? 'Добавлено' : <><Plus size={16} />Добавить</>}</em>
                </button>
              );
            })}
          </div>
        )}

        {(savedGroups.length > 0 || collections.length > 0 || showExample) && (
          <div className="source-shortcuts">
            {collections.length > 0 && (
              <div className="source-collections">
                <span className="source-row-title"><FolderOpen size={16} />Мои подборки</span>
                <div className="source-collections-list">
                  {collections.map((collection) => (
                    <div className="source-collection" key={collection.id}>
                      <button className="source-collection-open" disabled={disabled} type="button" onClick={() => onApplyCollection(collection)}>
                        <span className="source-collection-avatars" aria-hidden="true">
                          {collection.sources.slice(0, 3).map((source) => (
                            <img alt="" className={source.photo ? '' : 'logo'} key={`${source.platform}:${source.externalId}`} src={source.photo ?? platformLogos[source.platform]} />
                          ))}
                          {collection.sources.length > 3 && <span>+{collection.sources.length - 3}</span>}
                        </span>
                        <span className="source-collection-text">
                          <strong>{collection.name}</strong>
                          <small>{collection.sources.map((source) => source.name).join(', ')}</small>
                        </span>
                      </button>
                      <span className="source-collection-actions">
                        <IconButton aria-label={`Переименовать подборку «${collection.name}»`} icon={Pencil} onClick={() => onRenameCollection(collection)} size={32} view="transparent" />
                        <IconButton aria-label={`Удалить подборку «${collection.name}»`} icon={Trash2} onClick={() => onDeleteCollection(collection)} size={32} view="transparent" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {savedGroups.length > 0 && (
              <div className="source-collections">
                <span className="source-row-title">Ваши источники</span>
                <div className="source-collections-list">
                  {(isSavedExpanded ? savedGroups : savedGroups.slice(0, SAVED_PREVIEW_COUNT)).map((group) => {
                    const isAdded = selectedKeys.has(sourceKey(group));
                    return (
                    <button className={`source-saved ${isAdded ? 'added' : ''}`} disabled={(isFull && !isAdded) || disabled} key={sourceKey(group)} title={isAdded ? 'Убрать из списка' : undefined} type="button" onClick={() => (isAdded ? onRemove(group) : onAdd(group))}>
                      <SourceAvatar group={group} />
                      <span className="source-collection-text">
                        <strong>{group.name}</strong>
                        <small>{[platformNames[group.platform], formatCompactMembers(group.members_count)].filter(Boolean).join(' · ')}</small>
                      </span>
                      <em>{isAdded ? <><Check size={16} />Добавлено</> : <><Plus size={16} />Добавить</>}</em>
                    </button>
                    );
                  })}
                  {savedGroups.length > SAVED_PREVIEW_COUNT && (
                    <button className="source-saved-toggle" type="button" onClick={() => setIsSavedExpanded((value) => !value)}>
                      {isSavedExpanded ? 'Свернуть' : `Показать все (${savedGroups.length})`}
                    </button>
                  )}
                </div>
              </div>
            )}
            {showExample && (
              <div className="source-shortcut-row">
                <span className="source-row-title"><Sparkles size={16} />Попробуйте на примере:</span>
                <button className="analytics-landing-chip" disabled={isSearching || disabled} type="button" onClick={onExample}>
                  <img alt="" src={platformLogos[example.sources[0].platform]} /><span>{example.label}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className={`panel source-summary ${selected.length >= minSources ? 'ready' : ''}`} aria-label={summaryTitle}>
        <div className="source-summary-heading">
          <h2>{summaryTitle}</h2>
          <span>
            {selected.length} из {maxSources}
            {selected.length > 0 && <button disabled={disabled} type="button" onClick={onClear}>очистить</button>}
          </span>
        </div>
        {activeCollection && <p className="source-summary-collection"><FolderOpen size={15} aria-hidden="true" />Подборка «{activeCollection.name}»{activeCollection.changed && <span>· изменена</span>}</p>}
        <div className="source-summary-list">
          {selected.map((group) => (
            <div className="source-summary-item" key={sourceKey(group)}>
              <SourceAvatar group={group} />
              <span><strong title={group.name}>{group.name}</strong><small>{[platformNames[group.platform], formatCompactMembers(group.members_count)].filter(Boolean).join(' · ')}</small></span>
              <IconButton aria-label={`Убрать «${group.name}»`} disabled={disabled} icon={X} onClick={() => onRemove(group)} size={32} view="transparent" />
            </div>
          ))}
          {Array.from({ length: missingCount }, (_, index) => (
            <div className="source-summary-slot" key={`slot-${index}`}>{selected.length + index === 0 ? 'Добавьте первый канал через поиск' : 'Добавьте ещё канал'}</div>
          ))}
          {missingCount === 0 && !isFull && <div className="source-summary-slot subtle">Можно добавить ещё {maxSources - selected.length}</div>}
        </div>
        {children}
      </aside>
    </div>
  );
}
