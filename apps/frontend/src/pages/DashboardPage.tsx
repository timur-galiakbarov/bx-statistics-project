import { BarChart3, ExternalLink, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../api/client';
import type { DashboardPeriod, DashboardSummary, SavedGroup, VkGroup, VkListResponse } from '../api/types';

type Props = {
  groups: SavedGroup[];
  onGroupsChanged: () => Promise<void>;
};

export function DashboardPage({ groups, onGroupsChanged }: Props) {
  const managedGroups = groups.filter((group) => group.source === 'managed');
  const freeGroups = groups.filter((group) => group.source === 'free');
  const [subscriptions, setSubscriptions] = useState<VkGroup[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VkGroup[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [message, setMessage] = useState('');
  const [subscriptionsStatus, setSubscriptionsStatus] = useState<'idle' | 'loading'>('idle');
  const [subscriptionsMessage, setSubscriptionsMessage] = useState('');
  const [period, setPeriod] = useState<DashboardPeriod>('last7days');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'loading'>('idle');
  const [summaryMessage, setSummaryMessage] = useState('');

  const loadSummary = async (nextPeriod = period) => {
    setSummaryStatus('loading');
    setSummaryMessage('');

    try {
      const data = await apiGet<DashboardSummary>(`/api/dashboard/summary?period=${nextPeriod}`);
      setSummary(data);
    } catch (error) {
      setSummary(null);
      setSummaryMessage(error instanceof Error ? error.message : 'Не удалось загрузить статистику.');
    } finally {
      setSummaryStatus('idle');
    }
  };

  const loadSubscriptions = async () => {
    setSubscriptionsStatus('loading');
    setSubscriptionsMessage('');

    try {
      const data = await apiGet<VkListResponse<VkGroup>>('/api/vk/groups/subscriptions');
      setSubscriptions(data.items ?? []);
      setSubscriptionsMessage(data.items?.length ? '' : 'Подписок на группы не найдено.');
    } catch (error) {
      setSubscriptions([]);
      setSubscriptionsMessage(error instanceof Error ? error.message : 'Не удалось загрузить подписки.');
    } finally {
      setSubscriptionsStatus('idle');
    }
  };

  useEffect(() => {
    loadSummary();
    loadSubscriptions();
  }, [groups.length]);

  const setSummaryPeriod = (nextPeriod: DashboardPeriod) => {
    setPeriod(nextPeriod);
    loadSummary(nextPeriod);
  };

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
            <p>
              {summary
                ? `${summary.period.dateFrom} - ${summary.period.dateTo}`
                : 'Сводка по сохранённым группам'}
            </p>
          </div>
          <button className="icon-button" aria-label="Обновить" onClick={() => loadSummary()}>
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="period-tabs">
          <button className={period === 'last7days' ? 'active' : ''} onClick={() => setSummaryPeriod('last7days')}>
            7 дней
          </button>
          <button className={period === 'today' ? 'active' : ''} onClick={() => setSummaryPeriod('today')}>
            Сегодня
          </button>
          <button className={period === 'yesterday' ? 'active' : ''} onClick={() => setSummaryPeriod('yesterday')}>
            Вчера
          </button>
          <button className={period === 'currentMonth' ? 'active' : ''} onClick={() => setSummaryPeriod('currentMonth')}>
            Месяц
          </button>
        </div>

        {summaryMessage && <div className="form-message">{summaryMessage}</div>}

        <div className="table">
          <div className="table-row dashboard-row table-head">
            <span>Группа</span>
            <span>Участников</span>
            <span>Прирост</span>
            <span>Посещения</span>
            <span>Охват</span>
            <span>Активность</span>
            <span />
          </div>
          {summaryStatus === 'loading' && <div className="empty-state table-empty">Загружаем статистику...</div>}
          {summary?.groups.length === 0 && <div className="empty-state table-empty">Сохранённые группы пока не добавлены.</div>}
          {summary?.groups.map((item) => (
            <div className="table-row dashboard-row" key={item.savedGroupId}>
              <div className="summary-group">
                {item.group.photo && <img src={item.group.photo} alt="" />}
                <strong>{item.group.name}</strong>
                {item.error && <span>{item.error.message}</span>}
                {!item.error && item.warnings.map((warning) => <span key={warning}>{warning}</span>)}
              </div>
              <span>{item.membersCount.toLocaleString('ru-RU')}</span>
              <span>
                {item.growth.total.toLocaleString('ru-RU')}
                <small>+{item.growth.subscribed} / -{item.growth.unsubscribed}</small>
              </span>
              <span>
                {item.traffic.visitors.toLocaleString('ru-RU')}
                <small>{item.traffic.views.toLocaleString('ru-RU')} просмотров</small>
              </span>
              <span>
                {item.reach.subscribers.toLocaleString('ru-RU')}
                <small>{item.reach.total.toLocaleString('ru-RU')} всего</small>
              </span>
              <span>
                {item.activity.likes.toLocaleString('ru-RU')}
                <small>
                  {item.activity.reposts} / {item.activity.comments}
                </small>
              </span>
              <div className="group-actions">
                <Link
                  className="icon-button has-tooltip"
                  to={`/analytics?groupId=${item.group.id}`}
                  aria-label="Открыть аналитику"
                  data-tooltip="Открыть аналитику группы"
                >
                  <BarChart3 size={17} />
                </Link>
                <a
                  className="icon-button has-tooltip"
                  href={`https://vk.com/${item.group.screenName ?? `club${item.group.id}`}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Открыть VK"
                  data-tooltip="Открыть страницу VK"
                >
                  <ExternalLink size={17} />
                </a>
              </div>
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
                <Link
                  className="icon-button has-tooltip"
                  to={`/analytics?groupId=${group.vkGroupId}`}
                  aria-label="Открыть аналитику"
                  data-tooltip="Открыть аналитику группы"
                >
                  <BarChart3 size={17} />
                </Link>
                <a
                  className="icon-button has-tooltip"
                  href={`https://vk.com/${group.vkGroupId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Открыть VK"
                  data-tooltip="Открыть страницу VK"
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
        <div className="panel-header compact">
          <h2>Мои подписки VK</h2>
          <button className="icon-button" aria-label="Обновить подписки" onClick={loadSubscriptions}>
            <RefreshCw size={18} />
          </button>
        </div>
        {subscriptionsMessage && <div className="form-message">{subscriptionsMessage}</div>}
        {subscriptionsStatus === 'loading' && <div className="empty-state">Загружаем подписки...</div>}
        {subscriptionsStatus !== 'loading' && subscriptions.length > 0 && (
          <div className="subscription-list">
            {subscriptions.map((group) => (
              <div className="group-line" key={group.id}>
                <div className="summary-group">
                  {(group.photo_100 ?? group.photo_50 ?? group.photo_200) && (
                    <img src={group.photo_100 ?? group.photo_50 ?? group.photo_200} alt="" />
                  )}
                  <div>
                    <strong>{group.name}</strong>
                    <span>{group.members_count?.toLocaleString('ru-RU') ?? '-'} участников</span>
                  </div>
                </div>
                <div className="group-actions">
                  <Link
                    className="icon-button has-tooltip"
                    to={`/analytics?groupId=${group.id}`}
                    aria-label="Открыть аналитику"
                    data-tooltip="Открыть аналитику группы"
                  >
                    <BarChart3 size={17} />
                  </Link>
                  <a
                    className="icon-button has-tooltip"
                    href={`https://vk.com/${group.screen_name ?? `club${group.id}`}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Открыть VK"
                    data-tooltip="Открыть страницу VK"
                  >
                    <ExternalLink size={17} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
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
