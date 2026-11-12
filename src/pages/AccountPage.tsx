import { ChevronDown, Clock3, CreditCard, LogOut, MessageCircle, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';
import { useDayOfferImpression } from '../components/DayPlanOffer';
import { PushSettings } from '../components/PushPrompt';
import { VkReportSettings } from '../components/VkReports';
import type { PaymentHistoryItem, PaymentIntent, PaymentPlan, SavedGroup, User } from '../api/types';
import { formatAccessEnd } from '../utils/date';
import { formatRub, getTermPlans, getTermSavingsPercent, getTermSavingsRub, isTermPlanId, type TermPlanId } from '../utils/pricing';

type Props = {
  user: User | null;
  groups: SavedGroup[];
  hasPaidAccess: boolean;
  onAccountChanged: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export function AccountPage({ user, groups, hasPaidAccess, onAccountChanged, onLogout }: Props) {
  const [searchParams] = useSearchParams();
  const isPaymentReturn = searchParams.get('payment') === 'success';
  const requestedPlan = searchParams.get('plan');
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<TermPlanId>(() => (isTermPlanId(requestedPlan) ? requestedPlan : 'year'));
  const [paymentType, setPaymentType] = useState<'AC' | 'PC'>('AC');
  const [message, setMessage] = useState<string | null>(null);
  const [creatingPlanId, setCreatingPlanId] = useState<PaymentPlan['id'] | null>(null);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const dayPlanRef = useRef<HTMLDivElement>(null);

  const loadPaymentHistory = () => apiGet<PaymentHistoryItem[]>('/api/payments/history').then(setPayments);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<PaymentPlan[]>('/api/payments/plans?offer=account'), apiGet<PaymentHistoryItem[]>('/api/payments/history')])
      .then(([nextPlans, nextPayments]) => {
        if (cancelled) return;
        setPlans(nextPlans);
        setPayments(nextPayments);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Не удалось загрузить данные оплаты.');
      });
    return () => { cancelled = true; };
  }, [user?.id, user?.activeTo, user?.activeToExact, hasPaidAccess]);

  useEffect(() => {
    if (isTermPlanId(requestedPlan)) {
      setSelectedTermId(requestedPlan);
    }
  }, [requestedPlan]);

  const termPlans = getTermPlans(plans);
  const dayPlan = plans.find((plan) => plan.id === 'day');
  const dayOfferRef = useDayOfferImpression<HTMLButtonElement>(dayPlan ? 'account' : undefined);
  const adminTestPlan = plans.find((plan) => plan.id === 'admin-test');
  const monthPlan = termPlans.find((plan) => plan.id === 'month');
  const yearPlan = termPlans.find((plan) => plan.id === 'year');
  const yearlySavings = yearPlan ? getTermSavingsRub(yearPlan, monthPlan) : null;
  const yearlyMonthlyTotal = yearPlan && yearlySavings !== null ? yearPlan.priceRub + yearlySavings : null;
  const selectedTerm = termPlans.find((plan) => plan.id === selectedTermId) ?? monthPlan ?? termPlans[0];
  const termOptions = termPlans.map((plan) => ({ plan, savings: getTermSavingsPercent(plan, monthPlan) }));

  useEffect(() => {
    if (requestedPlan === 'day' && dayPlan) {
      dayPlanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [requestedPlan, dayPlan?.id]);

  const accessStatus = hasPaidAccess ? `Активен до ${formatAccessEnd(user?.activeTo, user?.activeToExact)}` : 'Доступ не активен';
  const paymentsCount = payments.length >= 20 ? '20+' : String(payments.length);
  const isCreatingPayment = creatingPlanId !== null;

  const submitPaymentForm = (intent: PaymentIntent) => {
    const form = document.createElement('form');
    form.action = intent.action;
    form.method = intent.method;
    form.target = '_self';

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

  const createPayment = async (plan: PaymentPlan) => {
    setCreatingPlanId(plan.id);
    setMessage(null);

    try {
      const intent = await apiPost<PaymentIntent>('/api/payments/create', {
        planId: plan.id,
        paymentType
      });
      submitPaymentForm(intent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось перейти к оплате.');
    } finally {
      setCreatingPlanId(null);
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
    <div className="pricing-page">
      <div className="pricing-layout">
        <div className="pricing-main">
          <section className="panel pricing-panel">
            <div className="pricing-head">
              <div>
                <span className="eyebrow">Тариф Socstat</span>
                <h2>Полный доступ Socstat</h2>
              </div>
              <div className={hasPaidAccess ? 'pricing-access-chip active' : 'pricing-access-chip'}>
                <i />
                {accessStatus}
              </div>
            </div>

            {isPaymentReturn && (
              <div className="payment-return-banner pricing-return-banner">
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

            <div className={yearlyMonthlyTotal === null ? 'pricing-pass' : 'pricing-pass with-comparison'}>
              <div className="pricing-pass-copy">
                <h3>
                  {yearlySavings === null ? 'Аналитика любых сообществ' : (
                    <>Год аналитики на <em>{formatRub(yearlySavings)} ₽</em> дешевле</>
                  )}
                </h3>
                <p>Следите за конкурентами, сравнивайте каналы и находите лучшие публикации во ВКонтакте, Telegram и YouTube.</p>
              </div>
              {yearPlan && monthPlan && yearlyMonthlyTotal !== null && (
                <div className="pricing-comparison" aria-label="Стоимость доступа за год">
                  <div>
                    <div className="pricing-comparison-label">
                      <span>{yearPlan.months} оплат по {formatRub(monthPlan.priceRub)} ₽</span>
                      <strong>{formatRub(yearlyMonthlyTotal)} ₽</strong>
                    </div>
                    <div className="pricing-comparison-bar" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="pricing-comparison-label">
                      <span>Одна оплата за год</span>
                      <strong>{formatRub(yearPlan.priceRub)} ₽</strong>
                    </div>
                    <div className="pricing-comparison-bar yearly" aria-hidden="true"
                      style={{ width: `${yearPlan.priceRub / yearlyMonthlyTotal * 100}%` }} />
                  </div>
                  <small>Полный доступ в обоих вариантах</small>
                </div>
              )}
            </div>

            <div className="pricing-term-card">
              <div>
                <h3>Выберите срок доступа</h3>
                {termOptions.length > 0 ? (
                  <>
                    <div className="pricing-term-options" role="radiogroup" aria-label="Срок доступа">
                      {termOptions.map(({ plan, savings }) => (
                        <label className="pricing-term-option" key={plan.id}>
                          <span className="pricing-term-heading">
                            <input
                              checked={selectedTerm?.id === plan.id}
                              disabled={isCreatingPayment}
                              name="accessTerm"
                              type="radio"
                              value={plan.id}
                              onChange={() => {
                                setSelectedTermId(plan.id as TermPlanId);
                                setMessage(null);
                              }}
                            />
                            <span>{plan.title}</span>
                          </span>
                          <strong className="pricing-term-price">{formatRub(plan.priceRub)} ₽</strong>
                          {savings !== null && <span className="pricing-term-savings">Выгода {savings}%</span>}
                        </label>
                      ))}
                    </div>
                    {termOptions.some(({ savings }) => savings !== null) && (
                      <p className="pricing-fine">Выгода по сравнению с помесячной оплатой за тот же срок.</p>
                    )}
                  </>
                ) : (
                  <div className="empty-state">{message ? 'Тарифы временно недоступны.' : 'Загружаем тарифы…'}</div>
                )}
              </div>
              <div className="pricing-payment-actions">
                <div className="pricing-payment-method">
                  <label htmlFor="account-payment-method">Способ оплаты</label>
                  <div className="pricing-method-control">
                    {paymentType === 'AC' ? <CreditCard size={16} aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
                    <select
                      disabled={isCreatingPayment || plans.length === 0}
                      id="account-payment-method"
                      value={paymentType}
                      onChange={(event) => setPaymentType(event.currentTarget.value === 'PC' ? 'PC' : 'AC')}
                    >
                      <option value="AC">Банковская карта</option>
                      <option value="PC">Кошелёк ЮMoney</option>
                    </select>
                    <ChevronDown size={14} aria-hidden="true" />
                  </div>
                </div>
                {selectedTerm && (
                  <>
                    <button
                      className="primary-button pricing-pay-button"
                      disabled={isCreatingPayment}
                      type="button"
                      onClick={() => createPayment(selectedTerm)}
                    >
                      {creatingPlanId === selectedTerm.id ? 'Готовим оплату' : `Оплатить ${formatRub(selectedTerm.priceRub)} ₽`}
                    </button>
                    <p className="pricing-fine">
                      {hasPaidAccess
                        ? 'Оплаченный срок добавится к текущему доступу.'
                        : 'Доступ откроется после подтверждения оплаты.'}
                      {' Оплата разовая.'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {dayPlan && (
              <div className={requestedPlan === 'day' ? 'pricing-day-plan is-requested' : 'pricing-day-plan'} ref={dayPlanRef}>
                <span className="pricing-day-icon"><Clock3 size={21} aria-hidden="true" /></span>
                <div className="pricing-day-plan-copy">
                  <h3>Нужен отчёт сегодня?</h3>
                  <p>24 часа полного доступа с момента подтверждения оплаты. Разовый платёж.</p>
                </div>
                <button
                  className="secondary-button"
                  disabled={isCreatingPayment}
                  type="button"
                  ref={dayOfferRef}
                  onClick={() => createPayment(dayPlan)}
                >
                  {creatingPlanId === dayPlan.id ? 'Готовим оплату' : `Открыть на сутки за ${formatRub(dayPlan.priceRub)} ₽`}
                </button>
              </div>
            )}

            {adminTestPlan && (
              <div className="pricing-test-plan">
                <div className="pricing-day-plan-copy">
                  <h3>Тестовый режим</h3>
                  <p>{adminTestPlan.durationLabel ?? adminTestPlan.title} доступа</p>
                </div>
                <button
                  className="secondary-button"
                  disabled={isCreatingPayment}
                  type="button"
                  onClick={() => createPayment(adminTestPlan)}
                >
                  {creatingPlanId === adminTestPlan.id ? 'Готовим оплату' : `Купить тест за ${formatRub(adminTestPlan.priceRub)} ₽`}
                </button>
              </div>
            )}

            {message && <div className="form-message" role="status">{message}</div>}
          </section>
        </div>

        <aside className="pricing-rail">
          <section className="panel pricing-account-panel">
            <h2>Мой аккаунт</h2>
            <div className="pricing-account-profile">
              <div className="pricing-account-avatar">{user?.first_name?.[0] ?? 'S'}</div>
              <div>
                <strong>{user?.userFullName ?? 'Гость'}</strong>
                <span className={hasPaidAccess ? 'pricing-account-status active' : 'pricing-account-status'}>{accessStatus}</span>
              </div>
            </div>
            <div className="pricing-account-meta">
              <div><span>Сохранённых сообществ</span><b>{groups.length}</b></div>
              <div><span>Оплат</span><b>{paymentsCount}</b></div>
              <div><span>Способ входа</span><b>{user?.vkId ? 'ВКонтакте' : '—'}</b></div>
            </div>
            <button className="secondary-button pricing-account-logout" type="button" onClick={() => void onLogout()}>
              <LogOut size={17} />
              Выйти
            </button>
          </section>

          <section className="panel pricing-settings-panel">
            <h2>Настройки</h2>
            <PushSettings />
            {user?.vkReports?.enabled && <VkReportSettings settings={user.vkReports} onChanged={onAccountChanged} />}
          </section>

          <section className="panel pricing-help-panel">
            <h2>Нужна помощь?</h2>
            <p>Если оплата не прошла или доступ не открылся, напишите в поддержку.</p>
            <a className="secondary-button" href="https://vk.com/socstat_ru" target="_blank" rel="noreferrer">
              <MessageCircle size={17} />
              Написать в VK
            </a>
          </section>
        </aside>
      </div>

      <section className="panel pricing-history">
        <div className="panel-header compact">
          <div>
            <h2>История оплат</h2>
            <p>Подтверждённые платежи за доступ к сервису.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Обновить историю оплат" onClick={refreshPaymentStatus} disabled={isRefreshingPayment}>
            <RefreshCw size={17} className={isRefreshingPayment ? 'spin' : undefined} />
          </button>
        </div>

        {payments.length === 0 && <div className="empty-state">Оплат пока нет.</div>}

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
