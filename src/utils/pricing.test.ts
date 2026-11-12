import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PaymentPlan } from '../api/types';
import { formatRub, getMonthlyPriceRub, getTermPlans, getTermSavingsPercent, getTermSavingsRub, isTermPlanId } from './pricing';

function plan(overrides: Partial<PaymentPlan> & Pick<PaymentPlan, 'id' | 'priceRub'>): PaymentPlan {
  return { title: overrides.id, ...overrides };
}

test('сроки идут месяц → 3 месяца → год, сутки и тест не попадают в выбор', () => {
  const plans = [
    plan({ id: 'year', priceRub: 3990, months: 12 }),
    plan({ id: 'day', priceRub: 249 }),
    plan({ id: 'quarter', priceRub: 1490, months: 3 }),
    plan({ id: 'admin-test', priceRub: 29, days: 15 }),
    plan({ id: 'month', priceRub: 699, months: 1 })
  ];
  assert.deepEqual(getTermPlans(plans).map((item) => item.id), ['month', 'quarter', 'year']);
  assert.equal(isTermPlanId('day'), false);
  assert.equal(isTermPlanId('quarter'), true);
});

test('выгода считается от месячной цены, в том числе на старых ценах', () => {
  const month = plan({ id: 'month', priceRub: 699, months: 1 });
  const quarter = plan({ id: 'quarter', priceRub: 1490, months: 3 });
  const year = plan({ id: 'year', priceRub: 3990, months: 12 });
  assert.equal(getTermSavingsRub(quarter, month), 607);
  assert.equal(getTermSavingsRub(year, month), 4398);
  assert.equal(getTermSavingsRub(month, month), null);
  assert.equal(getTermSavingsRub(plan({ id: 'quarter', priceRub: 899, months: 3 }), plan({ id: 'month', priceRub: 499, months: 1 })), 598);
});

test('месячная цена берётся с сервера и форматируется по-русски', () => {
  assert.equal(getMonthlyPriceRub(plan({ id: 'quarter', priceRub: 1490, months: 3, monthlyPriceRub: 497 })), 497);
  assert.equal(getMonthlyPriceRub(plan({ id: 'quarter', priceRub: 1490, months: 3 })), 497);
  assert.equal(formatRub(1490), '1\u00A0490');
});

test('процент выгоды считается от цены того же срока при помесячной оплате', () => {
  const month = plan({ id: 'month', priceRub: 699, months: 1 });
  const legacyMonth = plan({ id: 'month', priceRub: 499, months: 1 });
  const quarter = plan({ id: 'quarter', priceRub: 1490, months: 3 });
  const year = plan({ id: 'year', priceRub: 3990, months: 12 });
  assert.equal(getTermSavingsPercent(quarter, month), 29);
  assert.equal(getTermSavingsPercent(year, month), 52);
  assert.equal(getTermSavingsPercent({ ...quarter, priceRub: 899 }, legacyMonth), 40);
  assert.equal(getTermSavingsPercent({ ...year, priceRub: 1999 }, legacyMonth), 67);
  assert.equal(getTermSavingsPercent(month, month), null);
  assert.equal(getTermSavingsPercent(year), null);
  assert.equal(getTermSavingsPercent({ ...quarter, priceRub: 3 * month.priceRub }, month), null);
});
