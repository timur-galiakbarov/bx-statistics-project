import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import type { PaymentPlan } from '../api/types';

export const DAY_PLAN_LINK = '/account?plan=day';

export function useDayOffer(place?: 'telegram' | 'competitors') {
  const [price, setPrice] = useState<number>();
  useEffect(() => {
    setPrice(undefined);
    if (!place) return;
    let cancelled = false;
    apiGet<PaymentPlan[]>(`/api/payments/plans?offer=${place}`)
      .then((plans) => {
        if (!cancelled) setPrice(plans.find((plan) => plan.id === 'day')?.priceRub);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [place]);

  return place && price ? `24 часа за ${price} ₽` : undefined;
}

type DayOfferPlace = 'account' | 'telegram' | 'competitors';

/** Один показ за появление предложения: хотя бы половина кнопки видна в активной вкладке. */
export function useDayOfferImpression<T extends HTMLElement>(place?: DayOfferPlace) {
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    if (!element || !place || typeof IntersectionObserver === 'undefined') return;

    let recorded = false;
    const observer = new IntersectionObserver((entries) => {
      if (recorded || document.visibilityState !== 'visible') return;
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;

      recorded = true;
      observer.disconnect();
      void apiPost('/api/account/ui-event', { event: 'day_plan_offer_shown', label: place }).catch(() => undefined);
    }, { threshold: 0.5 });

    const observeVisibleTab = () => {
      observer.disconnect();
      observer.takeRecords();
      if (!recorded && document.visibilityState === 'visible') observer.observe(element);
    };

    observeVisibleTab();
    document.addEventListener('visibilitychange', observeVisibleTab);
    return () => {
      recorded = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', observeVisibleTab);
    };
  }, [element, place]);

  return setElement;
}
