import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  sessionCookie: process.env.SESSION_COOKIE ?? 'socstat_session',
  oauthStateCookie: process.env.OAUTH_STATE_COOKIE ?? 'socstat_oauth_state',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/socstat',
  mongoServerSelectionTimeoutMs: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS ?? 5000),
  vkClientId: process.env.VK_CLIENT_ID ?? '5358505',
  vkClientSecret: process.env.VK_CLIENT_SECRET ?? '',
  vkAuthScope: process.env.VK_AUTH_SCOPE ?? 'stats,groups,photos,video,offline',
  vkForceRevoke: process.env.VK_FORCE_REVOKE === '1',
  vkRedirectUrl: process.env.VK_REDIRECT_URL ?? 'http://localhost:4000/api/auth/vk/callback',
  vkPublicRedirectUrl:
    process.env.VK_PUBLIC_REDIRECT_URL ??
    process.env.VK_REDIRECT_URL ??
    'http://localhost:4000/api/auth/vk/callback',
  vkImplicitRedirectUrl:
    process.env.VK_IMPLICIT_REDIRECT_URL ?? 'http://localhost:5173/app/auth/vk/implicit-callback',
  authSuccessRedirectUrl: process.env.AUTH_SUCCESS_REDIRECT_URL ?? 'http://localhost:5173/app/dashboard',
  yoomoneyReceiver: process.env.YOOMONEY_RECEIVER ?? '',
  yoomoneyNotificationUrl: process.env.YOOMONEY_NOTIFICATION_URL ?? 'http://localhost:4000/api/payments/callback',
  yoomoneySuccessUrl: process.env.YOOMONEY_SUCCESS_URL ?? 'http://localhost:5173/app/account?payment=success',
  yoomoneyNotificationSecret: process.env.YOOMONEY_NOTIFICATION_SECRET ?? '',
  adminVkIds: (process.env.ADMIN_VK_IDS ?? '30647716')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? 'development'
};
