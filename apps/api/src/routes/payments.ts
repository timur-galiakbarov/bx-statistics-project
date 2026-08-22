import { Router } from 'express';

export const paymentsRouter = Router();

paymentsRouter.get('/plans', (_req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'month', title: '1 месяц', priceRub: 299 },
      { id: 'quarter', title: '3 месяца', priceRub: 799 },
      { id: 'year', title: '12 месяцев', priceRub: 2490 }
    ]
  });
});

paymentsRouter.post('/callback', (req, res) => {
  res.json({ success: true, received: req.body });
});
