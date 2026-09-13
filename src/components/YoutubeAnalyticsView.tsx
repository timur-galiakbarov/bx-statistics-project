import { Activity, ArrowDownUp, BarChart3, CircleHelp, Eye, Heart, MessageCircle, Play, TrendingUp, Users } from 'lucide-react';
import { Button } from '@alfalab/core-components-button';
import { Select } from '@alfalab/core-components-select';
import { Tooltip } from '@alfalab/core-components-tooltip';
import { useMemo, useState } from 'react';
import type { CommunityAnalytics } from '../api/types';
import { PostCard } from './PostCard';

type YoutubePost = CommunityAnalytics['wall']['topPosts'][number];
type YoutubeSort = 'views' | 'velocity' | 'engagement' | 'likes' | 'comments' | 'date';

const PAGE_SIZE = 18;
const sortOptions = [
  { key: 'views', content: 'Просмотры' },
  { key: 'velocity', content: 'Просмотры в день' },
  { key: 'engagement', content: 'Вовлечённость' },
  { key: 'likes', content: 'Лайки' },
  { key: 'comments', content: 'Комментарии' },
  { key: 'date', content: 'Дата публикации' }
];

function number(value: number, digits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
}

function percent(value: number) {
  return `${number(value, value > 0 && value < 0.1 ? 2 : 1)}%`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ageDays(post: YoutubePost) {
  return Math.max(1, (Date.now() - new Date(post.date).getTime()) / 86_400_000);
}

function viewVelocity(post: YoutubePost) {
  return post.views / ageDays(post);
}

function engagement(post: YoutubePost) {
  return post.views > 0 ? ((post.likes + post.comments) / post.views) * 100 : 0;
}

function postTitle(post: YoutubePost) {
  return post.media[0]?.title || post.text || 'Видео без названия';
}

function sortValue(post: YoutubePost, sort: YoutubeSort) {
  if (sort === 'date') return new Date(post.date).getTime();
  if (sort === 'velocity') return viewVelocity(post);
  if (sort === 'engagement') return engagement(post);
  return post[sort];
}

function YoutubeMetric({ icon: Icon, label, value, caption }: { icon: typeof Eye; label: string; value: string; caption: string }) {
  return <article className="youtube-kpi"><div><Icon size={18} /><span>{label}</span></div><strong>{value}</strong><small>{caption}</small></article>;
}

function YoutubePerformance({ posts }: { posts: YoutubePost[] }) {
  const leaders = [...posts].sort((left, right) => right.views - left.views).slice(0, 8);
  const maximumViews = leaders[0]?.views ?? 0;

  if (!leaders.length) return <div className="empty-state">За выбранный период видео не найдено.</div>;

  return <div className="youtube-performance-list">{leaders.map((post, index) => <a href={post.url} key={post.id} rel="noreferrer" target="_blank" className="youtube-performance-row">
    <strong>{index + 1}</strong>
    <span className="youtube-performance-title">{postTitle(post)}</span>
    <span className="youtube-performance-bar"><i style={{ width: `${maximumViews ? Math.max(3, (post.views / maximumViews) * 100) : 0}%` }} /></span>
    <span><b>{number(post.views)}</b><small>просмотров</small></span>
    <span><b>{number(viewVelocity(post), 1)}</b><small>в день</small></span>
    <span><b>{percent(engagement(post))}</b><small>вовлечённость</small></span>
  </a>)}</div>;
}

export function YoutubeAnalyticsView({ analytics, section }: { analytics: CommunityAnalytics; section: 'summary' | 'posts' }) {
  const [sort, setSort] = useState<YoutubeSort>('views');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const posts = analytics.wall.topPosts;
  const periodDays = Math.max(1, Math.round((new Date(`${analytics.period.dateTo}T00:00:00`).getTime() - new Date(`${analytics.period.dateFrom}T00:00:00`).getTime()) / 86_400_000) + 1);
  const views = posts.reduce((sum, post) => sum + post.views, 0);
  const likes = posts.reduce((sum, post) => sum + post.likes, 0);
  const comments = posts.reduce((sum, post) => sum + post.comments, 0);
  const viewsPerDay = median(posts.map(viewVelocity));
  const sortedPosts = useMemo(() => [...posts].sort((left, right) => sortValue(right, sort) - sortValue(left, sort)), [posts, sort]);
  const visiblePosts = sortedPosts.slice(0, visibleCount);

  const leaderCandidates: Array<{ post?: YoutubePost; badge: string; reason: (post: YoutubePost) => string }> = [
    { post: [...posts].sort((left, right) => right.views - left.views)[0], badge: 'Больше всего просмотров', reason: (post) => `${number(post.views)} просмотров` },
    { post: [...posts].filter((post) => post.views > 0).sort((left, right) => engagement(right) - engagement(left))[0], badge: 'Лучшая вовлечённость', reason: (post) => `${percent(engagement(post))} реакций от просмотров` },
    { post: [...posts].sort((left, right) => right.comments - left.comments)[0], badge: 'Самое обсуждаемое', reason: (post) => `${number(post.comments)} комментариев` }
  ];
  const selectedIds = new Set<number>();
  const leaders = leaderCandidates.flatMap(({ post, badge, reason }) => {
    if (!post || selectedIds.has(post.id)) return [];
    selectedIds.add(post.id);
    return [{ ...post, er: engagement(post), resultBadge: badge, resultReason: reason(post) }];
  });

  if (section === 'posts') {
    return <div className="panel span-2 posts-section youtube-videos-section">
      <div className="section-title"><div><h2>Все видео</h2><p>Показано {number(visiblePosts.length)} из {number(posts.length)} видео, опубликованных в выбранный период.</p></div></div>
      <div className="posts-toolbar"><ArrowDownUp size={16} /><span>Сортировка</span><Select className="analytics-post-sort-select" client="desktop" options={sortOptions} optionsListWidth="content" selected={sort} size={40} onChange={({ selected }) => { if (selected) { setSort(selected.key as YoutubeSort); setVisibleCount(PAGE_SIZE); } }} /></div>
      {visiblePosts.length ? <><div className="posts-list">{visiblePosts.map((post) => <PostCard key={post.id} post={{ ...post, er: engagement(post), group: analytics.group }} />)}</div>{visibleCount < posts.length && <Button className="load-more-button" client="desktop" size={40} type="button" view="secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Показать ещё {Math.min(PAGE_SIZE, posts.length - visibleCount)}</Button>}</> : <div className="empty-state">За выбранный период видео не найдено.</div>}
    </div>;
  }

  return <>
    <div className="panel span-2 analytics-section youtube-channel-summary">
      <div className="section-title"><div><h2>Канал сейчас</h2><p>Основные публичные показатели канала.</p></div></div>
      <div className="youtube-channel-kpis">
        <YoutubeMetric icon={Users} label="Подписчики" value={analytics.group.membersCount === null ? 'Скрыты' : number(analytics.group.membersCount)} caption="Текущая аудитория канала" />
        <YoutubeMetric icon={Eye} label="Просмотры канала" value={number(analytics.group.channelViewCount ?? 0)} caption="За всё время" />
        <YoutubeMetric icon={Play} label="Публичные видео" value={number(analytics.group.publicVideoCount ?? 0)} caption="Всего на канале" />
      </div>
    </div>
    <div className="panel span-2 analytics-section">
      <div className="section-title"><div><h2>Результаты видео за выбранный период</h2><p>Видео, опубликованные с {new Date(`${analytics.period.dateFrom}T00:00:00`).toLocaleDateString('ru-RU')} по {new Date(`${analytics.period.dateTo}T00:00:00`).toLocaleDateString('ru-RU')}.</p></div><Tooltip content="Период отбирает видео по дате публикации. Метрики показывают их значения на момент обновления." position="left" targetTag="span" view="hint"><button className="youtube-data-info" type="button"><CircleHelp size={18} /> О данных</button></Tooltip></div>
      <div className="youtube-period-kpis">
        <YoutubeMetric icon={Play} label="Опубликовано" value={number(posts.length)} caption={`${number(posts.length / periodDays * 7, 1)} видео в неделю`} />
        <YoutubeMetric icon={Eye} label="Просмотры" value={number(views)} caption={`Медиана — ${number(analytics.wall.medianViewsPerPost ?? 0)}`} />
        <YoutubeMetric icon={TrendingUp} label="Медиана просмотров в день" value={number(viewsPerDay, 1)} caption="С учётом возраста каждого видео" />
        <YoutubeMetric icon={Heart} label="Лайки на 1 000 просмотров" value={views ? number(likes / views * 1000, 1) : '—'} caption={`${number(likes)} лайков всего`} />
        <YoutubeMetric icon={MessageCircle} label="Комментарии на 1 000 просмотров" value={views ? number(comments / views * 1000, 1) : '—'} caption={`${number(comments)} комментариев всего`} />
        <YoutubeMetric icon={Activity} label="Вовлечённость по просмотрам" value={views ? percent((likes + comments) / views * 100) : '—'} caption="Лайки и комментарии / просмотры" />
      </div>
    </div>
    <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Результативность видео</h2><p>Лидеры по просмотрам с поправкой на возраст видео и долей реакций.</p></div></div><YoutubePerformance posts={posts} /></div>
    <div className="panel span-2 analytics-section"><div className="section-title"><div><h2>Лучшие видео</h2><p>Лидеры периода по разным критериям.</p></div></div>{leaders.length ? <div className="posts-list">{leaders.map((post) => <PostCard key={post.id} post={{ ...post, group: analytics.group }} />)}</div> : <div className="empty-state">За выбранный период видео не найдено.</div>}</div>
  </>;
}
