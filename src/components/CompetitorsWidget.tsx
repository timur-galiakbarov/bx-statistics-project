import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LockKeyhole, Plus, Search } from 'lucide-react';
import { apiGet } from '../api/client';
import type { SavedGroup, SocialPlatform } from '../api/types';
import { trackCompetitorsWidget } from '../utils/visit';
import { competitorKey } from './competitorMetrics';

type Place = { place: number; total: number } | null;
type CompetitorSetSummary = { platform: SocialPlatform; externalId: string; sourceName: string; competitorsCount: number; summary: { views: Place; er: Place; growth: Place } | null };
type Row = { key: string; platform: SocialPlatform; id: string; name: string; photo?: string; set?: CompetitorSetSummary };
type Props = { groups: SavedGroup[]; locked: boolean };

const VISIBLE_ROWS = 4;
const platformLogos: Record<SocialPlatform, string> = { vk: '/vk-network-logo.png', youtube: '/youtube-logo.png', telegram: '/telegram-logo.svg' };
const places: Array<['views' | 'er' | 'growth', string]> = [['views', 'Просмотры'], ['er', 'ER'], ['growth', 'Рост']];
const plural = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'конкурент' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'конкурента' : 'конкурентов';

function Places({ summary }: { summary: NonNullable<CompetitorSetSummary['summary']> }) {
  return <span className="competitors-widget-places">{places.map(([key, label]) => {
    const value = summary[key];
    return value && <span key={key} className={value.place === 1 ? 'is-best' : ''}>{label} <b>{value.place} из {value.total}</b></span>;
  })}</span>;
}

export const competitorsLink = (platform: SocialPlatform, id: string) => platform === 'telegram'
  ? `/analytics?platform=telegram&channel=${encodeURIComponent(id)}&section=competitors`
  : `/analytics?groupId=${encodeURIComponent(id)}&platform=${platform}&section=competitors`;

// Пример для пользователей без тарифа: показывает, что даёт сравнение, и ведёт к оплате.
const exampleRows: Array<{ name: string; platform: SocialPlatform; count: number; summary: NonNullable<CompetitorSetSummary['summary']> }> = [
  { name: 'Ваше сообщество', platform: 'vk', count: 4, summary: { views: { place: 2, total: 5 }, er: { place: 1, total: 4 }, growth: { place: 3, total: 5 } } },
  { name: 'Ваш канал', platform: 'telegram', count: 3, summary: { views: { place: 1, total: 4 }, er: { place: 2, total: 3 }, growth: null } }
];

export function CompetitorsWidget({ groups, locked }: Props) {
  return locked ? <CompetitorsTeaser /> : <CompetitorsList groups={groups} />;
}

function CompetitorsTeaser() {
  return <section className="panel span-2 competitors-widget" aria-labelledby="competitors-widget-title">
    <div className="competitors-widget-head">
      <h2 id="competitors-widget-title">Конкуренты <span className="competitors-widget-lock"><LockKeyhole size={12} aria-hidden="true" />На тарифе</span></h2>
      <p>Сравнивайте свои сообщества с конкурентами во ВКонтакте, Telegram и YouTube: место по просмотрам, ER и росту и лучшие публикации конкурентов.</p>
    </div>
    <ul className="competitors-widget-list" aria-label="Пример">{exampleRows.map((row) => <li key={row.name}>
      <div className="competitors-widget-example">
        <span className="competitors-widget-avatar"><span aria-hidden="true">{row.name.slice(0, 1)}</span><img className="competitors-widget-platform" src={platformLogos[row.platform]} alt="" /></span>
        <span className="competitors-widget-body"><strong>{row.name}</strong><small>{row.count} {plural(row.count)} · пример</small><Places summary={row.summary} /></span>
      </div>
    </li>)}</ul>
    <Link className="primary-button competitors-widget-cta" to="/account" onClick={() => trackCompetitorsWidget('teaser')}>Подключить тариф</Link>
  </section>;
}

// Наборы конкурентов по каждому сообществу плюс отслеживаемые источники, для которых конкуренты ещё не выбраны.
function CompetitorsList({ groups }: Pick<Props, 'groups'>) {
  const [sets, setSets] = useState<CompetitorSetSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<{ sets: CompetitorSetSummary[] }>('/api/competitors').then((data) => { if (active) setSets(data.sets); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed) return null;
  const tracked: Row[] = groups.filter((group) => group.isTracked).map((group) => {
    const id = group.platform === 'telegram' ? group.handle ?? group.externalId : group.externalId;
    return { key: competitorKey(group.platform, id), platform: group.platform, id, name: group.name, photo: group.photo };
  });
  const photos = new Map(tracked.map((row) => [row.key, row.photo]));
  const withSets: Row[] = (sets ?? []).map((set) => {
    const key = competitorKey(set.platform, set.externalId);
    return { key, platform: set.platform, id: set.externalId, name: set.sourceName, photo: photos.get(key), set };
  });
  const rows = [...withSets, ...tracked.filter((row) => !withSets.some((entry) => entry.key === row.key))];
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);

  return <section className="panel span-2 competitors-widget" aria-labelledby="competitors-widget-title">
    <div className="competitors-widget-head">
      <h2 id="competitors-widget-title">Конкуренты</h2>
      <p>Ваше место среди конкурентов за 30 дней. Нажмите на сообщество, чтобы открыть сравнение или выбрать конкурентов.</p>
    </div>
    {!sets ? <p className="competitors-widget-note" role="status">Загружаем…</p> : rows.length === 0
      ? <p className="competitors-widget-note">Откройте аналитику любого сообщества или канала и перейдите на вкладку «Конкуренты», чтобы сравнить его с похожими.</p>
      : <ul className="competitors-widget-list">{visibleRows.map((row) => <li key={row.key}>
        <Link to={competitorsLink(row.platform, row.id)} onClick={() => trackCompetitorsWidget(row.set ? 'open' : 'add')} aria-label={`${row.name}: ${row.set ? 'открыть сравнение с конкурентами' : 'выбрать конкурентов'}`}>
          <span className="competitors-widget-avatar">{row.photo ? <img src={row.photo} alt="" /> : <span aria-hidden="true">{row.name.replace(/^@/, '').slice(0, 1).toUpperCase()}</span>}<img className="competitors-widget-platform" src={platformLogos[row.platform]} alt="" /></span>
          <span className="competitors-widget-body">
            <strong>{row.name}</strong>
            {row.set
              ? <>
                <small>{row.set.competitorsCount} {plural(row.set.competitorsCount)}</small>
                {row.set.summary ? <Places summary={row.set.summary} />
                  : <small className="competitors-widget-pending">Откройте сравнение, чтобы посчитать места</small>}
              </>
              : <small>Конкуренты не выбраны</small>}
          </span>
          {row.set ? <ChevronRight className="competitors-widget-chevron" size={18} aria-hidden="true" /> : <span className="competitors-widget-add"><Plus size={14} aria-hidden="true" />Добавить</span>}
        </Link>
      </li>)}</ul>}
    {sets && rows.length > VISIBLE_ROWS && <button type="button" className="competitors-widget-more" onClick={() => { if (!expanded) trackCompetitorsWidget('expand'); setExpanded((value) => !value); }}>{expanded ? 'Свернуть' : `Показать все (${rows.length})`}</button>}
    <Link className="competitors-widget-other" to="/analytics" onClick={() => trackCompetitorsWidget('other')}><Search size={15} aria-hidden="true" />Сравнить другое сообщество</Link>
  </section>;
}
