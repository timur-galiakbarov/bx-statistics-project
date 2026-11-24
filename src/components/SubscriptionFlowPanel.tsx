import { formatDate } from '../utils/date';
import { summarizeSubscriptionFlow, type FlowDay } from '../utils/subscriptionFlow';

type SubscriptionFlowPanelProps = {
  days: FlowDay[];
  periodLabel: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

/**
 * Официальные подписки и отписки VK по дням: нет деления на +/− у срезов, поэтому блок
 * показывается только когда статистика VK доступна.
 */
export function SubscriptionFlowPanel({ days, periodLabel }: SubscriptionFlowPanelProps) {
  const flow = summarizeSubscriptionFlow(days);
  if (!flow.hasData) return null;

  const net = `${flow.net > 0 ? '+' : ''}${formatNumber(flow.net)}`;
  const chartLabel = `Подписки и отписки по дням: пришло ${flow.subscribed}, ушло ${flow.unsubscribed}, чистый прирост ${flow.net}`;
  // Пара событий за месяц — это одна палка на пустом поле, график ничего не показывает.
  const showChart = flow.subscribed + flow.unsubscribed >= 3;

  return (
    <div className="panel span-2 analytics-section subscription-flow">
      <div className="section-title">
        <div>
          <h2>Подписки и отписки по дням</h2>
          <p>Официальная статистика VK · {periodLabel}</p>
        </div>
        <div className="subscription-flow-legend">
          <span><i className="up" />подписки</span>
          <span><i className="down" />отписки</span>
        </div>
      </div>
      <div className="subscription-flow-stats">
        <div><span>Пришло</span><strong className="up">{formatNumber(flow.subscribed)}</strong><small>за период</small></div>
        <div><span>Ушло</span><strong className="down">{formatNumber(flow.unsubscribed)}</strong><small>за период</small></div>
        <div><span>Чистый прирост</span><strong className={flow.net < 0 ? 'down' : flow.net > 0 ? 'up' : ''}>{net}</strong><small>{flow.net < 0 ? 'подписчиков убыло' : 'подписчиков прибавилось'}</small></div>
      </div>
      {showChart ? <>
        <div aria-label={chartLabel} className="subscription-flow-chart" role="img">
          {flow.bars.map((bar) => (
            <div className="subscription-flow-day" key={bar.date} title={`${formatDate(bar.date)}: +${bar.subscribed} / −${bar.unsubscribed}`}>
              <span className="subscription-flow-up" style={{ height: `${bar.up * 100}%` }} />
              <span className="subscription-flow-down" style={{ height: `${bar.down * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="subscription-flow-axis"><span>{formatDate(flow.bars[0]?.date)}</span><span>{formatDate(flow.bars[flow.bars.length - 1]?.date)}</span></div>
        <p className="visibility-chart-note">Вверх — подписки, вниз — отписки. Дни без событий VK не присылает: они показаны нулями, чтобы шкала времени не сжималась.</p>
      </> : <p className="visibility-chart-note">Событий за период мало для графика по дням — цифры выше показывают всё, что есть.</p>}
    </div>
  );
}
