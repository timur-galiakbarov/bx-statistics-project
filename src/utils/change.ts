/**
 * Сравнение метрики с прошлым периодом. Одно правило для всех площадок:
 * при нулевой базе процент не считается (деление на ноль), остаётся абсолютная разница.
 */
export type ChangeState = 'up' | 'down' | 'steady';

export type MetricChange = {
  absolute: number;
  percent: number | null;
  state: ChangeState;
};

/** Возвращает null, когда сравнивать не с чем: метрики нет в одном из периодов. */
export function getChange(current: number | null, previous: number | null): MetricChange | null {
  if (current === null || previous === null) return null;
  const absolute = current - previous;
  const percent = previous === 0 ? null : (absolute / Math.abs(previous)) * 100;
  const state: ChangeState = absolute === 0 ? 'steady' : absolute > 0 ? 'up' : 'down';
  return { absolute, percent, state };
}

function formatPercentValue(value: number): string {
  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute > 0 && absolute < 0.01 ? 4 : absolute > 0 && absolute < 0.1 ? 3 : 1;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value)}%`;
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value);
}

/** Подпись к KPI: «+8,1%», «−0,4 п. п. к прошлому периоду», «+42» при нулевой базе. */
export function formatChange(change: MetricChange | null, unit = '', isEr = false): string {
  if (!change) return 'Нет сравнения';
  if (change.absolute === 0) return 'Без изменений';
  const relative = change.percent === null ? null : `${change.percent > 0 ? '+' : ''}${formatPercentValue(change.percent)}`;
  // Абсолютное изменение ER в долях процента мало что говорит и округляется до «-0», поэтому для ER — только относительное.
  if (isEr && relative) return `${relative} к прошлому периоду`;
  const digits = Math.abs(change.absolute) < 10 && !Number.isInteger(change.absolute) ? 1 : 0;
  const absolute = `${change.absolute > 0 ? '+' : ''}${formatNumber(change.absolute, isEr ? 3 : digits)}${isEr ? ' п. п.' : unit ? ` ${unit}` : ''}`;
  return relative === null ? absolute : `${absolute} · ${relative}`;
}
