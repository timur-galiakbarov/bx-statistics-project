/** Подписки и отписки VK по дням: готовим данные для столбиков «вверх/вниз». */

export type FlowDay = {
  date: string;
  subscribed: number | null;
  unsubscribed: number | null;
};

export type FlowBar = {
  date: string;
  /** Доля от максимума периода, 0…1 — высота столбика вверх. */
  up: number;
  /** Доля от максимума периода, 0…1 — высота столбика вниз. */
  down: number;
  subscribed: number;
  unsubscribed: number;
  /** VK прислал этот день в статистике; иначе день показан нулём, но данных о нём нет. */
  hasData: boolean;
};

export type SubscriptionFlow = {
  bars: FlowBar[];
  /** Максимум среди подписок и отписок за день; не меньше 1, чтобы не делить на ноль. */
  max: number;
  subscribed: number;
  unsubscribed: number;
  net: number;
  daysWithData: number;
  daysTotal: number;
  hasData: boolean;
};

/**
 * VK не присылает дни без активности, поэтому в ряду их нет — для графика это ноль,
 * а не повод выкинуть день и сжать шкалу времени. Столбики строятся по всем дням периода.
 */
export function summarizeSubscriptionFlow(days: FlowDay[]): SubscriptionFlow {
  const bars: FlowBar[] = days.map((day) => ({
    date: day.date,
    up: 0,
    down: 0,
    subscribed: day.subscribed ?? 0,
    unsubscribed: day.unsubscribed ?? 0,
    hasData: day.subscribed !== null || day.unsubscribed !== null
  }));
  const max = Math.max(1, ...bars.map((bar) => Math.max(bar.subscribed, bar.unsubscribed)));
  for (const bar of bars) {
    bar.up = bar.subscribed / max;
    bar.down = bar.unsubscribed / max;
  }
  const subscribed = bars.reduce((sum, bar) => sum + bar.subscribed, 0);
  const unsubscribed = bars.reduce((sum, bar) => sum + bar.unsubscribed, 0);
  const daysWithData = bars.filter((bar) => bar.hasData).length;
  return {
    bars,
    max,
    subscribed,
    unsubscribed,
    net: subscribed - unsubscribed,
    daysWithData,
    daysTotal: bars.length,
    hasData: bars.length > 0 && (daysWithData > 0 || subscribed + unsubscribed > 0)
  };
}
