import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useState } from 'react';
import { formatDate } from '../utils/date';

type ChartKind = 'reach' | 'activity' | 'views' | 'comments' | 'engagement' | 'subscribers' | 'viewsCurve';

type ChartPoint = {
  date: string;
  current: number | null;
  previous?: number | null;
};

type Props = {
  kind: ChartKind;
  title: string;
  data: ChartPoint[];
  currentPeriodLabel: string;
  previousPeriodLabel?: string;
  connectNulls?: boolean;
  /** Подпись точки по оси X; по умолчанию значение — дата. */
  formatX?: (value: string) => string;
};

const chartTooltipStyle = {
  border: '1px solid #dce3ea',
  borderRadius: 3,
  boxShadow: '0 8px 24px rgba(23, 55, 47, 0.12)'
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  const absoluteValue = Math.abs(value);
  const maximumFractionDigits = absoluteValue > 0 && absoluteValue < 0.01 ? 4 : absoluteValue > 0 && absoluteValue < 0.1 ? 3 : 1;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value)}%`;
}

function formatTooltipValue(kind: ChartKind, value: unknown) {
  if (value === null || value === undefined) return 'Нет публикаций';
  const numericValue = Number(value);
  return kind === 'engagement' ? formatPercent(numericValue) : formatNumber(numericValue);
}

const OUTLIER_RATIO = 3;
const MAX_OUTLIERS = 2;

// Один вирусный пост растягивает шкалу, и остальные дни прижимаются к нулю. Если выбиваются
// один-два дня (в 3+ раза выше медианы), обрезаем шкалу по обычным дням и подписываем выбросы.
function findOutliers(data: ChartPoint[]) {
  const values = data.map((point) => point.current).filter((value): value is number => typeof value === 'number' && value > 0);
  if (values.length < 5) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)];
  const outliers = data.filter((point) => typeof point.current === 'number' && point.current > median * OUTLIER_RATIO);
  if (!outliers.length || outliers.length > MAX_OUTLIERS) return null;
  const outlierDates = new Set(outliers.map((point) => point.date));
  const regularMax = Math.max(...data.flatMap((point) => [outlierDates.has(point.date) ? null : point.current, point.previous]).filter((value): value is number => typeof value === 'number'));
  return { outliers, median, cap: Math.ceil(regularMax * 1.2) };
}

export default function AnalyticsChart({ kind, title, data, currentPeriodLabel, previousPeriodLabel, connectNulls = true, formatX = (value) => formatDate(value) }: Props) {
  const [showFullScale, setShowFullScale] = useState(false);
  const outlierInfo = kind === 'subscribers' || kind === 'viewsCurve' ? null : findOutliers(data);
  const isCapped = Boolean(outlierInfo) && !showFullScale;
  const valueLabel = kind === 'viewsCurve' ? 'Медиана просмотров поста' : kind === 'subscribers' ? 'Подписчики, человек' : kind === 'reach' ? 'Охват, человек' : kind === 'activity' ? 'Реакции' : kind === 'views' ? 'Средние просмотры поста' : kind === 'comments' ? 'Комментарии на пост' : 'ER';

  return (
    <div className="chart-panel">
      <div className="chart-heading">
        <h3>{title}</h3>
        <span>{valueLabel}</span>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#687684', fontSize: 12 }} tickFormatter={(value) => formatX(String(value))} />
            <YAxis allowDataOverflow={isCapped} domain={kind === 'subscribers' ? ['auto', 'auto'] : isCapped ? [0, outlierInfo!.cap] : undefined} tick={{ fill: '#687684', fontSize: 12 }} tickFormatter={(value) => kind === 'engagement' ? formatPercent(Number(value)) : formatNumber(Number(value))} width={52} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelFormatter={(label) => formatX(String(label))}
              formatter={(value, name) => [formatTooltipValue(kind, value), String(name)]}
            />
            <Legend verticalAlign="top" height={30} />
            <Line
              connectNulls={connectNulls}
              dataKey="current"
              dot={{ r: 3 }}
              name={currentPeriodLabel}
              stroke="#2f9f7b"
              strokeWidth={2}
              type="monotone"
            />
            {previousPeriodLabel && (
              <Line
                connectNulls={connectNulls}
                dataKey="previous"
                dot={false}
                name={previousPeriodLabel}
                stroke="#597da3"
                strokeDasharray="5 5"
                strokeWidth={2}
                type="monotone"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {outlierInfo && <p className="chart-outlier-note">
        {isCapped ? 'Шкала обрезана, чтобы были видны обычные дни. Выбивается: ' : 'Выбивается: '}
        {outlierInfo.outliers.map((point) => `${formatDate(point.date)} — ${formatTooltipValue(kind, point.current)} (в ${formatNumber(Math.round((point.current ?? 0) / outlierInfo.median))} раз выше обычного)`).join('; ')}.
        <button type="button" onClick={() => setShowFullScale((value) => !value)}>{isCapped ? 'Показать целиком' : 'Обрезать выбросы'}</button>
      </p>}
    </div>
  );
}
