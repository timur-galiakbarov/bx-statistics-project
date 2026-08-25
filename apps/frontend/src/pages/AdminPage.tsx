import { Bug, CheckCircle2, CreditCard, Info, Link, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import type {
  AdminPaymentActionResult,
  AdminPaymentHistoryItem,
  AdminPaymentsMonthlySummary,
  AdminUserAccessResult,
  RecentAdminUser,
  VkAppInfo,
  VkManualStatsResult,
  VkOAuthDebug,
  VkPermissions,
  VkTokenStatus
} from '../api/types';

const paymentStatusOptions = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Ожидает' },
  { key: 'paid', label: 'Оплачены' },
  { key: 'failed', label: 'Ошибки' }
] as const;

type PaymentStatusFilter = (typeof paymentStatusOptions)[number]['key'];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
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
  minute: '2-digit',
  timeZone: 'UTC'
});

function formatAdminDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatAdminDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function AdminPage() {
  const [permissions, setPermissions] = useState<VkPermissions | null>(null);
  const [tokenStatus, setTokenStatus] = useState<VkTokenStatus | null>(null);
  const [appInfo, setAppInfo] = useState<VkAppInfo | null>(null);
  const [oauthDebug, setOauthDebug] = useState<VkOAuthDebug | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualGroupId, setManualGroupId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [payments, setPayments] = useState<AdminPaymentHistoryItem[]>([]);
  const [paymentsMonthlySummary, setPaymentsMonthlySummary] = useState<AdminPaymentsMonthlySummary | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentAdminUser[]>([]);
  const [manualPermissions, setManualPermissions] = useState<VkPermissions | null>(null);
  const [manualStats, setManualStats] = useState<VkManualStatsResult | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [tokenStatusError, setTokenStatusError] = useState<string | null>(null);
  const [appInfoError, setAppInfoError] = useState<string | null>(null);
  const [oauthDebugError, setOauthDebugError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentsMonthlySummaryError, setPaymentsMonthlySummaryError] = useState<string | null>(null);
  const [recentUsersError, setRecentUsersError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [paymentActionId, setPaymentActionId] = useState<string | null>(null);
  const [accessActionUserId, setAccessActionUserId] = useState<string | null>(null);
  const [accessDates, setAccessDates] = useState<Record<string, string>>({});
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [isTokenStatusLoading, setIsTokenStatusLoading] = useState(false);
  const [isAppInfoLoading, setIsAppInfoLoading] = useState(false);
  const [isOauthDebugLoading, setIsOauthDebugLoading] = useState(false);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [isPaymentsMonthlySummaryLoading, setIsPaymentsMonthlySummaryLoading] = useState(false);
  const [isRecentUsersLoading, setIsRecentUsersLoading] = useState(false);
  const [isManualPermissionsLoading, setIsManualPermissionsLoading] = useState(false);
  const [isManualStatsLoading, setIsManualStatsLoading] = useState(false);

  const app = appInfo?.items?.[0];
  const displayedPaymentsAmount = payments.reduce((total, payment) => total + payment.amount, 0);
  const displayedPaidPayments = payments.filter((payment) => payment.status === 'paid').length;
  const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const currentMonthName = monthFormatter.format(new Date());
  const previousMonthName = monthFormatter.format(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)));

  const getPaymentStatusLabel = (status: string) => {
    if (status === 'paid') {
      return 'Оплачен';
    }

    if (status === 'failed') {
      return 'Ошибка';
    }

    if (status === 'pending') {
      return 'Ожидает';
    }

    return status;
  };

  const updatePaymentRow = (nextPayment: AdminPaymentHistoryItem | null) => {
    if (!nextPayment) {
      return;
    }

    setPayments((items) => items.map((item) => (item.id === nextPayment.id ? nextPayment : item)));
  };

  const updateUserRows = (user: AdminUserAccessResult['user']) => {
    setPayments((items) =>
      items.map((item) =>
        item.user?.id === user.id
          ? {
              ...item,
              user
            }
          : item
      )
    );
    setAccessDates((items) => ({ ...items, [user.id]: user.activeTo }));
  };

  const loadPermissions = async () => {
    setIsPermissionsLoading(true);
    setPermissionsError(null);

    try {
      const data = await apiGet<VkPermissions>('/api/vk/permissions');
      setPermissions(data);
    } catch (nextError) {
      setPermissions(null);
      setPermissionsError(nextError instanceof Error ? nextError.message : 'Не удалось получить permissions');
    } finally {
      setIsPermissionsLoading(false);
    }
  };

  const loadTokenStatus = async () => {
    setIsTokenStatusLoading(true);
    setTokenStatusError(null);

    try {
      const data = await apiGet<VkTokenStatus>('/api/vk/token-status');
      setTokenStatus(data);
    } catch (nextError) {
      setTokenStatus(null);
      setTokenStatusError(nextError instanceof Error ? nextError.message : 'Не удалось получить статус VK token');
    } finally {
      setIsTokenStatusLoading(false);
    }
  };

  const loadAppInfo = async () => {
    setIsAppInfoLoading(true);
    setAppInfoError(null);

    try {
      const data = await apiGet<VkAppInfo>('/api/vk/app');
      setAppInfo(data);
    } catch (nextError) {
      setAppInfo(null);
      setAppInfoError(nextError instanceof Error ? nextError.message : 'Не удалось получить информацию о приложении');
    } finally {
      setIsAppInfoLoading(false);
    }
  };

  const loadOauthDebug = async () => {
    setIsOauthDebugLoading(true);
    setOauthDebugError(null);

    try {
      const data = await apiGet<VkOAuthDebug>('/api/vk/oauth-debug');
      setOauthDebug(data);
    } catch (nextError) {
      setOauthDebug(null);
      setOauthDebugError(nextError instanceof Error ? nextError.message : 'Не удалось получить OAuth debug');
    } finally {
      setIsOauthDebugLoading(false);
    }
  };

  const checkManualPermissions = async () => {
    setIsManualPermissionsLoading(true);
    setManualError(null);
    setManualPermissions(null);

    try {
      const data = await apiPost<VkPermissions>('/api/vk/debug/permissions', {
        accessToken: manualToken
      });
      setManualPermissions(data);
    } catch (nextError) {
      setManualError(nextError instanceof Error ? nextError.message : 'Не удалось проверить token');
    } finally {
      setIsManualPermissionsLoading(false);
    }
  };

  const checkManualStats = async () => {
    setIsManualStatsLoading(true);
    setManualError(null);
    setManualStats(null);

    try {
      const data = await apiPost<VkManualStatsResult>('/api/vk/debug/stats', {
        accessToken: manualToken,
        groupId: manualGroupId
      });
      setManualStats(data);
    } catch (nextError) {
      setManualError(nextError instanceof Error ? nextError.message : 'Не удалось проверить stats.get');
    } finally {
      setIsManualStatsLoading(false);
    }
  };

  const loadPayments = async () => {
    setIsPaymentsLoading(true);
    setPaymentsError(null);

    try {
      const params = new URLSearchParams();
      params.set('status', paymentStatus);

      if (paymentQuery.trim()) {
        params.set('q', paymentQuery.trim());
      }

      const data = await apiGet<AdminPaymentHistoryItem[]>(`/api/payments/admin/history?${params.toString()}`);
      setPayments(data);
    } catch (nextError) {
      setPayments([]);
      setPaymentsError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить оплаты');
    } finally {
      setIsPaymentsLoading(false);
    }
  };

  const loadPaymentsMonthlySummary = async () => {
    setIsPaymentsMonthlySummaryLoading(true);
    setPaymentsMonthlySummaryError(null);

    try {
      const data = await apiGet<AdminPaymentsMonthlySummary>('/api/payments/admin/summary');
      setPaymentsMonthlySummary(data);
    } catch (nextError) {
      setPaymentsMonthlySummary(null);
      setPaymentsMonthlySummaryError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить сводку платежей');
    } finally {
      setIsPaymentsMonthlySummaryLoading(false);
    }
  };

  const loadRecentUsers = async () => {
    setIsRecentUsersLoading(true);
    setRecentUsersError(null);

    try {
      const data = await apiGet<RecentAdminUser[]>('/api/account/admin/users/recent');
      setRecentUsers(data);
    } catch (nextError) {
      setRecentUsers([]);
      setRecentUsersError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить пользователей');
    } finally {
      setIsRecentUsersLoading(false);
    }
  };

  const confirmPayment = async (payment: AdminPaymentHistoryItem) => {
    setPaymentActionId(payment.id);
    setPaymentsError(null);

    try {
      const data = await apiPost<AdminPaymentActionResult>(`/api/payments/admin/${payment.id}/confirm`, {
        note: 'Ручное подтверждение из админки'
      });
      updatePaymentRow(data.payment);
      await loadPayments();
    } catch (nextError) {
      setPaymentsError(nextError instanceof Error ? nextError.message : 'Не удалось подтвердить оплату');
    } finally {
      setPaymentActionId(null);
    }
  };

  const cancelPayment = async (payment: AdminPaymentHistoryItem) => {
    setPaymentActionId(payment.id);
    setPaymentsError(null);

    try {
      const data = await apiPost<AdminPaymentActionResult>(`/api/payments/admin/${payment.id}/cancel`, {
        reason: 'Отменено из админки'
      });
      updatePaymentRow(data.payment);
      await loadPayments();
    } catch (nextError) {
      setPaymentsError(nextError instanceof Error ? nextError.message : 'Не удалось отменить оплату');
    } finally {
      setPaymentActionId(null);
    }
  };

  const updateUserAccess = async (
    userId: string,
    payload: { action: 'set' | 'add_days' | 'add_months'; value: string | number }
  ) => {
    setAccessActionUserId(userId);
    setPaymentsError(null);

    try {
      const data = await apiPost<AdminUserAccessResult>(`/api/payments/admin/users/${userId}/access`, payload);
      updateUserRows(data.user);
    } catch (nextError) {
      setPaymentsError(nextError instanceof Error ? nextError.message : 'Не удалось изменить дату доступа');
    } finally {
      setAccessActionUserId(null);
    }
  };

  useEffect(() => {
    loadPayments();
    loadPaymentsMonthlySummary();
    loadRecentUsers();
  }, []);

  return (
    <section className="page-grid">
      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Платежи по месяцам</h2>
            <p>Только оплаченные платежи за текущий и предыдущий календарные месяцы.</p>
          </div>
          <button
            className="secondary-button inline"
            type="button"
            onClick={loadPaymentsMonthlySummary}
            disabled={isPaymentsMonthlySummaryLoading}
          >
            {isPaymentsMonthlySummaryLoading ? <RefreshCw className="spin" size={18} /> : <RefreshCw size={18} />}
            Обновить
          </button>
        </div>
        {paymentsMonthlySummaryError && <div className="debug-error">{paymentsMonthlySummaryError}</div>}
        {paymentsMonthlySummary && (
          <div className="admin-monthly-payments">
            <div>
              <span>{currentMonthName}</span>
              <strong>{paymentsMonthlySummary.current.amount.toLocaleString('ru-RU')} ₽</strong>
              <small>{paymentsMonthlySummary.current.count} оплат</small>
            </div>
            <div>
              <span>{previousMonthName}</span>
              <strong>{paymentsMonthlySummary.previous.amount.toLocaleString('ru-RU')} ₽</strong>
              <small>{paymentsMonthlySummary.previous.count} оплат</small>
            </div>
          </div>
        )}
      </div>

      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Последние активные пользователи</h2>
            <p>До 300 пользователей, отсортированных по времени последнего входа.</p>
          </div>
          <button className="secondary-button inline" type="button" onClick={loadRecentUsers} disabled={isRecentUsersLoading}>
            {isRecentUsersLoading ? <RefreshCw className="spin" size={18} /> : <Users size={18} />}
            {isRecentUsersLoading ? 'Загружаем' : 'Обновить'}
          </button>
        </div>

        {recentUsersError && <div className="debug-error">{recentUsersError}</div>}
        {recentUsers.length === 0 && !recentUsersError && !isRecentUsersLoading && (
          <div className="empty-state">Пользователей со входами пока нет.</div>
        )}
        {recentUsers.length > 0 && (
          <div className="table analytics-posts recent-users-table">
            <div className="table-row table-head admin-recent-users-row">
              <span>Последний вход</span>
              <span>Пользователь</span>
              <span>VK ID</span>
              <span>Bitrix ID</span>
              <span>Доступ</span>
              <span>Доступ до</span>
            </div>
            {recentUsers.map((user) => (
              <div className="table-row admin-recent-users-row" key={user.id}>
                <span data-label="Последний вход">{formatAdminDateTime(user.lastLoginAt)}</span>
                <span data-label="Пользователь">
                  <strong>{user.name}</strong>
                </span>
                <span data-label="VK ID">{user.vkId ?? '—'}</span>
                <span data-label="Bitrix ID">{user.bitrixId ?? '—'}</span>
                <span data-label="Доступ" className={`user-active-status ${user.hasActiveAccess ? 'active' : 'inactive'}`}>
                  {user.hasActiveAccess ? 'Активен' : 'Не активен'}
                </span>
                <span data-label="Доступ до">{formatAdminDate(user.activeTo)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Последние 100 платежей</h2>
            <p>Статусы, суммы и пользователи. Лимит применяется на сервере.</p>
          </div>
          <button className="primary-button" type="button" onClick={loadPayments} disabled={isPaymentsLoading}>
            {isPaymentsLoading ? <RefreshCw className="spin" size={18} /> : <CreditCard size={18} />}
            {isPaymentsLoading ? 'Загружаем' : 'Загрузить оплаты'}
          </button>
        </div>

        <div className="debug-form admin-payments-filter">
          <label>
            Поиск
            <input
              value={paymentQuery}
              onChange={(event) => setPaymentQuery(event.target.value)}
              placeholder="user, VK id, operation id, payment id"
            />
          </label>
          <label>
            Статус
            <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatusFilter)}>
              {paymentStatusOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button inline" type="button" onClick={loadPayments} disabled={isPaymentsLoading}>
            <Search size={17} />
            Применить
          </button>
        </div>

        {paymentsError && <div className="debug-error">{paymentsError}</div>}

        {payments.length > 0 && (
          <div className="admin-payments-summary" aria-label="Сводка по показанным платежам">
            <span>Показано: <strong>{payments.length}</strong></span>
            <span>Оплачено: <strong>{displayedPaidPayments}</strong></span>
            <span>Сумма: <strong>{displayedPaymentsAmount.toLocaleString('ru-RU')} ₽</strong></span>
          </div>
        )}

        {payments.length === 0 && !paymentsError && <div className="empty-state">Оплаты ещё не загружены.</div>}

        {payments.length > 0 && (
          <div className="table analytics-posts payments-table">
            <div className="table-row table-head admin-payment-row">
              <span>Дата</span>
              <span>Пользователь</span>
              <span>Период</span>
              <span>Сумма</span>
              <span>Статус</span>
              <span>Операция</span>
              <span>Действия</span>
            </div>
            {payments.map((payment) => (
              <div className="table-row admin-payment-row" key={payment.id}>
                <span>{formatAdminDate(payment.createdAt)}</span>
                <span>
                  <strong>{payment.user?.name ?? 'Пользователь не найден'}</strong>
                  {payment.user ? (
                    <>
                      <small>id: {payment.user.id}</small>
                      <small>vk id: {payment.user.vkId} / до {formatAdminDate(payment.user.activeTo)}</small>
                      <span className="admin-access-actions">
                        <button
                          className="mini-button"
                          type="button"
                          disabled={accessActionUserId === payment.user.id}
                          onClick={() => updateUserAccess(payment.user!.id, { action: 'add_days', value: 7 })}
                        >
                          +7 дней
                        </button>
                        <button
                          className="mini-button"
                          type="button"
                          disabled={accessActionUserId === payment.user.id}
                          onClick={() => updateUserAccess(payment.user!.id, { action: 'add_months', value: 1 })}
                        >
                          +1 месяц
                        </button>
                        <input
                          type="date"
                          value={accessDates[payment.user.id] ?? payment.user.activeTo}
                          disabled={accessActionUserId === payment.user.id}
                          onChange={(event) =>
                            setAccessDates((items) => ({ ...items, [payment.user!.id]: event.target.value }))
                          }
                        />
                        <button
                          className="mini-button"
                          type="button"
                          disabled={accessActionUserId === payment.user.id}
                          onClick={() =>
                            updateUserAccess(payment.user!.id, {
                              action: 'set',
                              value: accessDates[payment.user!.id] ?? payment.user!.activeTo
                            })
                          }
                        >
                          Задать
                        </button>
                      </span>
                    </>
                  ) : (
                    <small>{payment.id}</small>
                  )}
                </span>
                <span>{payment.period}</span>
                <span>{payment.amount} ₽</span>
                <span className={`payment-status ${payment.status}`}>{getPaymentStatusLabel(payment.status)}</span>
                <span>{payment.providerTransactionId ?? '-'}</span>
                <span className="admin-payment-actions">
                  {payment.status !== 'paid' && (
                    <button
                      className="icon-button has-tooltip"
                      type="button"
                      aria-label="Подтвердить оплату"
                      data-tooltip="Подтвердить оплату"
                      disabled={paymentActionId === payment.id}
                      onClick={() => confirmPayment(payment)}
                    >
                      {paymentActionId === payment.id ? <RefreshCw className="spin" size={17} /> : <CheckCircle2 size={17} />}
                    </button>
                  )}
                  {payment.status !== 'failed' && (
                    <button
                      className="icon-button has-tooltip"
                      type="button"
                      aria-label="Отменить оплату"
                      data-tooltip="Отменить оплату"
                      disabled={paymentActionId === payment.id}
                      onClick={() => cancelPayment(payment)}
                    >
                      {paymentActionId === payment.id ? <RefreshCw className="spin" size={17} /> : <XCircle size={17} />}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Дебаг панель</h2>
            <p>Проверка текущих прав VK token для авторизованного пользователя.</p>
          </div>
          <div className="debug-actions">
            <button
              className="primary-button"
              type="button"
              onClick={loadPermissions}
              disabled={isPermissionsLoading}
            >
              {isPermissionsLoading ? <RefreshCw className="spin" size={18} /> : <Bug size={18} />}
              {isPermissionsLoading ? 'Проверяем' : 'Получить permissions'}
            </button>
            <button
              className="secondary-button inline"
              type="button"
              onClick={loadTokenStatus}
              disabled={isTokenStatusLoading}
            >
              {isTokenStatusLoading ? <RefreshCw className="spin" size={18} /> : <Info size={18} />}
              {isTokenStatusLoading ? 'Проверяем' : 'Статус token'}
            </button>
            <button className="secondary-button inline" type="button" onClick={loadAppInfo} disabled={isAppInfoLoading}>
              {isAppInfoLoading ? <RefreshCw className="spin" size={18} /> : <Info size={18} />}
              {isAppInfoLoading ? 'Проверяем' : 'Информация о приложении'}
            </button>
            <button
              className="secondary-button inline"
              type="button"
              onClick={loadOauthDebug}
              disabled={isOauthDebugLoading}
            >
              {isOauthDebugLoading ? <RefreshCw className="spin" size={18} /> : <Link size={18} />}
              {isOauthDebugLoading ? 'Проверяем' : 'OAuth debug'}
            </button>
          </div>
        </div>

        {permissionsError && <div className="debug-error">{permissionsError}</div>}
        {tokenStatusError && <div className="debug-error">{tokenStatusError}</div>}
        {appInfoError && <div className="debug-error">{appInfoError}</div>}
        {oauthDebugError && <div className="debug-error">{oauthDebugError}</div>}

        {tokenStatus && (
          <div className="debug-grid">
            <div className="debug-summary">
              <strong>VK token</strong>
              <span>
                сохранён: {String(tokenStatus.hasToken)} / истёк: {String(tokenStatus.isExpired)}
              </span>
            </div>
            <div className="debug-summary">
              <strong>Срок</strong>
              <span>
                expiresAt: {tokenStatus.expiresAt ?? 'без срока'} / updatedAt:{' '}
                {tokenStatus.updatedAt ?? 'не указан'}
              </span>
            </div>
            <pre className="debug-json">{JSON.stringify(tokenStatus, null, 2)}</pre>
          </div>
        )}

        {permissions && (
          <div className="debug-grid">
            <div className="debug-summary">
              <strong>Mask</strong>
              <span>{permissions.mask}</span>
            </div>
            <div className="debug-summary">
              <strong>Dashboard</strong>
              <span>
                groups: {String(permissions.requiredForDashboard.groups)}, stats:{' '}
                {String(permissions.requiredForDashboard.stats)}, wall:{' '}
                {String(permissions.requiredForDashboard.wall)}
              </span>
            </div>
            <pre className="debug-json">{JSON.stringify(permissions, null, 2)}</pre>
          </div>
        )}

        {appInfo && (
          <div className="debug-grid">
            <div className="debug-summary">
              <strong>Приложение</strong>
              <span>
                {app?.title ?? 'Без названия'} / type: {app?.type ?? 'не указан'} / id: {app?.id ?? 'не указан'}
              </span>
            </div>
            <pre className="debug-json">{JSON.stringify(appInfo, null, 2)}</pre>
          </div>
        )}

        {oauthDebug && (
          <div className="debug-grid">
            <div className="debug-summary">
              <strong>OAuth</strong>
              <span>
                scope: {oauthDebug.scope} / revoke: {String(oauthDebug.forceRevoke)}
              </span>
            </div>
            <pre className="debug-json">{JSON.stringify(oauthDebug, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Ручная проверка VK token</h2>
            <p>Token не сохраняется, используется только для одного debug-запроса.</p>
          </div>
        </div>

        <div className="debug-form">
          <label>
            VK access token
            <textarea
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder="access_token из старого socstat.ru или VK OAuth"
              rows={3}
            />
          </label>
          <label>
            ID сообщества для stats.get
            <input
              value={manualGroupId}
              onChange={(event) => setManualGroupId(event.target.value)}
              placeholder="например 125792332"
            />
          </label>
          <div className="debug-actions left">
            <button
              className="primary-button"
              type="button"
              onClick={checkManualPermissions}
              disabled={isManualPermissionsLoading}
            >
              {isManualPermissionsLoading ? <RefreshCw className="spin" size={18} /> : <Bug size={18} />}
              Проверить permissions
            </button>
            <button
              className="secondary-button inline"
              type="button"
              onClick={checkManualStats}
              disabled={isManualStatsLoading}
            >
              {isManualStatsLoading ? <RefreshCw className="spin" size={18} /> : <Info size={18} />}
              Проверить stats.get
            </button>
          </div>
        </div>

        {manualError && <div className="debug-error">{manualError}</div>}

        {manualPermissions && (
          <div className="debug-grid">
            <div className="debug-summary">
              <strong>Manual permissions</strong>
              <span>
                mask: {manualPermissions.mask} / stats: {String(manualPermissions.requiredForDashboard.stats)} /
                groups: {String(manualPermissions.requiredForDashboard.groups)}
              </span>
            </div>
            <pre className="debug-json">{JSON.stringify(manualPermissions, null, 2)}</pre>
          </div>
        )}

        {manualStats !== null && (
          <div className="debug-grid">
            <div className="debug-summary">
              <strong>Manual stats.get</strong>
              <span>Сырой ответ VK для указанного сообщества.</span>
            </div>
            <pre className="debug-json">{JSON.stringify(manualStats, null, 2)}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
