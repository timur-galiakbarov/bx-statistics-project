import { Bug, CreditCard, Info, Link, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import type { AdminPaymentHistoryItem, VkAppInfo, VkManualStatsResult, VkOAuthDebug, VkPermissions } from '../api/types';

const paymentStatusOptions = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Ожидает' },
  { key: 'paid', label: 'Оплачены' },
  { key: 'failed', label: 'Ошибки' }
] as const;

type PaymentStatusFilter = (typeof paymentStatusOptions)[number]['key'];

export function AdminPage() {
  const [permissions, setPermissions] = useState<VkPermissions | null>(null);
  const [appInfo, setAppInfo] = useState<VkAppInfo | null>(null);
  const [oauthDebug, setOauthDebug] = useState<VkOAuthDebug | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualGroupId, setManualGroupId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [payments, setPayments] = useState<AdminPaymentHistoryItem[]>([]);
  const [manualPermissions, setManualPermissions] = useState<VkPermissions | null>(null);
  const [manualStats, setManualStats] = useState<VkManualStatsResult | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [appInfoError, setAppInfoError] = useState<string | null>(null);
  const [oauthDebugError, setOauthDebugError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [isAppInfoLoading, setIsAppInfoLoading] = useState(false);
  const [isOauthDebugLoading, setIsOauthDebugLoading] = useState(false);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [isManualPermissionsLoading, setIsManualPermissionsLoading] = useState(false);
  const [isManualStatsLoading, setIsManualStatsLoading] = useState(false);

  const app = appInfo?.items?.[0];

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

  useEffect(() => {
    loadPayments();
  }, []);

  return (
    <section className="page-grid">
      <div className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>Оплаты</h2>
            <p>Последние платежи, статусы и пользователи.</p>
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

        {payments.length === 0 && !paymentsError && <div className="empty-state">Оплаты ещё не загружены.</div>}

        {payments.length > 0 && (
          <div className="table analytics-posts">
            <div className="table-row table-head admin-payment-row">
              <span>Дата</span>
              <span>Пользователь</span>
              <span>Период</span>
              <span>Сумма</span>
              <span>Статус</span>
              <span>Операция</span>
            </div>
            {payments.map((payment) => (
              <div className="table-row admin-payment-row" key={payment.id}>
                <span>{new Date(payment.createdAt).toLocaleString('ru-RU')}</span>
                <span>
                  <strong>{payment.user?.name ?? 'Пользователь не найден'}</strong>
                  {payment.user ? (
                    <>
                      <small>id: {payment.user.id}</small>
                      <small>vk id: {payment.user.vkId} / до {payment.user.activeTo}</small>
                    </>
                  ) : (
                    <small>{payment.id}</small>
                  )}
                </span>
                <span>{payment.period}</span>
                <span>{payment.amount} ₽</span>
                <span className={`payment-status ${payment.status}`}>{getPaymentStatusLabel(payment.status)}</span>
                <span>{payment.providerTransactionId ?? '-'}</span>
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
        {appInfoError && <div className="debug-error">{appInfoError}</div>}
        {oauthDebugError && <div className="debug-error">{oauthDebugError}</div>}

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
