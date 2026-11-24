/** Разбивка охвата VK на своих подписчиков и виральный: сколько людей пришло не из базы. */

export type ReachBreakdown = {
  subscribers: number;
  viral: number;
  subscribersShare: number;
  viralShare: number;
};

/**
 * Возвращает null, если разбивки нет: охват нулевой или VK не дал охват подписчиков.
 * Иначе виральный охват — остаток после своих подписчиков.
 */
export function reachBreakdown(reach: number, subscribers: number | null | undefined): ReachBreakdown | null {
  if (!Number.isFinite(reach) || reach <= 0) return null;
  if (subscribers === null || subscribers === undefined || !Number.isFinite(subscribers) || subscribers <= 0) return null;
  const own = Math.min(subscribers, reach);
  const viral = reach - own;
  return { subscribers: own, viral, subscribersShare: own / reach, viralShare: viral / reach };
}
