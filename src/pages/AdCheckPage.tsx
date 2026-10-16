import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { CalendarClock, CircleHelp, ClipboardCheck, ExternalLink, Megaphone, Search } from 'lucide-react';
import { FormEvent, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiGet } from '../api/client';
import type { AdCheckResult, AdCheckUsage, AdMarker } from '../api/types';
import { TelegramLogo } from '../components/TelegramLogo';
import { costPerThousand, positiveAmount } from '../utils/adCheck';
import { formatDate } from '../utils/date';
import { detectPlatform } from '../utils/sourceQuery';

const AnalyticsChart = lazy(() => import('../components/AnalyticsChart'));

type Platform = AdCheckResult['platform'];
type PostFilter = 'all' | 'ads';

const POSTS_SHOWN = 20;
const markerLabels: Record<AdMarker, string> = { platform: 'отметка VK', erid: 'erid', label: 'маркировка' };

const number = (value: number | null, digits = 0) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const rubles = (value: number | null) => value === null ? '—' : `${number(value, value < 10 ? 2 : 0)} ₽`;

function plural(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="analytics-kpi steady"><div className="analytics-kpi-heading"><span>{label}</span></div><strong>{value}</strong><em>{note}</em></article>;
}

function loadedTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function AdCheckPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedQuery = searchParams.get('q')?.trim() ?? '';
  const requestedPlatform: Platform = searchParams.get('platform') === 'telegram' ? 'telegram' : 'vk';
  const [query, setQuery] = useState(requestedQuery);
  const [platform, setPlatform] = useState<Platform>(requestedPlatform);
  const [result, setResult] = useState<AdCheckResult | null>(null);
  const [usage, setUsage] = useState<AdCheckUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [filter, setFilter] = useState<PostFilter>('all');

  useEffect(() => {
    apiGet<AdCheckUsage>('/api/ad-check/usage').then(setUsage).catch(() => undefined);
  }, []);

  // The check is driven by the URL, so a link from analytics or a reload opens the same source.
  useEffect(() => {
    if (!requestedQuery) return;
    let active = true;
    setQuery(requestedQuery);
    setPlatform(requestedPlatform);
    setIsLoading(true);
    setMessage('');
    setPrice('');
    setFilter('all');
    const params = new URLSearchParams({ q: requestedQuery, platform: requestedPlatform });
    apiGet<AdCheckResult>(`/api/ad-check?${params}`)
      .then((data) => { if (active) { setResult(data); setUsage(data.usage); } })
      .catch((error) => {
        if (!active) return;
        setResult(null);
        setMessage(error instanceof ApiError ? error.message : 'Не удалось проверить источник. Повторите позже.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [requestedQuery, requestedPlatform]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return setMessage('Вставьте ссылку на сообщество VK или Telegram-канал.');
    const detected = detectPlatform(value);
    if (detected === 'youtube') return setMessage('Проверка YouTube-каналов пока недоступна: работают VK и Telegram.');
    setSearchParams({ platform: detected ?? platform, q: value });
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    const detected = detectPlatform(value);
    if (detected === 'vk' || detected === 'telegram') setPlatform(detected);
  };

  return <section className="page-grid analytics-page ad-check-page">
    <div className="panel span-2 analytics-section ad-check-search">
      <div className="section-title"><div>
        <h2><ClipboardCheck size={20} aria-hidden="true" /> Проверка канала перед рекламой</h2>
        <p>Вставьте ссылку на сообщество VK или Telegram-канал: покажем, сколько просмотров набирает пост, сколько рекламы выходит в канале и во что обойдётся 1 000 просмотров.</p>
      </div></div>
      <form className="ad-check-form" onSubmit={submit}>
        <SegmentedControl selectedId={platform} size={40} onChange={(id) => setPlatform(id as Platform)}>
          <Segment id="vk" title="VK" />
          <Segment id="telegram" title="Telegram" />
        </SegmentedControl>
        <div className="search-form">
          <input aria-label="Ссылка на источник" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={platform === 'telegram' ? 't.me/channel или @channel' : 'vk.com/community'} autoComplete="off" />
          <button type="submit" disabled={isLoading}><Search size={18} />{isLoading ? 'Проверяем' : 'Проверить'}</button>
        </div>
      </form>
      {usage && <p className="ad-check-data-note">Сегодня проверено {usage.used} из {usage.limit} {plural(usage.limit, 'источника', 'источников', 'источников')}. Повторно открыть уже проверенный источник можно бесплатно.</p>}
      {message && <div className="form-message telegram-message-error" role="alert">{message}</div>}
    </div>

    {isLoading && <div className="panel span-2 analytics-loading" aria-live="polite" role="status"><div><strong>Проверяем источник</strong><span>Загружаем публикации за последние 30 дней</span></div><div className="analytics-loading-progress" role="progressbar" aria-label="Загрузка"><span /></div></div>}

    {!isLoading && !result && <div className="panel span-2 ad-check-start">
      <h2>Что покажет проверка</h2>
      <ul className="ad-check-checklist">
        <li><b>Типичные просмотры поста</b> и их разброс — от этой цифры считается цена 1 000 просмотров.</li>
        <li><b>Сколько рекламы в канале</b> и как она смотрится по сравнению с обычными постами — по маркировке erid и отметкам «Реклама».</li>
        <li><b>Динамика подписчиков</b> и просмотры за 24/48/72 часа — источник сразу встаёт на ежедневное отслеживание, точные цифры появятся через пару дней.</li>
      </ul>
    </div>}

    {!isLoading && result && <AdCheckReport result={result} price={price} onPriceChange={setPrice} filter={filter} onFilterChange={setFilter} />}
  </section>;
}

function AdCheckReport({ result, price, onPriceChange, filter, onFilterChange }: {
  result: AdCheckResult;
  price: string;
  onPriceChange: (value: string) => void;
  filter: PostFilter;
  onFilterChange: (value: PostFilter) => void;
}) {
  const { estimate, ads } = result;
  const amount = positiveAmount(price);
  const cpm = costPerThousand(amount, estimate?.views ?? null);
  const cheapCpm = costPerThousand(amount, estimate?.upper ?? null);
  const expensiveCpm = costPerThousand(amount, estimate?.lower ?? null);
  const posts = useMemo(() => result.posts.filter((post) => filter === 'all' || post.ad), [result.posts, filter]);
  const history = result.history.filter((point): point is typeof point & { subscribers: number } => point.subscribers !== null);
  const historyChange = history.length >= 2 ? history.at(-1)!.subscribers - history[0].subscribers : null;
  const adsDifference = ads.medianViews !== null && ads.organicMedianViews ? Math.round((ads.medianViews / ads.organicMedianViews - 1) * 100) : null;
  const days = Math.max(1, Math.round(Math.min(result.coverageDays, result.windowDays)));
  const periodLabel = `${days} ${plural(days, 'день', 'дня', 'дней')}`;
  const estimateNote = !estimate ? 'Мало публикаций старше 3 дней для оценки'
    : estimate.source === 'snapshots' ? `Медиана за ${estimate.hours} ч после выхода · ${estimate.posts} ${plural(estimate.posts, 'пост', 'поста', 'постов')} из срезов Socstat`
      : `Оценка по текущим просмотрам ${estimate.posts} ${plural(estimate.posts, 'поста', 'постов', 'постов')} старше 3 дней`;

  return <>
    <header className="span-2 analytics-hero">
      {result.source.photo ? <img className="analytics-hero-avatar" src={result.source.photo} alt="" width={56} height={56} /> : <span className="analytics-hero-avatar ad-check-avatar">{result.platform === 'telegram' ? <TelegramLogo size={28} /> : 'VK'}</span>}
      <div className="analytics-hero-text">
        <small className="analytics-platform-label">{result.platform === 'telegram' ? 'Telegram-канал' : 'Сообщество VK'} · проверка перед рекламой</small>
        <h2>{result.source.name}</h2>
        <p>{result.source.subscribers !== null && `${number(result.source.subscribers)} ${plural(result.source.subscribers, 'подписчик', 'подписчика', 'подписчиков')} · `}Публикации за {periodLabel} · данные на {loadedTime(result.loadedAt)}</p>
      </div>
      <div className="analytics-actions"><a className="ad-check-link-button" href={result.source.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Открыть {result.platform === 'telegram' ? 'канал' : 'сообщество'}</a></div>
    </header>

    <div className="panel span-2 analytics-section ad-check-verdict">
      <div className="ad-check-columns">
        <div className="ad-check-main">
          <span>Типичные просмотры поста</span>
          <strong>{estimate ? number(estimate.views) : '—'}</strong>
          {estimate && <p>Обычно от {number(estimate.lower)} до {number(estimate.upper)} — так набирает половина постов.</p>}
          <small>{estimateNote}</small>
        </div>
        <div className="ad-check-result" aria-live="polite" aria-atomic="true">
          <label htmlFor="ad-price">Цена размещения, ₽<input id="ad-price" value={price} onChange={(event) => onPriceChange(event.target.value)} inputMode="decimal" placeholder="Например, 5 000" autoComplete="off" maxLength={24} aria-invalid={Boolean(price && amount === null)} /></label>
          {price && amount === null && <small className="ad-check-error">Введите сумму числом, например 5000 или 5 000,50.</small>}
          <span>Цена 1 000 просмотров (CPM)</span>
          <strong>{rubles(cpm)}</strong>
          <p>{cpm !== null && cheapCpm !== null && expensiveCpm !== null ? `От ${rubles(cheapCpm)} до ${rubles(expensiveCpm)} в зависимости от того, как зайдёт пост.` : !estimate ? 'Посчитаем, когда будет оценка просмотров.' : 'Введите цену, которую назвал владелец, вместе с комиссиями.'}</p>
        </div>
      </div>
      <div className="analytics-kpi-grid ad-check-tiles">
        <Tile label="Просмотры / подписчики" value={result.viewsToSubscribers === null ? '—' : `${number(result.viewsToSubscribers, 1)}%`} note="Какая доля аудитории видит типичный пост" />
        <Tile label="Реклама в неделю" value={number(ads.perWeek, 1)} note={ads.share === null ? 'Публикаций за период нет' : `${number(ads.share, 1)}% публикаций · только маркированная`} />
        <Tile label="Вовлечённость" value={result.engagement === null ? '—' : `${number(result.engagement, 2)}%`} note={`${result.platform === 'telegram' ? 'Реакции, комментарии, пересылки' : 'Лайки, комментарии, репосты'} на просмотр`} />
        <Tile label="Публикаций в день" value={number(result.postsPerDay, 1)} note={`За ${periodLabel}${result.complete ? '' : ' · VK отдал 100 последних'}`} />
      </div>
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2><Megaphone size={19} aria-hidden="true" /> Реклама в {result.platform === 'telegram' ? 'канале' : 'сообществе'}</h2><p>Рекламой считаем посты с отметкой VK, токеном erid или строкой «Реклама»; немаркированную рекламу не видно, поэтому это нижняя оценка.</p></div></div>
      <div className="analytics-kpi-grid">
        <Tile label={`Рекламных постов за ${periodLabel}`} value={number(ads.posts)} note={ads.posts ? Object.entries(ads.markers).filter(([, count]) => count).map(([marker, count]) => `${markerLabels[marker as AdMarker]}: ${count}`).join(' · ') : 'Маркированной рекламы не нашли'} />
        <Tile label="Просмотры рекламного поста" value={number(ads.medianViews)} note={ads.medianViews === null ? 'Нужно хотя бы 2 рекламных поста старше 3 дней' : 'Медиана по рекламным постам старше 3 дней'} />
        <Tile label="Просмотры обычного поста" value={number(ads.organicMedianViews)} note={adsDifference === null ? 'Медиана по остальным постам старше 3 дней' : adsDifference < 0 ? `Реклама набирает на ${Math.abs(adsDifference)}% меньше` : `Реклама набирает на ${adsDifference}% больше`} />
      </div>
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2><CalendarClock size={19} aria-hidden="true" /> Просмотры за 24, 48 и 72 часа</h2><p>{result.trackingSince ? `Socstat сохраняет счётчики источника каждую ночь с ${formatDate(result.trackingSince)}.` : 'Источник поставлен на ежедневное отслеживание: первый срез будет сегодня ночью.'} Платформы не отдают историю задним числом.</p></div></div>
      {result.milestones
        ? <div className="analytics-kpi-grid">{result.milestones.map((item) => <Tile key={item.hours} label={`За ${item.hours} ${item.hours === 24 ? 'часа' : item.hours === 48 ? 'часов' : 'часа'}`} value={number(item.median)} note={item.median === null ? 'Срезов пока мало' : `Типичный пост · ${item.posts} ${plural(item.posts, 'пост', 'поста', 'постов')}`} />)}</div>
        : <div className="ad-check-notice">Точные просмотры за 24/48/72 часа появятся через 2–3 дня, когда накопятся ночные срезы свежих постов. Откройте проверку этого источника позже — повторная проверка не расходует лимит в тот же день.</div>}
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Подписчики</h2><p>По ежедневным срезам Socstat за последние {result.windowDays} дней.</p></div></div>
      {history.length >= 2
        ? <>
          <p className="ad-check-data-note">С {formatDate(history[0].date)}: {historyChange! > 0 ? '+' : ''}{number(historyChange)} {plural(Math.abs(historyChange!), 'подписчик', 'подписчика', 'подписчиков')}. Резкие скачки за один день стоит обсудить с владельцем.</p>
          <Suspense fallback={<div className="empty-state">Загружаем график...</div>}><AnalyticsChart kind="subscribers" title="Подписчики по дням" data={result.history.map((point) => ({ date: point.date, current: point.subscribers }))} currentPeriodLabel="Подписчики на утро дня" /></Suspense>
        </>
        : <div className="ad-check-notice">{history.length === 1 ? `Первый срез — ${formatDate(history[0].date)}. График появится со второго дня отслеживания.` : 'Истории подписчиков пока нет: источник только что поставлен на отслеживание.'}</div>}
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title ad-check-posts-title"><div><h2>Публикации</h2><p>Последние посты за {periodLabel}: рекламные отмечены.</p></div>
        <SegmentedControl selectedId={filter} size={32} onChange={(id) => onFilterChange(id as PostFilter)}><Segment id="all" title={`Все · ${result.posts.length}`} /><Segment id="ads" title={`Реклама · ${ads.posts}`} /></SegmentedControl>
      </div>
      {posts.length
        ? <div className="ad-check-posts">{posts.slice(0, POSTS_SHOWN).map((post) => <a className="ad-check-post" key={post.id} href={post.url} target="_blank" rel="noreferrer">
          <span><strong>{post.text.trim() || 'Публикация без текста'}</strong><small>{formatDate(post.date)}{post.ad && <em className="ad-check-badge">Реклама · {markerLabels[post.ad]}</em>}</small></span>
          <span className="ad-check-post-views"><b>{number(post.views)}</b><small>просмотров</small></span>
          <ExternalLink size={16} aria-label="Открыть публикацию" />
        </a>)}</div>
        : <div className="empty-state">{filter === 'ads' ? 'Маркированной рекламы за период нет.' : 'Публикаций за период нет.'}</div>}
      {posts.length > POSTS_SHOWN && <p className="ad-check-data-note">Показаны {POSTS_SHOWN} последних из {posts.length}.</p>}
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2><CircleHelp size={19} aria-hidden="true" /> Что уточнить у владельца</h2></div></div>
      <ul className="ad-check-checklist">
        <li>Ссылки на 2–3 последних рекламных поста похожего формата и их просмотры за 24–48 часов.</li>
        <li>Время выхода, через сколько пост удалят, будет ли закреп и сколько ещё рекламы выйдет в тот же день.</li>
        <li>География и портрет аудитории — публичная статистика их не показывает.</li>
        <li>Маркировка рекламы и отчёт после размещения. Дайте отдельную ссылку с UTM-метками или промокод, чтобы посчитать результат.</li>
      </ul>
      <details className="ad-check-method">
        <summary>Как считаем</summary>
        <p>Типичные просмотры — медиана: один вирусный пост её не сдвигает. Пока у Socstat нет ночных срезов источника, берём текущие просмотры постов старше 3 дней: к 48 часам пост обычно набирает чуть меньше. Когда срезы накопятся, оценка переходит на просмотры через 48 часов после выхода.</p>
        <p>Разброс — от 25-го до 75-го процентиля: так набирает половина постов. CPM = цена ÷ типичные просмотры × 1 000. Просмотры — не уникальные зрители, и проверка не доказывает отсутствие накрутки: сверяйте цифры с примерами прошлых рекламных постов.</p>
      </details>
    </div>
  </>;
}
