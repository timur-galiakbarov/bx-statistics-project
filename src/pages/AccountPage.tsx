import { CreditCard, LogOut, RefreshCw, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';
import type { PaymentHistoryItem, PaymentIntent, PaymentPlan, SavedGroup, User } from '../api/types';

type Props = {
  user: User | null;
  groups: SavedGroup[];
  onAccountChanged: () => Promise<void>;
};

export function AccountPage({ user, groups, onAccountChanged }: Props) {
  const [searchParams] = useSearchParams();
  const isPaymentReturn = searchParams.get('payment') === 'success';
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<PaymentPlan['id']>('quarter');
  const [paymentType, setPaymentType] = useState<'AC' | 'PC'>('AC');
  const [message, setMessage] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);

  const loadPaymentHistory = () => apiGet<PaymentHistoryItem[]>('/api/payments/history').then(setPayments);

  useEffect(() => {
    Promise.all([apiGet<PaymentPlan[]>('/api/payments/plans'), apiGet<PaymentHistoryItem[]>('/api/payments/history')])
      .then(([nextPlans, nextPayments]) => {
        setPlans(nextPlans);
        setPayments(nextPayments);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Не удалось загрузить данные оплаты.'));
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];

  const submitPaymentForm = (intent: PaymentIntent) => {
    const form = document.createElement('form');
    form.action = intent.action;
    form.method = intent.method;
    form.target = '_blank';

    Object.entries(intent.fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  const createPayment = async () => {
    if (!selectedPlan) {
      setMessage('Выберите тариф.');
      return;
    }

    setIsCreatingPayment(true);
    setMessage(null);

    try {
      const intent = await apiPost<PaymentIntent>('/api/payments/create', {
        planId: selectedPlan.id,
        paymentType
      });
      setPayments((items) => [
        {
          id: intent.paymentId,
          provider: intent.provider,
          amount: selectedPlan.priceRub,
          period: selectedPlan.title,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        ...items
      ]);
      submitPaymentForm(intent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось перейти к оплате.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const refreshPaymentStatus = async () => {
    setIsRefreshingPayment(true);
    setMessage(null);

    try {
      await Promise.all([loadPaymentHistory(), onAccountChanged()]);
      setMessage('Статус оплаты обновлён.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось обновить статус оплаты.');
    } finally {
      setIsRefreshingPayment(false);
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    if (status === 'paid') {
      return 'Оплачен';
    }

    if (status === 'failed') {
      return 'Ошибка';
    }

    if (status === 'pending') {
      return 'Ожидает оплаты';
    }

    return status;
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Оплата</h2>
            <p>Подписка открывает аналитику любых групп без ограничений.</p>
          </div>
          <WalletCards size={24} />
        </div>

        {message && <div className="form-message">{message}</div>}

        {isPaymentReturn && (
          <div className="payment-return-banner">
            <strong>Возврат после оплаты</strong>
            <span>
              Если оплата прошла успешно, ЮMoney отправит уведомление на сервер, и дата доступа обновится после
              подтверждения.
            </span>
            <button className="secondary-button inline" type="button" onClick={refreshPaymentStatus} disabled={isRefreshingPayment}>
              <RefreshCw size={17} className={isRefreshingPayment ? 'spin' : undefined} />
              {isRefreshingPayment ? 'Обновляем' : 'Обновить статус оплаты'}
            </button>
          </div>
        )}

        <div className="billing-current">
          <span>Текущий доступ</span>
          <strong>до {user?.activeTo ?? '-'}</strong>
        </div>

        <div className="plan-grid">
          {plans.map((plan) => (
            <button
              className={selectedPlan?.id === plan.id ? 'plan-card active' : 'plan-card'}
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <span>{plan.title}</span>
              <strong>{plan.priceRub} ₽</strong>
              <small>{plan.monthlyPriceRub} ₽ / месяц</small>
            </button>
          ))}
        </div>

        <div className="payment-methods">
          <label>
            <input
              checked={paymentType === 'AC'}
              name="paymentType"
              type="radio"
              value="AC"
              onChange={() => setPaymentType('AC')}
            />
            Банковская карта
          </label>
          <label>
            <input
              checked={paymentType === 'PC'}
              name="paymentType"
              type="radio"
              value="PC"
              onChange={() => setPaymentType('PC')}
            />
            ЮMoney
          </label>
        </div>

        <button className="primary-button billing-pay-button" type="button" onClick={createPayment} disabled={isCreatingPayment}>
          <CreditCard size={18} />
          {isCreatingPayment ? 'Готовим оплату' : `Оплатить${selectedPlan ? ` ${selectedPlan.priceRub} ₽` : ''}`}
        </button>

        <div className="billing-note">
          После оплаты период подписки суммируется с текущим остатком. Если дата доступа не обновилась сразу, нажмите
          кнопку обновления после возврата с оплаты.
        </div>
      </section>

      <section className="panel">
        <h2>Мой аккаунт</h2>
        <div className="account-card">
          <div className="avatar">{user?.first_name?.[0] ?? 'S'}</div>
          <div>
            <strong>{user?.userFullName ?? 'Гость'}</strong>
            <span>id: {user?.id ?? '-'}</span>
            <span>vk id: {user?.vkId ?? '-'}</span>
            <span>Безлимитная аналитика до {user?.activeTo ?? '-'}</span>
            <span>{groups.length} сохраненных групп</span>
          </div>
        </div>
        <button className="secondary-button">
          <LogOut size={17} />
          Выйти
        </button>
      </section>

      <section className="panel span-2">
        <div className="panel-header compact">
          <div>
            <h2>История оплат</h2>
            <p>Последние платежи и их текущие статусы.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Обновить историю оплат" onClick={refreshPaymentStatus} disabled={isRefreshingPayment}>
            <RefreshCw size={17} className={isRefreshingPayment ? 'spin' : undefined} />
          </button>
        </div>

        {payments.length === 0 && <div className="empty-state">Платежей пока нет.</div>}

        {payments.length > 0 && (
          <div className="table analytics-posts">
            <div className="table-row table-head payment-history-row">
              <span>Дата</span>
              <span>Период</span>
              <span>Сумма</span>
              <span>Статус</span>
              <span>Операция</span>
            </div>
            {payments.map((payment) => (
              <div className="table-row payment-history-row" key={payment.id}>
                <span>{new Date(payment.createdAt).toLocaleString('ru-RU')}</span>
                <span>{payment.period}</span>
                <span>{payment.amount} ₽</span>
                <span className={`payment-status ${payment.status}`}>{getPaymentStatusLabel(payment.status)}</span>
                <span>{payment.providerTransactionId ?? '-'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
