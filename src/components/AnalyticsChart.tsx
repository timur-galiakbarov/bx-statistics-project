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
import { formatDate } from '../utils/date';

type ChartKind = 'reach' | 'activity' | 'views' | 'comments' | 'engagement';

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

export default function AnalyticsChart({ kind, title, data, currentPeriodLabel, previousPeriodLabel, connectNulls = true }: Props) {
  const valueLabel = kind === 'reach' ? 'Охват, человек' : kind === 'activity' ? 'Реакции' : kind === 'views' ? 'Средние просмотры поста' : kind === 'comments' ? 'Комментарии на пост' : 'ER';

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
            <XAxis dataKey="date" tick={{ fill: '#687684', fontSize: 12 }} tickFormatter={(value) => formatDate(String(value))} />
            <YAxis tick={{ fill: '#687684', fontSize: 12 }} tickFormatter={(value) => kind === 'engagement' ? formatPercent(Number(value)) : formatNumber(Number(value))} width={52} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelFormatter={(label) => formatDate(String(label))}
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
    </div>
  );
}
