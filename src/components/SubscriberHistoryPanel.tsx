import { ArrowDown, ArrowUp, CalendarClock } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { SocialPlatform, SubscriberHistory } from '../api/types';
import { formatDate } from '../utils/date';

const AnalyticsChart = lazy(() => import('./AnalyticsChart'));
const HISTORY_DAYS = 365;

type Props = {
  platform: SocialPlatform;
  sourceId: string | number;
  period: { dateFrom: string; dateTo: string };
  currentSubscribers: number | null;
  /** Официальный прирост VK для сообществ с доступом к статистике: точнее срезов и делится на подписки и отписки. */
  officialGrowth?: { total: number; subscribed: number; unsubscribed: number } | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function formatSigned(value: number) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

// Единственный блок динамики подписчиков в аналитике: число сейчас, прирост за период и график
// из ежедневных срезов Socstat. Срезы пишутся для всех отслеживаемых источников, включая
// сообщества VK с доступом к статистике, поэтому график есть у любого источника.
export function SubscriberHistoryPanel({ platform, sourceId, period, currentSubscribers, officialGrowth }: Props) {
  const [history, setHistory] = useState<SubscriberHistory | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActual = true;
    setHistory(null);
    setError('');
    const params = new URLSearchParams({ platform, id: String(sourceId), days: String(HISTORY_DAYS), from: period.dateFrom, to: period.dateTo });
    if (currentSubscribers !== null) params.set('current', String(currentSubscribers));
    apiGet<SubscriberHistory>(`/api/snapshots/history?${params.toString()}`)
      .then((data) => { if (isActual) setHistory(data); })
      .catch((reason) => { if (isActual) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить историю подписчиков.'); });
    return () => { isActual = false; };
  }, [platform, sourceId, period.dateFrom, period.dateTo, currentSubscribers]);

  const known = (history?.points ?? []).filter((point): point is typeof point & { subscribers: number } => point.subscribers !== null);
  const first = known[0];
  const last = known.at(-1);
  const snapshotGrowth = history?.periodGrowth ?? null;

  let periodGrowth;
  if (officialGrowth) {
    periodGrowth = <><strong>{formatSigned(officialGrowth.total)}</strong><small><ArrowUp size={12} />{formatNumber(officialGrowth.subscribed)} <ArrowDown size={12} />{formatNumber(officialGrowth.unsubscribed)} · статистика VK</small></>;
  } else if (snapshotGrowth?.total !== null && snapshotGrowth?.total !== undefined) {
    const isPartial = Boolean(snapshotGrowth.since && snapshotGrowth.since > period.dateFrom);
    periodGrowth = <><strong>{formatSigned(snapshotGrowth.total)}</strong><small>{isPartial ? `с ${formatDate(snapshotGrowth.since)} · срезов раньше нет` : 'по срезам Socstat'}</small></>;
  } else {
    periodGrowth = <><strong>—</strong><small>{history ? 'Срезов за период пока нет' : 'Загружаем...'}</small></>;
  }

  let chart;
  if (error) chart = <div className="empty-state">{error}</div>;
  else if (!history) chart = <div className="empty-state">Загружаем историю подписчиков...</div>;
  else if (!first || !last) chart = <div className="empty-state">Срезов пока нет. Socstat сохраняет подписчиков раз в сутки, ночью: первая точка появится после ближайшего среза. Если источника ещё нет в отслеживаемых на главной, добавьте его — иначе история собираться не будет.</div>;
  else if (first === last) chart = <div className="empty-state">Первый срез сделан {formatDate(first.date)}: {formatNumber(first.subscribers)} подписчиков. График появится, когда накопится хотя бы два дня.</div>;
  else chart = <Suspense fallback={<div className="empty-state">Загружаем график...</div>}>
    <AnalyticsChart kind="subscribers" title="Подписчики по дням" data={history.points.map((point) => ({ date: point.date, current: point.subscribers }))} currentPeriodLabel="Подписчики на утро дня" />
  </Suspense>;

  return <div className="panel span-2 analytics-section subscriber-history">
    <div className="section-title"><div>
      <h2>Динамика подписчиков</h2>
      <p><CalendarClock size={14} />Socstat начал сохранять число подписчиков, как только источник добавили в отслеживаемые, и делает это каждый день{first ? ` — первый срез ${formatDate(first.date)}` : ''}. Платформы не отдают историю задним числом, поэтому раньше этой даты данных нет.</p>
    </div></div>
    <div className="subscriber-history-stats">
      <div><span>Подписчики сейчас</span><strong>{currentSubscribers === null ? 'Недоступно' : formatNumber(currentSubscribers)}</strong></div>
      <div><span>Прирост за период</span>{periodGrowth}</div>
      {first && last && first !== last && <div><span>С начала истории, {formatDate(first.date)}</span><strong>{formatSigned(last.subscribers - first.subscribers)}</strong></div>}
    </div>
    {chart}
  </div>;
}
