import type { SubscriberPoint } from './snapshotUtils.js';

const DAY_MS = 86_400_000;

/** Сдвиг даты среза (YYYY-MM-DD) на целое число дней. */
export function shiftDateKey(dateKey: string, days: number) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function isMondayKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay() === 1;
}

/** Начало дня среза по Москве (UTC+3 без перехода на летнее время). */
export function mskDateStart(dateKey: string) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - 3 * 3_600_000);
}

const dayMonthFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** «20–26 октября» или «29 сентября – 5 октября»: неделя перед днём отчёта. */
export function weekLabel(reportDateKey: string) {
  const from = new Date(`${shiftDateKey(reportDateKey, -7)}T00:00:00Z`);
  const to = new Date(`${shiftDateKey(reportDateKey, -1)}T00:00:00Z`);
  if (from.getUTCMonth() === to.getUTCMonth()) return `${from.getUTCDate()}–${dayMonthFormatter.format(to)}`;
  return `${dayMonthFormatter.format(from)} – ${dayMonthFormatter.format(to)}`;
}

function knownAt(points: SubscriberPoint[], dateKeys: string[]) {
  for (const dateKey of dateKeys) {
    const value = points.find((point) => point.date === dateKey)?.subscribers;
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

export type WeekGrowth = {
  subscribers: number | null;
  change: number | null;
  percent: number | null;
  previousChange: number | null;
};

/**
 * Прирост за неделю по ночным срезам: от среза в понедельник неделю назад до среза в день отчёта.
 * Пропущенный срез заменяется соседним днём; без него прирост неизвестен.
 */
export function weekGrowth(points: SubscriberPoint[], reportDateKey: string): WeekGrowth {
  const end = knownAt(points, [reportDateKey, shiftDateKey(reportDateKey, -1)]);
  const start = knownAt(points, [shiftDateKey(reportDateKey, -7), shiftDateKey(reportDateKey, -6)]);
  const previousStart = knownAt(points, [shiftDateKey(reportDateKey, -14), shiftDateKey(reportDateKey, -13)]);
  const change = end !== null && start !== null ? end - start : null;
  return {
    subscribers: end,
    change,
    percent: change !== null && start ? (change / start) * 100 : null,
    previousChange: start !== null && previousStart !== null ? start - previousStart : null
  };
}

export function postUrl(platform: string, externalId: string, postId: string) {
  if (platform === 'telegram') return `https://t.me/${externalId}/${postId}`;
  if (platform === 'youtube') return `https://youtu.be/${postId}`;
  return `https://vk.com/wall-${externalId}_${postId}`;
}

export type CompetitorPlaceResult = { place: number; total: number; leader: { name: string; percent: number } | null };

/** Место по росту за неделю среди своего источника и конкурентов; лидер — если это не сам источник. */
export function competitorGrowthPlace(ownPercent: number | null, competitors: Array<{ name: string; percent: number | null }>): CompetitorPlaceResult | null {
  if (ownPercent === null) return null;
  const known = competitors.filter((item): item is { name: string; percent: number } => item.percent !== null);
  if (!known.length) return null;
  const leader = [...known].sort((left, right) => right.percent - left.percent)[0];
  return {
    place: 1 + known.filter((item) => item.percent > ownPercent).length,
    total: known.length + 1,
    leader: leader.percent > ownPercent ? leader : null
  };
}

export type ReportSourceWeek = {
  name: string;
  growth: WeekGrowth;
  bestPost: { views: number; url: string } | null;
  competitors: CompetitorPlaceResult | null;
};

const numberFormatter = new Intl.NumberFormat('ru-RU');

export function formatCount(value: number) {
  return numberFormatter.format(value).replace(/ /g, ' ');
}

export function formatSigned(value: number) {
  return value > 0 ? `+${formatCount(value)}` : value < 0 ? `−${formatCount(Math.abs(value))}` : '0';
}

export function formatPercent(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const text = Math.abs(rounded).toLocaleString('ru-RU', { maximumFractionDigits: Math.abs(rounded) < 1 ? 2 : 1 });
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${text}%`;
}

function subscribersLine(growth: WeekGrowth) {
  if (growth.subscribers === null) return 'Подписчики: нет свежего среза';
  const base = `Подписчики: ${formatCount(growth.subscribers)}`;
  if (growth.change === null) return `${base} (прирост появится, когда накопится неделя срезов)`;
  const percent = growth.percent !== null ? `, ${formatPercent(growth.percent)}` : '';
  return `${base} (${formatSigned(growth.change)} за неделю${percent})`;
}

export type WeeklyReportMessageOptions = {
  reportDateKey: string;
  variant: 'full' | 'locked';
  sources: ReportSourceWeek[];
  siteUrl: string;
  monthPriceRub: number;
  isReturning: boolean;
};

const reportLinkMarks = 'utm_source=vk_msg&utm_medium=messenger&utm_campaign=weekly';

export function weeklyReportMessage(options: WeeklyReportMessageOptions) {
  const lines = [`📊 Socstat: итоги недели ${weekLabel(options.reportDateKey)}`];

  for (const source of options.sources) {
    lines.push('', `▪ ${source.name}`, subscribersLine(source.growth));
    if (options.variant === 'locked') continue;
    if (source.growth.previousChange !== null && source.growth.change !== null) {
      lines.push(`Неделей раньше: ${formatSigned(source.growth.previousChange)}`);
    }
    if (source.bestPost) {
      lines.push(`Лучший пост: ${formatCount(source.bestPost.views)} просмотров — ${source.bestPost.url}`);
    }
    if (source.competitors) {
      const { place, total, leader } = source.competitors;
      const leaderText = leader ? `, быстрее всех — ${leader.name} (${formatPercent(leader.percent)})` : '';
      lines.push(`Рост среди конкурентов: ${place}-е место из ${total}${leaderText}`);
    }
  }

  lines.push('');
  if (options.variant === 'locked') {
    const price = options.isReturning
      ? `Ваша цена сохранена: ${options.monthPriceRub} ₽ за месяц.`
      : `Месяц — ${options.monthPriceRub} ₽.`;
    lines.push(
      `Лучшие посты недели и сравнение с конкурентами — с доступом. ${price}`,
      `Продлить: ${options.siteUrl}/app/account?${reportLinkMarks}`
    );
  } else {
    lines.push(`Вся аналитика: ${options.siteUrl}/app/dashboard?${reportLinkMarks}`);
  }
  lines.push('', 'Отключить отчёт — напишите «стоп».');
  return lines.join('\n');
}

export const vkReportReplies = {
  connected: 'Готово! Каждый понедельник пришлём сюда итоги недели по сообществам и каналам с вашего дашборда в socstat: прирост подписчиков, лучший пост и место среди конкурентов.\n\nОтключить отчёт — напишите «стоп».',
  stopped: 'Отчёт отключён. Включить снова — напишите «старт» или в профиле на socstat.',
  started: 'Отчёт включён: пришлём итоги недели в понедельник.'
};

/** Команда в сообщении сообществу: «стоп» отключает отчёт, «старт» включает. */
export function reportCommand(text: unknown): 'stop' | 'start' | null {
  if (typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase().replace(/[.!«»"]/g, '');
  if (['стоп', 'stop', 'отписаться', 'отключить'].includes(normalized)) return 'stop';
  if (['старт', 'start', 'включить'].includes(normalized)) return 'start';
  return null;
}
