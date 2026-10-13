import { useEffect, useMemo, useState } from 'react';
import { Button } from '@alfalab/core-components-button';
import { Calculator, CircleHelp, ClipboardCheck, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { apiGet } from '../api/client';
import type { PostViewCurves, SocialPlatform } from '../api/types';
import { adSample, costPerThousand, maturePostStats, MIN_AD_SAMPLE, positiveAmount, type AdPost } from '../utils/adCheck';
import { formatDate } from '../utils/date';
import { SubscriberHistoryPanel } from './SubscriberHistoryPanel';

type Props = {
  platform: SocialPlatform;
  sourceId: string;
  subscribers: number | null;
  period: { dateFrom: string; dateTo: string };
  posts: AdPost[];
  isComplete: boolean | null;
  warnings?: string[];
};

const number = (value: number | null, digits = 0) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const rubles = (value: number | null) => value === null ? '—' : `${number(value, value < 10 ? 2 : 0)} ₽`;

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="analytics-kpi steady"><div className="analytics-kpi-heading"><span>{label}</span></div><strong>{value}</strong><small>{note}</small></article>;
}

export function AdCheckPanel({ platform, sourceId, subscribers, period, posts, isComplete, warnings = [] }: Props) {
  const [curves, setCurves] = useState<PostViewCurves | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [hours, setHours] = useState(48);
  const [price, setPrice] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    let active = true;
    setCurves(null);
    setError('');
    const params = new URLSearchParams({ platform, id: sourceId, days: '90' });
    apiGet<PostViewCurves>(`/api/snapshots/posts?${params}`)
      .then((data) => { if (active) setCurves(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить срезы просмотров.'); });
    return () => { active = false; };
  }, [platform, sourceId, attempt]);

  const sample = useMemo(() => adSample(curves, period.dateFrom, period.dateTo, hours), [curves, period.dateFrom, period.dateTo, hours]);
  const milestones = [24, 48, 72].map((hour) => ({ hour, ...adSample(curves, period.dateFrom, period.dateTo, hour) }));
  const current = maturePostStats(posts);
  const amount = positiveAmount(price);
  const targetCpm = positiveAmount(target);
  const cpm = costPerThousand(amount, sample.median);
  const cheapCpm = costPerThousand(amount, sample.upper);
  const expensiveCpm = costPerThousand(amount, sample.lower);
  const maxPrice = sample.median !== null && sample.median > 0 && targetCpm !== null ? targetCpm * sample.median / 1000 : null;
  const wideSpread = sample.median !== null && sample.median > 0 && sample.lower !== null && sample.upper !== null && (sample.upper - sample.lower) / sample.median >= 1;
  const knownById = new Map(posts.map((post) => [String(post.id), post]));
  const listed = [...sample.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8);
  const missing = Math.max(0, posts.length - sample.count);
  const horizonLimited = period.dateFrom < new Date(Date.now() - 90 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });

  const postUrl = (id: string) => knownById.get(id)?.url ?? (platform === 'vk'
    ? `https://vk.com/wall-${sourceId.replace(/^-/, '')}_${id}`
    : platform === 'youtube' ? `https://www.youtube.com/watch?v=${id}` : `https://t.me/${sourceId.replace(/^@/, '')}/${id}`);

  return <>
    <div className="panel span-2 analytics-section ad-check-intro">
      <div className="section-title"><div><h2><ClipboardCheck size={20} aria-hidden="true" /> Проверка перед покупкой рекламы</h2><p>Оцените типичные просмотры и цену размещения. Расчёт опирается на публикации канала, а результат конкретной рекламы зависит от её формата, темы и условий.</p></div></div>
      <div className="ad-check-notice"><Info size={18} aria-hidden="true" /><span>Просмотры — не уникальные зрители. Эти данные не подтверждают отсутствие накрутки и не прогнозируют продажи или подписки.</span></div>
      {isComplete !== true && <div className="ad-check-notice warning"><Info size={18} aria-hidden="true" /><span>{isComplete === false ? 'Публикации загружены не полностью.' : 'Полнота списка публикаций не подтверждена: платформа ограничивает объём загрузки.'} Показатели текущих постов относятся только к доступной выборке.</span></div>}
      {horizonLimited && <div className="ad-check-notice warning"><Info size={18} aria-hidden="true" /><span>Для сравнения в одинаковом возрасте доступны публикации только за последние 90 дней. Начало выбранного периода в расчёт не входит.</span></div>}
      {warnings.map((warning) => <p className="ad-check-data-note" key={warning}>{warning}</p>)}
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Просмотры в одинаковом возрасте</h2><p>Публикации с {formatDate(period.dateFrom)} по {formatDate(period.dateTo)}. Счётчики за 24/48/72 часа оценены по ежедневным срезам Socstat, с интерполяцией между ними.</p></div></div>
      {error ? <div className="ad-check-notice warning" role="alert"><Info size={18} /><div><strong>Срезы просмотров недоступны</strong><p>{error}</p><Button client="desktop" size={40} view="secondary" leftAddons={<RefreshCw size={16} />} onClick={() => setAttempt((value) => value + 1)}>Повторить загрузку</Button></div></div>
        : !curves ? <div className="empty-state" role="status">Загружаем срезы просмотров…</div>
          : <div className="analytics-kpi-grid ad-check-milestones">{milestones.map((item) => <Metric key={item.hour} label={`За ${item.hour} ${item.hour === 48 ? 'часов' : 'часа'}`} value={number(item.median)} note={item.sufficient ? `Медиана · ${number(item.count)} публикаций` : `${number(item.count)} из ${MIN_AD_SAMPLE} необходимых публикаций`} />)}</div>}
      <p className="ad-check-data-note">Каждый срок рассчитан по своей выборке; медианы могут различаться из-за её состава. Нулевые просмотры учитываются, пропущенные срезы — нет.</p>
    </div>

    <div className="panel span-2 analytics-section ad-check-calculator">
      <div className="section-title"><div><h2><Calculator size={19} aria-hidden="true" /> Стоимость размещения</h2><p>Выберите срок, на который покупаете размещение, и введите полную цену с комиссиями.</p></div></div>
      <div className="ad-check-duration"><span id="ad-duration-label">Просмотры за</span><div role="group" aria-labelledby="ad-duration-label">{[24, 48, 72].map((hour) => <Button key={hour} client="desktop" size={40} view="secondary" className={`period-tab-button ${hours === hour ? 'period-tab-button-active' : ''}`} aria-pressed={hours === hour} onClick={() => setHours(hour)}>{hour} ч</Button>)}</div></div>
      <div className="ad-check-columns">
        <div className="ad-check-fields">
          <label htmlFor="ad-price">Цена размещения, ₽<input id="ad-price" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="Например, 5 000" autoComplete="off" maxLength={24} aria-invalid={Boolean(price && amount === null)} aria-describedby="ad-price-hint" /></label>
          <small id="ad-price-hint">{price && amount === null ? 'Введите положительную сумму до 1 млрд ₽, не более двух знаков после запятой.' : 'Пост, интеграция или размещение на выбранный срок.'}</small>
          <label htmlFor="ad-target">Ваш целевой CPM, ₽ <span className="ad-check-optional">необязательно</span><input id="ad-target" value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" placeholder="Например, 700" autoComplete="off" maxLength={24} aria-invalid={Boolean(target && targetCpm === null)} aria-describedby="ad-target-hint" /></label>
          <small id="ad-target-hint">{target && targetCpm === null ? 'Введите положительную сумму до 1 млрд ₽, не более двух знаков после запятой.' : 'Стоимость 1 000 просмотров, приемлемая для вашей кампании.'}</small>
        </div>
        <div className="ad-check-result" aria-live="polite" aria-atomic="true">
          <span>Расчётный CPM за {hours} ч</span><strong>{rubles(cpm)}</strong>
          <p>{cpm !== null ? `${rubles(amount)} ÷ ${number(sample.median, 1)} просмотров × 1 000` : error ? 'Расчёт недоступен. Повторите загрузку срезов выше.' : !curves ? 'Расчёт появится после загрузки срезов.' : !sample.sufficient ? `Нужны срезы хотя бы ${MIN_AD_SAMPLE} публикаций за ${hours} ч. Можно выбрать другой срок или период.` : sample.median === 0 ? 'Медиана просмотров равна нулю — CPM рассчитать нельзя.' : 'Введите цену размещения, чтобы рассчитать CPM.'}</p>
          {cheapCpm !== null && expensiveCpm !== null && <p>При типичном разбросе просмотров: <b>{rubles(cheapCpm)} — {rubles(expensiveCpm)}</b> за 1 000 просмотров.</p>}
          {sample.sufficient && sample.lower === 0 && <p>Четверть публикаций имеет нулевые просмотры: верхнюю границу CPM оценить нельзя.</p>}
          {maxPrice !== null && <div className="ad-check-target"><span>Цена при вашем целевом CPM</span><b>{rubles(maxPrice)}</b><small>На основе медианы за {hours} ч{amount !== null ? amount > maxPrice ? ' · предложенная цена выше ориентира' : ' · предложенная цена в пределах ориентира' : ''}.</small></div>}
        </div>
      </div>
      <div className="analytics-kpi-grid">
        <Metric label={`Типичные просмотры за ${hours} ч`} value={number(sample.median, 1)} note={`Медиана по ${number(sample.count)} публикациям`} />
        <Metric label="Разброс центральных 50%" value={sample.sufficient ? `${number(sample.lower, 1)} — ${number(sample.upper, 1)}` : '—'} note="От 25-го до 75-го процентиля · не гарантия" />
        <Metric label="Просмотры / подписчики" value={sample.median !== null && subscribers !== null && subscribers > 0 ? `${number(sample.median / subscribers * 100, 1)}%` : '—'} note="Относительно текущей аудитории · не уникальный охват" />
      </div>
      {curves && <div className={`ad-check-notice ${sample.count < 10 || wideSpread ? 'warning' : ''}`}><Info size={18} aria-hidden="true" /><span>{!sample.sufficient ? 'Истории пока недостаточно. Срезы собираются каждую ночь после первого анализа канала; прошлые счётчики восстановить нельзя.' : sample.count < 10 ? 'Небольшая выборка: менее 10 публикаций. Сверьте расчёт с примерами прошлых рекламных размещений.' : wideSpread ? 'Просмотры заметно различаются между публикациями. При обсуждении цены учитывайте нижнюю границу типичного диапазона.' : 'Сравните условия размещения и прошлые рекламные посты с этой выборкой.'}{missing > 0 ? ` У ${number(missing)} загруженных публикаций нет подходящего среза за ${hours} ч.` : ''}</span></div>}
    </div>

    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Контекст публикаций</h2><p>Текущие счётчики постов старше 72 часов. Их возраст различается; эти показатели не используются в калькуляторе CPM.</p></div></div>
      <div className="analytics-kpi-grid"><Metric label="Медиана текущих просмотров" value={number(current.median)} note={`${number(current.count)} публикаций старше 72 ч`} /><Metric label="ER по просмотрам" value={current.engagement === null ? '—' : `${number(current.engagement, 2)}%`} note="Сумма действий / сумма просмотров зрелых постов" /><Metric label="Публикации за период" value={number(posts.length)} note={isComplete === true ? 'Загруженные публикации' : 'Полнота выборки не подтверждена'} /></div>
    </div>
    <SubscriberHistoryPanel platform={platform} sourceId={sourceId} period={period} currentSubscribers={subscribers} />

    {listed.length > 0 && <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>На каких публикациях основан расчёт</h2><p>Последние {listed.length} из {number(sample.count)} публикаций со срезами за {hours} ч. В выборке обычный контент и реклама, если она опубликована в канале.</p></div></div><div className="ad-check-posts">{listed.map((post) => <a className="ad-check-post" key={post.postId} href={postUrl(post.postId)} target="_blank" rel="noreferrer"><span><strong>{knownById.get(post.postId)?.text?.trim().slice(0, 120) || `Публикация от ${formatDate(post.publishedAt.slice(0, 10))}`}</strong><small>{formatDate(post.publishedAt.slice(0, 10))}</small></span><span className="ad-check-post-views"><b>{number(post.milestones[String(hours)], 1)}</b><small>за {hours} ч</small></span><ExternalLink size={16} aria-label="Открыть публикацию" /></a>)}</div></div>}

    <div className="panel span-2 analytics-section"><div className="section-title"><div><h2><CircleHelp size={19} aria-hidden="true" /> Что уточнить перед оплатой</h2><p>Публичная статистика помогает оценить цену, но условия размещения нужно согласовать с владельцем.</p></div></div><ul className="ad-check-checklist"><li>Попросите ссылки на последние рекламные публикации похожего формата и результаты за тот же срок.</li><li>Уточните время выхода, срок удаления, закрепление и соседство с другими рекламными постами.</li><li>Проверьте, совпадают ли тематика и аудитория канала с вашим продуктом. Географию и портрет аудитории запросите у владельца.</li><li>Обсудите маркировку рекламы и отчётность. Используйте отдельную ссылку с UTM-метками или промокод для оценки результата.</li></ul></div>
  </>;
}
