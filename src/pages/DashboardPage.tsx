import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, Heart, LockKeyhole, MessageCircle, Plus, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import { IconButton } from '@alfalab/core-components-icon-button';
import { Input } from '@alfalab/core-components-input';
import { Modal } from '@alfalab/core-components-modal';
import { Button } from '@alfalab/core-components-button';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { Skeleton } from '@alfalab/core-components-skeleton';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../api/client';
import type { DashboardPeriod, DashboardSummary, DashboardSummaryItem, SavedGroup, VkGroup, VkListResponse } from '../api/types';
import { number } from './dashboardSelectors';

type Props = { groups: SavedGroup[]; hasPaidAccess: boolean; isTrialActive: boolean; onGroupsChanged: () => Promise<void> };
type AddMode = 'tracked' | 'free' | 'bonus';
export function DashboardPage({ groups, hasPaidAccess, isTrialActive, onGroupsChanged }: Props) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>('last7days');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<VkGroup[]>([]);
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
  useEffect(() => { if (groups.length) void loadSummary(); else setSummary(null); }, [groups.length, hasPaidAccess, period]);
  const search = async (event: FormEvent) => { event.preventDefault(); if (!query.trim()) { setSearchError('Введите название или ссылку на сообщество.'); return; } setSearchError(''); setIsSearching(true); try { setResults((await apiGet<VkListResponse<VkGroup>>(`/api/vk/groups/search?q=${encodeURIComponent(query.trim())}`)).items); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось найти сообщество.'); } finally { setIsSearching(false); } };
  const updateQuery = (value: string) => { setQuery(value); if (searchError) setSearchError(''); };
  const add = async (group: VkGroup) => { try { const photo = group.photo_100 ?? group.photo_50; const payload = { group: { id: group.id, name: group.name, screen_name: group.screen_name, photo, photo_50: photo, members_count: group.members_count } }; const path = addMode === 'free' ? '/api/account/groups/free' : addMode === 'bonus' ? '/api/account/groups/bonus' : '/api/account/groups'; await apiPost(path, addMode === 'tracked' ? { ...payload, source: 'bookmark' } : payload); await onGroupsChanged(); setResults([]); setIsAddModalOpen(false); setMessage(`«${group.name}» ${addMode === 'tracked' ? 'добавлено в отслеживание' : 'добавлено для бесплатного анализа'}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось добавить сообщество.'); } };
  const remove = async (group: SavedGroup) => { if (!window.confirm(`Удалить «${group.name}» из списка сообществ?`)) return; setDeletingGroupId(group.id); try { await apiDelete(`/api/account/groups/${group.id}`); await onGroupsChanged(); setMessage(`«${group.name}» удалено из списка.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось удалить сообщество.'); } finally { setDeletingGroupId(null); } };
  const loadVkGroups = async () => { if (vkGroups.length || isVkGroupsLoading) return; setIsVkGroupsLoading(true); try { setVkGroups((await apiGet<VkListResponse<VkGroup>>('/api/vk/groups/subscriptions')).items); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить список сообществ VK.'); } finally { setIsVkGroupsLoading(false); } };
  const openAddModal = (mode: AddMode) => { setAddMode(mode); setIsAddModalOpen(true); setResults([]); setSearchError(''); void loadVkGroups(); };
  const managedVkGroups = vkGroups.filter((group) => Boolean(group.is_admin));
  const subscribedVkGroups = vkGroups.filter((group) => !group.is_admin);
  const freeGroups = groups.filter((group) => group.source === 'free' || group.source === 'bonus');
  const trackedGroups = groups.filter((group) => group.source !== 'free' && group.source !== 'bonus');
  const managementProps = { query, setQuery: updateQuery, searchError, isSearching, results, search, add, isVkGroupsLoading, managedVkGroups, subscribedVkGroups, savedGroupIds: groups.map((group) => group.vkGroupId) };
  return <div className="page-grid dashboard-page">
    <CommunitiesTable groups={trackedGroups} summary={summary} period={period} onPeriodChange={setPeriod} onAdd={() => openAddModal('tracked')} onRefresh={() => void loadSummary(true)} onRemove={remove} onSelect={(group) => navigate(`/analytics?groupId=${group.vkGroupId}`)} deletingGroupId={deletingGroupId} isRefreshing={isSummaryLoading} />
    <FreeCommunitiesPanel groups={freeGroups} isTrialActive={isTrialActive} onAdd={openAddModal} />
    {message && <div className="form-message span-2">{message}</div>}
    <AddCommunityModal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} managementProps={managementProps} />
  </div>;
}
type ManagementProps = {
  query: string;
  setQuery: (value: string) => void;
  searchError: string;
  isSearching: boolean;
  results: VkGroup[];
  search: (event: FormEvent) => Promise<void>;
  add: (group: VkGroup, source?: 'free' | 'managed' | 'bookmark') => Promise<void>;
  isVkGroupsLoading: boolean;
  managedVkGroups: VkGroup[];
  subscribedVkGroups: VkGroup[];
  savedGroupIds: string[];
};

function AddCommunityModal({ open, onClose, managementProps }: { open: boolean; onClose: () => void; managementProps: ManagementProps }) {
  return <Modal open={open} onClose={onClose} hasCloser scrollLock size={600}><Modal.Header title="Добавить сообщество" /><Modal.Content><p className="add-community-modal-description">Найдите сообщество через поиск или выберите из списка сообществ VK.</p><Management {...managementProps} /></Modal.Content></Modal>;
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
  return <div className={`free-community-slot ${isActive ? 'active' : ''}`}><span className="free-community-slot-icon">{isActive ? <Check size={16} /> : <Users size={16} />}</span><div><strong>{group?.name ?? title}</strong><small>{isActive ? 'Добавлено для анализа' : description}</small></div>{group && <a aria-label={`Открыть ${group.name} во ВКонтакте`} href={`https://vk.com/${group.vkGroupId}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}</div>;
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
      <div className="communities-filter" aria-label="Фильтр сообществ">
        <SegmentedControl className="communities-filter-control" onChange={(id) => setOwnershipFilter(id as 'all' | 'mine' | 'other')} selectedId={ownershipFilter} size={40}>
        <Segment className="communities-filter-segment" id="all" title={`Все (${groups.length})`} />
        <Segment className="communities-filter-segment" id="mine" title={`Мои (${managedCount})`} />
        <Segment className="communities-filter-segment" id="other" title={`Чужие (${groups.length - managedCount})`} />
        </SegmentedControl>
      </div>
      <div className="communities-period" aria-label="Период статистики">
        <SegmentedControl className="communities-period-control" onChange={(id) => onPeriodChange(id as DashboardPeriod)} selectedId={period} size={40}>
          {dashboardPeriods.map((item) => <Segment className="communities-period-segment" id={item.id} key={item.id} title={item.title} />)}
        </SegmentedControl>
      </div>
    </div>
    <div className="communities-table">
      <div className="communities-table-head"><span>Сообщество</span><span>Участники</span><span>Прирост</span><span>Посещения<br />Просмотры</span><span>Охват подписчиков<br />Полный охват</span><span>Лайки<br />Репосты<br />Комментарии</span><span aria-label="Действия" /></div>
      {visibleRows.length ? visibleRows.map(({ group, summaryItem, isManaged }) => {
        const membersCount = summaryItem?.membersCount ?? group.membersCount;
        const selectGroup = () => onSelect(group);
        return <div className="communities-table-row communities-table-row-action" key={group.id} onClick={selectGroup} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectGroup(); } }} role="link" tabIndex={0}>
          <span className="communities-table-name">{group.photo ? <img src={group.photo} alt="" /> : <Users size={18} />}<span><strong>{group.name}</strong><small className={`communities-table-owner ${isManaged ? 'managed' : ''}`}>{isManaged ? 'Моё сообщество' : 'Чужое сообщество'}</small></span></span>
          <MetricValue value={membersCount} loading={!summaryItem} />
          <GrowthValue item={summaryItem} />
          <PairValue first={summaryItem?.traffic.visitors} second={summaryItem?.traffic.views} firstIcon={Users} secondIcon={Eye} unavailable={isStatsUnavailable(summaryItem)} loading={!summaryItem} />
          <PairValue first={summaryItem?.reach.subscribers} second={summaryItem?.reach.total} unavailable={isStatsUnavailable(summaryItem)} loading={!summaryItem} />
          <TripleValue item={summaryItem} loading={!summaryItem} />
          <IconButton className="community-delete-button" aria-label={`Удалить ${group.name}`} icon={Trash2} loading={deletingGroupId === group.id} onClick={(event) => { event.stopPropagation(); void onRemove(group); }} size={24} view="transparent" />
        </div>;
      }) : <div className="communities-table-empty">В этой категории пока нет сообществ.</div>}
    </div>
    <div className="communities-add"><Button className="dashboard-action-button" type="button" view="primary" size={40} leftAddons={<Plus size={16} />} onClick={onAdd}>Добавить сообщество</Button></div>
  </section>;
}

function isStatsUnavailable(item?: DashboardSummaryItem) {
  return Boolean(item && (item.statsAvailable === false || item.statsAvailable === null || item.error));
}

function MetricValue({ value, loading = false }: { value?: number; loading?: boolean }) {
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

function TripleValue({ item, loading }: { item?: DashboardSummaryItem; loading: boolean }) {
  if (loading) return <MetricValue loading />;
  if (item?.error) return <MetricValue />;
  return <span className="communities-table-triple"><small><Heart size={13} />{number(item?.activity.likes ?? 0)}</small><small><Share2 size={13} />{number(item?.activity.reposts ?? 0)}</small><small><MessageCircle size={13} />{number(item?.activity.comments ?? 0)}</small></span>;
}

function Management({ query, setQuery, searchError, isSearching, results, search, add, isVkGroupsLoading, managedVkGroups, subscribedVkGroups, savedGroupIds }: ManagementProps) {
  const visiblePickerGroups = [...managedVkGroups, ...subscribedVkGroups.filter((group) => !managedVkGroups.some((managed) => managed.id === group.id))];
  return <div className="dashboard-management"><form className="search-form" onSubmit={search}><Input block className="dashboard-search-input" error={searchError || undefined} value={query} onChange={(_, payload) => setQuery(payload.value)} placeholder="Название или screen name сообщества" /><Button className="dashboard-action-button" type="submit" view="primary" size={48} leftAddons={<Plus size={17} />} loading={isSearching}>Найти</Button></form><div className="search-results">{isSearching ? <SearchResultsSkeleton /> : results.map((group) => <GroupOption group={group} key={group.id} isAdded={savedGroupIds.includes(String(group.id))} onAdd={() => void add(group)} />)}</div><div className="vk-picker"><div className="vk-picker-heading"><strong>Или выберите из VK</strong></div>{isVkGroupsLoading ? <div className="empty-state">Загружаем сообщества VK...</div> : <div className="search-results vk-picker-results">{visiblePickerGroups.length ? visiblePickerGroups.map((group) => <GroupOption group={group} key={group.id} isAdded={savedGroupIds.includes(String(group.id))} onAdd={() => void add(group)} />) : <div className="empty-state">В этом списке нет сообществ.</div>}</div>}</div></div>;
}

function SearchResultsSkeleton() {
  return <>{Array.from({ length: 3 }, (_, index) => <div className="group-option-skeleton" key={index}><Skeleton borderRadius={10} style={{ height: 40, width: 40 }} /><div><Skeleton borderRadius={6} style={{ height: 16, width: '68%' }} /><Skeleton borderRadius={6} style={{ height: 13, marginTop: 7, width: '42%' }} /></div><Skeleton borderRadius={10} style={{ height: 32, width: 82 }} /></div>)}</>;
}

function GroupOption({ group, isAdded, onAdd }: { group: VkGroup; isAdded: boolean; onAdd: () => void }) {
  const groupPath = group.screen_name ?? `club${group.id}`;
  return <div className="search-result"><img src={group.photo_100 ?? group.photo_50} alt="" /><span><OverflowingCommunityName name={group.name} /><a href={`https://vk.com/${groupPath}`} target="_blank" rel="noreferrer">vk.com/{groupPath}</a></span><Button className="dashboard-action-button group-add-button" aria-label={isAdded ? `${group.name} уже добавлено` : `Добавить ${group.name}`} disabled={isAdded} onClick={onAdd} size={32} view="primary">{isAdded ? 'Добавлено' : 'Добавить'}</Button></div>;
}

function OverflowingCommunityName({ name }: { name: string }) {
  return <strong title={name}>{name}</strong>;
}
