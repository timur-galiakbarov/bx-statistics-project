import { Bug, RefreshCw, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import type { VkChannelDebug } from '../api/types';

type DebugGroup = {
  id?: number;
  name?: string;
  screen_name?: string;
  has_group_channel?: number | boolean;
  members_count?: number;
  is_admin?: number | boolean;
  is_member?: number | boolean;
  is_subscribed?: number | boolean;
  can_subscribe_posts?: number | boolean;
  type?: string;
};

function normalizeGroupInfo(value: unknown): DebugGroup | null {
  if (Array.isArray(value)) {
    return (value[0] as DebugGroup | undefined) ?? null;
  }

  return (value as DebugGroup | null) ?? null;
}

function formatFlag(value: unknown) {
  if (value === undefined || value === null) {
    return 'нет поля';
  }

  return value === true || value === 1 ? 'да' : 'нет';
}

function getPostDate(timestamp?: number) {
  if (!timestamp) {
    return 'без даты';
  }

  return new Date(timestamp * 1000).toLocaleString('ru-RU');
}

export function ChannelsPage() {
  const [groupId, setGroupId] = useState('');
  const [debug, setDebug] = useState<VkChannelDebug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const group = useMemo(() => normalizeGroupInfo(debug?.groupInfo), [debug]);
  const wallItems = debug?.wall?.items ?? [];
  const wallSummary = useMemo(
    () =>
      wallItems.reduce(
        (acc, post) => ({
          likes: acc.likes + (post.likes?.count ?? 0),
          reposts: acc.reposts + (post.reposts?.count ?? 0),
          comments: acc.comments + (post.comments?.count ?? 0),
          views: acc.views + (post.views?.count ?? 0)
        }),
        { likes: 0, reposts: 0, comments: 0, views: 0 }
      ),
    [wallItems]
  );

  const loadChannelDebug = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedGroupId = groupId.trim().replace(/^https?:\/\/vk\.com\//, '').replace(/^vk\.com\//, '');
    if (!normalizedGroupId) {
      setError('Укажи ID, short name или ссылку на сообщество.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebug(null);

    try {
      const data = await apiGet<VkChannelDebug>(
        `/api/vk/groups/${encodeURIComponent(normalizedGroupId)}/channel-debug?count=20`
      );
      setDebug(data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Не удалось получить данные по каналу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page-grid">
      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Каналы VK</h2>
            <p>Минимальная проверка полей канала и доступных методов VK API для сообщества.</p>
          </div>
        </div>

        <form className="search-form" onSubmit={loadChannelDebug}>
          <label>
            Сообщество
            <input
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              placeholder="club123, screen_name или vk.com/..."
            />
          </label>
          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
            {isLoading ? 'Проверяем' : 'Проверить'}
          </button>
        </form>

        {error && <div className="debug-error">{error}</div>}
      </div>

      {debug && (
        <>
          <div className="panel span-2">
            <div className="panel-header compact">
              <div>
                <h2>Сводка</h2>
                <p>То, что можно быстро интерпретировать из ответа VK.</p>
              </div>
              <Bug size={20} />
            </div>

            <div className="channel-summary-grid">
              <div className="debug-summary">
                <strong>Сообщество</strong>
                <span>
                  {group?.name ?? 'без названия'} / {group?.screen_name ?? group?.id ?? 'без screen name'}
                </span>
              </div>
              <div className="debug-summary">
                <strong>Канал</strong>
                <span>has_group_channel: {formatFlag(group?.has_group_channel)}</span>
              </div>
              <div className="debug-summary">
                <strong>Аудитория</strong>
                <span>members_count: {group?.members_count ?? 'нет поля'}</span>
              </div>
              <div className="debug-summary">
                <strong>Права текущего пользователя</strong>
                <span>
                  admin: {formatFlag(group?.is_admin)} / member: {formatFlag(group?.is_member)} / subscribed:{' '}
                  {formatFlag(group?.is_subscribed)}
                </span>
              </div>
              <div className="debug-summary">
                <strong>Подписка на посты</strong>
                <span>can_subscribe_posts: {formatFlag(group?.can_subscribe_posts)}</span>
              </div>
              <div className="debug-summary">
                <strong>Стена</strong>
                <span>
                  всего: {debug.wall?.count ?? 'нет данных'} / получено: {wallItems.length}
                </span>
              </div>
              <div className="debug-summary">
                <strong>Реакции в полученных постах</strong>
                <span>
                  likes: {wallSummary.likes}, reposts: {wallSummary.reposts}, comments: {wallSummary.comments}, views:{' '}
                  {wallSummary.views}
                </span>
              </div>
              <div className="debug-summary">
                <strong>Доступность методов</strong>
                <span>
                  stats.get: {debug.stats ? 'есть ответ' : 'нет ответа'} / stats.getPostReach:{' '}
                  {debug.postReach ? 'есть ответ' : 'нет ответа'}
                </span>
              </div>
            </div>

            {debug.warnings.length > 0 && (
              <div className="debug-error">
                {debug.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            )}
          </div>

          {wallItems.length > 0 && (
            <div className="panel span-2">
              <div className="panel-header compact">
                <div>
                  <h2>Последние записи стены</h2>
                  <p>Если VK отдаёт канальные посты как записи стены, они будут видны здесь.</p>
                </div>
              </div>
              <div className="channel-post-list">
                {wallItems.slice(0, 10).map((post, index) => (
                  <div className="debug-summary" key={`${post.id ?? index}`}>
                    <strong>
                      #{post.id ?? index + 1} / {getPostDate(post.date)}
                    </strong>
                    <span>{post.text?.trim() || 'без текста'}</span>
                    <span>
                      likes: {post.likes?.count ?? 0}, reposts: {post.reposts?.count ?? 0}, comments:{' '}
                      {post.comments?.count ?? 0}, views: {post.views?.count ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel span-2">
            <div className="panel-header compact">
              <div>
                <h2>Сырой ответ</h2>
                <p>Полный debug-ответ API, чтобы увидеть все неожиданные поля.</p>
              </div>
            </div>
            <pre className="debug-json">{JSON.stringify(debug, null, 2)}</pre>
          </div>
        </>
      )}
    </section>
  );
}
