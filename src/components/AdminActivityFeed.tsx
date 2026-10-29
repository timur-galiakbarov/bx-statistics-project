import { ChevronDown, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { AdminActivityFeedItem } from '../api/types';
import { actionLabels, platformLabels } from './AdminActivityStats';

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
  // Без timeZone: в часовом поясе браузера, как и время в списках пользователей.
});
const amountFormatter = new Intl.NumberFormat('ru-RU');

type FeedGroup = { first: AdminActivityFeedItem; items: AdminActivityFeedItem[] };

// Подряд идущие одинаковые действия одного человека — одна строка, иначе активный пользователь забивает ленту.
function groupFeed(feed: AdminActivityFeedItem[]) {
  const groups: FeedGroup[] = [];
  for (const item of feed) {
    const last = groups.at(-1);
    const canMerge = last && last.first.userId === item.userId && last.first.type === item.type
      && item.type !== 'payment' && item.type !== 'registration';
    if (canMerge) last.items.push(item);
    else groups.push({ first: item, items: [item] });
  }
  return groups;
}

function details(group: FeedGroup) {
  const { first, items } = group;
  const labels = [...new Set(items.map((item) => item.label).filter(Boolean))];
  return [
    first.platform ? platformLabels[first.platform] ?? first.platform : null,
    labels.length > 3 ? `${labels.slice(0, 3).join(', ')}…` : labels.join(', '),
    first.amount ? `${amountFormatter.format(first.amount)} ₽` : null
  ].filter(Boolean).join(' · ');
}

export function AdminActivityFeed() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [feed, setFeed] = useState<AdminActivityFeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    apiGet<AdminActivityFeedItem[]>(`/api/account/admin/activity/feed${user ? `?userId=${user.id}` : ''}`)
      .then((items) => { if (isCurrent) setFeed(items); })
      .catch((reason) => { if (isCurrent) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить ленту событий.'); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [user, reloadKey]);

  const groups = feed ? groupFeed(feed) : [];

  return (
    <div className="panel activity-panel span-2">
      <button aria-controls="admin-activity-feed" aria-expanded={isOpen} className="panel-header compact admin-accordion-toggle" type="button" onClick={() => setIsOpen((open) => !open)}>
        <h2>Лента событий</h2>
        <ChevronDown aria-hidden="true" size={20} />
      </button>
      {isOpen && <div id="admin-activity-feed">
      <div className="panel-header compact">
        <div>
          {user ? (
            <p className="activity-feed-filter">
              <strong>{user.name}</strong>
              <button className="activity-feed-reset" type="button" onClick={() => setUser(null)}>
                <X size={14} /> все события
              </button>
            </p>
          ) : <p className="activity-note">Последние действия, регистрации и оплаты. Нажмите на имя, чтобы увидеть действия человека</p>}
        </div>
        <button className="secondary-button inline" type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={isLoading}>
          <RefreshCw className={isLoading ? 'spin' : undefined} size={18} />
          Обновить
        </button>
      </div>
      {error && <div className="debug-error">{error}</div>}
      {!error && feed && groups.length === 0 && <div className="empty-state">Событий пока нет.</div>}
      {!error && groups.length > 0 && (
        <ul className={`activity-feed${user ? ' single-user' : ''}`}>
          {groups.map((group) => (
            <li key={group.first.id}>
              <time title={group.items.length > 1 ? `с ${timeFormatter.format(new Date(group.items.at(-1)!.at))}` : undefined}>
                {timeFormatter.format(new Date(group.first.at))}
              </time>
              {!user && (
                <button className="activity-feed-user" type="button" onClick={() => setUser({ id: group.first.userId, name: group.first.userName })}>
                  {group.first.userName}
                </button>
              )}
              <span className={`activity-feed-type ${group.first.type}`}>
                {actionLabels[group.first.type] ?? group.first.type}
                {group.items.length > 1 && <b> ×{group.items.length}</b>}
              </span>
              <small>{details(group)}</small>
            </li>
          ))}
        </ul>
      )}
      </div>}
    </div>
  );
}
