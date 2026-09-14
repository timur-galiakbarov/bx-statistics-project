import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, Heart, LockKeyhole, MessageCircle, MoreHorizontal, Plus, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import { IconButton } from '@alfalab/core-components-icon-button';
import { Input } from '@alfalab/core-components-input';
import { Modal } from '@alfalab/core-components-modal';
import { Button } from '@alfalab/core-components-button';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../api/client';
import { PlatformSegmentTitle } from '../components/PlatformSegmentTitle';
import type { DashboardPeriod, DashboardSummary, DashboardSummaryItem, SavedGroup, VkGroup, VkListResponse, YoutubeChannel } from '../api/types';
import { number } from './dashboardSelectors';

type Props = { groups: SavedGroup[]; hasPaidAccess: boolean; isTrialActive: boolean; onGroupsChanged: () => Promise<void> };
type AddMode = 'tracked' | 'free' | 'bonus';
type Platform = 'vk' | 'youtube';
type SearchResult = VkGroup | YoutubeChannel;
const DASHBOARD_PERIOD_STORAGE_KEY = 'socstat.dashboard.period';
const dashboardPeriodValues: DashboardPeriod[] = ['last7days', 'today', 'yesterday', 'currentMonth'];

function getSavedDashboardPeriod(): DashboardPeriod {
  try {
    const savedPeriod = window.localStorage.getItem(DASHBOARD_PERIOD_STORAGE_KEY) as DashboardPeriod | null;
    return savedPeriod && dashboardPeriodValues.includes(savedPeriod) ? savedPeriod : 'last7days';
  } catch {
    return 'last7days';
  }
}

function isYoutubeChannel(group: SearchResult): group is YoutubeChannel {
  return 'platform' in group && group.platform === 'youtube';
}
export function DashboardPage({ groups, hasPaidAccess, isTrialActive, onGroupsChanged }: Props) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>(getSavedDashboardPeriod);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [platform, setPlatform] = useState<Platform>('vk');
  const [vkGroups, setVkGroups] = useState<VkGroup[]>([]);
  const [isVkGroupsLoading, setIsVkGroupsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('tracked');
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const loadSummary = async (forceRefresh = false) => {
    if (!hasPaidAccess) { setSummary(null); setMessage('Детальная статистика недоступна: срок доступа истёк.'); return; }
    setMessage(''); setIsSummaryLoading(true);
    try { setSummary(await apiGet<DashboardSummary>(`/api/dashboard/summary?period=${period}${forceRefresh ? '&refresh=1' : ''}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить дашборд.'); }
    finally { setIsSummaryLoading(false); }
  };
  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_PERIOD_STORAGE_KEY, period);
    } catch {
      // The dashboard still works when browser storage is unavailable.
    }
  }, [period]);
  useEffect(() => { if (groups.length) void loadSummary(); else setSummary(null); }, [groups.length, hasPaidAccess, period]);
  const search = async (event: FormEvent) => { event.preventDefault(); if (!query.trim()) { setSearchError(`Введите название, ID или ссылку на ${platform === 'youtube' ? 'канал' : 'сообщество'}.`); return; } setSearchError(''); setResults([]); setIsSearching(true); try { const path = platform === 'youtube' ? '/api/youtube/channels/search' : '/api/vk/groups/search'; const items = (await apiGet<VkListResponse<SearchResult>>(`${path}?q=${encodeURIComponent(query.trim())}`)).items; setResults(items); if (!items.length) setSearchError(platform === 'youtube' ? 'YouTube-каналы не найдены.' : 'Сообщества не найдены.'); } catch (error) { setSearchError(error instanceof Error ? error.message : 'Не удалось найти источник.'); } finally { setIsSearching(false); } };
  const updateQuery = (value: string) => { setQuery(value); if (searchError) setSearchError(''); };
  const add = async (group: SearchResult) => { try { setSearchError(''); const payload = isYoutubeChannel(group) ? { platform: 'youtube', group } : { platform: 'vk', group: { id: group.id, name: group.name, screen_name: group.screen_name, photo: group.photo_100 ?? group.photo_50, members_count: group.members_count } }; const path = addMode === 'free' ? '/api/account/groups/free' : addMode === 'bonus' ? '/api/account/groups/bonus' : '/api/account/groups'; await apiPost(path, addMode === 'tracked' ? { ...payload, source: 'bookmark' } : payload); await onGroupsChanged(); setResults([]); setIsAddModalOpen(false); setMessage(`«${group.name}» добавлено.`); } catch (error) { setSearchError(error instanceof Error ? error.message : 'Не удалось добавить источник.'); } };
  const remove = async (group: SavedGroup) => { if (!window.confirm(`Удалить «${group.name}» из списка сообществ?`)) return; setDeletingGroupId(group.id); try { await apiDelete(`/api/account/groups/${group.id}`); await onGroupsChanged(); setMessage(`«${group.name}» удалено из списка.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось удалить сообщество.'); } finally { setDeletingGroupId(null); } };
  const loadVkGroups = async () => { if (vkGroups.length || isVkGroupsLoading) return; setIsVkGroupsLoading(true); try { setVkGroups((await apiGet<VkListResponse<VkGroup>>('/api/vk/groups/subscriptions')).items); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить список сообществ VK.'); } finally { setIsVkGroupsLoading(false); } };
  const openAddModal = (mode: AddMode) => { setAddMode(mode); setIsAddModalOpen(true); setResults([]); setSearchError(''); void loadVkGroups(); };
  const managedVkGroups = vkGroups.filter((group) => Boolean(group.is_admin));
  const subscribedVkGroups = vkGroups.filter((group) => !group.is_admin);
  const freeGroups = groups.filter((group) => group.source === 'free' || group.source === 'bonus');
  const trackedGroups = groups.filter((group) => group.isTracked);
  const savedGroupIds = groups
    .filter((group) => {
      if (addMode === 'free' || addMode === 'bonus') {
        return group.source === 'free' || group.source === 'bonus';
      }
      return group.isTracked;
    })
    .map((group) => `${group.platform}:${group.externalId}`);
  const managementProps = { platform, setPlatform: (next: Platform) => { setPlatform(next); setResults([]); setSearchError(''); }, query, setQuery: updateQuery, searchError, isSearching, results, search, add, isVkGroupsLoading, managedVkGroups, subscribedVkGroups, savedGroupIds };
  return <div className="page-grid dashboard-page">
    <CommunitiesTable groups={trackedGroups} summary={summary} period={period} onPeriodChange={setPeriod} onAdd={() => openAddModal('tracked')} onRefresh={() => void loadSummary(true)} onRemove={remove} onSelect={(group) => navigate(`/analytics?groupId=${encodeURIComponent(group.externalId)}&platform=${group.platform}`)} deletingGroupId={deletingGroupId} isRefreshing={isSummaryLoading} />
    <FreeCommunitiesPanel groups={freeGroups} isTrialActive={isTrialActive} onAdd={openAddModal} />
    {message && <div className="form-message span-2">{message}</div>}
    <AddCommunityModal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} managementProps={managementProps} />
  </div>;
}
type ManagementProps = {
  platform: Platform;
  setPlatform: (platform: Platform) => void;
  query: string;
  setQuery: (value: string) => void;
  searchError: string;
  isSearching: boolean;
  results: SearchResult[];
  search: (event: FormEvent) => Promise<void>;
  add: (group: SearchResult, source?: 'free' | 'managed' | 'bookmark') => Promise<void>;
  isVkGroupsLoading: boolean;
  managedVkGroups: VkGroup[];
  subscribedVkGroups: VkGroup[];
  savedGroupIds: string[];
};

function AddCommunityModal({ open, onClose, managementProps }: { open: boolean; onClose: () => void; managementProps: ManagementProps }) {
  return <Modal open={open} onClose={onClose} hasCloser scrollLock size={600}><Modal.Header title="Добавить источник" /><Modal.Content><p className="add-community-modal-description">Добавьте сообщество VK или произвольный публичный YouTube-канал.</p><Management {...managementProps} /></Modal.Content></Modal>;
}

function FreeCommunitiesPanel({ groups, isTrialActive, onAdd }: { groups: SavedGroup[]; isTrialActive: boolean; onAdd: (mode: AddMode) => void }) {
  const baseGroup = groups.find((group) => group.source === 'free');
  const bonusGroup = groups.find((group) => group.source === 'bonus');
  const hasBaseGroup = Boolean(baseGroup);
  const hasBonusGroup = Boolean(bonusGroup);
  return <section className="panel free-communities-panel">
    <div className="free-communities-heading"><div><h2>Бонусные сообщества</h2><p>Добавьте до двух сообществ: первое доступно сразу, второе — после вступления в сообщество Socstat во ВКонтакте.</p></div><strong className="free-communities-count">{Math.min(groups.length, 2)} из 2</strong></div>
    <div className="free-communities-slots">
      <FreeCommunitySlot title="Первое сообщество" description="Доступно всем пользователям" isActive={hasBaseGroup} group={baseGroup} />
      <FreeCommunitySlot title="Бонусное сообщество" description="За вступление в сообщество Socstat во ВКонтакте" isActive={hasBonusGroup} group={bonusGroup} />
    </div>
    {isTrialActive && <div className="trial-access-note"><Check size={17} /><span><strong>Пробный период активен.</strong> В течение трёх дней доступна аналитика без ограничений.</span></div>}
    {!hasBonusGroup && <div className="free-communities-action"><div>{hasBaseGroup && <><LockKeyhole size={17} /><span>Подпишитесь на <a href="https://vk.com/socstat" target="_blank" rel="noreferrer">сообщество Socstat</a> и добавьте ещё одно.</span></>}</div><Button className="dashboard-action-button" type="button" view="primary" size={40} leftAddons={<Plus size={16} />} onClick={() => onAdd(hasBaseGroup ? 'bonus' : 'free')}>{hasBaseGroup ? 'Добавить бонусное сообщество' : 'Добавить сообщество'}</Button></div>}
    {hasBonusGroup && <div className="free-communities-limit"><Check size={17} />Доступны оба бесплатных сообщества для анализа.</div>}
  </section>;
}

function FreeCommunitySlot({ title, description, isActive, group }: { title: string; description: string; isActive: boolean; group?: SavedGroup }) {
  return <div className={`free-community-slot ${isActive ? 'active' : ''}`}><span className="free-community-slot-icon">{isActive ? <Check size={16} /> : <Users size={16} />}</span><div><strong>{group?.name ?? title}</strong><small>{isActive ? `Добавлено · ${group?.platform === 'youtube' ? 'YouTube' : 'VK'}` : description}</small></div>{group && <a aria-label={`Открыть ${group.name}`} href={group.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}</div>;
}

const dashboardPeriods: Array<{ id: DashboardPeriod; title: string }> = [
  { id: 'last7days', title: 'Последние 7 дней' },
  { id: 'today', title: 'Сегодня' },
  { id: 'yesterday', title: 'Вчера' },
  { id: 'currentMonth', title: 'Этот месяц' }
];

function CommunitiesTable({ groups, summary, period, onPeriodChange, onAdd, onRefresh, onRemove, onSelect, deletingGroupId, isRefreshing }: { groups: SavedGroup[]; summary: DashboardSummary | null; period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void; onAdd: () => void; onRefresh: () => void; onRemove: (group: SavedGroup) => Promise<void>; onSelect: (group: SavedGroup) => void; deletingGroupId: string | null; isRefreshing: boolean }) {
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine' | 'other'>('all');
  const rows = groups.map((group) => {
    const summaryItem = summary?.groups.find((item) => item.savedGroupId === group.id);
    return {
      group,
      summaryItem,
      isManaged: summaryItem?.isManagedByUser ?? group.source === 'managed'
    };
  });
  const visibleRows = rows.filter(({ isManaged }) => ownershipFilter === 'all' || (ownershipFilter === 'mine' ? isManaged : !isManaged));
  const managedCount = rows.filter(({ isManaged }) => isManaged).length;

  return <section className="panel span-2 communities-panel">
    <div className="section-title"><div><h2>Отслеживаемые сообщества</h2><strong>{groups.length}</strong></div><Button disabled={isRefreshing} leftAddons={<RefreshCw size={16} />} loading={isRefreshing} size={40} type="button" view="secondary" onClick={onRefresh}>Обновить данные</Button></div>
    <div className="communities-controls">
      <label className="communities-mobile-select">
        <span>Показывать</span>
        <select aria-label="Фильтр сообществ" value={ownershipFilter} onChange={(event) => setOwnershipFilter(event.target.value as 'all' | 'mine' | 'other')}>
          <option value="all">Все сообщества ({groups.length})</option>
          <option value="mine">Мои ({managedCount})</option>
          <option value="other">Чужие ({groups.length - managedCount})</option>
        </select>
      </label>
      <div className="communities-filter" aria-label="Фильтр сообществ">
        <SegmentedControl className="communities-filter-control" onChange={(id) => setOwnershipFilter(id as 'all' | 'mine' | 'other')} selectedId={ownershipFilter} size={40}>
        <Segment className="communities-filter-segment" id="all" title={`Все (${groups.length})`} />
        <Segment className="communities-filter-segment" id="mine" title={`Мои (${managedCount})`} />
        <Segment className="communities-filter-segment" id="other" title={`Чужие (${groups.length - managedCount})`} />
        </SegmentedControl>
      </div>
      <label className="communities-mobile-select">
        <span>Период</span>
        <select aria-label="Период статистики" value={period} onChange={(event) => onPeriodChange(event.target.value as DashboardPeriod)}>
          {dashboardPeriods.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <div className="communities-period" aria-label="Период статистики">
        <SegmentedControl className="communities-period-control" onChange={(id) => onPeriodChange(id as DashboardPeriod)} selectedId={period} size={40}>
          {dashboardPeriods.map((item) => <Segment className="communities-period-segment" id={item.id} key={item.id} title={item.title} />)}
        </SegmentedControl>
      </div>
    </div>
    <div className="communities-table">
      <div className="communities-table-head"><span>Сеть</span><span>Сообщество</span><span>Участники</span><span>Прирост</span><span>Посещения<br />Просмотры</span><span>Охват подписчиков<br />Полный охват</span><span>Лайки<br />Репосты<br />Комментарии</span><span aria-label="Действия" /></div>
      {visibleRows.length ? visibleRows.map(({ group, summaryItem, isManaged }) => {
        const membersCount = summaryItem?.membersCount ?? group.membersCount;
        const selectGroup = () => onSelect(group);
        return <div className="communities-table-row communities-table-row-action" key={group.id} onClick={selectGroup} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectGroup(); } }} role="link" tabIndex={0}>
          <span className="communities-table-network"><img src={group.platform === 'youtube' ? '/youtube-logo.png' : '/vk-network-logo.png'} alt={group.platform === 'youtube' ? 'YouTube' : 'ВКонтакте'} title={group.platform === 'youtube' ? 'YouTube' : 'ВКонтакте'} /></span>
          <span className="communities-table-name">{group.photo ? <img src={group.photo} alt="" /> : <Users size={18} />}<span><strong>{group.name}</strong><small className={`communities-table-owner ${isManaged ? 'managed' : ''}`}><img className="community-platform-mobile" src={group.platform === 'youtube' ? '/youtube-logo.png' : '/vk-network-logo.png'} alt="" />{group.platform === 'youtube' ? 'YouTube-канал' : isManaged ? 'Моё сообщество' : 'Чужое сообщество'}</small></span></span>
          <MetricValue value={membersCount} loading={!summaryItem} />
          {group.platform === 'youtube' ? <MetricValue /> : <GrowthValue item={summaryItem} />}
          {group.platform === 'youtube' ? <MetricValue value={summaryItem?.traffic.views} loading={!summaryItem} /> : <PairValue first={summaryItem?.traffic.visitors} second={summaryItem?.traffic.views} firstIcon={Users} secondIcon={Eye} unavailable={isStatsUnavailable(summaryItem)} loading={!summaryItem} />}
          {group.platform === 'youtube' ? <MetricValue /> : <PairValue first={summaryItem?.reach.subscribers} second={summaryItem?.reach.total} unavailable={isStatsUnavailable(summaryItem)} loading={!summaryItem} />}
          <TripleValue item={summaryItem} loading={!summaryItem} platform={group.platform} />
          <details className="community-actions" onClick={(event) => event.stopPropagation()}>
            <summary aria-label={`Действия для ${group.name}`}><MoreHorizontal size={20} /></summary>
            <IconButton className="community-delete-button" aria-label={`Удалить ${group.name}`} icon={Trash2} loading={deletingGroupId === group.id} onClick={() => void onRemove(group)} size={32} view="transparent" />
          </details>
        </div>;
      }) : <div className="communities-table-empty">В этой категории пока нет сообществ.</div>}
    </div>
    <p className="communities-table-scroll-hint" aria-hidden="true">Прокрутите таблицу в сторону, чтобы увидеть все показатели →</p>
    <div className="communities-add"><Button className="dashboard-action-button" type="button" view="primary" size={40} leftAddons={<Plus size={16} />} onClick={onAdd}>Добавить сообщество</Button></div>
  </section>;
}

function isStatsUnavailable(item?: DashboardSummaryItem) {
  return Boolean(item && (item.statsAvailable === false || item.statsAvailable === null || item.error));
}

function MetricValue({ value, loading = false }: { value?: number | null; loading?: boolean }) {
  return <span className={`communities-table-metric ${loading ? 'loading' : ''}`}>{loading ? 'Загружаем данные' : typeof value === 'number' ? number(value) : '—'}</span>;
}

function GrowthValue({ item }: { item?: DashboardSummaryItem }) {
  if (!item) return <MetricValue loading />;
  if (isStatsUnavailable(item)) return <MetricValue />;
  return <span className="communities-table-pair"><strong>{item.growth.total > 0 ? '+' : ''}{number(item.growth.total)}</strong><small><ArrowUp size={12} />{number(item.growth.subscribed)} <ArrowDown size={12} />{number(item.growth.unsubscribed)}</small></span>;
}

function PairValue({ first, second, firstIcon: FirstIcon, secondIcon: SecondIcon, unavailable, loading }: { first?: number; second?: number; firstIcon?: typeof Users; secondIcon?: typeof Users; unavailable: boolean; loading: boolean }) {
  if (loading || unavailable) return <MetricValue loading={loading} />;
  return <span className="communities-table-pair"><strong>{FirstIcon && <FirstIcon size={13} />}{number(first ?? 0)}</strong><small>{SecondIcon && <SecondIcon size={13} />}{number(second ?? 0)}</small></span>;
}

function TripleValue({ item, loading, platform = 'vk' }: { item?: DashboardSummaryItem; loading: boolean; platform?: Platform }) {
  if (loading) return <MetricValue loading />;
  if (item?.error) return <MetricValue />;
  return <span className="communities-table-triple"><span className="communities-reaction-values"><small><Heart size={13} />{number(item?.activity.likes ?? 0)}</small><small><Share2 size={13} />{platform === 'youtube' ? 'Недоступно' : number(item?.activity.reposts ?? 0)}</small><small><MessageCircle size={13} />{number(item?.activity.comments ?? 0)}</small></span></span>;
}

function Management({ platform, setPlatform, query, setQuery, searchError, isSearching, results, search, add, isVkGroupsLoading, managedVkGroups, subscribedVkGroups, savedGroupIds }: ManagementProps) {
  const visiblePickerGroups = [...managedVkGroups, ...subscribedVkGroups.filter((group) => !managedVkGroups.some((managed) => managed.id === group.id))];
  return <div className="dashboard-management"><SegmentedControl onChange={(id) => setPlatform(id as Platform)} selectedId={platform} size={40}><Segment id="vk" title={<PlatformSegmentTitle platform="vk" />} /><Segment id="youtube" title={<PlatformSegmentTitle platform="youtube" />} /></SegmentedControl><form className="search-form" onSubmit={search}><Input block className="dashboard-search-input" value={query} onChange={(_, payload) => setQuery(payload.value)} placeholder={platform === 'youtube' ? 'URL, @handle, channel ID или название' : 'Название или screen name сообщества'} /><Button className="dashboard-action-button" type="submit" view="primary" size={48} leftAddons={<Plus size={17} />} loading={isSearching}>Найти</Button></form><div className={`source-search-feedback ${searchError ? 'has-error' : ''}`} aria-live="polite">{isSearching ? `Ищем ${platform === 'youtube' ? 'YouTube-канал' : 'сообщество'}…` : searchError}</div><div className="search-results source-search-results">{results.map((group) => <GroupOption group={group} key={group.id} isAdded={savedGroupIds.includes(`${platform}:${group.id}`)} onAdd={() => void add(group)} />)}</div>{platform === 'vk' && <div className="vk-picker"><div className="vk-picker-heading"><strong>Или выберите из VK</strong></div>{isVkGroupsLoading ? <div className="empty-state">Загружаем сообщества VK...</div> : <div className="search-results vk-picker-results">{visiblePickerGroups.length ? visiblePickerGroups.map((group) => <GroupOption group={group} key={group.id} isAdded={savedGroupIds.includes(`vk:${group.id}`)} onAdd={() => void add(group)} />) : <div className="empty-state">В этом списке нет сообществ.</div>}</div>}</div>}</div>;
}

function GroupOption({ group, isAdded, onAdd }: { group: SearchResult; isAdded: boolean; onAdd: () => void }) {
  const youtube = isYoutubeChannel(group);
  const groupPath = youtube ? group.handle ?? group.id : group.screen_name ?? `club${group.id}`;
  const photo = youtube ? group.photo : group.photo_100 ?? group.photo_50;
  const href = youtube ? group.url : `https://vk.com/${groupPath}`;
  const details = youtube ? `${group.followersCount === null ? 'Подписчики: Недоступно' : `${number(group.followersCount)} подписчиков`} · ${number(group.videoCount)} видео · ${number(group.viewCount)} просмотров` : `vk.com/${groupPath}`;
  return <div className="search-result">{photo ? <img src={photo} alt="" /> : <Users size={32} />}<span><OverflowingCommunityName name={group.name} /><a href={href} target="_blank" rel="noreferrer">{groupPath}</a><small>{details}</small></span><Button className="dashboard-action-button group-add-button" aria-label={isAdded ? `${group.name} уже добавлено` : `Добавить ${group.name}`} disabled={isAdded} onClick={onAdd} size={32} view="primary">{isAdded ? 'Добавлено' : 'Добавить'}</Button></div>;
}

function OverflowingCommunityName({ name }: { name: string }) {
  return <strong title={name}>{name}</strong>;
}
