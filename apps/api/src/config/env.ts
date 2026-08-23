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
  vkRedirectUrl: process.env.VK_REDIRECT_URL ?? 'http://localhost:4000/api/auth/vk/callback',
  authSuccessRedirectUrl: process.env.AUTH_SUCCESS_REDIRECT_URL ?? 'http://localhost:5173/dashboard',
  nodeEnv: process.env.NODE_ENV ?? 'development'
};
