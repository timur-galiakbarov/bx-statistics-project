import { ExternalLink, RefreshCw } from 'lucide-react';
import type { SavedGroup } from '../api/types';

type Props = {
  groups: SavedGroup[];
};

export function DashboardPage({ groups }: Props) {
  const managedGroups = groups.filter((group) => group.source === 'managed');
  const freeGroups = groups.filter((group) => group.source === 'free');

  return (
    <div className="page-grid">
      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <h2>Статистика моих сообществ</h2>
            <p>Базовая витрина для переноса старого dashboardController</p>
          </div>
          <button className="icon-button" aria-label="Обновить">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="table">
          <div className="table-row table-head">
            <span>Группа</span>
            <span>Участников</span>
            <span>Источник</span>
            <span />
          </div>
          {managedGroups.map((group) => (
            <div className="table-row" key={group.id}>
              <strong>{group.name}</strong>
              <span>{group.membersCount?.toLocaleString('ru-RU') ?? '-'}</span>
              <span>Управляемая</span>
              <a href={`https://vk.com/${group.vkGroupId}`} target="_blank" rel="noreferrer" aria-label="Открыть VK">
                <ExternalLink size={17} />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Бесплатные группы</h2>
        <div className="stack">
          {freeGroups.map((group) => (
            <div className="group-line" key={group.id}>
              <strong>{group.name}</strong>
              <span>{group.membersCount?.toLocaleString('ru-RU') ?? '-'} участников</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
