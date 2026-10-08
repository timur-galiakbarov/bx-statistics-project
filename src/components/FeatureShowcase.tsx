import { Button } from '@alfalab/core-components-button';
import { Select } from '@alfalab/core-components-select';
import { ArrowDownUp, ArrowLeftRight, Check, FileText } from 'lucide-react';
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackPreviewUnlock } from '../utils/visit';
import { useMonthPrice } from './AnalyticsPreview';
import { PostCard, type PostCardData } from './PostCard';
import { TelegramLogo } from './TelegramLogo';

const CompareChart = lazy(() => import('./CompareChart'));

type Feature = 'compare' | 'posts_page';

// Вымышленные примеры: страница без доступа ничего не запрашивает и не показывает реальных данных.
type ExamplePlatform = 'vk' | 'telegram' | 'youtube';
const compareExample: Array<{
  name: string; platform: ExamplePlatform; initials: string; color: string; members: number;
  actions: number; perPost: number; perDay: number; likes: number; reposts: number | null; comments: number;
  averageViews: number; maxViews: number; minViews: number; ads: number | null; posts: number;
  er: number; erMax: number; photos: number; videos: number;
}> = [
  { name: 'Ваше сообщество', platform: 'vk', initials: 'ВС', color: '#4caf50', members: 12480, actions: 1326, perPost: 60.3, perDay: 44.2, likes: 1104, reposts: 96, comments: 126, averageViews: 3905, maxViews: 9120, minViews: 1210, ads: 2, posts: 22, er: 0.48, erMax: 1.9, photos: 14, videos: 3 },
  { name: 'Конкурент ВК', platform: 'vk', initials: 'КВ', color: '#2787f5', members: 18920, actions: 2018, perPost: 72.1, perDay: 67.3, likes: 1690, reposts: 141, comments: 187, averageViews: 4210, maxViews: 12400, minViews: 980, ads: 5, posts: 28, er: 0.38, erMax: 1.4, photos: 19, videos: 6 },
  { name: 'Канал в Telegram', platform: 'telegram', initials: 'TG', color: '#29a9eb', members: 9304, actions: 874, perPost: 24.3, perDay: 29.1, likes: 702, reposts: 118, comments: 54, averageViews: 2870, maxViews: 6340, minViews: 1430, ads: 3, posts: 36, er: 0.85, erMax: 2.6, photos: 11, videos: 4 },
  { name: 'Канал на YouTube', platform: 'youtube', initials: 'YT', color: '#ff3d3d', members: 21500, actions: 1542, perPost: 192.8, perDay: 51.4, likes: 1371, reposts: null, comments: 171, averageViews: 8640, maxViews: 19800, minViews: 2950, ads: null, posts: 8, er: 2.2, erMax: 4.1, photos: 0, videos: 8 }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function ExampleGroupCell({ row }: { row: (typeof compareExample)[number] }) {
  return <span className="compare-group-cell">
    <span className="compare-avatar">
      <span className="showcase-avatar" style={{ background: row.color }}>{row.initials}</span>
      {row.platform === 'telegram' ? <TelegramLogo className="compare-platform-icon" size={14} /> : <img className="compare-platform-icon" src={row.platform === 'youtube' ? '/youtube-logo.png' : '/vk-network-logo.png'} alt="" />}
    </span>
    <span>
      <strong>{row.name}</strong>
      <small>{formatNumber(row.members)} {row.platform === 'vk' ? 'участников' : 'подписчиков'}</small>
    </span>
  </span>;
}

function CompareTable({ title, kind, columns, cells }: { title: string; kind: 'activity' | 'reach' | 'content'; columns: string[]; cells: (row: (typeof compareExample)[number]) => ReactNode[] }) {
  return <section className="compare-table-card">
    <h3 className="compare-table-title">{title}</h3>
    <div className="table analytics-posts">
      <div className={`table-row table-head compare-row ${kind} ${columns.length === 4 ? 'four' : ''}`}><span>Группа</span>{columns.map((column) => <span key={column}>{column}</span>)}</div>
      {compareExample.map((row) => <div className={`table-row compare-row ${kind} ${columns.length === 4 ? 'four' : ''}`} key={row.name}>
        <ExampleGroupCell row={row} />
        {cells(row).map((cell, index) => <span key={index}>{cell}</span>)}
      </div>)}
    </div>
  </section>;
}


type ExampleSource = (typeof compareExample)[number];
const DAY_MS = 86_400_000;

function exampleAvatar(source: ExampleSource) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${source.color}"/><text x="20" y="25" font-family="Arial" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">${source.initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function exampleGroup(source: ExampleSource): PostCardData['group'] {
  return { id: source.name, platform: source.platform, name: source.name, membersCount: source.members, photo: exampleAvatar(source) };
}

// Публикации примера живут неделю назад от сегодняшнего дня, чтобы даты не выглядели устаревшими.
function examplePosts(): Array<PostCardData & { likes: number; reposts: number | null; comments: number; views: number; er: number; actions: number }> {
  const [own, vk, telegram, youtube] = compareExample;
  const rows: Array<[ExampleSource, number, 'photo' | 'video' | null, string, number, number | null, number, number, number, boolean]> = [
    [youtube, 2, 'video', 'Разбор трёх ошибок, из-за которых падают просмотры: что мы поменяли и что получилось', 1290, null, 164, 11840, 6.3, false],
    [vk, 1, 'photo', 'Подборка лучших идей недели: что попробовать в эти выходные', 486, 52, 61, 9120, 3.2, false],
    [own, 3, 'photo', 'Итоги месяца в цифрах и планы на следующий — спасибо, что вы с нами!', 402, 38, 47, 6230, 3.6, false],
    [telegram, 1, null, 'Коротко о главном за день: пять новостей, которые стоит знать', 318, 74, 22, 6340, 0.4, false],
    [own, 5, 'video', 'Как мы готовим публикации: показываем процесс от идеи до выхода поста', 276, 19, 33, 4870, 2.6, false],
    [vk, 4, 'photo', 'Розыгрыш среди подписчиков: условия внутри', 231, 88, 140, 7410, 2.4, true]
  ];
  return rows.map(([source, daysAgo, media, text, likes, reposts, comments, views, er, isAd], index) => ({
    id: `example-${index}`,
    group: exampleGroup(source),
    date: new Date(new Date().setHours(12, 0, 0, 0) - daysAgo * DAY_MS).toISOString(),
    text,
    url: '',
    media: media ? [{ type: media, url: '', title: media === 'video' ? 'Видео' : 'Фото' }] : [],
    likes,
    reposts,
    comments,
    views,
    er,
    actions: likes + (reposts ?? 0) + comments,
    isAd,
    contentType: media === 'video' ? 'Видео' : media === 'photo' ? 'Фото' : 'Текст'
  }));
}

const postSortOptions = [
  { key: 'likes', content: 'Лайки' },
  { key: 'comments', content: 'Комментарии' },
  { key: 'actions', content: 'Все реакции' },
  { key: 'views', content: 'Просмотры' },
  { key: 'er', content: 'ER' },
  { key: 'date', content: 'Дата' }
] as const;
const postFilterOptions = [
  { key: 'all', label: 'Все' },
  { key: 'photo', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'ad', label: 'Реклама' },
  { key: 'text', label: 'Без вложений' }
] as const;
type ExamplePostSort = (typeof postSortOptions)[number]['key'];
type ExamplePostFilter = (typeof postFilterOptions)[number]['key'];

function ExamplePlatformIcon({ platform }: { platform: ExamplePlatform }) {
  return <img className="posts-platform-icon" src={platform === 'youtube' ? '/youtube-logo.png' : platform === 'telegram' ? '/telegram-logo.svg' : '/vk-network-logo.png'} alt="" />;
}

function PostsExample() {
  const posts = useMemo(examplePosts, []);
  const [sortBy, setSortBy] = useState<ExamplePostSort>('likes');
  const [filterBy, setFilterBy] = useState<ExamplePostFilter>('all');
  // Сортировка и фильтры работают на примере так же, как в настоящем отчёте.
  const visiblePosts = posts
    .filter((post) => filterBy === 'all' || (filterBy === 'ad' ? post.isAd : filterBy === 'text' ? post.media.length === 0 : post.media.some((item) => item.type === filterBy)))
    .sort((left, right) => sortBy === 'date' ? new Date(right.date).getTime() - new Date(left.date).getTime() : right[sortBy] - left[sortBy]);

  return <div className="panel span-2 posts-results">
    <div className="posts-results-heading">
      <div>
        <h2>Результаты анализа</h2>
        <p>Так выглядит раздел — пример на вымышленных данных за 30 дней.</p>
      </div>
      <div className="posts-results-meta">
        <span><strong>{compareExample.length}</strong>источника</span>
        <span><strong>{formatNumber(compareExample.reduce((sum, source) => sum + source.posts, 0))}</strong>публикаций</span>
      </div>
    </div>
    <div className="compare-sections">
      <div className="table analytics-posts compare-table-card">
        <div className="table-row table-head posts-group-row"><span>Источник</span><span>Посты</span><span>Реакции</span><span>На пост</span><span>Ср. просмотры</span><span>ER ср.</span></div>
        {compareExample.map((source) => <div className="table-row posts-group-row" key={source.name}>
          <span className="posts-result-source">
            <span className="posts-result-source-content">
              <span className="posts-result-avatar"><span className="showcase-avatar" style={{ background: source.color }}>{source.initials}</span><ExamplePlatformIcon platform={source.platform} /></span>
              <span className="posts-result-identity"><strong>{source.name}</strong><small>{formatNumber(source.members)} {source.platform === 'vk' ? 'участников' : 'подписчиков'}</small></span>
            </span>
          </span>
          <span>{formatNumber(source.posts)}</span>
          <span>{formatNumber(source.actions)}</span>
          <span>{formatNumber(Math.round(source.perPost))}</span>
          <span>{formatNumber(source.averageViews)}</span>
          <span>{String(source.er).replace('.', ',')}%</span>
        </div>)}
      </div>
      <div className="posts-content-heading">
        <div><h3>Все публикации</h3><p>Показано {formatNumber(visiblePosts.length)} из {formatNumber(compareExample.reduce((sum, source) => sum + source.posts, 0))}</p></div>
        <div className="posts-toolbar"><ArrowDownUp size={16} /><span>Сортировка</span><Select className="analytics-post-sort-select" client="desktop" options={[...postSortOptions]} optionsListWidth="content" selected={sortBy} size={40} onChange={({ selected }) => selected && setSortBy(selected.key as ExamplePostSort)} /></div>
      </div>
      <div className="post-filter-tabs">
        {postFilterOptions.map((option) => <Button className={filterBy === option.key ? 'post-filter-button active' : 'post-filter-button'} client="desktop" key={option.key} size={40} type="button" view="secondary" onClick={() => setFilterBy(option.key)}>{option.label}</Button>)}
      </div>
      {visiblePosts.length ? <div className="posts-list">{visiblePosts.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="empty-state">В примере нет таких публикаций.</div>}
    </div>
  </div>;
}

function Showcase({ feature, icon, title, description, items, example }: { feature: Feature; icon: ReactNode; title: string; description: string; items: string[]; example: ReactNode }) {
  const navigate = useNavigate();
  const price = useMonthPrice();
  const unlock = () => {
    trackPreviewUnlock(feature);
    navigate('/account');
  };

  return (
    <section className="page-grid feature-showcase-page">
      <div className="panel span-2 feature-showcase">
        <div className="feature-showcase-intro">
          <span className="feature-showcase-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
            <ul>{items.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
          </div>
          <div className="feature-showcase-action">
            <button className="primary-button" type="button" onClick={unlock}>{price ? `Открыть за ${new Intl.NumberFormat('ru-RU').format(price)} ₽` : 'Выбрать тариф'}</button>
            <small>Доступ к аналитике истёк. Сообщества ВКонтакте можно бесплатно посмотреть в кратком отчёте за неделю.</small>
          </div>
        </div>
      </div>
      {example}
    </section>
  );
}

export function CompareShowcase() {
  return <Showcase
    feature="compare"
    icon={<ArrowLeftRight size={22} />}
    title="Сравнение сообществ"
    description="Поставьте своё сообщество рядом с конкурентами и посмотрите, у кого контент работает лучше и за счёт чего."
    items={['До 10 сообществ ВКонтакте, Telegram и YouTube в одной таблице', 'Реакции, просмотры, публикации, форматы и ER за любой период', 'График динамики и сохранённые подборки для регулярного сравнения']}
    example={<div className="panel span-2">
      <div className="panel-header compact">
        <div>
          <h2>Результаты сравнения</h2>
          <p>Так выглядит раздел — пример на вымышленных данных за 30 дней.</p>
        </div>
      </div>
      <div className="compare-sections">
        <Suspense fallback={<div className="chart-panel">Загрузка графика...</div>}>
          <CompareChart data={[...compareExample].sort((left, right) => right.actions - left.actions).map((row) => ({ id: row.name, name: row.name, reactions: row.actions, er: row.er, averageViews: row.averageViews }))} />
        </Suspense>
        <CompareTable title="Вовлечённость" kind="activity" columns={['Реакции', 'На пост', 'В день', 'Лайки', 'Репосты', 'Комментарии']}
          cells={(row) => [formatNumber(row.actions), String(row.perPost).replace('.', ','), String(row.perDay).replace('.', ','), formatNumber(row.likes), row.reposts === null ? 'Недоступно' : formatNumber(row.reposts), formatNumber(row.comments)]} />
        <CompareTable title="Просмотры и публикации" kind="reach" columns={['Средний охват', 'Максимум', 'Минимум', 'Рекламные посты', 'Посты']}
          cells={(row) => [formatNumber(row.averageViews), formatNumber(row.maxViews), formatNumber(row.minViews), row.ads === null ? 'Недоступно' : formatNumber(row.ads), formatNumber(row.posts)]} />
        <CompareTable title="Форматы и ER" kind="content" columns={['ER ср.', 'ER макс.', 'Фото', 'Видео']}
          cells={(row) => [`${String(row.er).replace('.', ',')}%`, `${String(row.erMax).replace('.', ',')}%`, formatNumber(row.photos), formatNumber(row.videos)]} />
      </div>
    </div>}
  />;
}

export function PostsShowcase() {
  return <Showcase
    feature="posts_page"
    icon={<FileText size={22} />}
    title="Разбор публикаций"
    description="Соберите до 10 групп и каналов своей ниши и отсортируйте их публикации по вовлечённости — готовые идеи для контент-плана."
    items={['Публикации ВКонтакте, Telegram и YouTube в одной ленте, с просмотрами и ER', 'Сортировка по просмотрам, реакциям, репостам и комментариям', 'Фильтры по формату: фото, видео, GIF, реклама, без вложений']}
    example={<PostsExample />}
  />;
}
