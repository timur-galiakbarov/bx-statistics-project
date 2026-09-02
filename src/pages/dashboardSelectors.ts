import type { CommunityAnalytics, DashboardSummaryItem } from '../api/types';
import { formatDate } from '../utils/date';

export type DashboardInsight = {
  tone: 'positive' | 'warning' | 'neutral';
  title: string;
  description: string;
  href: string;
};

export function number(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function percent(value: number, fractionDigits = 1) {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: fractionDigits })}%`;
}

export function change(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function getDashboardInsights(item: DashboardSummaryItem, analytics: CommunityAnalytics | null): DashboardInsight[] {
  const href = `/analytics?groupId=${item.group.id}`;
  const insights: DashboardInsight[] = [];
  if (item.growth.total < 0) {
    insights.push({ tone: 'warning', title: `Аудитория сократилась на ${number(Math.abs(item.growth.total))} подписчиков`, description: 'Проверьте дни с отписками и последние публикации.', href });
  } else if (item.growth.total > 0) {
    insights.push({ tone: 'positive', title: `За период пришло ${number(item.growth.total)} подписчиков`, description: `Подписались ${number(item.growth.subscribed)}, отписались ${number(item.growth.unsubscribed)}.`, href });
  }
  if (analytics) {
    const erDelta = change(analytics.wall.erAverage, analytics.previous.wall.available ? analytics.previous.wall.erAverage : null);
    if (erDelta !== null) {
      insights.push({ tone: erDelta < -5 ? 'warning' : erDelta > 5 ? 'positive' : 'neutral', title: `Средний ER ${erDelta < -5 ? 'снизился' : erDelta > 5 ? 'вырос' : 'почти не изменился'}${Math.abs(erDelta) > 5 ? ` на ${percent(Math.abs(erDelta), 0)}` : ''}`, description: `Сейчас ${percent(analytics.wall.erAverage)} — сравнение с предыдущим равным периодом.`, href });
    }
    const bestPost = analytics.wall.topPosts[0];
    if (bestPost && bestPost.er > analytics.wall.erAverage && analytics.wall.erAverage > 0) {
      insights.push({ tone: 'positive', title: 'Лучшая публикация заметно сильнее среднего', description: `ER ${percent(bestPost.er)} — в ${(bestPost.er / analytics.wall.erAverage).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} раза выше среднего.`, href: '/posts' });
    }
    const peak = [...analytics.wall.dayGroups].sort((a, b) => b.actions - a.actions)[0];
    if (peak && peak.actions > 0) insights.push({ tone: 'neutral', title: `Самый активный день — ${formatDate(peak.date)}`, description: `${number(peak.actions)} реакций на ${number(peak.posts)} публикаций.`, href });
  }
  return insights.slice(0, 4);
}

export function getTopPosts(analytics: CommunityAnalytics | null) {
  if (!analytics) return [];
  const selected = new Set<number>();
  const candidates = [
    { post: [...analytics.wall.topPosts].sort((a, b) => b.er - a.er)[0], label: 'Лучший по ER' },
    { post: [...analytics.wall.topPosts].sort((a, b) => b.views - a.views)[0], label: 'Максимальный охват периода' },
    { post: [...analytics.wall.topPosts].sort((a, b) => b.comments - a.comments)[0], label: 'Самый обсуждаемый' },
    { post: [...analytics.wall.topPosts].sort((a, b) => b.reposts - a.reposts)[0], label: 'Чаще всего репостили' }
  ];
  return candidates.flatMap(({ post, label }) => {
    if (!post || selected.has(post.id)) return [];
    selected.add(post.id);
    return [{ post, label }];
  }).slice(0, 3);
}
