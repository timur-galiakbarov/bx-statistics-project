import { Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import type { PaymentPlan, ReportPassState } from '../api/types';

export const REPORT_PASS_OFFER_ID = 'report-pass-offer';

export function useMonthPrice() {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    apiGet<PaymentPlan[]>('/api/payments/plans')
      .then((plans) => setPrice(plans.find((plan) => plan.id === 'month')?.priceRub ?? null))
      .catch(() => undefined);
  }, []);
  return price;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

/** «сегодня в 14:20», «завтра в 9:05» или «31 октября в 14:20». */
export function formatPassMoment(value: string) {
  const date = new Date(value);
  const time = date.toLocaleTimeString('ru-RU', { hour: 'numeric', minute: '2-digit' });
  const dayKey = (shift: number) => new Date(Date.now() + shift * 86_400_000).toDateString();
  if (date.toDateString() === dayKey(0)) return `сегодня в ${time}`;
  if (date.toDateString() === dayKey(1)) return `завтра в ${time}`;
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${time}`;
}

export function formatPassDay(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function isReportPassFor(pass: ReportPassState | null | undefined, platform: string, sourceId: string | number) {
  return pass?.status === 'active' && pass.platform === platform && pass.sourceId === String(sourceId).replace(/^-/, '');
}

export function reportPassLink(pass: Extract<ReportPassState, { status: 'active' }>) {
  return `/analytics?groupId=${encodeURIComponent(pass.sourceId)}&platform=${pass.platform}&section=summary`;
}

export function tariffLabel(price: number | null) {
  return price ? `Тариф от ${formatNumber(price)} ₽ в месяц` : 'Выбрать тариф';
}

/** Click on a locked block while the pass is available: point at its button instead of the payment page. */
export function highlightReportPassOffer() {
  const offer = document.getElementById(REPORT_PASS_OFFER_ID);
  if (!offer) return false;
  offer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  offer.classList.remove('report-pass-highlight');
  // Перезапуск анимации подсветки при повторном клике.
  void offer.offsetWidth;
  offer.classList.add('report-pass-highlight');
  return true;
}

/** Thin notice above a full report opened by the pass. */
export function ReportPassNotice({ expiresAt }: { expiresAt: string }) {
  const price = useMonthPrice();
  return <div className="panel span-2 report-pass-notice">
    <Ticket size={20} />
    <span><strong>Открыто по бесплатному пропуску</strong> · до {formatPassMoment(expiresAt)}. Все источники без ограничений — на тарифе.</span>
    <Link className="secondary-button" to="/account">{tariffLabel(price)}</Link>
  </div>;
}
