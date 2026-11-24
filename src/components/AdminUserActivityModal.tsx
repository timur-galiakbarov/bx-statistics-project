import { RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { AdminUserActivity } from '../api/types';
import { formatActivityDuration } from '../utils/activityFormat';
import { actionLabels, pageLabels, platformLabels } from './AdminActivityStats';

const periodOptions = [7, 30, 90] as const;

const dateOnlyFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC'
});

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
  // Без timeZone: моменты времени показываются в часовом поясе браузера администратора.
});

const amountFormatter = new Intl.NumberFormat('ru-RU');

const paymentStatusLabels: Record<string, string> = {
  paid: 'Оплачен',
  failed: 'Ошибка',
  pending: 'Ожидает'
};

const deviceLabels: Record<string, string> = {
  desktop: 'Компьютер',
  mobile: 'Телефон'
};

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : '—';
}

function formatDateOnly(value: string) {
  return dateOnlyFormatter.format(new Date(value));
}

function pageLabel(path: string) {
  return pageLabels[path] ?? path;
}

type Props = {
  userId: string;
  fallbackName: string;
  onClose: () => void;
};

export function AdminUserActivityModal({ userId, fallbackName, onClose }: Props) {
  const [days, setDays] = useState<number>(30);
  const [activity, setActivity] = useState<AdminUserActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    apiGet<AdminUserActivity>(`/api/account/admin/users/${userId}/activity?days=${days}`)
      .then((data) => { if (isCurrent) setActivity(data); })
      .catch((reason) => {
        if (isCurrent) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить действия пользователя.');
      })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [userId, days, reloadKey]);

  return (
    <div className="admin-access-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="admin-user-activity-title"
        aria-modal="true"
        className="admin-access-modal admin-user-activity-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Закрыть" className="icon-button" type="button" onClick={onClose}>
          <XCircle size={18} />
        </button>
        <h2 id="admin-user-activity-title">Действия пользователя</h2>
        <p className="admin-user-activity-user">
          <strong>{activity?.user.name ?? fallbackName}</strong>
          {activity?.user.vkId ? ` · VK ID ${activity.user.vkId}` : ''}
          {activity?.user.bitrixId ? ` · Bitrix ID ${activity.user.bitrixId}` : ''}
          {activity && (
            <span className={`admin-payment-origin ${activity.user.hasPaidPayment ? 'paid' : 'granted'}`}>
              {activity.user.hasPaidPayment ? 'Оплачивал' : 'Без оплаты'}
            </span>
          )}
        </p>

        {error && (
          <div className="debug-error">
            {error}
            <button className="secondary-button inline" type="button" disabled={isLoading} onClick={() => setReloadKey((key) => key + 1)}>
              Повторить
            </button>
          </div>
        )}
        {isLoading && !activity && <div className="admin-user-payments-loading"><RefreshCw className="spin" size={18} /> Загружаем</div>}

        {activity && (
          <>
            <div className="admin-user-activity-facts">
              <div><span>Регистрация</span><strong>{formatDateTime(activity.user.registeredAt)}</strong></div>
              <div><span>Последний вход</span><strong>{formatDateTime(activity.user.lastLoginAt)}</strong></div>
              <div><span>Последняя активность</span><strong>{formatDateTime(activity.user.lastActivityAt)}</strong></div>
              <div><span>Последний визит</span><strong>{formatDateTime(activity.summary.allTime.lastVisitAt)}</strong></div>
              <div><span>Последнее действие</span><strong>{formatDateTime(activity.summary.allTime.lastActionAt)}</strong></div>
              <div><span>Доступ до</span><strong>{formatDateOnly(activity.user.activeTo)}</strong></div>
            </div>

            <div className="admin-user-activity-toolbar">
              <div className="admin-active-users-filters" role="group" aria-label="Период сводки">
                {periodOptions.map((option) => (
                  <button
                    key={option}
                    className={days === option ? 'active' : ''}
                    type="button"
                    onClick={() => setDays(option)}
                  >
                    {option} дней
                  </button>
                ))}
              </div>
              <button className="secondary-button inline" type="button" disabled={isLoading} onClick={() => setReloadKey((key) => key + 1)}>
                <RefreshCw className={isLoading ? 'spin' : undefined} size={16} />
                Обновить
              </button>
            </div>

            <h3 className="admin-user-activity-heading">Сводка за {activity.days} дней</h3>
            <div className="admin-user-activity-summary">
              <div><span>Визиты</span><strong>{activity.summary.period.visits}</strong></div>
              <div><span>Просмотры страниц</span><strong>{activity.summary.period.pageViews}</strong></div>
              <div><span>Действия</span><strong>{activity.summary.period.actions}</strong></div>
              <div><span>Дней с визитами</span><strong>{activity.summary.period.activeDays}</strong></div>
            </div>

            <p className="admin-user-activity-alltime">
              За всё время — визитов: {activity.summary.allTime.visits}, просмотров страниц: {activity.summary.allTime.pageViews},{' '}
              действий: {activity.summary.allTime.actions}, дней с визитами: {activity.summary.allTime.activeDays}.
              {activity.summary.allTime.firstVisitAt && <> Первый визит — {formatDateTime(activity.summary.allTime.firstVisitAt)}.</>}
            </p>
            <p className="admin-user-activity-payments-total">
              Успешных оплат: {activity.summary.payments.count} на {amountFormatter.format(activity.summary.payments.revenue)} ₽.
            </p>
            {activity.trackingSince && (
              <p className="admin-user-activity-note">
                Визиты и действия записываются с {formatDateTime(activity.trackingSince)}. За более раннее время данных о поведении нет.
              </p>
            )}

            <div className="admin-user-activity-grid">
              <section>
                <h3 className="admin-user-activity-heading">Последние визиты</h3>
                {activity.visits.length === 0 ? (
                  <div className="empty-state">Визитов нет.</div>
                ) : (
                  <ul className="admin-user-activity-list">
                    {activity.visits.map((visit) => (
                      <li key={visit.id}>
                        <time dateTime={visit.startedAt}>{formatDateTime(visit.startedAt)}</time>
                        <strong>{formatActivityDuration(visit.seconds)}</strong>
                        <small>
                          {visit.pageViews} стр.
                          {visit.device ? ` · ${deviceLabels[visit.device] ?? visit.device}` : ''}
                          {visit.actions > 0 ? ` · ${visit.actions} действ.` : ''}
                        </small>
                        {visit.paths.length > 0 && <small>{visit.paths.map(pageLabel).join(' · ')}</small>}
                        {visit.entryPath && <small>Вход: {pageLabel(visit.entryPath)}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="admin-user-activity-heading">Последние действия</h3>
                {activity.events.length === 0 ? (
                  <div className="empty-state">Действий нет.</div>
                ) : (
                  <ul className="admin-user-activity-list">
                    {activity.events.map((event) => (
                      <li key={event.id}>
                        <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                        <strong>{actionLabels[event.type] ?? event.type}</strong>
                        {event.platform && <small>{platformLabels[event.platform] ?? event.platform}</small>}
                        {event.label && <small>{event.label}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="admin-user-activity-payments">
              <h3 className="admin-user-activity-heading">Оплаты</h3>
              {activity.payments.length === 0 ? (
                <div className="empty-state">Оплат нет.</div>
              ) : (
                <ul className="admin-user-payments-list">
                  {activity.payments.map((payment) => (
                    <li key={payment.id}>
                      <span className="admin-user-dates">
                        <strong>{amountFormatter.format(payment.amount)} ₽ · {payment.period}</strong>
                        <small>Создан: {formatDateTime(payment.createdAt)}</small>
                        {payment.paidAt && <small>Оплачен: {formatDateTime(payment.paidAt)}</small>}
                      </span>
                      <span className={`payment-status ${payment.status}`}>
                        {paymentStatusLabels[payment.status] ?? payment.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
