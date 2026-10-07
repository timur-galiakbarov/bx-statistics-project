import type { CompareItem, SocialPlatform } from '../api/types';

export type CompetitorReportItem = CompareItem & { growth: { total: number | null; percent: number | null }; historySince: string | null };
export type CompetitorMetric = 'subscribers' | 'growthPercent' | 'frequency' | 'views' | 'er';
export type Metric = { value: number | null; note?: string };
const metric = (value: number | null | undefined, missing: string): Metric => typeof value === 'number' && Number.isFinite(value) ? { value } : { value: null, note: missing };

export const competitorKey = (platform: SocialPlatform, id: string | number) => `${platform}:${platform === 'telegram' ? String(id).toLowerCase() : String(id)}`;

// ER Telegram считается по просмотрам, VK и YouTube — по подписчикам: сравнивать можно только внутри одной базы.
const erBasis = (platform: SocialPlatform) => platform === 'telegram' ? 'views' : 'subscribers';
export const isComparable = (key: CompetitorMetric, platform: SocialPlatform, ownPlatform: SocialPlatform) => key !== 'er' || erBasis(platform) === erBasis(ownPlatform);

export function competitorMetrics(item: CompetitorReportItem, days: number): Record<CompetitorMetric, Metric> {
  const analytics = item.analytics;
  const platform = item.platform ?? 'vk';
  if (!analytics) return { subscribers: { value: null, note: 'Нет данных' }, growthPercent: { value: null, note: 'Нет данных' }, frequency: { value: null, note: 'Нет данных' }, views: { value: null, note: 'Нет данных' }, er: { value: null, note: 'Нет данных' } };
  const wall = analytics.wall;
  const missing = !wall.isComplete ? 'Неполная выборка' : !wall.periodPosts ? 'Нет публикаций' : 'Недоступно';
  const hasPosts = wall.isComplete && wall.periodPosts > 0;
  const erAvailable = hasPosts && (platform === 'telegram' ? wall.views > 0 : (analytics.group.membersCount ?? 0) > 0) && wall.availability?.er !== false && wall.availability?.likes !== false && wall.availability?.comments !== false && (platform === 'youtube' || wall.availability?.reposts !== false);
  const growthMissing = analytics.group.membersCount === null ? 'Аудитория скрыта' : item.historySince ? `История с ${new Date(`${item.historySince}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : 'История копится';
  return {
    subscribers: metric(analytics.group.membersCount, 'Аудитория скрыта'),
    growthPercent: metric(item.growth.percent, item.growth.total !== null ? 'Нулевая база' : growthMissing),
    frequency: metric(wall.isComplete ? wall.periodPosts / days * 7 : null, 'Неполная выборка'),
    views: metric(hasPosts && wall.availability?.views !== false ? wall.averageViewsPerPost : null, missing),
    er: metric(erAvailable ? wall.erAverage : null, missing)
  };
}
