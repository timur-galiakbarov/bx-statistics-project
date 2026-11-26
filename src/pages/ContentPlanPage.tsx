import { CalendarClock, ListChecks, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, apiGet } from '../api/client';
import './content.css';
import './content-plan.css';

type ContentPlanMeta = {
  channels: unknown[];
  posts: unknown[];
  serverTime: string;
};

export function ContentPlanPage() {
  const [meta, setMeta] = useState<ContentPlanMeta | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<ContentPlanMeta>('/api/content-plan')
      .then(setMeta)
      .catch((reason) => {
        setError(
          reason instanceof ApiError && reason.status === 403
            ? 'Раздел пока недоступен. Включите его в «Админке → Настройки → Фичи».'
            : reason instanceof Error
              ? reason.message
              : 'Не удалось загрузить контент-план.'
        );
      });
  }, []);

  return (
    <div className="content-page content-plan-page">
      <div className="content-hero">
        <div>
          <div className="content-eyebrow"><ShieldCheck size={14} /> Только для администраторов</div>
          <h2>Контент-план</h2>
          <p>
            Календарь публикаций и автопубликация. Начинаем с Telegram: markdown, время пользователя и без лимитов.
            Раздел «Идеи для постов» пока остаётся отдельным.
          </p>
          <div className="content-row" style={{ marginTop: 12 }}>
            <span className="content-tag">Этап 0: каркас</span>
            <span className="content-tag">Автопубликация включена</span>
            <span className="content-tag">Время пользователя</span>
          </div>
        </div>
        <div className="content-hero-icon"><CalendarClock size={34} /></div>
      </div>

      {error && <div className="content-message content-error">{error}</div>}

      <div className="content-panel">
        <div className="content-section-heading">
          <div>
            <h3>Каркас раздела</h3>
            <p>
              {meta
                ? `API отвечает: ${meta.channels.length} каналов, ${meta.posts.length} постов.`
                : 'Проверяем доступ к разделу…'}
            </p>
          </div>
          <span className="content-tag">{meta ? 'Готово' : 'Загрузка'}</span>
        </div>
        <div className="content-empty">
          <ListChecks size={34} />
          <h3>Дальше — календарь и Telegram</h3>
          <p>
            Следующий этап: список подключённых каналов, календарь на месяц, черновики и форма поста с markdown.
            Публикация и автопубликация — после этого.
          </p>
          <div className="content-plan-next">
            <span><CalendarClock size={14} /> 1. Календарь и каналы</span>
            <span><Send size={14} /> 2. Markdown и редактор</span>
            <span><Sparkles size={14} /> 3. Публикация по времени пользователя</span>
          </div>
        </div>
      </div>
    </div>
  );
}
