import { env } from '../config/env.js';
import { getUserBySession } from '../repositories/accountRepository.js';
export async function attachUser(req, res, next) {
    try {
        const sessionId = req.cookies?.[env.sessionCookie] ?? req.header('x-socstat-session');
        req.user = await getUserBySession(sessionId);
        next();
    }
    catch (error) {
        next(error);
    }
}
export function requireUser(req, res, next) {
    if (!req.user) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return;
    }
    next();
}
