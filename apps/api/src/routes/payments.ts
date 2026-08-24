import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { requireUser } from '../middleware/auth.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';

export const paymentsRouter = Router();

const plans = [
  { id: 'month', title: '1 месяц', months: 1, priceRub: 299, monthlyPriceRub: 299 },
  { id: 'quarter', title: '3 месяца', months: 3, priceRub: 499, monthlyPriceRub: 166 },
  { id: 'year', title: '1 год', months: 12, priceRub: 1399, monthlyPriceRub: 116 }
];

type YooMoneyCallback = {
  notification_type?: string;
  operation_id?: string;
  amount?: string;
  withdraw_amount?: string;
  currency?: string;
  datetime?: string;
  sender?: string;
  codepro?: string;
  label?: string;
  sha1_hash?: string;
};

function findPlanByAmount(amount: number) {
  return plans.find((plan) => plan.priceRub === amount);
}

function getPaymentIdFromLabel(label?: string) {
  const prefix = 'socstat-payment:';

  if (!label?.startsWith(prefix)) {
    return undefined;
  }

  return label.slice(prefix.length);
}

function buildYooMoneyHashPayload(payload: YooMoneyCallback) {
  return [
    payload.notification_type ?? '',
    payload.operation_id ?? '',
    payload.amount ?? '',
    payload.currency ?? '',
    payload.datetime ?? '',
    payload.sender ?? '',
    payload.codepro ?? '',
    env.yoomoneyNotificationSecret,
    payload.label ?? ''
  ].join('&');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyYooMoneyCallback(payload: YooMoneyCallback) {
  if (!env.yoomoneyNotificationSecret) {
    return false;
  }

  if (!payload.sha1_hash || !payload.label) {
    return false;
  }

  const hash = createHash('sha1').update(buildYooMoneyHashPayload(payload)).digest('hex');
  return safeEqual(hash, payload.sha1_hash);
}

function extendActiveTo(currentActiveTo: Date, months: number) {
  const now = new Date();
  const base = currentActiveTo > now ? new Date(currentActiveTo) : now;

  base.setDate(base.getDate() + 1);
  base.setMonth(base.getMonth() + months);
  base.setHours(0, 0, 0, 0);

  return base;
}

paymentsRouter.get('/plans', (_req, res) => {
  res.json({
    success: true,
    data: plans
  });
});

paymentsRouter.get('/history', requireUser, async (req, res, next) => {
  try {
    const payments = await PaymentModel.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(20).lean();

    res.json({
      success: true,
      data: payments.map((payment) => ({
        id: payment._id.toString(),
        provider: payment.provider,
        amount: payment.amount,
        period: payment.period,
        status: payment.status,
        providerTransactionId: payment.providerTransactionId,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get('/admin/history', requireUser, async (req, res, next) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }

  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const paymentQuery = status !== 'all' ? { status } : {};
    const payments = await PaymentModel.find(paymentQuery)
      .populate<{ userId: { _id: Types.ObjectId; vkId: string; firstName: string; lastName: string; activeTo: Date } }>(
        'userId',
        'vkId firstName lastName activeTo'
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const normalizedQuery = query.toLowerCase();
    const filteredPayments = normalizedQuery
      ? payments.filter((payment) => {
          const user = payment.userId;
          const haystack = [
            payment._id.toString(),
            payment.providerTransactionId,
            payment.period,
            payment.status,
            user?.vkId,
            user?.firstName,
            user?.lastName
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        })
      : payments;

    res.json({
      success: true,
      data: filteredPayments.map((payment) => ({
        id: payment._id.toString(),
        provider: payment.provider,
        amount: payment.amount,
        period: payment.period,
        status: payment.status,
        providerTransactionId: payment.providerTransactionId,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        user: payment.userId
          ? {
              id: payment.userId._id.toString(),
              vkId: payment.userId.vkId,
              name: `${payment.userId.firstName} ${payment.userId.lastName}`,
              activeTo: payment.userId.activeTo.toISOString().slice(0, 10)
            }
          : null
      }))
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/create', requireUser, async (req, res, next) => {
  try {
    const plan = plans.find((item) => item.id === req.body?.planId);
    const paymentType = req.body?.paymentType === 'PC' ? 'PC' : 'AC';

    if (!plan) {
      res.status(400).json({ success: false, error: 'UNKNOWN_PAYMENT_PLAN', message: 'Неизвестный тариф.' });
      return;
    }

    const payment = await PaymentModel.create({
      userId: req.user!.id,
      provider: 'yoomoney',
      amount: plan.priceRub,
      period: plan.title,
      status: 'pending'
    });
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : 'http://localhost:5173';

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        provider: 'yoomoney',
        action: 'https://yoomoney.ru/quickpay/confirm.xml',
        method: 'POST',
        fields: {
          receiver: '410011867702471',
          formcomment: 'socstat.ru',
          'short-dest': `оплата периода ${plan.title}`,
          label: `socstat-payment:${payment.id}`,
          'quickpay-form': 'shop',
          targets: `Для пользователя ${req.user!.firstName} ${req.user!.lastName}`,
          successURL: `${origin}/account?payment=success`,
          sum: String(plan.priceRub),
          'need-fio': 'false',
          'need-email': 'false',
          'need-phone': 'false',
          'need-address': 'false',
          paymentType
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/callback', async (req, res, next) => {
  try {
    const payload = req.body as YooMoneyCallback;

    if (!verifyYooMoneyCallback(payload)) {
      res.status(403).json({ success: false, error: 'INVALID_YOOMONEY_SIGNATURE' });
      return;
    }

    const paymentId = getPaymentIdFromLabel(payload.label);

    if (!paymentId) {
      res.status(400).json({ success: false, error: 'INVALID_PAYMENT_LABEL' });
      return;
    }

    const payment = await PaymentModel.findById(paymentId);

    if (!payment) {
      res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
      return;
    }

    if (payment.status === 'paid') {
      res.json({ success: true, data: { status: 'already_paid' } });
      return;
    }

    if (payload.operation_id) {
      const existingPaidPayment = await PaymentModel.findOne({
        _id: { $ne: payment._id },
        provider: 'yoomoney',
        providerTransactionId: payload.operation_id,
        status: 'paid'
      });

      if (existingPaidPayment) {
        payment.status = 'failed';
        payment.rawCallbackPayload = payload;
        payment.providerTransactionId = payload.operation_id;
        await payment.save();

        res.status(409).json({ success: false, error: 'PAYMENT_OPERATION_ALREADY_PROCESSED' });
        return;
      }
    }

    const paidAmount = Number(payload.withdraw_amount ?? payload.amount);
    const plan = findPlanByAmount(paidAmount);

    if (!plan || payment.amount !== plan.priceRub) {
      payment.status = 'failed';
      payment.rawCallbackPayload = payload;
      payment.providerTransactionId = payload.operation_id;
      await payment.save();

      res.status(400).json({ success: false, error: 'PAYMENT_AMOUNT_MISMATCH' });
      return;
    }

    const user = await UserModel.findById(payment.userId);

    if (!user) {
      res.status(404).json({ success: false, error: 'PAYMENT_USER_NOT_FOUND' });
      return;
    }

    user.activeTo = extendActiveTo(user.activeTo, plan.months);
    payment.status = 'paid';
    payment.providerTransactionId = payload.operation_id;
    payment.rawCallbackPayload = payload;

    await Promise.all([user.save(), payment.save()]);

    res.json({
      success: true,
      data: {
        status: 'paid',
        activeTo: user.activeTo.toISOString().slice(0, 10)
      }
    });
  } catch (error) {
    next(error);
  }
});
