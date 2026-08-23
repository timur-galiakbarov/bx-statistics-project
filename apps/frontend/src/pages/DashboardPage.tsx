import { ExternalLink, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { apiDelete, apiGet, apiPost } from '../api/client';
import type { SavedGroup, VkGroup, VkListResponse } from '../api/types';

type Props = {
  groups: SavedGroup[];
  onGroupsChanged: () => Promise<void>;
};

export function DashboardPage({ groups, onGroupsChanged }: Props) {
  const managedGroups = groups.filter((group) => group.source === 'managed');
  const freeGroups = groups.filter((group) => group.source === 'free');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VkGroup[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [message, setMessage] = useState('');

  const searchGroups = async (event: FormEvent) => {
    event.preventDefault();

    if (!query.trim()) {
      setMessage('Введите название группы.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const data = await apiGet<VkListResponse<VkGroup>>(
        `/api/vk/groups/search?q=${encodeURIComponent(query.trim())}`
      );
      setResults(data.items ?? []);
      setMessage(data.items?.length ? '' : 'Ничего не найдено.');
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : 'Не удалось найти группы.');
    } finally {
      setStatus('idle');
    }
  };

  const addFreeGroup = async (group: VkGroup) => {
    setStatus('saving');
    setMessage('');

    try {
      await apiPost('/api/account/groups/free', {
        group: {
          id: group.id,
          screen_name: group.screen_name,
          name: group.name,
          photo: group.photo_100 ?? group.photo_50 ?? group.photo_200,
          members_count: group.members_count
        }
      });
      await onGroupsChanged();
      setMessage(`Группа "${group.name}" добавлена.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось добавить группу.');
    } finally {
      setStatus('idle');
    }
  };

  const removeSavedGroup = async (group: SavedGroup) => {
    setStatus('saving');
    setMessage('');

    try {
      await apiDelete(`/api/account/groups/${group.id}`);
      await onGroupsChanged();
      setMessage(`Группа "${group.name}" удалена.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось удалить группу.');
    } finally {
      setStatus('idle');
    }
  };

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
        <div className="panel-header compact">
          <h2>Бесплатные группы</h2>
          <span className="limit-badge">{freeGroups.length} из 3</span>
        </div>
        <div className="stack">
          {freeGroups.length === 0 && <div className="empty-state">Бесплатные группы пока не добавлены.</div>}
          {freeGroups.map((group) => (
            <div className="group-line" key={group.id}>
              <div>
                <strong>{group.name}</strong>
                <span>{group.membersCount?.toLocaleString('ru-RU') ?? '-'} участников</span>
              </div>
              <div className="group-actions">
                <a
                  className="icon-button"
                  href={`https://vk.com/${group.vkGroupId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Открыть VK"
                >
                  <ExternalLink size={17} />
                </a>
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label="Удалить группу"
                  disabled={status === 'saving'}
                  onClick={() => removeSavedGroup(group)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Поиск группы</h2>
        <p>Найдите группу ВКонтакте и добавьте её в список бесплатных.</p>
        <form className="search-form" onSubmit={searchGroups}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название или короткое имя группы"
          />
          <button type="submit" disabled={status === 'loading'}>
            <Search size={17} />
            Найти
          </button>
        </form>
        {message && <div className="form-message">{message}</div>}
        <div className="search-results">
          {results.map((group) => (
            <div className="search-result" key={group.id}>
              <img src={group.photo_100 ?? group.photo_50 ?? group.photo_200} alt="" />
              <div>
                <strong>{group.name}</strong>
                <span>{group.screen_name ? `vk.com/${group.screen_name}` : `club${group.id}`}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Добавить группу"
                disabled={status === 'saving'}
                onClick={() => addFreeGroup(group)}
              >
                <Plus size={17} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
