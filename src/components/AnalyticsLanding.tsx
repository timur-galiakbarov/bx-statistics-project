import { BarChart3, Clock3, Search, Users } from 'lucide-react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Segment, SegmentedControl } from '@alfalab/core-components-segmented-control';
import { PlatformSegmentTitle } from './PlatformSegmentTitle';
import { formatDate } from '../utils/date';

export type AnalyticsPlatform = 'vk' | 'youtube' | 'telegram';
export type AnalyticsChannel = {
  id: string | number;
  name: string;
  platform: AnalyticsPlatform;
  screen_name?: string;
  photo_50?: string;
  photo_100?: string;
  members_count?: number | null;
  url?: string;
};

export const analyticsExamples: Array<{ platform: AnalyticsPlatform; query: string; label: string }> = [
  { platform: 'vk', query: 'pikabu', label: 'Пикабу' },
  { platform: 'telegram', query: 'rbc_news', label: 'РБК' },
  { platform: 'youtube', query: 'UC101o-vQ2iOj9vr00JUlyKw', label: 'Варламов' }
];

const platformLogos: Record<AnalyticsPlatform, string> = {
  vk: '/vk-network-logo.png',
  youtube: '/youtube-logo.png',
  telegram: '/telegram-logo.svg'
};

const platformNames: Record<AnalyticsPlatform, string> = { vk: 'VK', youtube: 'YouTube', telegram: 'Telegram' };

const searchPlaceholders: Record<AnalyticsPlatform, string> = {
  vk: 'Ссылка VK, t.me или YouTube',
  youtube: 'Ссылка, @handle или название YouTube-канала',
  telegram: 'Ссылка t.me или @username канала'
};

function formatMembers(value?: number | null) {
  if (value === null) return 'Подписчики: недоступно';
  return value ? `${new Intl.NumberFormat('ru-RU').format(value)} подписчиков` : '';
}

function getDaysLeft(activeTo?: string) {
  if (!activeTo) return 0;
  const end = new Date(`${activeTo}T23:59:59`).getTime();
  return Number.isNaN(end) ? 0 : Math.max(Math.ceil((end - Date.now()) / 86_400_000), 0);
}

function pluralizeDays(days: number) {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

export function AnalyticsLanding({
  query,
  searchPlatform,
  isSearching,
  searchResults,
  message,
  recentGroups,
  savedGroups,
  hasPaidAccess,
  isTrialActive,
  activeTo,
  onQueryChange,
  onPlatformChange,
  onSearch,
  onExample,
  onPick
}: {
  query: string;
  searchPlatform: AnalyticsPlatform;
  isSearching: boolean;
  searchResults: AnalyticsChannel[];
  message: string | null;
  recentGroups: AnalyticsChannel[];
  savedGroups: AnalyticsChannel[];
  hasPaidAccess: boolean;
  isTrialActive: boolean;
  activeTo?: string;
  onQueryChange: (value: string) => void;
  onPlatformChange: (platform: AnalyticsPlatform) => void;
  onSearch: (event: FormEvent) => void;
  onExample: (example: (typeof analyticsExamples)[number]) => void;
  onPick: (group: AnalyticsChannel) => void;
}) {
  const quickGroups = [...recentGroups, ...savedGroups]
    .filter((group, index, list) => list.findIndex((item) => `${item.platform}:${item.id}` === `${group.platform}:${group.id}`) === index)
    .slice(0, 6);
  const daysLeft = getDaysLeft(activeTo);

  return (
    <div className="span-2 analytics-landing">
      <section className="panel analytics-landing-hero">
        <h2>Аналитика канала</h2>
        <p className="analytics-landing-lead">Вставьте ссылку на группу VK, Telegram- или YouTube-канал — свой или конкурента. Права администратора не нужны.</p>
        <form className="analytics-landing-search" onSubmit={onSearch}>
          <Search aria-hidden="true" size={20} />
          <input aria-label="Ссылка или название канала" autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={searchPlaceholders[searchPlatform]} />
          <button disabled={isSearching} type="submit"><BarChart3 size={18} />{isSearching ? 'Ищем…' : 'Получить отчёт'}</button>
        </form>
        <div className="analytics-landing-platforms">
          <span>Поиск по названию:</span>
          <SegmentedControl className="social-platform-switcher" onChange={(id) => onPlatformChange(id as AnalyticsPlatform)} selectedId={searchPlatform} size={32}>
            <Segment id="vk" title={<PlatformSegmentTitle platform="vk" />} />
            <Segment id="youtube" title={<PlatformSegmentTitle platform="youtube" />} />
            <Segment id="telegram" title={<PlatformSegmentTitle platform="telegram" />} />
          </SegmentedControl>
        </div>
        {message && <div className="form-message">{message}</div>}
        {searchResults.length > 0 && (
          <div className="analytics-landing-results">
            {searchResults.map((group) => (
              <button className="analytics-result" key={`${group.platform}:${group.id}`} type="button" onClick={() => onPick(group)}>
                {group.photo_100 ?? group.photo_50 ? <img src={group.photo_100 ?? group.photo_50} alt="" /> : <span className="community-avatar-placeholder" />}
                <span><strong>{group.name}</strong><small>{[group.screen_name ?? group.id, formatMembers(group.members_count)].filter(Boolean).join(' · ')}</small></span>
              </button>
            ))}
          </div>
        )}
        <div className="analytics-landing-row">
          {quickGroups.length > 0 ? <>
            <span className="analytics-landing-row-title"><Clock3 size={16} />Недавние и отслеживаемые</span>
            {quickGroups.map((group) => (
              <button className="analytics-landing-chip" key={`${group.platform}:${group.id}`} type="button" onClick={() => onPick(group)}>
                {group.photo_100 ?? group.photo_50 ? <img alt="" className="analytics-landing-chip-avatar" src={group.photo_100 ?? group.photo_50} /> : <Users size={16} />}
                <span>{group.name}</span>
                <small>{platformNames[group.platform]}</small>
              </button>
            ))}
          </> : <>
            <span className="analytics-landing-row-title">Попробуйте на примере:</span>
            {analyticsExamples.map((example) => (
              <button className="analytics-landing-chip" disabled={isSearching} key={example.query} type="button" onClick={() => onExample(example)}>
                <img alt="" src={platformLogos[example.platform]} />{example.label}
              </button>
            ))}
          </>}
        </div>
      </section>

      {(isTrialActive || !hasPaidAccess) && (
        <section className={`panel analytics-landing-access ${hasPaidAccess ? '' : 'expired'}`}>
          <Clock3 size={20} />
          <div>
            <strong>{hasPaidAccess ? `Пробный доступ: ${daysLeft ? `осталось ${daysLeft} ${pluralizeDays(daysLeft)}` : 'последний день'}` : 'Доступ к аналитике закончился'}</strong>
            <span>{hasPaidAccess && activeTo ? `До ${formatDate(activeTo)}. ` : ''}Дальше — от 167 ₽ в месяц, без автосписаний.</span>
          </div>
          <Link className="analytics-landing-access-button" to="/account">Выбрать тариф</Link>
        </section>
      )}
    </div>
  );
}
