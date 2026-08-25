import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { attachUser } from './middleware/auth.js';
import { accountRouter } from './routes/account.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter } from './routes/auth.js';
import { compareRouter } from './routes/compare.js';
import { dashboardRouter } from './routes/dashboard.js';
import { legacyRouter } from './routes/legacy.js';
import { paymentsRouter } from './routes/payments.js';
import { postsRouter } from './routes/posts.js';
import { vkRouter } from './routes/vk.js';
import { VkApiError } from './services/vkClient.js';
import { DomainError } from './errors/domainError.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use(attachUser);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'socstat-api' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/compare', compareRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/vk', vkRouter);
  app.use('/controllers', legacyRouter);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof DomainError) {
      res.status(error.status).json({
        success: false,
        error: error.code,
        message: error.message
      });
      return;
    }

    if (error instanceof VkApiError) {
      res.status(error.status).json({
        success: false,
        error: error.code,
        message: error.message,
        vkCode: error.vkCode
      });
      return;
    }

    console.error(error);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  });

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'NOT_FOUND' });
  });

  return app;
}
