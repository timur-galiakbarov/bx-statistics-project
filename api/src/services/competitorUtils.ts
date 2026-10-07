import { DomainError } from '../errors/domainError.js';
import type { SubscriberPoint } from './snapshotUtils.js';

export type CompetitorPlatform = 'vk' | 'youtube' | 'telegram';
export type Competitor = { platform: CompetitorPlatform; externalId: string; name: string };

export function competitorPlatform(value: unknown): CompetitorPlatform {
  if (value === 'vk' || value === 'youtube' || value === 'telegram') return value;
  throw new DomainError('Неизвестная платформа.', { status: 400, code: 'INVALID_PLATFORM' });
}

export function competitorSource(platform: unknown, id: unknown) {
  const value = typeof id === 'string' ? id.trim() : '';
  if (platform === 'vk' && /^[1-9]\d*$/.test(value)) return value;
  if (platform === 'youtube' && /^UC[\w-]{22}$/.test(value)) return value;
  if (platform === 'telegram' && /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(value)) return value.toLowerCase();
  throw new DomainError('Некорректный идентификатор сообщества.', { status: 400, code: 'INVALID_COMPETITOR_SOURCE' });
}

// Конкуренты могут быть на любой платформе; без platform конкурент считается на платформе исходного сообщества.
export function validateCompetitors(platform: CompetitorPlatform, ownId: string, value: unknown): Competitor[] {
  if (!Array.isArray(value) || value.length > 5) throw new DomainError('Можно добавить до пяти конкурентов.', { status: 400, code: 'COMPETITOR_LIMIT' });
  const items = value.map((item) => {
    const itemPlatform = item?.platform === undefined ? platform : competitorPlatform(item.platform);
    return { platform: itemPlatform, externalId: competitorSource(itemPlatform, item?.externalId), name: typeof item?.name === 'string' ? item.name.trim().slice(0, 160) : '' };
  });
  const keys = items.map(competitorKey);
  if (items.some((item) => !item.name || (item.platform === platform && item.externalId === ownId)) || new Set(keys).size !== keys.length) {
    throw new DomainError('Выберите разных конкурентов, исключая своё сообщество.', { status: 400, code: 'INVALID_COMPETITORS' });
  }
  return items;
}

export const competitorKey = (item: { platform: string; externalId: string }) => `${item.platform}:${item.externalId}`;

export function storedCompetitors(set: { platform: string; competitors: { platform?: string | null; externalId: string; name: string }[] }): Competitor[] {
  return set.competitors.map((item) => ({ platform: competitorPlatform(item.platform ?? set.platform), externalId: item.externalId, name: item.name }));
}

export function competitorGrowth(points: SubscriberPoint[], from: string, current: number | null) {
  const baseline = points.find((point) => point.date === from)?.subscribers;
  if (baseline == null || current == null) return { total: null, percent: null };
  return { total: current - baseline, percent: baseline > 0 ? (current - baseline) / baseline * 100 : null };
}

type SummaryWall = { isComplete?: boolean; periodPosts: number; views: number; averageViewsPerPost: number | null; erAverage: number | null; availability?: { views?: boolean; er?: boolean; likes?: boolean; comments?: boolean; reposts?: boolean } };
export type CompetitorSummaryItem = { platform: string; groupId: string; analytics: { group: { membersCount: number | null }; wall: SummaryWall } | null; growth: { percent: number | null } };
export type CompetitorPlace = { place: number; total: number } | null;
export type CompetitorSummary = { period: 'week' | 'month'; computedAt: Date; views: CompetitorPlace; er: CompetitorPlace; growth: CompetitorPlace };

// Место исходного сообщества по ключевым метрикам — сохраняется в набор, чтобы главная не ждала живой отчёт.
// Правила совпадают с вкладкой: ER сравнивается только внутри одной базы (Telegram — просмотры, VK/YouTube — подписчики).
export function summarizeCompetitorReport(items: CompetitorSummaryItem[], platform: CompetitorPlatform, externalId: string, period: 'week' | 'month'): CompetitorSummary {
  const ownKey = competitorKey({ platform, externalId });
  const basis = (value: string) => value === 'telegram' ? 'views' : 'subscribers';
  const values = items.map((item) => {
    const wall = item.analytics?.wall;
    const hasPosts = Boolean(wall?.isComplete !== false && wall && wall.periodPosts > 0);
    const erAvailable = hasPosts && (item.platform === 'telegram' ? wall!.views > 0 : (item.analytics!.group.membersCount ?? 0) > 0)
      && wall!.availability?.er !== false && wall!.availability?.likes !== false && wall!.availability?.comments !== false && (item.platform === 'youtube' || wall!.availability?.reposts !== false);
    return {
      own: competitorKey({ platform: item.platform, externalId: item.groupId }) === ownKey,
      sameBasis: basis(item.platform) === basis(platform),
      views: hasPosts && wall!.availability?.views !== false ? wall!.averageViewsPerPost ?? null : null,
      er: erAvailable ? wall!.erAverage ?? null : null,
      growth: item.analytics ? item.growth.percent : null
    };
  });
  const place = (key: 'views' | 'er' | 'growth'): CompetitorPlace => {
    const list = values.filter((item) => item[key] !== null && (key !== 'er' || item.sameBasis)).sort((a, b) => b[key]! - a[key]!);
    const index = list.findIndex((item) => item.own);
    return list.length > 1 && index >= 0 ? { place: index + 1, total: list.length } : null;
  };
  return { period, computedAt: new Date(), views: place('views'), er: place('er'), growth: place('growth') };
}
