import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type ChartKind = 'activity' | 'views' | 'engagement';

type ChartPoint = {
  date: string;
  reactions?: number;
  average?: number;
  views?: number;
  averageViews?: number;
  er?: number;
};

type Props = {
  kind: ChartKind;
  title: string;
  data: ChartPoint[];
};

const chartTooltipStyle = {
  border: '1px solid #dce3ea',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(23, 55, 47, 0.12)'
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function getTooltipName(kind: ChartKind, name: string) {
  if (kind === 'activity') {
    return name === 'reactions' ? 'Реакции' : 'Среднее';
  }

  if (kind === 'views') {
    return name === 'averageViews' ? 'Средний охват' : 'Просмотры';
  }

  return name === 'er' ? 'ER' : 'Средний ER';
}

function formatTooltipValue(kind: ChartKind, value: unknown) {
  const numericValue = Number(value);

  if (kind === 'engagement') {
    return `${numericValue.toFixed(3)}%`;
  }

  return formatNumber(numericValue);
}

export default function AnalyticsChart({ kind, title, data }: Props) {
  return (
    <div className="chart-panel">
      <h3>{title}</h3>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#687684', fontSize: 12 }} />
            <YAxis tick={{ fill: '#687684', fontSize: 12 }} width={44} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value, name) => [
                formatTooltipValue(kind, value),
                getTooltipName(kind, String(name))
              ]}
            />

            {kind === 'activity' && (
              <>
                <Line
                  dataKey="reactions"
                  dot={{ r: 3 }}
                  name="Реакции"
                  stroke="#2f9f7b"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="average"
                  dot={false}
                  name="Среднее"
                  stroke="#597da3"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  type="monotone"
                />
              </>
            )}

            {kind === 'views' && (
              <>
                <Line
                  dataKey="averageViews"
                  dot={{ r: 3 }}
                  name="Средний охват"
                  stroke="#597da3"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="views"
                  dot={false}
                  name="Просмотры"
                  stroke="#2f9f7b"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  type="monotone"
                />
              </>
            )}

            {kind === 'engagement' && (
              <>
                <Line
                  dataKey="er"
                  dot={{ r: 3 }}
                  name="ER"
                  stroke="#2f9f7b"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="average"
                  dot={false}
                  name="Средний ER"
                  stroke="#597da3"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  type="monotone"
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
