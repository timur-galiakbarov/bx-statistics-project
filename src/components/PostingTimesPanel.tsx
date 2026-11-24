import { Fragment } from 'react';
import { buildPostingHeatmap, POSTING_BUCKETS, type PostingPost } from '../utils/postingTimes';

type PostingTimesPanelProps = {
  posts: PostingPost[];
  periodLabel: string;
};

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MIN_POSTS = 3;

function bucketLabel(bucket: number) {
  return `${bucket * 2}–${bucket * 2 + 2}`;
}

function plural(value: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(value) % 10;
  const mod100 = Math.abs(value) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function percent(value: number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value < 1 ? 2 : 1 }).format(value)}%`;
}

/**
 * Теплокарта «когда публиковать»: медианный ER по дню недели и двухчасовому окну.
 * Показывается только когда постов хватает для вывода — иначе это гадание по одному посту.
 */
export function PostingTimesPanel({ posts, periodLabel }: PostingTimesPanelProps) {
  const heatmap = buildPostingHeatmap(posts);
  if (!heatmap.hasData) return null;

  const max = heatmap.maxMedianEr ?? 0;
  const gridLabel = `Лучшее время публикации: ${heatmap.totalPosts} постов за период, лучшие окна — ${heatmap.best
    .map((cell) => `${WEEKDAYS[cell.weekday]} ${bucketLabel(cell.bucket)}`)
    .join(', ')}`;

  return (
    <div className="panel span-2 analytics-section posting-times">
      <div className="section-title">
        <div>
          <h2>Лучшее время публикации</h2>
          <p>Медианный ER по дню недели и времени · {periodLabel} · МСК</p>
        </div>
        <div className="posting-times-legend">
          <span><i className="low" />ниже</span>
          <span><i className="high" />выше</span>
        </div>
      </div>
      <div aria-label={gridLabel} className="posting-times-grid" role="img">
        <div className="posting-times-corner" />
        {Array.from({ length: POSTING_BUCKETS }, (_, bucket) => (
          <div className="posting-times-hour" key={bucket}>{bucket % 2 === 0 ? bucketLabel(bucket) : ''}</div>
        ))}
        {heatmap.cells.map((row, weekday) => (
          <Fragment key={weekday}>
            <div className="posting-times-day">{WEEKDAYS[weekday]}</div>
            {row.map((cell) => {
              const enough = cell.posts >= MIN_POSTS && cell.medianEr !== null;
              const share = enough && max > 0 ? Math.min(1, (cell.medianEr as number) / max) : 0;
              const background = cell.posts === 0
                ? '#f4f6f5'
                : enough
                  ? `rgba(76, 175, 80, ${(0.18 + share * 0.82).toFixed(2)})`
                  : '#e9ecea';
              const title = cell.posts === 0
                ? `${WEEKDAYS[weekday]}, ${bucketLabel(cell.bucket)}: постов нет`
                : `${WEEKDAYS[weekday]}, ${bucketLabel(cell.bucket)}: ${cell.posts} ${plural(cell.posts, 'пост', 'поста', 'постов')}${cell.medianEr === null ? '' : `, медианный ER ${percent(cell.medianEr)}`}${enough ? '' : ' — мало данных'}`;
              return <div className="posting-times-cell" key={cell.bucket} style={{ background }} title={title} />;
            })}
          </Fragment>
        ))}
      </div>
      <p className="posting-times-best">
        Лучшие окна: {heatmap.best.map((cell) => `${WEEKDAYS[cell.weekday]} ${bucketLabel(cell.bucket)}`).join(', ')}
        {heatmap.best[0]?.medianEr != null ? ` — медианный ER до ${percent(heatmap.best[0].medianEr)}` : ''}.
      </p>
      <p className="visibility-chart-note">Серые ячейки — меньше {MIN_POSTS} постов: вывод по ним предварительный. Время московское, рекламные посты не учитываются.</p>
    </div>
  );
}
