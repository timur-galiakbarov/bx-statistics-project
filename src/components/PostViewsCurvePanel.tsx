import { ExternalLink, Timer } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { PostViewCurves } from '../api/types';
import { formatDate } from '../utils/date';

const AnalyticsChart = lazy(() => import('./AnalyticsChart'));
const CURVE_DAYS = 30;
const MAX_LISTED_POSTS = 8;

type KnownPost = { id: string | number; text?: string; url?: string };

type Props = {
  platform: 'vk' | 'telegram' | 'youtube';
  sourceId: string;
  subscribers: number | null;
  /** Посты, уже загруженные в аналитике: из них берём текст и ссылку для списка. */
  knownPosts: KnownPost[];
};

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value);
}

function postTitle(post: KnownPost | undefined, publishedAt: string, platform: Props['platform']) {
  const text = post?.text?.replace(/\s+/g, ' ').trim();
  if (text) return text.length > 90 ? `${text.slice(0, 90)}…` : text;
  return `${platform === 'youtube' ? 'Видео' : 'Публикация'} от ${formatDate(publishedAt.slice(0, 10))}`;
}

function postUrl(post: KnownPost | undefined, postId: string, platform: Props['platform'], sourceId: string) {
  if (post?.url) return post.url;
  if (platform === 'vk') return `https://vk.com/wall-${sourceId.replace(/^-/, '')}_${postId}`;
  return platform === 'youtube' ? `https://www.youtube.com/watch?v=${postId}` : `https://t.me/${sourceId.replace(/^@/, '')}/${postId}`;
}

// Сколько публикация набирает за первые сутки, двое и трое. Платформы отдают только текущие
// просмотры, поэтому Socstat каждую ночь записывает счётчики свежих постов и строит кривую сам.
export function PostViewsCurvePanel({ platform, sourceId, subscribers, knownPosts }: Props) {
  const [curves, setCurves] = useState<PostViewCurves | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActual = true;
    setCurves(null);
    setError('');
    apiGet<PostViewCurves>(`/api/snapshots/posts?platform=${platform}&id=${encodeURIComponent(sourceId)}&days=${CURVE_DAYS}`)
      .then((data) => { if (isActual) setCurves(data); })
      .catch((reason) => { if (isActual) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить набор просмотров.'); });
    return () => { isActual = false; };
  }, [platform, sourceId]);

  const postNoun = platform === 'youtube' ? 'видео' : 'посты';
  const median24 = curves?.milestones.find((item) => item.hours === 24)?.median ?? null;
  const knownById = new Map(knownPosts.map((post) => [String(post.id), post]));
  const listedPosts = (curves?.posts ?? []).filter((post) => post.milestones['24'] !== null).slice(0, MAX_LISTED_POSTS);
  const hasCurve = Boolean(curves?.curve.some((point) => point.median !== null));

  let content;
  if (error) content = <div className="empty-state">{error}</div>;
  else if (!curves) content = <div className="empty-state">Загружаем набор просмотров...</div>;
  else if (!curves.snapshotPosts) content = <div className="empty-state">Срезов публикаций пока нет. Socstat каждую ночь записывает просмотры {postNoun === 'видео' ? 'видео' : 'постов'} младше 7 дней у отслеживаемых источников — после пары ночей здесь появятся первые цифры.</div>;
  else if (!median24 && !listedPosts.length) content = <div className="empty-state">В срезах уже {formatNumber(curves.snapshotPosts)} {platform === 'youtube' ? 'видео' : 'публикаций'}, но ни одна ещё не прожила первые сутки между двумя срезами. Цифры появятся после следующего ночного среза.</div>;
  else content = <>
    <div className="post-curve-milestones">
      {curves.milestones.map((item) => <div key={item.hours}>
        <span>За {item.hours} ч</span>
        <strong>{item.median === null ? '—' : formatNumber(item.median)}</strong>
        <small>{item.median === null
          ? `Мало данных: ${formatNumber(item.posts)} из 3 нужных`
          : item.hours === 24 && subscribers
            ? `${formatNumber((item.median / subscribers) * 100, 1)}% подписчиков · медиана по ${formatNumber(item.posts)}`
            : `медиана по ${formatNumber(item.posts)}`}</small>
      </div>)}
    </div>
    {hasCurve && <Suspense fallback={<div className="empty-state">Загружаем график...</div>}>
      <AnalyticsChart kind="viewsCurve" title="Типичный набор просмотров" data={curves.curve.map((point) => ({ date: String(point.hours), current: point.median }))} currentPeriodLabel={`Медиана по ${postNoun === 'видео' ? 'видео' : 'постам'} за ${curves.days} дней`} formatX={(value) => `${value} ч`} />
    </Suspense>}
    {listedPosts.length > 0 && <div className="post-curve-list">
      <h3>Как стартовали свежие {postNoun}</h3>
      {listedPosts.map((post) => {
        const known = knownById.get(post.postId);
        const at24 = post.milestones['24']!;
        const ratio = median24 ? at24 / median24 : null;
        const tone = ratio === null ? '' : ratio >= 1.2 ? 'good' : ratio <= 0.8 ? 'warn' : '';
        return <a className="post-curve-row" href={postUrl(known, post.postId, platform, sourceId)} key={post.postId} rel="noreferrer" target="_blank">
          <span className="post-curve-title"><strong>{postTitle(known, post.publishedAt, platform)}</strong><small>{formatDate(post.publishedAt.slice(0, 10))}{post.latestViews !== null ? ` · сейчас ${formatNumber(post.latestViews)}` : ''}</small></span>
          <span className="post-curve-value"><strong>{formatNumber(at24)}</strong><small>за 24 ч</small></span>
          <span className={`post-curve-ratio ${tone}`}>{ratio === null ? '—' : `×${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ratio)}`}</span>
          <ExternalLink size={14} />
        </a>;
      })}
      {median24 !== null && <p className="post-curve-hint">×1,0 — как обычно на этом канале. Больше 1 — пост стартовал лучше медианы за 24 часа, меньше — хуже.</p>}
    </div>}
  </>;

  return <div className="panel span-2 analytics-section post-curve">
    <div className="section-title"><div>
      <h2>Набор просмотров</h2>
      <p><Timer size={14} />Сколько {postNoun} набирают за первые сутки, двое и трое. Платформа показывает только текущие просмотры, поэтому Socstat каждую ночь записывает счётчики свежих публикаций и строит кривую сам.</p>
    </div></div>
    {content}
  </div>;
}
