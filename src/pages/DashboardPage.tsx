import { AlertTriangle, BarChart3, ExternalLink, Plus, RefreshCw, Search, Sparkles, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';
import type { DashboardPeriod, DashboardSummary, DashboardSummaryItem, SavedGroup, VkGroup, VkListResponse } from '../api/types';

type Props = { groups: SavedGroup[]; hasPaidAccess: boolean; onGroupsChanged: () => Promise<void> };
type Filter = 'all' | 'managed' | 'saved' | 'attention' | 'data';
type Sort = 'priority' | 'growth' | 'members';

function format(value: number) { return new Intl.NumberFormat('ru-RU').format(value); }
function getAttention(item: DashboardSummaryItem) {
  if (item.error) return { priority: 4, text: item.error.message, action: 'Обновить данные' };
  if (item.warnings.length) return { priority: 3, text: item.warnings[0], action: 'Проверить доступ VK' };
  if (item.growth.total < 0) return { priority: 2, text: `Прирост ${format(item.growth.total)} за период`, action: 'Посмотреть динамику' };
  if (item.activity.likes + item.activity.reposts + item.activity.comments === 0) return { priority: 1, text: 'Нет реакций за период', action: 'Анализировать сообщество' };
  return null;
}

export function DashboardPage({ groups, hasPaidAccess, onGroupsChanged }: Props) {
  const [period, setPeriod] = useState<DashboardPeriod>('last7days');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('priority');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VkGroup[]>([]);

  const loadSummary = async (nextPeriod = period) => {
    if (!hasPaidAccess) { setSummary(null); setMessage('Детальная статистика недоступна: срок доступа истёк.'); return; }
    setLoading(true); setMessage('');
    try { setSummary(await apiGet<DashboardSummary>(`/api/dashboard/summary?period=${nextPeriod}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить портфель сообществ.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadSummary(); }, [groups.length, hasPaidAccess]);

  const portfolio = useMemo(() => {
    const items = summary?.groups ?? [];
    return items.filter((item) => {
      const attention = Boolean(getAttention(item));
      if (filter === 'managed') return item.source === 'managed';
      if (filter === 'saved') return item.source !== 'managed';
      if (filter === 'attention') return attention;
      if (filter === 'data') return Boolean(item.error || item.warnings.length);
      return true;
    }).sort((left, right) => {
      if (sort === 'growth') return right.growth.total - left.growth.total;
      if (sort === 'members') return right.membersCount - left.membersCount;
      return (getAttention(right)?.priority ?? 0) - (getAttention(left)?.priority ?? 0);
    });
  }, [filter, sort, summary]);
  const attention = useMemo(() => (summary?.groups ?? []).map((item) => ({ item, signal: getAttention(item) })).filter((value): value is { item: DashboardSummaryItem; signal: NonNullable<ReturnType<typeof getAttention>> } => Boolean(value.signal)).sort((left, right) => right.signal.priority - left.signal.priority).slice(0, 5), [summary]);
  const portfolioKpi = useMemo(() => {
    const items = summary?.groups ?? [];
    const statsItems = items.filter((item) => !item.error && !item.warnings.length);
    return { count: items.length, members: items.reduce((sum, item) => sum + item.membersCount, 0), growth: statsItems.reduce((sum, item) => sum + item.growth.total, 0), statsCount: statsItems.length };
  }, [summary]);

  const search = async (event: FormEvent) => {
    event.preventDefault(); if (!query.trim()) return;
    try { const data = await apiGet<VkListResponse<VkGroup>>(`/api/vk/groups/search?q=${encodeURIComponent(query.trim())}`); setResults(data.items); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось найти сообщество.'); }
  };
  const add = async (group: VkGroup) => {
    try { await apiPost('/api/account/groups/free', { group: { id: group.id, name: group.name, screen_name: group.screen_name, photo: group.photo_100 ?? group.photo_50, members_count: group.members_count } }); await onGroupsChanged(); setResults([]); setMessage(`«${group.name}» добавлено.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось добавить сообщество.'); }
  };

  if (!groups.length && !loading) return <div className="page-grid dashboard-page"><section className="panel span-2 dashboard-onboarding"><Sparkles size={28} /><h2>Добавьте первое сообщество</h2><p>Socstat покажет динамику аудитории, сильные публикации и точки роста.</p><div className="dashboard-quick-actions"><Link className="primary-button" to="/analytics">Выбрать из моих сообществ VK</Link><button className="secondary-button" onClick={() => document.getElementById('dashboard-management')?.scrollIntoView()}>Найти любое сообщество</button></div><Management query={query} setQuery={setQuery} results={results} search={search} add={add} /></section></div>;

  return <div className="page-grid dashboard-page">
    <section className="panel span-2 dashboard-overview">
      <div className="panel-header"><div><h2>Главная</h2><p>{summary ? `${summary.period.dateFrom} — ${summary.period.dateTo}` : 'Обзор отслеживаемых сообществ'}</p></div><button className="icon-button" onClick={() => loadSummary()} aria-label="Обновить данные"><RefreshCw size={18} /></button></div>
      <div className="period-tabs">{([{ key: 'last7days', label: '7 дней' }, { key: 'currentMonth', label: 'Текущий месяц' }, { key: 'today', label: 'Сегодня' }] as const).map((item) => <button key={item.key} className={period === item.key ? 'active' : ''} onClick={() => { setPeriod(item.key); loadSummary(item.key); }}>{item.label}</button>)}</div>
      {message && <div className="form-message">{message}</div>}
      {!hasPaidAccess && <Link className="primary-button" to="/account">Продлить доступ</Link>}
      {loading ? <div className="dashboard-skeleton"><span /><span /><span /><span /></div> : <div className="dashboard-kpis"><div><span>Отслеживаемые сообщества</span><strong>{portfolioKpi.count}</strong></div><div><span>Суммарная аудитория</span><strong>{format(portfolioKpi.members)}</strong></div><div><span>Чистый прирост</span><strong>{portfolioKpi.statsCount ? `${portfolioKpi.growth > 0 ? '+' : ''}${format(portfolioKpi.growth)}` : 'Недоступно'}</strong><small>{`по ${portfolioKpi.statsCount} из ${portfolioKpi.count} сообществ`}</small></div><div><span>Требуют внимания</span><strong>{attention.length}</strong></div></div>}
    </section>
    <section className="panel span-2"><div className="section-title"><div><h2>Требует внимания</h2><p>Сигналы с конкретным следующим действием.</p></div></div>{loading ? <div className="empty-state">Обновляем сигналы…</div> : attention.length ? <div className="attention-list">{attention.map(({ item, signal }) => <article key={item.savedGroupId} className="attention-item"><AlertTriangle size={18} /><div><strong>{item.group.name}</strong><span>{signal.text}</span></div><Link className="secondary-button" to={`/analytics?groupId=${item.group.id}`}>{signal.action}</Link></article>)}</div> : <div className="empty-state">В портфеле нет срочных сигналов. Можно перейти к сильному контенту или продолжить анализ.</div>}</section>
    <section className="panel span-2"><div className="dashboard-quick-actions"><Link className="primary-button" to="/analytics"><BarChart3 size={17} />Анализировать сообщество</Link><Link className="secondary-button" to="/compare">Сравнить сообщества</Link><button className="secondary-button" onClick={() => document.getElementById('dashboard-management')?.scrollIntoView()}><Plus size={17} />Добавить сообщество</button></div></section>
    <section className="panel span-2"><div className="section-title"><div><h2>Портфель сообществ</h2><p>Сначала — сообщества с сигналами или проблемами данных.</p></div><div className="content-controls"><label>Фильтр<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">Все</option><option value="managed">Мои</option><option value="saved">Сохранённые</option><option value="attention">Требующие внимания</option><option value="data">Проблемы с данными</option></select></label><label>Сортировка<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="priority">По важности</option><option value="growth">По приросту</option><option value="members">По подписчикам</option></select></label></div></div>{portfolio.length ? <div className="portfolio-grid">{portfolio.map((item) => <article className="portfolio-card" key={item.savedGroupId}><div className="summary-group">{item.group.photo && <img src={item.group.photo} alt="" />}<div><strong>{item.group.name}</strong><span>{item.source === 'managed' ? 'Управляемое' : item.source}</span></div></div>{item.error ? <div className="portfolio-warning">{item.error.message}</div> : <><div className="portfolio-metrics"><span>Подписчики<strong>{format(item.membersCount)}</strong></span><span>Прирост<strong>{item.warnings.length ? 'Недоступно' : format(item.growth.total)}</strong></span><span>Реакции<strong>{format(item.activity.likes + item.activity.reposts + item.activity.comments)}</strong></span></div>{item.warnings.map((warning) => <div className="portfolio-warning" key={warning}>{warning}</div>)}</>}<div className="group-actions"><Link className="secondary-button" to={`/analytics?groupId=${item.group.id}`}>Анализировать</Link><a className="icon-button" aria-label="Открыть сообщество VK" href={`https://vk.com/${item.group.screenName ?? `club${item.group.id}`}`} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a></div></article>)}</div> : <div className="empty-state">Нет сообществ по выбранному фильтру.</div>}</section>
    <section className="panel span-2" id="dashboard-management"><details><summary>Управление сообществами</summary><p>Поиск и добавление вынесены из основного рабочего сценария.</p><Management query={query} setQuery={setQuery} results={results} search={search} add={add} /></details></section>
  </div>;
}

function Management({ query, setQuery, results, search, add }: { query: string; setQuery: (value: string) => void; results: VkGroup[]; search: (event: FormEvent) => Promise<void>; add: (group: VkGroup) => Promise<void> }) {
  return <div className="dashboard-management"><form className="search-form" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или screen name сообщества" /><button type="submit"><Search size={17} />Найти</button></form><div className="search-results">{results.map((group) => <div className="search-result" key={group.id}><img src={group.photo_100 ?? group.photo_50} alt="" /><span><strong>{group.name}</strong><small>{group.screen_name ? `vk.com/${group.screen_name}` : `club${group.id}`}</small></span><button className="icon-button" onClick={() => add(group)} aria-label="Добавить сообщество"><Plus size={17} /></button></div>)}</div></div>;
}
