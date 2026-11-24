import { buildFormatRanking, type RankingPost } from '../utils/formatRanking';

type FormatRankingPanelProps = {
  posts: RankingPost[];
  periodLabel: string;
};

function number(value: number, digits = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
}

function er(value: number) {
  return `${number(value, Math.abs(value) < 1 ? 3 : 2)}%`;
}

function delta(value: number | null) {
  if (value === null) return '—';
  if (Math.abs(value) < 1) return '0%';
  return `${value > 0 ? '+' : '−'}${number(Math.abs(value), 0)}%`;
}

/**
 * Рейтинг форматов по медианам: один вирусный пост не делает формат лучшим.
 * Реклама исключена, форматы с малым числом постов помечены и не участвуют в выводе.
 */
export function FormatRankingPanel({ posts, periodLabel }: FormatRankingPanelProps) {
  const ranking = buildFormatRanking(posts);
  if (!ranking.hasData) return null;

  return (
    <div className="panel span-2 analytics-section format-ranking">
      <div className="section-title">
        <div>
          <h2>Форматы контента</h2>
          <p>Медианы за период · реклама исключена · {periodLabel}</p>
        </div>
        <span className="format-ranking-total">{number(ranking.totalPosts)} публикаций</span>
      </div>
      <div className="format-ranking-table">
        <div className="format-ranking-head">
          <span>Формат</span><span>Постов</span><span>Медиана просмотров</span><span>Мед. ER</span><span>Δ к медиане</span>
        </div>
        {ranking.rows.map((row) => (
          <div className={`format-ranking-row${row.best ? ' best' : ''}${row.lowSample ? ' low' : ''}`} key={row.format}>
            <span className="format-ranking-format">
              {row.format}
              {row.lowSample && <small>мало данных</small>}
            </span>
            <span className="format-ranking-posts">{number(row.posts)}<small>{number(row.share * 100, 0)}%</small></span>
            <span className="format-ranking-views">{row.medianViews === null ? '—' : number(row.medianViews)}</span>
            <span className="format-ranking-er">{row.medianEr === null ? '—' : er(row.medianEr)}</span>
            <span className={`format-ranking-delta${row.deltaViews !== null && row.deltaViews > 0 ? ' up' : row.deltaViews !== null && row.deltaViews < 0 ? ' down' : ''}`}>{delta(row.deltaViews)}</span>
          </div>
        ))}
      </div>
      <p className="visibility-chart-note">Медиана, а не среднее: один вирусный пост не делает формат лучшим. Форматы с меньше чем пятью постами помечены и в выводе не участвуют.</p>
    </div>
  );
}
