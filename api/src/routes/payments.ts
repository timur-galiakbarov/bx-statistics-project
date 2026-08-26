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

type PaymentActionResult = {
  status: string;
  activeTo?: string;
};

type AdminUserAccessAction = 'set' | 'add_days' | 'add_months';

type AdminPaymentsMonthlySummary = {
  current: { count: number; amount: number };
  previous: { count: number; amount: number };
};

function findPlanByAmount(amount: number) {
  return plans.find((plan) => plan.priceRub === amount);
}

function findPlanByPeriod(period: string) {
  return plans.find((plan) => plan.title === period);
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

function extendActiveToByDays(currentActiveTo: Date, days: number) {
  const now = new Date();
  const base = currentActiveTo > now ? new Date(currentActiveTo) : now;

  base.setDate(base.getDate() + days);
  base.setHours(0, 0, 0, 0);

  return base;
}

function parseAccessDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapAdminUser(user: {
  _id: Types.ObjectId;
  vkId: string;
  firstName: string;
  lastName: string;
  activeTo: Date;
}) {
  return {
    id: user._id.toString(),
    vkId: user.vkId,
    name: `${user.firstName} ${user.lastName}`,
    activeTo: user.activeTo.toISOString().slice(0, 10)
  };
}

function ensureAdmin(req: Parameters<Parameters<typeof paymentsRouter.get>[1]>[0], res: Parameters<Parameters<typeof paymentsRouter.get>[1]>[1]) {
  if (req.user!.isAdmin) {
    return true;
  }

  res.status(403).json({ success: false, error: 'FORBIDDEN' });
  return false;
}

function getMonthRange() {
  const now = new Date();
  const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const nextStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return { previousStart, currentStart, nextStart };
}

async function getAdminPaymentsMonthlySummary(): Promise<AdminPaymentsMonthlySummary> {
  const { previousStart, currentStart, nextStart } = getMonthRange();
  const totals = await PaymentModel.aggregate<{
    _id: 'current' | 'previous';
    count: number;
    amount: number;
  }>([
    {
      $addFields: {
        paymentDate: { $ifNull: ['$paidAt', '$createdAt'] }
      }
    },
    {
      $match: {
        status: 'paid',
        paymentDate: { $gte: previousStart, $lt: nextStart }
      }
    },
    {
      $project: {
        amount: 1,
        period: {
          $cond: [{ $gte: ['$paymentDate', currentStart] }, 'current', 'previous']
        }
      }
    },
    {
      $group: {
        _id: '$period',
        count: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    }
  ]);

  const byPeriod = new Map(totals.map((item) => [item._id, item]));
  const empty = { count: 0, amount: 0 };

  return {
    current: byPeriod.get('current') ?? empty,
    previous: byPeriod.get('previous') ?? empty
  };
}

function mapAdminPayment(payment: {
  _id: Types.ObjectId;
  provider: string;
  amount: number;
  period: string;
  status: string;
  providerTransactionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId?: {
    _id: Types.ObjectId;
    vkId: string;
    firstName: string;
    lastName: string;
    activeTo: Date;
  } | null;
}) {
  return {
    id: payment._id.toString(),
    provider: payment.provider,
    amount: payment.amount,
    period: payment.period,
    status: payment.status,
    providerTransactionId: payment.providerTransactionId,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    user: payment.userId
      ? mapAdminUser(payment.userId)
      : null
  };
}

async function updateUserAccess(
  userId: string,
  options: { action: AdminUserAccessAction; value?: unknown }
) {
  const user = await UserModel.findById(userId);

  if (!user) {
    return null;
  }

  if (options.action === 'set') {
    const nextDate = parseAccessDate(options.value);

    if (!nextDate) {
      return { error: 'INVALID_ACCESS_DATE' as const };
    }

    user.activeTo = nextDate;
  } else if (options.action === 'add_days') {
    const days = Number(options.value);

    if (!Number.isInteger(days) || days < 1 || days > 3660) {
      return { error: 'INVALID_ACCESS_DAYS' as const };
    }

    user.activeTo = extendActiveToByDays(user.activeTo, days);
  } else if (options.action === 'add_months') {
    const months = Number(options.value);

    if (!Number.isInteger(months) || months < 1 || months > 120) {
      return { error: 'INVALID_ACCESS_MONTHS' as const };
    }

    user.activeTo = extendActiveTo(user.activeTo, months);
  } else {
    return { error: 'INVALID_ACCESS_ACTION' as const };
  }

  await user.save();

  return {
    user: mapAdminUser({
      _id: user._id,
      vkId: user.vkId ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      activeTo: user.activeTo
    })
  };
}

async function confirmPayment(paymentId: string, options: { operationId?: string; rawPayload?: unknown } = {}): Promise<PaymentActionResult> {
  const payment = await PaymentModel.findById(paymentId);

  if (!payment) {
    return { status: 'not_found' };
  }

  if (payment.status === 'paid') {
    return { status: 'already_paid' };
  }

  const plan = findPlanByPeriod(payment.period);

  if (!plan || payment.amount !== plan.priceRub) {
    payment.status = 'failed';
    payment.rawCallbackPayload = options.rawPayload ?? {
      source: 'admin',
      reason: 'PAYMENT_PLAN_MISMATCH'
    };
    await payment.save();
    return { status: 'amount_mismatch' };
  }

  const user = await UserModel.findById(payment.userId);

  if (!user) {
    return { status: 'user_not_found' };
  }

  user.activeTo = extendActiveTo(user.activeTo, plan.months);
  payment.status = 'paid';
  payment.providerTransactionId = options.operationId ?? payment.providerTransactionId;
  payment.rawCallbackPayload = options.rawPayload ?? {
    source: 'admin',
    confirmedAt: new Date().toISOString()
  };

  await Promise.all([user.save(), payment.save()]);

  return {
    status: 'paid',
    activeTo: user.activeTo.toISOString().slice(0, 10)
  };
}

async function cancelPayment(paymentId: string, reason?: string): Promise<PaymentActionResult> {
  const payment = await PaymentModel.findById(paymentId);

  if (!payment) {
    return { status: 'not_found' };
  }

  if (payment.status === 'failed') {
    return { status: 'already_failed' };
  }

  payment.status = 'failed';
  payment.rawCallbackPayload = {
    ...(typeof payment.rawCallbackPayload === 'object' && payment.rawCallbackPayload !== null
      ? payment.rawCallbackPayload
      : {}),
    adminCancel: {
      reason: reason?.trim() || 'Отменено администратором',
      canceledAt: new Date().toISOString()
    }
  };
  await payment.save();

  return { status: 'failed' };
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
  if (!ensureAdmin(req, res)) {
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
      data: filteredPayments.map(mapAdminPayment)
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get('/admin/summary', requireUser, async (req, res, next) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  try {
    res.json({ success: true, data: await getAdminPaymentsMonthlySummary() });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/admin/users/:userId/access', requireUser, async (req, res, next) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  try {
    const action = req.body?.action as AdminUserAccessAction;
    const result = await updateUserAccess(req.params.userId, {
      action,
      value: req.body?.value
    });

    if (!result) {
      res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      return;
    }

    if ('error' in result) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/admin/:paymentId/confirm', requireUser, async (req, res, next) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  try {
    const result = await confirmPayment(req.params.paymentId, {
      operationId: typeof req.body?.operationId === 'string' ? req.body.operationId.trim() || undefined : undefined,
      rawPayload: {
        source: 'admin',
        confirmedBy: req.user!.id,
        confirmedAt: new Date().toISOString(),
        note: typeof req.body?.note === 'string' ? req.body.note.trim() : undefined
      }
    });

    if (result.status === 'not_found') {
      res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
      return;
    }

    if (result.status === 'user_not_found') {
      res.status(404).json({ success: false, error: 'PAYMENT_USER_NOT_FOUND' });
      return;
    }

    if (result.status === 'amount_mismatch') {
      res.status(400).json({ success: false, error: 'PAYMENT_AMOUNT_MISMATCH' });
      return;
    }

    const payment = await PaymentModel.findById(req.params.paymentId)
      .populate<{ userId: { _id: Types.ObjectId; vkId: string; firstName: string; lastName: string; activeTo: Date } }>(
        'userId',
        'vkId firstName lastName activeTo'
      )
      .lean();

    res.json({
      success: true,
      data: {
        status: result.status,
        activeTo: result.activeTo,
        payment: payment ? mapAdminPayment(payment) : null
      }
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/admin/:paymentId/cancel', requireUser, async (req, res, next) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  try {
    const result = await cancelPayment(
      req.params.paymentId,
      typeof req.body?.reason === 'string' ? req.body.reason : undefined
    );

    if (result.status === 'not_found') {
      res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
      return;
    }

    const payment = await PaymentModel.findById(req.params.paymentId)
      .populate<{ userId: { _id: Types.ObjectId; vkId: string; firstName: string; lastName: string; activeTo: Date } }>(
        'userId',
        'vkId firstName lastName activeTo'
      )
      .lean();

    res.json({
      success: true,
      data: {
        status: result.status,
        payment: payment ? mapAdminPayment(payment) : null
      }
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

    if (!env.yoomoneyReceiver) {
      res.status(503).json({ success: false, error: 'PAYMENTS_NOT_CONFIGURED', message: 'Оплата временно недоступна.' });
      return;
    }

    const payment = await PaymentModel.create({
      userId: req.user!.id,
      provider: 'yoomoney',
      amount: plan.priceRub,
      period: plan.title,
      status: 'pending'
    });
    res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        provider: 'yoomoney',
        action: 'https://yoomoney.ru/quickpay/confirm.xml',
        method: 'POST',
        fields: {
          receiver: env.yoomoneyReceiver,
          formcomment: env.yoomoneyFormComment,
          'short-dest': `оплата периода ${plan.title}`,
          label: `socstat-payment:${payment.id}`,
          'quickpay-form': 'shop',
          targets: `Для пользователя ${req.user!.firstName} ${req.user!.lastName}`,
          successURL: env.yoomoneySuccessUrl,
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

    const result = await confirmPayment(payment.id, {
      operationId: payload.operation_id,
      rawPayload: payload
    });

    if (result.status === 'user_not_found') {
      res.status(404).json({ success: false, error: 'PAYMENT_USER_NOT_FOUND' });
      return;
    }

    res.json({
      success: true,
      data: {
        status: result.status,
        activeTo: result.activeTo
      }
    });
  } catch (error) {
    next(error);
  }
});
