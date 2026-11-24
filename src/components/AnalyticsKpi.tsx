import { CircleHelp, TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip } from '@alfalab/core-components-tooltip';
import { formatChange, type MetricChange } from '../utils/change';
import type { ReachBreakdown } from '../utils/reachBreakdown';

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

type AnalyticsKpiProps = {
  label: string;
  value: string;
  /** Сравнение с прошлым периодом. Если не передано, показывается `caption`. */
  change?: MetricChange | null;
  caption?: string;
  tooltip?: string;
  unavailable?: boolean;
  comparisonUnavailable?: boolean;
  unit?: string;
  isEr?: boolean;
  className?: string;
  /** Разбивка охвата VK на своих подписчиков и виральный. */
  breakdown?: ReachBreakdown | null;
};

/**
 * KPI-карточка отчёта: значение, изменение к прошлому периоду и подсказка.
 * Один компонент на VK, Telegram и YouTube, чтобы дельты и состояния выглядели одинаково.
 */
export function AnalyticsKpi({
  label,
  value,
  change = null,
  caption,
  tooltip,
  unavailable = false,
  comparisonUnavailable = false,
  unit = '',
  isEr = false,
  className = '',
  breakdown = null
}: AnalyticsKpiProps) {
  const isUnavailable = unavailable || value === 'Недоступно';
  const state = isUnavailable ? 'unavailable' : change?.state ?? 'steady';
  const hasComparison = !isUnavailable && !comparisonUnavailable && change !== null;
  const TrendIcon = state === 'up' ? TrendingUp : state === 'down' ? TrendingDown : null;

  let footer: string;
  if (isUnavailable) footer = 'Недоступно для этого источника';
  else if (comparisonUnavailable) footer = 'Нет достоверного сравнения';
  else if (hasComparison) footer = formatChange(change, unit, isEr);
  else footer = caption ?? 'Нет сравнения';

  return (
    <article className={`analytics-kpi ${hasComparison ? state : isUnavailable ? 'unavailable' : 'steady'}${className ? ` ${className}` : ''}`}>
      <div className="analytics-kpi-heading">
        <span>{label}</span>
        {tooltip && (
          <Tooltip content={<div className="growth-help-content"><p>{tooltip}</p></div>} position="top" targetTag="span" view="hint">
            <button aria-label={`Что такое «${label}»`} className="growth-help-button kpi-help-button" type="button"><CircleHelp size={14} /></button>
          </Tooltip>
        )}
      </div>
      <strong>{isUnavailable ? '—' : value}</strong>
      {breakdown && (
        <>
          <div aria-hidden="true" className="analytics-kpi-meter">
            <span className="analytics-kpi-meter-subscribers" style={{ width: `${breakdown.subscribersShare * 100}%` }} />
            <span className="analytics-kpi-meter-viral" style={{ width: `${breakdown.viralShare * 100}%` }} />
          </div>
          <div className="analytics-kpi-breakdown">свои {formatNumber(breakdown.subscribers)} · виральный {formatNumber(breakdown.viral)}</div>
        </>
      )}
      <em>{hasComparison && TrendIcon && <TrendIcon size={14} aria-hidden="true" />}{footer}</em>
    </article>
  );
}
