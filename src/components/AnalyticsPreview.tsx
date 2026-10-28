import { ArrowDown, ArrowUp, BarChart3, LockKeyhole, Ticket, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CommunityAnalytics, ReportPassState } from '../api/types';
import { trackPreviewUnlock, type PreviewUnlockTarget } from '../utils/visit';
import { PostCard } from './PostCard';
import { formatPassDay, formatPassMoment, highlightReportPassOffer, REPORT_PASS_OFFER_ID, reportPassLink, tariffLabel, useMonthPrice } from './ReportPass';

export { useMonthPrice };

type Section = 'summary' | 'audience' | 'posts' | 'competitors';

const sectionContents: Record<Exclude<Section, 'summary'>, { title: string; items: string[] }> = {
  audience: { title: 'Аудитория', items: ['ER по дням и максимальный ER поста', 'Просмотры, реакции и комментарии на пост', 'Сравнение с прошлым периодом'] },
  posts: { title: 'Публикации', items: ['Все посты периода с охватом и ER', 'Сортировка по лайкам, репостам, просмотрам', 'Фильтры по формату: фото, видео, текст'] },
  competitors: { title: 'Конкуренты', items: ['Сравнение с похожими сообществами', 'Кто растёт быстрее и за счёт чего', 'Подписчики и ER конкурентов по дням'] }
};

// Правдоподобные заглушки под размытием: реальные значения сервер не присылает.
const lockedKpis = [
  { label: 'Охват сообщества', value: '12 480', change: '+8,4% к прошлому периоду' },
  { label: 'ER', value: '2,7%', change: '−0,3 п. п.' },
  { label: 'Реакции', value: '1 326', change: '+112 · +9,2%' },
  { label: 'Средние просмотры поста', value: '3 905', change: '+4,1% к прошлому периоду' }
];
const fakeChartPath = 'M0 70 C40 52 70 80 110 58 S180 30 220 46 S290 78 330 50 S400 22 440 38 S510 64 560 34 S630 18 680 30';

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function Locked({ target, onUnlock, className = '', children }: { target: PreviewUnlockTarget; onUnlock: (target: PreviewUnlockTarget) => void; className?: string; children: ReactNode }) {
  return <button className={`preview-locked ${className}`} type="button" onClick={() => onUnlock(target)} aria-label="Открыть полный отчёт">
    <span className="preview-locked-content" aria-hidden="true">{children}</span>
    <span className="preview-locked-badge"><LockKeyhole size={14} />Открыть</span>
  </button>;
}

/** Banner over the short report: offers the free full report first, the tariff second. */
function PreviewBanner({ reportPass, price, isActivatingPass, onActivatePass, onTariff }: {
  reportPass: ReportPassState | null;
  price: number | null;
  isActivatingPass: boolean;
  onActivatePass: () => void;
  onTariff: () => void;
}) {
  if (reportPass?.status === 'available') {
    return <div className="panel span-2 preview-banner report-pass-offer" id={REPORT_PASS_OFFER_ID}>
      <span className="preview-banner-icon report-pass-icon"><Ticket size={20} /></span>
      <div>
        <small>С возвращением!</small>
        <strong>Доступ закончился, но этот отчёт можно открыть полностью</strong>
        <span>Раз в 30 дней — один полный отчёт бесплатно: любой период до 90 дней, охват, ER, графики и все публикации. Открывается на 24 часа.</span>
      </div>
      <div className="preview-banner-actions">
        <button className="primary-button" disabled={isActivatingPass} type="button" onClick={onActivatePass}>{isActivatingPass ? 'Открываем…' : 'Открыть полный отчёт бесплатно'}</button>
        <button className="secondary-button" type="button" onClick={onTariff}>{tariffLabel(price)}</button>
      </div>
    </div>;
  }
  return <div className="panel span-2 preview-banner">
    <span className="preview-banner-icon"><LockKeyhole size={20} /></span>
    <div>
      <strong>Краткий отчёт за последние 7 дней</strong>
      {reportPass?.status === 'active'
        ? <span>Бесплатный полный отчёт сейчас открыт для «{reportPass.sourceName || 'другого источника'}» — до {formatPassMoment(reportPass.expiresAt)}. Следующий — {formatPassDay(reportPass.nextAt)}.</span>
        : reportPass?.status === 'used'
          ? <span>Бесплатный полный отчёт снова будет доступен {formatPassDay(reportPass.nextAt)}. Без ожидания — на тарифе: любой период до 90 дней, охват, ER и конкуренты.</span>
          : <span>Охват, ER, графики, разбор публикаций и конкуренты — в полном отчёте. Любой период до 90 дней.</span>}
    </div>
    <div className="preview-banner-actions">
      {reportPass?.status === 'active' && <Link className="secondary-button" to={reportPassLink(reportPass)}>Вернуться к «{reportPass.sourceName || 'источнику'}»</Link>}
      <button className="primary-button" type="button" onClick={onTariff}>{tariffLabel(price)}</button>
    </div>
  </div>;
}

export function AnalyticsPreviewView({ analytics, section, reportPass, isActivatingPass, onActivatePass }: {
  analytics: CommunityAnalytics;
  section: Section;
  reportPass: ReportPassState | null;
  isActivatingPass: boolean;
  onActivatePass: () => void;
}) {
  const navigate = useNavigate();
  const price = useMonthPrice();
  const preview = analytics.preview!;
  const unlock = (target: PreviewUnlockTarget) => {
    trackPreviewUnlock(target);
    if (reportPass?.status === 'available' && highlightReportPassOffer()) return;
    navigate('/account');
  };
  const previousPosts = analytics.previous.wall.available ? analytics.previous.wall.periodPosts : null;
  const postsDelta = previousPosts === null ? null : analytics.wall.periodPosts - previousPosts;
  const bestPost = analytics.wall.topPosts[0];
  const officialGrowth = analytics.stats.unavailable ? null : analytics.stats;
  const snapshotDirection = preview.snapshotGrowth?.direction ?? null;

  const banner = <PreviewBanner
    reportPass={reportPass}
    price={price}
    isActivatingPass={isActivatingPass}
    onActivatePass={onActivatePass}
    onTariff={() => { trackPreviewUnlock('banner'); navigate('/account'); }}
  />;

  if (section !== 'summary') {
    const content = sectionContents[section];
    return <>
      {banner}
      <div className="panel span-2 preview-section-lock">
        <LockKeyhole size={26} />
        <h2>{content.title} — в полном отчёте</h2>
        <ul>{content.items.map((item) => <li key={item}>{item}</li>)}</ul>
        <button className="primary-button" type="button" onClick={() => section === 'competitors' ? (trackPreviewUnlock('section'), navigate('/account')) : unlock('section')}>{reportPass?.status === 'available' && section !== 'competitors' ? 'Открыть бесплатно' : 'Открыть раздел'}</button>
        {section === 'competitors' && <p className="preview-section-note">Конкуренты открываются только на тарифе, бесплатный полный отчёт их не включает.</p>}
      </div>
    </>;
  }

  return <>
    {banner}
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Главное за неделю</h2><p>Подписчики и число публикаций открыты. Остальные показатели — в полном отчёте.</p></div></div>
      <div className="analytics-kpi-grid summary-kpi-grid">
        <article className="analytics-kpi steady">
          <div className="analytics-kpi-heading"><span>Подписчики</span></div>
          <strong>{analytics.group.membersCount === null ? '—' : formatNumber(analytics.group.membersCount)}</strong>
          <em>Сейчас в сообществе</em>
        </article>
        <article className={`analytics-kpi ${postsDelta ? (postsDelta > 0 ? 'up' : 'down') : 'steady'}`}>
          <div className="analytics-kpi-heading"><span>Публикации</span></div>
          <strong>{formatNumber(analytics.wall.periodPosts)}</strong>
          <em>{postsDelta === null ? 'Нет достоверного сравнения' : postsDelta === 0 ? 'Без изменений' : `${postsDelta > 0 ? '+' : '−'}${formatNumber(Math.abs(postsDelta))} к прошлой неделе`}</em>
        </article>
        {officialGrowth
          ? <article className={`analytics-kpi ${officialGrowth.growth > 0 ? 'up' : officialGrowth.growth < 0 ? 'down' : 'steady'}`}>
            <div className="analytics-kpi-heading"><span>Прирост подписчиков</span></div>
            <strong>{officialGrowth.growth > 0 ? '+' : ''}{formatNumber(officialGrowth.growth)}</strong>
            <em><ArrowUp size={12} />{formatNumber(officialGrowth.subscribed)} <ArrowDown size={12} />{formatNumber(officialGrowth.unsubscribed)} · статистика VK</em>
          </article>
          : <button className={`analytics-kpi preview-kpi-teaser ${snapshotDirection === 'up' ? 'up' : snapshotDirection === 'down' ? 'down' : 'steady'}`} type="button" onClick={() => unlock('kpi')}>
            <div className="analytics-kpi-heading"><span>Прирост подписчиков</span></div>
            <strong>{snapshotDirection === 'up' ? 'Растёт' : snapshotDirection === 'down' ? 'Падает' : snapshotDirection === 'steady' ? 'Без изменений' : 'Нет данных'}</strong>
            <em><LockKeyhole size={12} />Сколько именно и график по срезам Socstat — в полном отчёте</em>
          </button>}
        {lockedKpis.map((kpi) => <Locked className="preview-locked-kpi" key={kpi.label} target="kpi" onUnlock={unlock}>
          <article className="analytics-kpi steady">
            <div className="analytics-kpi-heading"><span>{kpi.label}</span></div>
            <strong>{kpi.value}</strong>
            <em>{kpi.change}</em>
          </article>
        </Locked>)}
      </div>
    </div>
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Динамика видимости</h2><p>Охват или средние просмотры поста по дням в сравнении с прошлым периодом.</p></div></div>
      <Locked className="preview-locked-chart" target="chart" onUnlock={unlock}>
        <svg viewBox="0 0 680 100" preserveAspectRatio="none" role="presentation">
          <path d={fakeChartPath} fill="none" stroke="#4caf50" strokeWidth="3" />
          <path d={fakeChartPath} fill="none" stroke="#9e9e9e" strokeDasharray="6 6" strokeWidth="2" transform="translate(0 14)" />
        </svg>
      </Locked>
    </div>
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Инсайты</h2><p>Что изменилось за неделю. Цифры и рекомендации — в полном отчёте.</p></div></div>
      {preview.insights.length
        ? <div className={`insight-grid insight-grid-count-${preview.insights.length}`}>{preview.insights.map((insight) => <div className={`insight-card ${insight.tone}`} key={insight.title}>
          {insight.tone === 'warn' ? <TrendingDown size={18} /> : insight.tone === 'good' ? <TrendingUp size={18} /> : <BarChart3 size={18} />}
          <div>
            <strong>{insight.title}</strong>
            <Locked className="preview-locked-text" target="insights" onUnlock={unlock}>
              <span>На 14,2% к прошлому периоду, 9 публикаций.</span>
              <span className="insight-action">Проверьте слабые посты и повторяющиеся рубрики.</span>
            </Locked>
          </div>
        </div>)}</div>
        : <div className="empty-state">За неделю мало публикаций для выводов. В полном отчёте можно выбрать период длиннее.</div>}
    </div>
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Публикации</h2><p>Лучшая публикация недели открыта, остальные — в полном отчёте.</p></div></div>
      {bestPost
        ? <div className="posts-list posts-carousel">
          <PostCard post={{ ...bestPost, group: analytics.group }} />
          {preview.hiddenPosts > 0 && <button className="preview-more-posts" type="button" onClick={() => unlock('posts')}>
            <LockKeyhole size={22} />
            <strong>Ещё {formatNumber(preview.hiddenPosts)}</strong>
            <span>публикаций с охватом и ER</span>
          </button>}
        </div>
        : <div className="empty-state">За последние 7 дней публикаций не найдено.</div>}
    </div>
  </>;
}
