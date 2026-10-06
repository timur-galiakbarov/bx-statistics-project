import { ArrowDown, ArrowUp, CalendarClock, CalendarDays, Check, CircleHelp, ExternalLink, Eye, GripVertical, Heart, LockKeyhole, MessageCircle, MoreHorizontal, Plus, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import { IconButton } from '@alfalab/core-components-icon-button';
import { Input } from '@alfalab/core-components-input';
import { Tooltip } from '@alfalab/core-components-tooltip';
import { Modal } from '@alfalab/core-components-modal';
import { Button } from '@alfalab/core-components-button';
import { CalendarInput } from '@alfalab/core-components-calendar-input';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../api/client';
import { PlatformSegmentTitle } from '../components/PlatformSegmentTitle';
import { TelegramAvatar, TelegramLogo } from '../components/TelegramLogo';
import type { DashboardPeriod, DashboardSummary, DashboardSummaryItem, SavedGroup, SocialPlatform, TelegramAnalytics, TelegramChannel, VkGroup, VkListResponse, YoutubeChannel } from '../api/types';
import { number } from './dashboardSelectors';
import { MAX_CUSTOM_PERIOD_DAYS } from '../utils/date';

type Props = { groups: SavedGroup[]; hasPaidAccess: boolean; isTrialActive: boolean; freeGroupsDisabled: boolean; onGroupsChanged: () => Promise<void> };
type AddMode = 'tracked' | 'free' | 'bonus';
type Platform = SocialPlatform;
type SearchResult = VkGroup | YoutubeChannel | TelegramChannel;
const DASHBOARD_PERIOD_STORAGE_KEY = 'socstat.dashboard.period';
const DASHBOARD_CUSTOM_RANGE_STORAGE_KEY = 'socstat.dashboard.customRange';
const DAY_MS = 86_400_000;
const dashboardPeriodValues: DashboardPeriod[] = ['last7days', 'last30days', 'today', 'yesterday', 'currentMonth', 'custom'];
type DateRange = { dateFrom: string; dateTo: string };

function getSavedDashboardPeriod(): DashboardPeriod {
  try {
    const savedPeriod = window.localStorage.getItem(DASHBOARD_PERIOD_STORAGE_KEY) as DashboardPeriod | null;
    return savedPeriod && dashboardPeriodValues.includes(savedPeriod) ? savedPeriod : 'last7days';
  } catch {
    return 'last7days';
  }
}

function formatIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDatePickerValue(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : '';
}

function dateTimestamp(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

function isValidCustomRange(range: DateRange | null): range is DateRange {
  if (!range?.dateFrom || !range.dateTo || range.dateFrom > range.dateTo || range.dateTo > formatIsoDate(new Date())) return false;
  return Math.round((dateTimestamp(range.dateTo) - dateTimestamp(range.dateFrom)) / DAY_MS) + 1 <= MAX_CUSTOM_PERIOD_DAYS;
}

function getSavedCustomRange(): DateRange | null {
  try {
    const savedRange = JSON.parse(window.localStorage.getItem(DASHBOARD_CUSTOM_RANGE_STORAGE_KEY) ?? 'null') as DateRange | null;
    return isValidCustomRange(savedRange) ? savedRange : null;
  } catch {
    return null;
  }
}

function isYoutubeChannel(group: SearchResult): group is YoutubeChannel {
  return 'platform' in group && group.platform === 'youtube';
}

function isTelegramChannel(group: SearchResult): group is TelegramChannel {
  return 'platform' in group && group.platform === 'telegram';
}

function platformLabel(platform: SocialPlatform) {
  return platform === 'youtube' ? 'YouTube' : platform === 'telegram' ? 'Telegram' : 'ВКонтакте';
}

function PlatformIcon({ platform, mobile = false }: { platform: SocialPlatform; mobile?: boolean }) {
  const className = mobile ? 'community-platform-mobile' : undefined;
  if (platform === 'telegram') return <TelegramLogo className={className} size={24} />;
  return <img className={className} src={platform === 'youtube' ? '/youtube-logo.png' : '/vk-network-logo.png'} alt={platformLabel(platform)} title={platformLabel(platform)} />;
}

function failedDashboardItem(group: SavedGroup, error: unknown): DashboardSummaryItem {
  return {
    savedGroupId: group.id,
    source: group.source,
    platform: group.platform,
    group: { id: group.externalId, name: group.name, screenName: group.handle, photo: group.photo },
    membersCount: group.membersCount ?? null,
    isManagedByUser: group.source === 'managed',
    statsAvailable: null,
    growth: { total: 0, subscribed: 0, unsubscribed: 0 },
    traffic: { visitors: 0, views: 0 },
    reach: { subscribers: 0, total: 0 },
    activity: { likes: 0, reposts: 0, comments: 0 },
    snapshotGrowth: null,
    warnings: [],
    error: {
      code: 'DASHBOARD_GROUP_REQUEST_FAILED',
      message: error instanceof Error ? error.message : 'Не удалось загрузить данные сообщества.'
    }
  };
}

export function DashboardPage({ groups, hasPaidAccess, isTrialActive, freeGroupsDisabled, onGroupsChanged }: Props) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>(getSavedDashboardPeriod);
  const [customRange, setCustomRange] = useState<DateRange | null>(getSavedCustomRange);
  // A custom period without a chosen range has nothing to load until the user applies dates.
  const isPeriodReady = period !== 'custom' || Boolean(customRange);
  const periodQuery = period === 'custom' && customRange
    ? `period=custom&dateFrom=${customRange.dateFrom}&dateTo=${customRange.dateTo}`
    : `period=${period}`;
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
  const summaryRequestId = useRef(0);
  const loadSummary = async (forceRefresh = false) => {
    const requestId = ++summaryRequestId.current;
    const pendingGroups = groups.filter((group) => group.isTracked);
    setMessage(''); setIsSummaryLoading(true);
    setSummary(null);
    let nextGroupIndex = 0;
    let failedGroups = 0;

    const updateItem = (item: DashboardSummaryItem, response?: DashboardSummary) => {
      if (summaryRequestId.current !== requestId) return;
      setSummary((current) => ({
        period: response?.period ?? current?.period ?? { key: period, dateFrom: customRange?.dateFrom ?? '', dateTo: customRange?.dateTo ?? '' },
        groups: [...(current?.groups ?? []).filter((currentItem) => currentItem.savedGroupId !== item.savedGroupId), item]
      }));
    };

    const worker = async () => {
      while (summaryRequestId.current === requestId) {
        const group = pendingGroups[nextGroupIndex++];
        if (!group) return;
        try {
          const response = await apiGet<DashboardSummary>(`/api/dashboard/summary/groups/${encodeURIComponent(group.id)}?${periodQuery}${forceRefresh ? '&refresh=1' : ''}`);
          const item = response.groups[0];
          if (item) updateItem(item, response);
        } catch (error) {
          failedGroups += 1;
          updateItem(failedDashboardItem(group, error));
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(2, pendingGroups.length) }, () => worker()));
      if (summaryRequestId.current === requestId && failedGroups) {
        setMessage(`Не удалось загрузить данные для ${failedGroups} ${failedGroups === 1 ? 'сообщества' : 'сообществ'}.`);
      }
    } finally {
      if (summaryRequestId.current === requestId) setIsSummaryLoading(false);
    }
  };
  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_PERIOD_STORAGE_KEY, period);
    } catch {
      // The dashboard still works when browser storage is unavailable.
    }
  }, [period]);
  useEffect(() => {
    try {
      if (customRange) window.localStorage.setItem(DASHBOARD_CUSTOM_RANGE_STORAGE_KEY, JSON.stringify(customRange));
    } catch {
      // The dashboard still works when browser storage is unavailable.
    }
  }, [customRange]);
  const trackedGroupsKey = groups.filter((group) => group.isTracked).map((group) => `${group.id}:${group.externalId}:${group.platform}:${group.source}`).join(',');
  useEffect(() => {
    if (trackedGroupsKey && isPeriodReady) void loadSummary();
    else { summaryRequestId.current += 1; setSummary(null); setIsSummaryLoading(false); }
    return () => { summaryRequestId.current += 1; };
  }, [trackedGroupsKey, hasPaidAccess, periodQuery]);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      setSearchError(platform === 'telegram' ? 'Введите @username или ссылку на публичный Telegram-канал.' : `Введите название, ID или ссылку на ${platform === 'youtube' ? 'канал' : 'сообщество'}.`);
      return;
    }
    setSearchError(''); setResults([]); setIsSearching(true);
    try {
      if (platform === 'telegram') {
        const channel = await apiGet<TelegramAnalytics['channel']>(`/api/telegram/channels/resolve?q=${encodeURIComponent(query.trim())}`);
        setResults([{
          platform: 'telegram', id: channel.id, externalId: channel.id, name: channel.title,
          description: channel.description, handle: channel.username, url: channel.url,
          photo: channel.photo, followersCount: channel.subscribers, verified: channel.verified
        }]);
        return;
      }
      const path = platform === 'youtube' ? '/api/youtube/channels/search' : '/api/vk/groups/search';
      const items = (await apiGet<VkListResponse<SearchResult>>(`${path}?q=${encodeURIComponent(query.trim())}`)).items;
      setResults(items);
      if (!items.length) setSearchError(platform === 'youtube' ? 'YouTube-каналы не найдены.' : 'Сообщества не найдены.');
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Не удалось найти источник.');
    } finally { setIsSearching(false); }
  };
  const updateQuery = (value: string) => { setQuery(value); if (searchError) setSearchError(''); };
  const add = async (group: SearchResult) => { try { setSearchError(''); const payload = isYoutubeChannel(group) || isTelegramChannel(group) ? { platform: group.platform, group } : { platform: 'vk', group: { id: group.id, name: group.name, screen_name: group.screen_name, photo: group.photo_100 ?? group.photo_50, members_count: group.members_count } }; const path = addMode === 'free' ? '/api/account/groups/free' : addMode === 'bonus' ? '/api/account/groups/bonus' : '/api/account/groups'; await apiPost(path, addMode === 'tracked' ? { ...payload, source: 'bookmark' } : payload); await onGroupsChanged(); setResults([]); setIsAddModalOpen(false); setMessage(`«${group.name}» добавлено.`); } catch (error) { setSearchError(error instanceof Error ? error.message : 'Не удалось добавить источник.'); } };
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
    <CommunitiesTable groups={trackedGroups} summary={summary} period={period} customRange={customRange} hasPaidAccess={hasPaidAccess} onPeriodChange={setPeriod} onCustomRangeApply={setCustomRange} onAdd={() => openAddModal('tracked')} onRefresh={() => isPeriodReady && void loadSummary(true)} onReorder={async (groupIds) => { await apiPost('/api/account/groups/order', { groupIds }); await onGroupsChanged(); }} onRemove={remove} onSelect={(group) => navigate(group.platform === 'telegram' ? `/analytics?platform=telegram&channel=${encodeURIComponent(group.handle ?? group.externalId)}` : `/analytics?groupId=${encodeURIComponent(group.externalId)}&platform=${group.platform}`)} deletingGroupId={deletingGroupId} isRefreshing={isSummaryLoading} />
    {freeGroupsDisabled
      ? isTrialActive && <div className="trial-access-note span-2"><Check size={17} /><span><strong>Пробный период активен.</strong> В течение семи дней доступна аналитика без ограничений.</span></div>
      : <FreeCommunitiesPanel groups={freeGroups} isTrialActive={isTrialActive} onAdd={openAddModal} />}
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
  return <Modal open={open} onClose={onClose} hasCloser scrollLock size={600}><Modal.Header title="Добавить источник" /><Modal.Content><p className="add-community-modal-description">Добавьте сообщество VK, YouTube-канал или публичный Telegram-канал.</p><Management {...managementProps} /></Modal.Content></Modal>;
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
    {isTrialActive && <div className="trial-access-note"><Check size={17} /><span><strong>Пробный период активен.</strong> В течение семи дней доступна аналитика без ограничений.</span></div>}
    {!hasBonusGroup && <div className="free-communities-action"><div>{hasBaseGroup && <><LockKeyhole size={17} /><span>Подпишитесь на <a href="https://vk.com/socstat" target="_blank" rel="noreferrer">сообщество Socstat</a> и добавьте ещё одно.</span></>}</div><div className="free-communities-add"><Button className="dashboard-action-button" type="button" view="primary" size={40} leftAddons={<Plus size={16} />} onClick={() => onAdd(hasBaseGroup ? 'bonus' : 'free')}>{hasBaseGroup ? 'Добавить бонусное сообщество' : 'Добавить сообщество'}</Button>{!hasBaseGroup && <span className="free-communities-platforms" aria-label="Поддерживаются ВКонтакте, YouTube и Telegram"><PlatformIcon platform="vk" /><PlatformIcon platform="youtube" /><PlatformIcon platform="telegram" /></span>}</div></div>}
    {hasBonusGroup && <div className="free-communities-limit"><Check size={17} />Доступны оба бесплатных сообщества для анализа.</div>}
  </section>;
}

function FreeCommunitySlot({ title, description, isActive, group }: { title: string; description: string; isActive: boolean; group?: SavedGroup }) {
  return <div className={`free-community-slot ${isActive ? 'active' : ''}`}><span className="free-community-slot-icon">{isActive ? <Check size={16} /> : <Users size={16} />}</span><div><strong>{group?.name ?? title}</strong><small>{isActive ? `Добавлено · ${platformLabel(group!.platform)}` : description}</small></div>{group && <a aria-label={`Открыть ${group.name}`} href={group.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a>}</div>;
}

const dashboardPeriods: Array<{ id: DashboardPeriod; title: string }> = [
  { id: 'last7days', title: '7 дней' },
  { id: 'last30days', title: '30 дней' },
  { id: 'today', title: 'Сегодня' },
  { id: 'yesterday', title: 'Вчера' },
  { id: 'currentMonth', title: 'Этот месяц' },
  { id: 'custom', title: 'Свой период' }
];

function CustomPeriodForm({ range, onApply }: { range: DateRange | null; onApply: (range: DateRange) => void }) {
  const [dateFrom, setDateFrom] = useState(range?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(range?.dateTo ?? '');
  const draft = { dateFrom, dateTo };
  const isApplied = range?.dateFrom === dateFrom && range.dateTo === dateTo;
  const dateFromTimestamp = dateFrom ? dateTimestamp(dateFrom) : undefined;
  const dateToMax = dateFromTimestamp ? Math.min(Date.now(), dateFromTimestamp + (MAX_CUSTOM_PERIOD_DAYS - 1) * DAY_MS) : Date.now();
  return <div className="custom-period-form dashboard-custom-period">
    <div className="custom-period-fields">
      <CalendarInput className="custom-period-picker" client="desktop" label="Дата начала" maxDate={dateTo ? dateTimestamp(dateTo) : Date.now()} size={40} value={formatDatePickerValue(dateFrom)} onChange={(_, { date }) => !Number.isNaN(date.getTime()) && setDateFrom(formatIsoDate(date))} />
      <CalendarInput className="custom-period-picker" client="desktop" label="Дата окончания" maxDate={dateToMax} minDate={dateFromTimestamp} size={40} value={formatDatePickerValue(dateTo)} onChange={(_, { date }) => !Number.isNaN(date.getTime()) && setDateTo(formatIsoDate(date))} />
      <Button className="custom-period-submit" client="desktop" disabled={!isValidCustomRange(draft) || isApplied} size={40} type="button" view="primary" onClick={() => onApply(draft)}>Применить период</Button>
    </div>
    <span className="custom-period-hint">{dateFrom && dateTo && !isValidCustomRange(draft) ? `Укажите период до ${MAX_CUSTOM_PERIOD_DAYS} дней без будущих дат.` : `Можно выбрать период до ${MAX_CUSTOM_PERIOD_DAYS} дней включительно.`}</span>
  </div>;
}

function CommunitiesTable({ groups, summary, period, customRange, hasPaidAccess, onPeriodChange, onCustomRangeApply, onAdd, onRefresh, onReorder, onRemove, onSelect, deletingGroupId, isRefreshing }: { groups: SavedGroup[]; summary: DashboardSummary | null; period: DashboardPeriod; customRange: DateRange | null; hasPaidAccess: boolean; onPeriodChange: (period: DashboardPeriod) => void; onCustomRangeApply: (range: DateRange) => void; onAdd: () => void; onRefresh: () => void; onReorder: (groupIds: string[]) => Promise<void>; onRemove: (group: SavedGroup) => Promise<void>; onSelect: (group: SavedGroup) => void; deletingGroupId: string | null; isRefreshing: boolean }) {
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine' | 'other'>('all');
  const [orderedGroupIds, setOrderedGroupIds] = useState(groups.map((group) => group.id));
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState('');
  const groupIdsKey = groups.map((group) => group.id).join(',');
  useEffect(() => setOrderedGroupIds(groups.map((group) => group.id)), [groupIdsKey]);
  const groupOrder = new Map(orderedGroupIds.map((id, index) => [id, index]));
  const rows = groups.map((group) => {
    const summaryItem = summary?.groups.find((item) => item.savedGroupId === group.id);
    return {
      group,
      summaryItem,
      isManaged: summaryItem?.isManagedByUser ?? group.source === 'managed'
    };
  });
  const visibleRows = rows
    .filter(({ isManaged }) => ownershipFilter === 'all' || (ownershipFilter === 'mine' ? isManaged : !isManaged))
    .sort((left, right) => (groupOrder.get(left.group.id) ?? Number.MAX_SAFE_INTEGER) - (groupOrder.get(right.group.id) ?? Number.MAX_SAFE_INTEGER));
  const managedCount = rows.filter(({ isManaged }) => isManaged).length;
  const moveGroup = async (targetGroupId: string) => {
    if (!draggedGroupId || draggedGroupId === targetGroupId) return;
    const nextOrder = [...orderedGroupIds];
    const fromIndex = nextOrder.indexOf(draggedGroupId);
    const toIndex = nextOrder.indexOf(targetGroupId);
    if (fromIndex < 0 || toIndex < 0) return;
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, draggedGroupId);
    setOrderedGroupIds(nextOrder);
    setDraggedGroupId(null);
    setReorderError('');
    try {
      await onReorder(nextOrder);
    } catch (error) {
      setOrderedGroupIds(groups.map((group) => group.id));
      setReorderError(error instanceof Error ? error.message : 'Не удалось сохранить порядок источников.');
    }
  };

  return <section className="panel span-2 communities-panel">
    <div className="section-title"><div><h2>Отслеживаемые источники</h2><strong>{groups.length}</strong></div><Button disabled={isRefreshing} leftAddons={<RefreshCw size={16} />} loading={isRefreshing} size={40} type="button" view="secondary" onClick={onRefresh}>Обновить данные</Button></div>
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
        {/* SegmentedControl renders at most five segments, so the custom range gets its own button. */}
        <SegmentedControl className="communities-period-control" onChange={(id) => onPeriodChange(id as DashboardPeriod)} selectedId={period} size={40}>
          {dashboardPeriods.filter((item) => item.id !== 'custom').map((item) => <Segment className="communities-period-segment" id={item.id} key={item.id} title={item.title} />)}
        </SegmentedControl>
        <Button className={`communities-period-custom ${period === 'custom' ? 'active' : ''}`} aria-pressed={period === 'custom'} leftAddons={<CalendarDays size={16} />} size={40} type="button" view="secondary" onClick={() => onPeriodChange('custom')}>Свой период</Button>
      </div>
    </div>
    {period === 'custom' && <CustomPeriodForm range={customRange} onApply={onCustomRangeApply} />}
    <p className="communities-reorder-hint"><GripVertical size={16} />Перетащите источник за значок слева, чтобы изменить порядок.</p>
    {reorderError && <div className="form-message">{reorderError}</div>}
    <div className="communities-table">
      <div className="communities-table-head"><span aria-label="Перемещение" /><span>Сеть</span><span>Сообщество</span><span>Участники</span><span className="communities-table-head-help">Прирост<GrowthHelp /></span><span>Посещения<br />Просмотры</span><span>Охват подписчиков<br />Полный охват</span><span>Реакции<br />Репосты / пересылки<br />Комментарии</span><span aria-label="Действия" /></div>
      {visibleRows.length ? visibleRows.map(({ group, summaryItem, isManaged }) => {
        const membersCount = summaryItem?.membersCount ?? group.membersCount;
        const selectGroup = () => onSelect(group);
        return <div className={`communities-table-row communities-table-row-action ${draggedGroupId === group.id ? 'is-dragging' : ''}`} key={group.id} onClick={selectGroup} onDragOver={(event) => event.preventDefault()} onDrop={() => void moveGroup(group.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectGroup(); } }} role="link" tabIndex={0}>
          <span className="communities-table-drag"><button aria-label={`Переместить ${group.name}`} draggable type="button" onClick={(event) => event.stopPropagation()} onDragEnd={() => setDraggedGroupId(null)} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; const row = event.currentTarget.closest<HTMLElement>('.communities-table-row'); if (row) { const preview = row.cloneNode(true) as HTMLElement; preview.classList.add('communities-table-drag-preview'); preview.style.width = `${row.getBoundingClientRect().width}px`; document.body.append(preview); event.dataTransfer.setDragImage(preview, 28, 28); requestAnimationFrame(() => preview.remove()); } setDraggedGroupId(group.id); }}><GripVertical size={18} /></button></span>
          <span className="communities-table-network"><PlatformIcon platform={group.platform} /></span>
          <span className="communities-table-name">{group.platform === 'telegram' ? <TelegramAvatar src={summaryItem?.group.photo ?? group.photo} size={30} /> : group.photo ? <img src={group.photo} alt="" /> : <Users size={18} />}<span><strong>{group.name}</strong><small className={`communities-table-owner ${isManaged ? 'managed' : ''}`}><PlatformIcon platform={group.platform} mobile />{group.platform === 'youtube' ? 'YouTube-канал' : group.platform === 'telegram' ? 'Telegram-канал' : isManaged ? 'Моё сообщество' : 'Чужое сообщество'}</small></span></span>
          <MetricValue value={membersCount} loading={!summaryItem} />
          {group.platform !== 'vk' ? <SnapshotGrowthValue item={summaryItem} periodFrom={summary?.period.dateFrom} /> : <GrowthValue item={summaryItem} periodFrom={summary?.period.dateFrom} />}
          {group.platform !== 'vk' ? <MetricValue value={summaryItem?.traffic.views} loading={!summaryItem} /> : <PairValue first={summaryItem?.traffic.visitors} second={summaryItem?.traffic.views} firstIcon={Users} secondIcon={Eye} unavailable={isStatsUnavailable(summaryItem)} loading={!summaryItem} />}
          {!hasPaidAccess ? <TariffUnavailableValue /> : group.platform !== 'vk' ? <MetricValue /> : <PairValue first={summaryItem?.reach.subscribers} second={summaryItem?.reach.total} unavailable={isStatsUnavailable(summaryItem)} loading={!summaryItem} />}
          {!hasPaidAccess ? <TariffUnavailableValue /> : <TripleValue item={summaryItem} loading={!summaryItem} platform={group.platform} />}
          <details className="community-actions" onClick={(event) => event.stopPropagation()}>
            <summary aria-label={`Действия для ${group.name}`}><MoreHorizontal size={20} /></summary>
            <IconButton className="community-delete-button" aria-label={`Удалить ${group.name}`} icon={Trash2} loading={deletingGroupId === group.id} onClick={() => void onRemove(group)} size={32} view="transparent" />
          </details>
        </div>;
      }) : <div className="communities-table-empty">В этой категории пока нет сообществ.</div>}
    </div>
    <p className="communities-table-scroll-hint" aria-hidden="true">Прокрутите таблицу в сторону, чтобы увидеть все показатели →</p>
    <div className="communities-add"><Button className="dashboard-action-button" type="button" view="primary" size={40} leftAddons={<Plus size={16} />} onClick={onAdd}>Добавить источник</Button><span className="free-communities-platforms" aria-label="Поддерживаются ВКонтакте, YouTube и Telegram"><PlatformIcon platform="vk" /><PlatformIcon platform="youtube" /><PlatformIcon platform="telegram" /></span></div>
  </section>;
}

function GrowthHelp() {
  return <Tooltip
    content={<div className="growth-help-content">
      <p><b>ВКонтакте, ваши сообщества:</b> подписавшиеся минус отписавшиеся из официальной статистики VK.</p>
      <p><b>Telegram, YouTube и чужие группы VK:</b> платформы не отдают историю подписчиков, поэтому Socstat каждую ночь сам сохраняет их число. Прирост — разница между первым срезом в периоде и текущим значением.</p>
      <p>История начинается с момента, когда источник впервые добавили в отслеживаемые, и задним числом не восстанавливается. Подпись «с 4 окт.» значит, что срезов за начало периода ещё нет.</p>
    </div>}
    position="bottom"
    targetTag="span"
    view="hint"
  ><button aria-label="Как считается прирост" className="growth-help-button" type="button"><CircleHelp size={14} /></button></Tooltip>;
}

function isStatsUnavailable(item?: DashboardSummaryItem) {
  return Boolean(item && (item.statsAvailable === false || item.statsAvailable === null || item.error));
}

function MetricValue({ value, loading = false }: { value?: number | null; loading?: boolean }) {
  return <span className={`communities-table-metric ${loading ? 'loading' : ''}`}>{loading ? 'Загружаем данные' : typeof value === 'number' ? number(value) : '—'}</span>;
}

function TariffUnavailableValue() {
  return <span className="communities-table-metric tariff-unavailable" title="Расчёт недоступен: срок действия тарифа истёк"><span className="tariff-unavailable-label"><LockKeyhole size={14} /><span>Тариф истёк</span></span></span>;
}

function GrowthValue({ item, periodFrom }: { item?: DashboardSummaryItem; periodFrom?: string }) {
  if (!item) return <MetricValue loading />;
  if (isStatsUnavailable(item)) return item.snapshotGrowth ? <SnapshotGrowthValue item={item} periodFrom={periodFrom} /> : <MetricValue />;
  return <span className="communities-table-pair"><strong>{item.growth.total > 0 ? '+' : ''}{number(item.growth.total)}</strong><small><ArrowUp size={12} />{number(item.growth.subscribed)} <ArrowDown size={12} />{number(item.growth.unsubscribed)}</small></span>;
}

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function shortDate(value: string) {
  return shortDateFormatter.format(new Date(`${value}T00:00:00Z`));
}

// Прирост по ежедневным срезам Socstat. Пока история короче периода, честно показываем, с какого дня он посчитан.
function SnapshotGrowthValue({ item, periodFrom }: { item?: DashboardSummaryItem; periodFrom?: string }) {
  if (!item) return <MetricValue loading />;
  const growth = item.snapshotGrowth;
  if (item.error || !growth) return <MetricValue />;
  const title = 'Прирост по ежедневным срезам Socstat: каждый день мы сохраняем число подписчиков, поэтому видна динамика даже там, где платформа её не отдаёт.';
  if (growth.total === null) {
    return <span className="communities-table-pair snapshot-growth" title={title}><strong>—</strong><small><CalendarClock size={12} />{growth.historySince ? `История с ${shortDate(growth.historySince)}` : 'Первый срез — ночью'}</small></span>;
  }
  const isPartial = Boolean(growth.since && periodFrom && growth.since > periodFrom);
  return <span className="communities-table-pair snapshot-growth" title={title}><strong>{growth.total > 0 ? '+' : ''}{number(growth.total)}</strong><small><CalendarClock size={12} />{isPartial ? `с ${shortDate(growth.since!)}` : 'по срезам'}</small></span>;
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
  const placeholder = platform === 'youtube' ? 'URL, @handle, channel ID или название' : platform === 'telegram' ? '@username или ссылка t.me' : 'Название или screen name сообщества';
  const searchingLabel = platform === 'youtube' ? 'YouTube-канал' : platform === 'telegram' ? 'Telegram-канал' : 'сообщество';
  return <div className="dashboard-management"><SegmentedControl className="social-platform-switcher" onChange={(id) => setPlatform(id as Platform)} selectedId={platform} size={40}><Segment id="vk" title={<PlatformSegmentTitle platform="vk" />} /><Segment id="youtube" title={<PlatformSegmentTitle platform="youtube" />} /><Segment id="telegram" title={<PlatformSegmentTitle platform="telegram" />} /></SegmentedControl><form className="search-form" onSubmit={search}><Input block className="dashboard-search-input" value={query} onChange={(_, payload) => setQuery(payload.value)} placeholder={placeholder} /><Button className="dashboard-action-button" type="submit" view="primary" size={48} leftAddons={<Plus size={17} />} loading={isSearching}>Найти</Button></form><div className={`source-search-feedback ${searchError ? 'has-error' : ''}`} aria-live="polite">{isSearching ? `Ищем ${searchingLabel}…` : searchError}</div><div className="search-results source-search-results">{results.map((group) => <GroupOption group={group} key={group.id} isAdded={savedGroupIds.includes(`${platform}:${group.id}`)} onAdd={() => void add(group)} />)}</div>{platform === 'vk' && <div className="vk-picker"><div className="vk-picker-heading"><strong>Или выберите из VK</strong></div>{isVkGroupsLoading ? <div className="empty-state">Загружаем сообщества VK...</div> : <div className="search-results vk-picker-results">{visiblePickerGroups.length ? visiblePickerGroups.map((group) => <GroupOption group={group} key={group.id} isAdded={savedGroupIds.includes(`vk:${group.id}`)} onAdd={() => void add(group)} />) : <div className="empty-state">В этом списке нет сообществ.</div>}</div>}</div>}</div>;
}

function GroupOption({ group, isAdded, onAdd }: { group: SearchResult; isAdded: boolean; onAdd: () => void }) {
  const youtube = isYoutubeChannel(group);
  const telegram = isTelegramChannel(group);
  const groupPath = youtube ? group.handle ?? group.id : telegram ? `@${group.handle}` : group.screen_name ?? `club${group.id}`;
  const photo = youtube || telegram ? group.photo : group.photo_100 ?? group.photo_50;
  const href = youtube || telegram ? group.url : `https://vk.com/${groupPath}`;
  const details = youtube
    ? `${group.followersCount === null ? 'Подписчики: Недоступно' : `${number(group.followersCount)} подписчиков`} · ${number(group.videoCount)} видео · ${number(group.viewCount)} просмотров`
    : telegram
      ? group.followersCount === null ? 'Подписчики: Недоступно' : `${number(group.followersCount)} подписчиков`
      : `vk.com/${groupPath}`;
  return <div className="search-result">{telegram ? <TelegramAvatar src={photo} size={48} /> : photo ? <img src={photo} alt="" /> : <Users size={32} />}<span><OverflowingCommunityName name={group.name} /><a href={href} target="_blank" rel="noreferrer">{groupPath}</a><small>{details}</small></span><Button className="dashboard-action-button group-add-button" aria-label={isAdded ? `${group.name} уже добавлено` : `Добавить ${group.name}`} disabled={isAdded} onClick={onAdd} size={32} view="primary">{isAdded ? 'Добавлено' : 'Добавить'}</Button></div>;
}

function OverflowingCommunityName({ name }: { name: string }) {
  return <strong title={name}>{name}</strong>;
}
