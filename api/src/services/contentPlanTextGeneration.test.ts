import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../errors/domainError.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { getContentPlanTextAvailability, reserveContentPlanGeneration } from './contentPlanTextGeneration.js';
import { redis } from './redis.js';

test('генерация учитывает ограничения администратора для текста и изображений', async (t) => {
  const previousKey = process.env.OPEN_AI_SERVICE_KEY;
  process.env.OPEN_AI_SERVICE_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPEN_AI_SERVICE_KEY;
    else process.env.OPEN_AI_SERVICE_KEY = previousKey;
  });

  for (const kind of ['text', 'image'] as const) {
    for (const scenario of [
      { name: 'админ без ограничений', isAdmin: true, enforceAccessRestrictions: false, active: false, unlimited: true },
      { name: 'админ без сохранённой галочки', isAdmin: true, enforceAccessRestrictions: undefined, active: false, unlimited: true },
      { name: 'админ с ограничениями без доступа', isAdmin: true, enforceAccessRestrictions: true, active: false, denied: true },
      { name: 'обычный пользователь без доступа', isAdmin: false, enforceAccessRestrictions: false, active: false, denied: true },
      { name: 'админ с ограничениями на триале', isAdmin: true, enforceAccessRestrictions: true, active: true },
      { name: 'обычный пользователь на триале', isAdmin: false, enforceAccessRestrictions: false, active: true }
    ]) {
      await t.test(`${kind}: ${scenario.name}`, async (st) => {
        const user = {
          isAdmin: scenario.isAdmin,
          enforceAccessRestrictions: scenario.enforceAccessRestrictions,
          activeTo: new Date(Date.now() + (scenario.active ? 86_400_000 : -86_400_000)),
          trialEndsAt: new Date(Date.now() + 86_400_000)
        };
        st.mock.method(UserModel, 'findById', (() => ({
          select: (fields: string) => {
            assert.ok(fields.split(' ').includes('enforceAccessRestrictions'));
            return { lean: async () => user };
          }
        })) as unknown as typeof UserModel.findById);
        const payment = st.mock.method(PaymentModel, 'exists', (async () => null) as unknown as typeof PaymentModel.exists);
        const count = st.mock.method(redis, 'zCount', async () => 0);
        const reserve = st.mock.method(redis, 'eval', async () => 0);

        if (scenario.denied) {
          for (const operation of [getContentPlanTextAvailability, reserveContentPlanGeneration]) {
            await assert.rejects(operation('user-a', kind), (error) =>
              error instanceof DomainError && error.code === 'CONTENT_PLAN_AI_ACCESS');
          }
        } else if (scenario.unlimited) {
          const expected = { period: 'unlimited', remaining: null };
          assert.deepEqual(await getContentPlanTextAvailability('user-a', kind), expected);
          assert.deepEqual(await reserveContentPlanGeneration('user-a', kind), expected);
          assert.equal(payment.mock.calls.length, 0);
        } else {
          const limit = kind === 'text' ? 5 : 3;
          const period = kind === 'text' ? 'day' : 'trial';
          assert.deepEqual(await getContentPlanTextAvailability('user-a', kind), { period, remaining: limit });
          assert.deepEqual(await reserveContentPlanGeneration('user-a', kind), { period, remaining: 0 });
          assert.equal(count.mock.calls.length, 1);
          assert.equal(reserve.mock.calls.length, 1);
          reserve.mock.mockImplementation(async () => -1);
          await assert.rejects(reserveContentPlanGeneration('user-a', kind), (error) =>
            error instanceof DomainError && error.code === 'CONTENT_PLAN_AI_LIMIT');
        }
        if (scenario.denied || scenario.unlimited) {
          assert.equal(count.mock.calls.length, 0);
          assert.equal(reserve.mock.calls.length, 0);
        }
      });
    }
  }
});
