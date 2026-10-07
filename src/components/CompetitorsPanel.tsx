import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@alfalab/core-components-button';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { ExternalLink, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react';
import { apiGet, apiPost, ApiError } from '../api/client';
import type { SocialPlatform } from '../api/types';
import { detectPlatform } from '../utils/sourceQuery';
import { searchSources, type SourceChannel } from './SourceSetup';
import { competitorKey, competitorMetrics, isComparable, type CompetitorMetric, type CompetitorReportItem, type Metric } from './competitorMetrics';

type Competitor = { platform: SocialPlatform; externalId: string; name: string };
type Props = { platform: SocialPlatform; sourceId: string | number; sourceName?: string };
type Period = 'week' | 'month';
type Report = { items: CompetitorReportItem[]; period: Period };
type Undo = { previous: Competitor[]; message: string };
type SearchResults = { query: string; items: SourceChannel[]; platforms: SocialPlatform[] };
type Row = { key: string; own: boolean; platform: SocialPlatform; name: string; photo?: string; competitor?: Competitor; item: CompetitorReportItem | null; metrics: Record<CompetitorMetric, Metric> | null };

const MAX_COMPETITORS = 5;
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const platformNames: Record<SocialPlatform, string> = { vk: 'VK', youtube: 'YouTube', telegram: 'Telegram' };
const platformLogos: Record<SocialPlatform, string> = { vk: '/vk-network-logo.png', youtube: '/youtube-logo.png', telegram: '/telegram-logo.svg' };
const metricLabels: Record<CompetitorMetric, string> = { subscribers: 'Подписчики', growthPercent: 'Рост, %', frequency: 'Постов / нед.', views: 'Просмотры / пост', er: 'ER, %' };
const metricKeys = Object.keys(metricLabels) as CompetitorMetric[];
const tiles: Array<[CompetitorMetric, string]> = [['views', 'Просмотры на пост'], ['er', 'Вовлечённость (ER)'], ['frequency', 'Публикаций в неделю'], ['growthPercent', 'Рост аудитории']];
const formatMetric = (key: CompetitorMetric, value: number) => key === 'subscribers' || key === 'views' ? compact.format(value) : key === 'growthPercent' ? `${value > 0 ? '+' : ''}${decimal.format(value)}%` : key === 'er' ? `${decimal.format(value)}%` : decimal.format(value >= 10 ? Math.round(value) : value);
const toCompetitor = (channel: SourceChannel): Competitor => ({ platform: channel.platform, externalId: channel.platform === 'telegram' ? String(channel.id).toLowerCase() : String(channel.id), name: channel.name });

// Поиск по названию на YouTube стоит 100 единиц квоты, а Telegram ищет только по username,
// поэтому автоматически ищем во ВКонтакте и по ссылкам, остальное — по явной кнопке.
async function autoSearch(text: string): Promise<Pick<SearchResults, 'items' | 'platforms'>> {
  const detected = detectPlatform(text);
  if (detected) return { items: await searchSources(text, detected), platforms: [detected] };
  if (text.startsWith('@')) {
    const settled = await Promise.allSettled([searchSources(text, 'telegram'), searchSources(text, 'youtube')]);
    return { items: settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []), platforms: ['telegram', 'youtube'] };
  }
  return { items: await searchSources(text, 'vk'), platforms: ['vk'] };
}

function PlatformMark({ platform }: { platform: SocialPlatform }) {
  return <img className="competitors-platform" src={platformLogos[platform]} alt={platformNames[platform]} title={platformNames[platform]} />;
}

function Avatar({ name, photo, size = 40 }: { name: string; photo?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) return <img className="competitors-avatar" src={photo} alt="" width={size} height={size} onError={() => setFailed(true)} />;
  return <span className="competitors-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">{name.replace(/^@/, '').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</span>;
}

export function CompetitorsPanel(props: Props) {
  return <CompetitorsContent key={`${props.platform}:${props.sourceId}`} {...props} />;
}

function CompetitorsContent({ platform, sourceId, sourceName }: Props) {
  const path = `/api/competitors/${platform}/${encodeURIComponent(sourceId)}`;
  const ownKey = competitorKey(platform, sourceId);
  const inputId = useId();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [locked, setLocked] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [suggestions, setSuggestions] = useState<SourceChannel[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [removed, setRemoved] = useState<Undo | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [sort, setSort] = useState<CompetitorMetric>('views');
  const searchRequest = useRef(0);
  const reportRequest = useRef(0);
  const savingRef = useRef(false);
  const mounted = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const selection = competitors.map((item) => competitorKey(item.platform, item.externalId)).join(',');
  const trimmedQuery = query.trim();
  const full = competitors.length >= MAX_COMPETITORS;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; searchRequest.current++; }; }, []);
  useEffect(() => {
    let active = true;
    setLoadError('');
    apiGet<{ competitors: Competitor[] }>(path).then((data) => {
      if (active) { setCompetitors(data.competitors); setReady(true); }
    }).catch((error: Error) => {
      if (active) { setLoadError(error.message); setLocked(error instanceof ApiError && error.status === 402); }
    });
    return () => { active = false; };
  }, [path, loadAttempt]);
  useEffect(() => {
    const request = ++reportRequest.current;
    setReportError('');
    if (!ready || !selection) { setLoading(false); setReport(null); return; }
    setLoading(true);
    apiGet<{ items: CompetitorReportItem[] }>(`${path}/report?period=${period}`).then((data) => {
      if (request === reportRequest.current) setReport({ items: data.items, period });
    }).catch((error: Error) => {
      if (request === reportRequest.current) { setReportError(error.message); if (error instanceof ApiError && error.status === 402) setLocked(true); }
    }).finally(() => { if (request === reportRequest.current) setLoading(false); });
    return () => { reportRequest.current++; };
  }, [path, ready, selection, period, revision]);
  useEffect(() => {
    if (!ready || !sourceName) return;
    let active = true;
    searchSources(sourceName, 'vk').then((items) => { if (active) setSuggestions(items); }).catch(() => undefined);
    return () => { active = false; };
  }, [ready, sourceName]);
  useEffect(() => {
    const request = ++searchRequest.current;
    setSearchError('');
    if (trimmedQuery.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(() => {
      autoSearch(trimmedQuery).then((found) => {
        if (request === searchRequest.current) setResults({ query: trimmedQuery, ...found });
      }).catch((error: Error) => {
        if (request === searchRequest.current) { setResults({ query: trimmedQuery, items: [], platforms: [] }); setSearchError(error.message); }
      }).finally(() => { if (request === searchRequest.current) setSearching(false); });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [trimmedQuery]);

  async function searchOn(target: SocialPlatform) {
    const text = trimmedQuery;
    const request = ++searchRequest.current;
    setSearching(true); setSearchError('');
    try {
      const items = await searchSources(text, target);
      if (request === searchRequest.current) setResults((current) => {
        const previous = current?.query === text ? current : { items: [], platforms: [] };
        return { query: text, items: [...items, ...previous.items.filter((item) => !items.some((found) => found.platform === item.platform && String(found.id) === String(item.id)))], platforms: [...previous.platforms, target] };
      });
    } catch (error) {
      if (request === searchRequest.current) { setSearchError(`${platformNames[target]}: ${(error as Error).message}`); setResults((current) => current && { ...current, platforms: [...current.platforms, target] }); }
    } finally { if (request === searchRequest.current) setSearching(false); }
  }
  async function save(next: Competitor[], undo: Undo | null = null) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true); setSaveError('');
    try {
      const data = await apiPost<{ competitors: Competitor[] }>(path, { competitors: next, sourceName });
      if (!mounted.current) return false;
      setCompetitors(data.competitors); setRemoved(undo);
      return true;
    } catch (error) {
      if (mounted.current) { setSaveError((error as Error).message); if (error instanceof ApiError && error.status === 402) setLocked(true); }
      return false;
    } finally { savingRef.current = false; if (mounted.current) setSaving(false); }
  }
  const stateOf = (channel: SourceChannel) => {
    const key = competitorKey(channel.platform, channel.id);
    return key === ownKey ? 'own' : competitors.some((item) => competitorKey(item.platform, item.externalId) === key) ? 'added' : full ? 'full' : 'available';
  };
  async function add(channel: SourceChannel) {
    if (stateOf(channel) !== 'available') return;
    const photo = channel.photo_100 ?? channel.photo_50;
    if (photo) setPhotos((current) => ({ ...current, [competitorKey(channel.platform, channel.id)]: photo }));
    if (await save([...competitors, toCompetitor(channel)])) { setQuery(''); setResults(null); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') setQuery('');
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const first = results?.query === trimmedQuery ? results.items.find((item) => stateOf(item) === 'available') : undefined;
    if (first) void add(first);
  }

  const days = period === 'week' ? 7 : 30;
  const visibleReport = report?.period === period ? report : null;
  const reportItems = new Map((visibleReport?.items ?? []).map((item) => [competitorKey(item.platform ?? platform, item.groupId), item]));
  const toRow = (key: string, own: boolean, rowPlatform: SocialPlatform, fallbackName: string, competitor?: Competitor): Row => {
    const item = reportItems.get(key) ?? null;
    return { key, own, platform: rowPlatform, competitor, item, name: item?.analytics?.group.name ?? fallbackName, photo: item?.analytics?.group.photo ?? photos[key], metrics: item ? competitorMetrics(item, days) : null };
  };
  const ownRow = toRow(ownKey, true, platform, sourceName ?? String(sourceId));
  const rivalRows = competitors.map((item) => toRow(competitorKey(item.platform, item.externalId), false, item.platform, item.name, item));
  const allRows = [ownRow, ...rivalRows];
  const value = (row: Row, key: CompetitorMetric) => row.metrics?.[key].value ?? null;
  const rankable = (row: Row, key: CompetitorMetric) => isComparable(key, row.platform, platform) && value(row, key) !== null;
  const ranking = (key: CompetitorMetric) => allRows.filter((row) => rankable(row, key)).sort((left, right) => value(right, key)! - value(left, key)!);
  const best = Object.fromEntries(metricKeys.map((key) => { const list = ranking(key); return [key, list.length > 1 ? value(list[0], key) : null]; })) as Record<CompetitorMetric, number | null>;
  const scale = Object.fromEntries(metricKeys.map((key) => [key, Math.max(1, ...allRows.map((row) => Math.abs(value(row, key) ?? 0)))])) as Record<CompetitorMetric, number>;
  const sortedRows = [...allRows].sort((left, right) => {
    if (!left.metrics !== !right.metrics) return left.metrics ? -1 : 1;
    const a = rankable(left, sort) ? value(left, sort)! : -Infinity;
    const b = rankable(right, sort) ? value(right, sort)! : -Infinity;
    return b - a;
  });
  let place = 0;
  const ranks = new Map(sortedRows.map((row) => [row.key, rankable(row, sort) ? ++place : null]));

  const viewsRanking = ranking('views');
  const viewsLeader = viewsRanking[0];
  const ownViews = value(ownRow, 'views');
  const insight = viewsRanking.length < 2 || ownViews === null
    ? null
    : viewsLeader.own
      ? `Вы лидер по просмотрам на пост среди ${viewsRanking.length} каналов: ${formatMetric('views', ownViews)} на публикацию.`
      : `${viewsLeader.name} собирает ${formatMetric('views', value(viewsLeader, 'views')!)} просмотров на пост — ${ownViews > 0 ? `в ${decimal.format(value(viewsLeader, 'views')! / ownViews)} раза больше, чем вы` : 'больше, чем вы'}. Посмотрите их лучшие публикации ниже.`;
  const bestPosts = rivalRows.flatMap((row) => {
    const analytics = row.item?.analytics;
    if (!analytics || analytics.wall.availability?.views === false) return [];
    const post = analytics.wall.topPosts.filter((entry) => entry.views != null && /^https?:\/\//.test(entry.url)).sort((a, b) => b.views - a.views)[0];
    return post ? [{ row, post }] : [];
  }).sort((a, b) => b.post.views - a.post.views).slice(0, 3);
  const freeSuggestions = suggestions.filter((item) => stateOf(item) === 'available').slice(0, 3);
  const hasMixedEr = allRows.some((row) => !isComparable('er', row.platform, platform));
  const reportLoadingFirstTime = loading && !visibleReport;
  const showResults = trimmedQuery.length >= 2 && !full;
  const extraSearches = (['youtube', 'telegram'] as SocialPlatform[]).filter((target) => results?.query === trimmedQuery && !results.platforms.includes(target) && !detectPlatform(trimmedQuery) && (target === 'youtube' || /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(trimmedQuery)));

  const renderStatus = (row: Row) => {
    if (row.item?.error) return <small className="competitors-card-error">{row.item.error.message}</small>;
    const subscribers = value(row, 'subscribers');
    if (!row.metrics) return loading ? <small className="competitors-card-loading">Загружаем данные…</small> : <small>{row.own ? platform === 'vk' ? 'Ваше сообщество' : 'Ваш канал' : 'Нет данных'}</small>;
    return <small>{subscribers === null ? 'Аудитория скрыта' : `${compact.format(subscribers)} подписчиков`}</small>;
  };
  const renderCell = (row: Row, key: CompetitorMetric) => {
    if (!row.metrics) return <span className="competitors-cell-value competitors-muted">…</span>;
    const metric = row.metrics[key];
    const isBest = metric.value !== null && isComparable(key, row.platform, platform) && metric.value === best[key];
    const marker = key === 'er' && metric.value !== null && !isComparable(key, row.platform, platform) ? '*' : '';
    return <>
      <span className={`competitors-cell-value ${isBest ? 'is-best' : ''}`}>{metric.value === null ? '—' : formatMetric(key, metric.value)}{marker}{isBest && <span className="competitors-sr-only">, лучший показатель</span>}</span>
      {metric.note && <small>{metric.note}</small>}
      <span className="competitors-bar" aria-hidden="true"><span className={row.own ? 'is-own' : isBest ? 'is-best' : ''} style={{ width: `${metric.value === null ? 0 : Math.max(4, Math.abs(metric.value) / scale[key] * 100)}%` }} /></span>
    </>;
  };

  if (locked) return <section className="panel span-2 competitors-panel" aria-label="Конкуренты"><div className="competitors-state"><Users size={28} /><h3>Сравнение доступно на активном тарифе</h3><p>Продлите доступ, чтобы добавлять конкурентов и смотреть сравнение.</p><a className="primary-button" href="/app/account">Перейти к оплате</a></div></section>;

  return <div className="span-2 competitors-panel">
    <div className="competitors-topbar">
      <h2>Конкуренты</h2>
      {competitors.length > 0 && <div className="competitors-topbar-actions">
        <SegmentedControl selectedId={period} size={40} onChange={(id) => setPeriod(id as Period)}><Segment id="week" title="7 дней" /><Segment id="month" title="30 дней" /></SegmentedControl>
        <Button size={40} view="secondary" disabled={loading} leftAddons={<RefreshCw size={16} />} onClick={() => setRevision((current) => current + 1)}>{loading ? 'Обновляем…' : 'Обновить'}</Button>
      </div>}
    </div>
    {loadError && <div className="panel competitors-error" role="alert"><p>Не удалось загрузить список конкурентов. {loadError}</p><Button size={40} onClick={() => setLoadAttempt((current) => current + 1)}>Повторить</Button></div>}
    {!ready && !loadError && <p className="panel competitors-loading" role="status"><RefreshCw size={18} />Загружаем список конкурентов…</p>}

    {ready && competitors.length > 0 && <section className="panel competitors-summary" aria-label="Итог сравнения">
      {reportLoadingFirstTime ? <div className="competitors-skeleton" aria-hidden="true"><span /><span /></div> : <>
        {insight && <p className="competitors-insight">{insight}</p>}
        <div className="competitors-tiles">{tiles.map(([key, label]) => {
          const list = ranking(key);
          const index = list.findIndex((row) => row.own);
          if (list.length < 2 || index < 0) return <div className="competitors-tile" key={key}><span>{label}</span><strong className="competitors-muted">—</strong><small>{key === 'growthPercent' ? 'История конкурентов ещё копится: срезы собираются каждый день' : 'Недостаточно данных для сравнения'}</small></div>;
          const leader = list[0];
          return <div className="competitors-tile" key={key}><span>{label}</span><strong className={index === 0 ? 'is-best' : ''}>{index + 1} из {list.length}</strong><small>{index === 0 ? `Вы лидер · ${formatMetric(key, value(leader, key)!)}` : `Лидер: ${leader.name} · ${formatMetric(key, value(leader, key)!)}, у вас ${formatMetric(key, value(list[index], key)!)}`}{key === 'er' && hasMixedEr ? ` · среди ${platform === 'telegram' ? 'Telegram' : 'VK и YouTube'}` : ''}</small></div>;
        })}</div>
      </>}
    </section>}

    {ready && <section className="panel competitors-manage" aria-labelledby={`${inputId}-title`}>
      <div className="competitors-section-title"><h3 id={`${inputId}-title`}>Кого сравниваем <span>· {competitors.length} из {MAX_COMPETITORS}</span></h3>{competitors.length > 0 && <button type="button" className="competitors-clear" disabled={saving} onClick={() => void save([], { previous: competitors, message: 'Сравнение удалено' })}><Trash2 size={15} aria-hidden="true" />Удалить сравнение</button>}</div>
      <div className="competitors-search">
        <label htmlFor={inputId}>Добавить конкурента</label>
        <div className="competitors-search-field">
          <Search size={18} aria-hidden="true" />
          <input id={inputId} ref={input} type="text" autoComplete="off" role="combobox" aria-expanded={showResults} aria-controls={`${inputId}-results`} aria-describedby={`${inputId}-hint`} disabled={full || saving} value={query} placeholder={full ? `Добавлено ${MAX_COMPETITORS} из ${MAX_COMPETITORS} — уберите одного, чтобы заменить` : 'Например, t.me/rbc_news, vk.com/rbc или название'} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} />
          <span className="competitors-search-platforms" aria-hidden="true">{(['vk', 'telegram', 'youtube'] as SocialPlatform[]).map((item) => <img key={item} src={platformLogos[item]} alt="" />)}</span>
        </div>
        <p id={`${inputId}-hint`} className="competitors-hint">Ссылка на сообщество или канал во ВКонтакте, Telegram или YouTube, @username или название. Enter — добавить первый результат.</p>
        {showResults && <div className="competitors-results" id={`${inputId}-results`} role="region" aria-label="Результаты поиска" aria-live="polite">
          {searching && <p className="competitors-results-note"><RefreshCw size={14} className="competitors-spin" />Ищем…</p>}
          {results?.query === trimmedQuery && results.items.length > 0 && <ul>{results.items.slice(0, 8).map((item) => {
            const state = stateOf(item);
            return <li key={competitorKey(item.platform, item.id)}>
              <Avatar name={item.name} photo={item.photo_100 ?? item.photo_50} />
              <span className="competitors-result-text"><strong>{item.name}<PlatformMark platform={item.platform} /></strong><small>{item.screen_name ?? item.id}{item.members_count != null && ` · ${compact.format(item.members_count)} подписчиков`}</small></span>
              <Button size={32} view={state === 'available' ? 'primary' : 'secondary'} disabled={state !== 'available' || saving} onClick={() => void add(item)}>{state === 'own' ? 'Это вы' : state === 'added' ? 'Добавлено' : 'Добавить'}</Button>
            </li>;
          })}</ul>}
          {!searching && results?.query === trimmedQuery && !results.items.length && !searchError && <p className="competitors-results-note">Ничего не нашли{results.platforms.length ? ` в ${results.platforms.map((item) => platformNames[item]).join(' и ')}` : ''}. Попробуйте вставить прямую ссылку.</p>}
          {searchError && <p className="competitors-results-note competitors-error-text" role="alert">{searchError}</p>}
          {extraSearches.length > 0 && !searching && <div className="competitors-results-more">{extraSearches.map((target) => <button type="button" key={target} onClick={() => void searchOn(target)}><PlatformMark platform={target} />{target === 'telegram' ? `Найти @${trimmedQuery.replace(/^@/, '')} в Telegram` : `Искать «${trimmedQuery}» на YouTube`}</button>)}</div>}
        </div>}
      </div>

      <ul className="competitors-cards">
        {allRows.map((row) => <li key={row.key} className={row.own ? 'is-own' : ''}>
          <Avatar name={row.name} photo={row.photo} />
          <span className="competitors-card-text"><strong>{row.name}<PlatformMark platform={row.platform} />{row.own && <span className="competitors-you">Вы</span>}</strong>{renderStatus(row)}</span>
          {row.competitor && <button type="button" className="competitors-remove" aria-label={`Убрать ${row.name}`} disabled={saving} onClick={() => { void save(competitors.filter((item) => item !== row.competitor), { previous: competitors, message: `«${row.name}» убран из сравнения` }); }}><X size={16} /></button>}
        </li>)}
        {Array.from({ length: MAX_COMPETITORS - competitors.length }, (_, index) => <li key={`slot-${index}`} className="competitors-slot"><label htmlFor={inputId}><Plus size={16} />Свободное место</label></li>)}
      </ul>

      {saveError && <p className="competitors-error" role="alert">Список не изменён. {saveError}</p>}
      {removed && !saving && <div className="competitors-toast" role="status"><span>{removed.message}</span><button type="button" onClick={() => void save(removed.previous)}>Вернуть</button></div>}
      {freeSuggestions.length > 0 && !full && <div className="competitors-suggestions"><span>Похожие по названию во ВКонтакте</span><div>{freeSuggestions.map((item) => <button type="button" key={competitorKey(item.platform, item.id)} disabled={saving} onClick={() => void add(item)}><Avatar name={item.name} photo={item.photo_100 ?? item.photo_50} size={28} /><span>{item.name}</span><em>+ Добавить</em></button>)}</div></div>}
    </section>}

    {reportError && <div className="panel competitors-error" role="alert"><p>Не удалось обновить сравнение. {reportError}</p>{visibleReport && <p>Ниже показан предыдущий результат.</p>}<Button size={40} disabled={loading} onClick={() => setRevision((current) => current + 1)}>Повторить</Button></div>}

    {ready && competitors.length > 0 && visibleReport && <section className="panel competitors-posts" aria-labelledby={`${inputId}-posts`}>
      <div className="competitors-section-title"><h3 id={`${inputId}-posts`}>Что сработало у конкурентов</h3><span>Самые просматриваемые публикации за {days} дней</span></div>
      {bestPosts.length ? <div className="competitors-post-grid">{bestPosts.map(({ row, post }) => <a key={row.key} href={post.url} target="_blank" rel="noreferrer">
        <span className="competitors-post-author"><Avatar name={row.name} photo={row.photo} size={24} />{row.name}<PlatformMark platform={row.platform} /><ExternalLink size={14} aria-hidden="true" /></span>
        <strong>{post.text?.slice(0, 160) || 'Публикация без текста'}</strong>
        <span className="competitors-post-stats"><b>{compact.format(post.views)}</b> просмотров{ownViews && post.views >= ownViews * 1.1 ? <em>×{decimal.format(post.views / ownViews)} к вашему среднему</em> : null}</span>
      </a>)}</div> : <p className="competitors-hint">За этот период нет публикаций конкурентов с доступными просмотрами.</p>}
    </section>}

    {ready && competitors.length > 0 && (visibleReport || reportLoadingFirstTime) && <section className="panel competitors-compare" aria-labelledby={`${inputId}-table`}>
      <div className="competitors-section-title"><h3 id={`${inputId}-table`}>Подробное сравнение</h3><span>Нажмите на заголовок колонки, чтобы отсортировать</span></div>
      <div className="competitors-table-wrap"><table className="competitors-table">
        <caption className="competitors-sr-only">Сравнение за {days} дней. Лучшие значения выделены.</caption>
        <thead><tr><th scope="col">Канал</th>{metricKeys.map((key) => <th scope="col" key={key} aria-sort={sort === key ? 'descending' : 'none'}><button type="button" className={sort === key ? 'is-active' : ''} onClick={() => setSort(key)}>{metricLabels[key]}{sort === key && <span aria-hidden="true"> ↓</span>}</button></th>)}</tr></thead>
        <tbody>{sortedRows.map((row) => <tr key={row.key} className={`${row.own ? 'is-own' : ''} ${row.metrics ? '' : 'is-loading'}`}>
          <th scope="row"><span className="competitors-row-name"><span className="competitors-rank">{ranks.get(row.key) ?? '–'}</span><Avatar name={row.name} photo={row.photo} size={24} /><span className="competitors-row-title">{row.name}</span><PlatformMark platform={row.platform} />{row.own && <span className="competitors-you">Вы</span>}</span>{row.item?.error && <small className="competitors-card-error">{row.item.error.message}</small>}</th>
          {metricKeys.map((key) => <td key={key}>{renderCell(row, key)}</td>)}
        </tr>)}</tbody>
      </table></div>
      <p className="competitors-hint">{hasMixedEr && '* ER в Telegram считается по просмотрам, в VK и YouTube — по подписчикам, поэтому лучший ER выбираем только среди каналов с той же базой, что у вас. '}Рост — изменение подписчиков от ежедневного среза на начало периода; появляется, когда у канала накопится история. Просмотры — публичные счётчики, свежие публикации ещё набирают их.</p>
    </section>}
  </div>;
}
