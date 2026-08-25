import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type CompareChartPoint = {
  id: string;
  name: string;
  reactions: number;
  er: number;
  averageViews: number;
};

type Props = {
  data: CompareChartPoint[];
};

const chartTooltipStyle = {
  border: '1px solid #dce3ea',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(23, 55, 47, 0.12)'
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export default function CompareChart({ data }: Props) {
  return (
    <div className="chart-panel compare-chart">
      <h3>Реакции по группам</h3>
      <div className="chart-box compare-chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 20 }}>
            <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" />
            <XAxis tick={{ fill: '#687684', fontSize: 12 }} type="number" />
            <YAxis
              dataKey="name"
              tick={{ fill: '#687684', fontSize: 12 }}
              tickFormatter={(value) => String(value).slice(0, 18)}
              type="category"
              width={132}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value, name) => [
                name === 'er' ? `${Number(value).toFixed(3)}%` : formatNumber(Number(value)),
                name === 'reactions' ? 'Реакции' : name === 'averageViews' ? 'Средний охват' : 'ER'
              ]}
            />
            <Bar dataKey="reactions" fill="#2f9f7b" name="Реакции" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
