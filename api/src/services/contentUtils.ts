import { createHash } from 'node:crypto';
import { DomainError } from '../errors/domainError.js';

export const ideaStatuses = ['new', 'saved', 'rejected', 'published'] as const;
export type Rubric = { name: string; description: string };
export const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function invalid(message: string): never {
  throw new DomainError(message, { code: 'CONTENT_INVALID' });
}
export function vkRef(value: unknown) {
  const input = text(value, 250);
  const ref = input.replace(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:vk\.com|vk\.ru)\//i, '').replace(/^@/, '').replace(/\/$/, '');
  if (!/^[a-zA-Z0-9_\.]{2,100}$/.test(ref)) invalid('Укажите ссылку на сообщество ВК или его короткое имя.');
  return ref.replace(/^(club|public)(\d+)$/, '$2');
}
export function targetUrl(value: unknown) {
  const input = text(value, 250);
  if (!input) return '';
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); } catch { return invalid('Укажите ссылку на свою группу ВК или Telegram-канал.'); }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  if (!['vk.com', 'vk.ru', 't.me'].includes(host) || !/^\/[a-zA-Z0-9_.]+\/?$/.test(url.pathname) || url.username || url.password || url.port) invalid('Укажите ссылку на свою группу ВК или публичный Telegram-канал.');
  return `https://${host}${url.pathname.replace(/\/$/, '')}`;
}
export function parseRubrics(value: unknown): Rubric[] {
  if (!Array.isArray(value) || value.length > 8) invalid('Добавьте от одной до восьми рубрик.');
  const result: Rubric[] = [];
  for (const item of value) {
    const name = text(item?.name, 80);
    if (!name || result.some((r) => r.name.toLowerCase() === name.toLowerCase())) invalid('Названия рубрик должны быть заполнены и не повторяться.');
    result.push({ name, description: text(item?.description, 500) });
  }
  return result;
}
export function projectInput(value: Record<string, unknown>) {
  const name = text(value.name, 80);
  const brief = text(value.brief, 3000);
  if (!name || !brief) invalid('Заполните название проекта и описание задачи.');
  return { name, brief, targetUrl: targetUrl(value.targetUrl), audience: text(value.audience, 1000), style: text(value.style, 1000), exclusions: text(value.exclusions, 1000), rubrics: parseRubrics(value.rubrics ?? []) };
}
export type ContentPost = { key: string; sourceId: number; sourceName: string; url: string; date: string; text: string; views: number; actions: number; relative: number | null };
export function fingerprint(value: string) {
  const normalized = value.toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex');
}
/** Повтор одного текста в разных пабликах занимает одно место в запросе к модели. */
export function uniquePosts(posts: ContentPost[]) {
  const seen = new Set<string>();
  return posts.filter((post) => { const key = fingerprint(post.text); if (seen.has(key)) return false; seen.add(key); return true; });
}
/** Модель может ссылаться только на переданные сервером посты и рубрики. */
export function parseIdeas(value: unknown, posts: ContentPost[], rubrics: Rubric[]) {
  const items = (value as { items?: unknown })?.items;
  if (!Array.isArray(items)) invalid('ИИ не вернул подборку. Повторите запрос.');
  const used = new Set<string>();
  return items.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rubric = rubrics.find((r) => r.name === item.rubric)?.name;
    const refs = Array.isArray(item.postKeys) ? posts.filter((p) => item.postKeys.includes(p.key) && !used.has(p.key)).slice(0, 4) : [];
    const title = text(item.title, 160), reason = text(item.reason, 1000), angle = text(item.angle, 1500);
    if (!rubric || !refs.length || !title || !reason || !angle) return [];
    refs.forEach((p) => used.add(p.key));
    return [{ key: fingerprint(refs.map((p) => p.key).sort().join('|')), title, rubric, reason, angle, checks: text(item.checks, 1500), references: refs }];
  });
}
