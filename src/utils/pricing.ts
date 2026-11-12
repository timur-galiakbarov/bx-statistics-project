import type { PaymentPlan } from '../api/types';

/** Порядок показа стандартных сроков. */
export const TERM_PLAN_IDS = ['month', 'quarter', 'year'] as const;
export type TermPlanId = (typeof TERM_PLAN_IDS)[number];

const termOrder = new Map<PaymentPlan['id'], number>([
  ['month', 0],
  ['quarter', 1],
  ['year', 2]
]);

export function isTermPlanId(value: unknown): value is TermPlanId {
  return typeof value === 'string' && (TERM_PLAN_IDS as readonly string[]).includes(value);
}

/** Только сроки подписки: без суток и админского теста. */
export function getTermPlans(plans: PaymentPlan[]) {
  return plans
    .filter((plan) => isTermPlanId(plan.id))
    .sort((left, right) => (termOrder.get(left.id) ?? 99) - (termOrder.get(right.id) ?? 99));
}

/** Разница с покупкой того же срока по месячному тарифу. Не скидка. */
export function getTermSavingsRub(plan: PaymentPlan, monthPlan?: PaymentPlan) {
  if (!monthPlan || !plan.months || plan.months <= 1) {
    return null;
  }

  const savings = monthPlan.priceRub * plan.months - plan.priceRub;
  return savings > 0 ? savings : null;
}

export function getTermSavingsPercent(plan: PaymentPlan, monthPlan?: PaymentPlan) {
  const savings = getTermSavingsRub(plan, monthPlan);
  if (savings === null) return null;

  const percent = Math.round(100 * savings / (plan.priceRub + savings));
  return percent > 0 ? percent : null;
}

export function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

/** Месячная цена: сервер уже считает её, но для старых ответов оставляем запасной расчёт. */
export function getMonthlyPriceRub(plan: PaymentPlan) {
  if (typeof plan.monthlyPriceRub === 'number') {
    return plan.monthlyPriceRub;
  }

  return plan.months ? Math.round(plan.priceRub / plan.months) : null;
}
