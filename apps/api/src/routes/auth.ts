import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import {
  createSession,
  getDemoUser,
  removeSession,
  saveVkToken,
  upsertVkUser
} from '../repositories/accountRepository.js';

type VkTokenResponse = {
  access_token: string;
  expires_in?: number;
  user_id: number;
  email?: string;
  error?: string;
  error_description?: string;
};

type VkUsersResponse = {
  response?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    photo_200?: string;
  }>;
  error?: {
    error_code: number;
    error_msg: string;
  };
};

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  path: '/'
};

export const authRouter = Router();

authRouter.get('/vk/start', (_req, res) => {
  const state = randomBytes(24).toString('hex');
  const params = new URLSearchParams({
    client_id: env.vkClientId,
    redirect_uri: env.vkRedirectUrl,
    response_type: 'code',
    scope: 'groups,stats,photos,video,wall',
    state,
    v: '5.131'
  });

  res.cookie(env.oauthStateCookie, state, {
    ...sessionCookieOptions,
    maxAge: 10 * 60 * 1000
  });
  res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
});

authRouter.get('/vk/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const expectedState = req.cookies?.[env.oauthStateCookie];

    if (!code || !state || !expectedState || state !== expectedState) {
      res.status(400).json({ success: false, error: 'INVALID_OAUTH_STATE' });
      return;
    }

    if (!env.vkClientSecret) {
      res.status(500).json({ success: false, error: 'VK_CLIENT_SECRET_REQUIRED' });
      return;
    }

    const tokenParams = new URLSearchParams({
      client_id: env.vkClientId,
      client_secret: env.vkClientSecret,
      redirect_uri: env.vkRedirectUrl,
      code
    });

    const tokenResponse = await fetch(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);
    const tokenPayload = (await tokenResponse.json()) as VkTokenResponse;

    if (!tokenResponse.ok || tokenPayload.error) {
      res.status(502).json({
        success: false,
        error: 'VK_TOKEN_EXCHANGE_FAILED',
        details: tokenPayload.error_description ?? tokenPayload.error
      });
      return;
    }

    const usersParams = new URLSearchParams({
      access_token: tokenPayload.access_token,
      user_ids: String(tokenPayload.user_id),
      fields: 'photo_200',
      v: '5.131'
    });
    const usersResponse = await fetch(`https://api.vk.com/method/users.get?${usersParams.toString()}`);
    const usersPayload = (await usersResponse.json()) as VkUsersResponse;
    const vkUser = usersPayload.response?.[0];

    if (!usersResponse.ok || usersPayload.error || !vkUser) {
      res.status(502).json({
        success: false,
        error: 'VK_USER_FETCH_FAILED',
        details: usersPayload.error?.error_msg
      });
      return;
    }

    const user = await upsertVkUser({
      vkId: String(vkUser.id),
      firstName: vkUser.first_name,
      lastName: vkUser.last_name,
      photo: vkUser.photo_200
    });
    await saveVkToken({
      userId: user.id,
      accessToken: tokenPayload.access_token,
      scopes: ['groups', 'stats', 'photos', 'video', 'wall'],
      expiresIn: tokenPayload.expires_in
    });

    const session = await createSession(user.id);

    res.clearCookie(env.oauthStateCookie, { path: '/' });
    res.cookie(env.sessionCookie, session.token, {
      ...sessionCookieOptions,
      expires: session.expiresAt
    });
    res.redirect(env.authSuccessRedirectUrl);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/dev', async (_req, res, next) => {
  try {
    if (env.nodeEnv === 'production') {
      res.status(404).json({ success: false, error: 'NOT_FOUND' });
      return;
    }

    const user = await getDemoUser();
    if (!user) {
      res.status(404).json({ success: false, error: 'DEMO_USER_NOT_FOUND' });
      return;
    }

    const session = await createSession(user.id);
    res.cookie(env.sessionCookie, session.token, {
      ...sessionCookieOptions,
      expires: session.expiresAt
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    await removeSession(req.cookies?.[env.sessionCookie]);
    res.clearCookie(env.sessionCookie, { path: '/' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
