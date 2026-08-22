import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { attachUser } from './middleware/auth.js';
import { accountRouter } from './routes/account.js';
import { legacyRouter } from './routes/legacy.js';
import { paymentsRouter } from './routes/payments.js';
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
    app.use('/api/account', accountRouter);
    app.use('/api/payments', paymentsRouter);
    app.use('/controllers', legacyRouter);
    app.use((error, _req, res, _next) => {
        console.error(error);
        res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    });
    app.use((_req, res) => {
        res.status(404).json({ success: false, error: 'NOT_FOUND' });
    });
    return app;
}
