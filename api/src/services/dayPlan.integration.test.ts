import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import type { Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { hasActiveAccess } from '../middleware/access.js';
import { ActivityEventModel } from '../models/ActivityEvent.js';
import { FeatureFlagModel } from '../models/FeatureFlag.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { mapUser } from '../repositories/accountRepository.js';
import { accountRouter } from '../routes/account.js';
import { paymentsRouter } from '../routes/payments.js';
import { DAY_PLAN_DURATION_MS, DAY_PLAN_PERIOD, dayPlanGroup } from './dayPlan.js';
import { setFeatureMode } from './featureFlags.js';
import { getLegacyPricingUserIds, hasLegacyPricing } from './legacyPricing.js';

type Intent = { paymentId: string; fields: { label: string; sum: string } };

function accountUser(user: { _id: mongoose.Types.ObjectId; activeTo: Date; hasExactAccessEnd?: boolean | null; isAdmin?: boolean | null }) {
  return mapUser({
    _id: user._id,
    activeTo: user.activeTo,
    hasExactAccessEnd: user.hasExactAccessEnd ?? undefined,
    firstName: '',
    lastName: '',
    isAdmin: user.isAdmin ?? false
  });
}

test('дневной тариф: группы, оплата, повтор уведомления, истечение и переход на месяц', {
  skip: !process.env.DAY_PLAN_TEST_MONGO_URI
}, async (t) => {
  const uri = new URL(process.env.DAY_PLAN_TEST_MONGO_URI!);
  assert.equal(uri.hostname, '127.0.0.1');
  assert.equal(uri.pathname, '/socstat_day_plan_test');
  const dbName = `socstat_day_plan_test_${new mongoose.Types.ObjectId()}`;
  await mongoose.connect(uri.href, { dbName });
  let server: Server | undefined;
  t.after(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    try {
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
  await Promise.all([UserModel.init(), PaymentModel.init(), FeatureFlagModel.init(), ActivityEventModel.init()]);
  const original = { receiver: env.yoomoneyReceiver, secret: env.yoomoneyNotificationSecret };
  env.yoomoneyReceiver = 'test-receiver';
  env.yoomoneyNotificationSecret = 'test-secret';
  t.after(() => {
    env.yoomoneyReceiver = original.receiver;
    env.yoomoneyNotificationSecret = original.secret;
  });

  const expired = new Date('2000-01-01T00:00:00.000Z');
  const findId = (group: ReturnType<typeof dayPlanGroup>) => {
    let id = new mongoose.Types.ObjectId();
    while (dayPlanGroup(id.toString()) !== group) id = new mongoose.Types.ObjectId();
    return id;
  };
  const buyerId = findId('offer');
  const controlId = findId('control');
  const olderUserId = new mongoose.Types.ObjectId();
  const otherViewerId = findId('offer');
  const adminId = new mongoose.Types.ObjectId();
  await UserModel.create([
    { _id: buyerId, activeTo: expired, createdAt: new Date('2026-10-08T00:00:00.000+03:00') },
    { _id: controlId, activeTo: expired },
    { _id: olderUserId, activeTo: expired, createdAt: new Date('2026-10-07T23:59:59.999+03:00') },
    { _id: otherViewerId, activeTo: expired, createdAt: new Date('2026-10-08T00:00:00.000+03:00') },
    { _id: adminId, activeTo: expired, isAdmin: true }
  ]);

  const app = express();
  app.use(express.json());
  app.use(async (req, _res, next) => {
    try {
      const actor = req.header('test-actor');
      const user = actor && await UserModel.findById(actor).lean();
      if (user) req.user = accountUser(user);
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use('/account', accountRouter);
  app.use(paymentsRouter);
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ success: false });
  });
  const listener = app.listen(0, '127.0.0.1');
  server = listener;
  await new Promise<void>((resolve, reject) => listener.once('listening', resolve).once('error', reject));
  const { port } = listener.address() as { port: number };
  const call = async <Data = never>(path: string, actor = buyerId, body?: object) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'test-actor': actor.toString() },
      body: body && JSON.stringify(body)
    });
    const { data } = await res.json() as { data: Data };
    return { status: res.status, data };
  };
  const notification = (payment: Intent) => {
    const payload = { label: payment.fields.label, operation_id: payment.paymentId, withdraw_amount: payment.fields.sum };
    const sign = createHmac('sha256', env.yoomoneyNotificationSecret)
      .update(Object.entries(payload).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')).digest('hex');
    return { ...payload, sign };
  };
  const monthPrice = async (actor: mongoose.Types.ObjectId) => {
    const { data } = await call<{ id: string; priceRub: number }[]>('/plans?offer=account', actor);
    return data.find((plan) => plan.id === 'month')?.priceRub;
  };

  await setFeatureMode('dayPlan', 'off', buyerId.toString());
  assert.equal((await call('/create', buyerId, { planId: 'day' })).status, 400);
  await setFeatureMode('dayPlan', 'all', buyerId.toString());
  const plans = (await call<{ id: string; priceRub: number }[]>('/plans?offer=telegram')).data;
  assert.equal(plans.find((plan) => plan.id === 'day')?.priceRub, 249);
  assert.equal((await call('/create', controlId, { planId: 'day' })).status, 400);
  await call('/plans?offer=account', controlId);
  assert.equal((await UserModel.findById(controlId).lean())?.dayPlanExperiment?.group, 'control');

  const statsPath = '/account/admin/day-plan-offer-stats';
  const impression = (actor: mongoose.Types.ObjectId, label: string) =>
    call('/account/ui-event', actor, { event: 'day_plan_offer_shown', label });
  assert.equal((await call(statsPath)).status, 403);
  assert.deepEqual((await call(statsPath, adminId)).data, { days: 30, users: 0, impressions: 0 });
  assert.equal((await impression(buyerId, 'unknown')).status, 400);
  assert.equal((await impression(buyerId, 'telegram')).status, 200);
  assert.equal((await impression(buyerId, 'account')).status, 200);
  assert.equal((await impression(otherViewerId, 'competitors')).status, 200);
  assert.equal((await impression(adminId, 'account')).status, 200);
  assert.equal(await ActivityEventModel.countDocuments({ type: 'day_plan_offer_shown' }), 3);

  await ActivityEventModel.create([
    { userId: controlId, type: 'day_plan_offer_shown', label: 'account', createdAt: new Date(Date.now() - 31 * DAY_PLAN_DURATION_MS) },
    { userId: adminId, type: 'day_plan_offer_shown', label: 'account' },
    { userId: controlId, type: 'access_lock', label: 'telegram' }
  ]);
  assert.deepEqual((await call(statsPath, adminId)).data, { days: 30, users: 2, impressions: 3 });

  const payment = await call<Intent>('/create', buyerId, { planId: 'day' });
  assert.equal(payment.status, 201);
  assert.equal(payment.data.fields.sum, '249');
  await setFeatureMode('dayPlan', 'off', buyerId.toString());
  const callback = notification(payment.data);
  const updatePayment = t.mock.method(PaymentModel, 'updateOne', () => { throw new Error('temporary write failure'); }, { times: 1 });
  assert.equal((await call('/callback', buyerId, callback)).status, 500);
  assert.equal(updatePayment.mock.callCount(), 1);
  const firstGrant = (await UserModel.findById(buyerId).orFail().lean()).activeTo;
  const confirm = (payload: object) => call<{ status: string }>('/callback', buyerId, payload);
  const responses = await Promise.all([confirm(callback), confirm(callback)]);
  assert.deepEqual(responses.map((result) => result.data?.status).sort(), ['already_paid', 'paid']);
  const paid = await PaymentModel.findById(payment.data.paymentId).orFail().lean();
  const user = await UserModel.findById(buyerId).orFail().lean();
  assert.equal(user.activeTo.getTime(), firstGrant.getTime());
  assert.equal(user.activeTo.getTime() - paid.paidAt!.getTime(), DAY_PLAN_DURATION_MS);
  assert.equal(user.pendingGoals.length, 1);
  assert.equal(hasActiveAccess(accountUser(user)), true);
  assert.equal(await hasLegacyPricing(buyerId), false);
  const month = await call<Intent>('/create', buyerId, { planId: 'month' });
  assert.equal(month.data.fields.sum, '699');

  await setFeatureMode('dayPlan', 'all', buyerId.toString());
  assert.equal((await call('/create', buyerId, { planId: 'day' })).status, 400);
  const now = new Date();
  const expiredUser = { ...user, activeTo: now };
  assert.equal(hasActiveAccess(accountUser(expiredUser)), false);
  await UserModel.updateOne({ _id: buyerId }, { $set: { activeTo: now } });
  assert.equal((await call('/create', buyerId, { planId: 'day' })).status, 201);
  assert.equal((await confirm(notification(month.data))).data.status, 'paid');
  const upgraded = await UserModel.findById(buyerId).orFail().lean();
  assert.equal(upgraded.hasExactAccessEnd, false);
  assert.equal(hasActiveAccess(accountUser(upgraded)), true);
  const monthPaid = await PaymentModel.findById(month.data.paymentId).orFail().lean();
  assert.ok(monthPaid.paidAt && monthPaid.paidAt >= now && monthPaid.paidAt.getTime() <= Date.now());
  assert.equal(await hasLegacyPricing(buyerId), false);
  assert.equal(await monthPrice(buyerId), 699);
  assert.equal((await call<Intent>('/create', buyerId, { planId: 'month' })).data.fields.sum, '699');

  assert.equal(await monthPrice(olderUserId), 699);
  await PaymentModel.create({ userId: olderUserId, provider: 'yoomoney', amount: 249, period: DAY_PLAN_PERIOD, status: 'paid' });
  assert.equal(await hasLegacyPricing(olderUserId), false);
  const firstOlderPayment = await call<Intent>('/create', olderUserId, { planId: 'month' });
  assert.equal(firstOlderPayment.data.fields.sum, '699');
  assert.equal(await hasLegacyPricing(olderUserId), false);
  assert.equal((await confirm(notification(firstOlderPayment.data))).data.status, 'paid');
  assert.equal(await monthPrice(olderUserId), 499);
  assert.equal((await call<Intent>('/create', olderUserId, { planId: 'month' })).data.fields.sum, '499');
  assert.deepEqual(await getLegacyPricingUserIds([buyerId, olderUserId]), new Set([olderUserId.toString()]));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await ActivityEventModel.countDocuments({ type: 'payment_started' }) === 6) return;
    await setTimeout(10);
  }
  assert.fail('Не все события начала оплаты записаны');
});
