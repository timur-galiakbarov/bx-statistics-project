import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { PaymentPlan } from '../api/types';

export const DAY_PLAN_LINK = '/account?plan=day';

export function useDayOffer(place?: 'telegram' | 'competitors') {
  const [price, setPrice] = useState<number>();
  useEffect(() => {
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
