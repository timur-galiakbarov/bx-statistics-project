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
  scope?: string | number;
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

type VkImplicitCallbackBody = {
  accessToken?: string;
  expiresIn?: number;
  userId?: number;
  state?: string;
  scope?: string | number;
};

const vkPermissionBits = {
  notify: 1,
  friends: 2,
  photos: 4,
  video: 16,
  pages: 128,
  status: 1024,
  notes: 2048,
  messages: 4096,
  wall: 8192,
  ads: 32768,
  offline: 65536,
  docs: 131072,
  groups: 262144,
  notifications: 524288,
  stats: 1048576,
  email: 4194304
};

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  path: '/'
};

export const authRouter = Router();

function redirectToLoginWithError(res: Parameters<Parameters<typeof authRouter.get>[1]>[1], error: string, details?: string) {
  const redirectUrl = new URL('/login', env.authSuccessRedirectUrl);
  redirectUrl.searchParams.set('authError', error);

  if (details) {
    redirectUrl.searchParams.set('details', details);
  }

  res.clearCookie(env.oauthStateCookie, { path: '/' });
  res.redirect(redirectUrl.toString());
}

class VkUserFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VkUserFetchError';
  }
}

function normalizeVkScopes(scope: string | number | undefined) {
  if (typeof scope === 'number') {
    return Object.entries(vkPermissionBits)
      .filter(([, bit]) => Boolean(scope & bit))
      .map(([permission]) => permission);
  }

  if (typeof scope === 'string' && scope.trim()) {
    if (/^\d+$/.test(scope)) {
      return normalizeVkScopes(Number(scope));
    }

    return scope
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function buildVkAuthorizeUrl(options: {
  responseType: 'code' | 'token';
  redirectUrl: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: env.vkClientId,
    redirect_uri: options.redirectUrl,
    response_type: options.responseType,
    scope: env.vkAuthScope,
    state: options.state,
    v: '5.131'
  });

  if (env.vkForceRevoke) {
    params.set('revoke', '1');
  }

  return `https://oauth.vk.com/authorize?${params.toString()}`;
}

async function fetchVkUser(accessToken: string, userId: number) {
  const usersParams = new URLSearchParams({
    access_token: accessToken,
    user_ids: String(userId),
    fields: 'photo_200',
    v: '5.131'
  });
  const usersResponse = await fetch(`https://api.vk.com/method/users.get?${usersParams.toString()}`);
  const usersPayload = (await usersResponse.json()) as VkUsersResponse;
  const vkUser = usersPayload.response?.[0];

  if (!usersResponse.ok || usersPayload.error || !vkUser) {
    throw new VkUserFetchError(usersPayload.error?.error_msg ?? 'VK_USER_FETCH_FAILED');
  }

  return vkUser;
}

async function createVkSession(options: {
  accessToken: string;
  userId: number;
  expiresIn?: number;
  scope?: string | number;
}) {
  const vkUser = await fetchVkUser(options.accessToken, options.userId);
  const user = await upsertVkUser({
    vkId: String(vkUser.id),
    firstName: vkUser.first_name,
    lastName: vkUser.last_name,
    photo: vkUser.photo_200
  });

  await saveVkToken({
    userId: user.id,
    accessToken: options.accessToken,
    scopes: normalizeVkScopes(options.scope),
    expiresIn: options.expiresIn
  });

  return createSession(user.id);
}

authRouter.get('/vk/start', (_req, res) => {
  const state = randomBytes(24).toString('hex');

  res.cookie(env.oauthStateCookie, state, {
    ...sessionCookieOptions,
    maxAge: 10 * 60 * 1000
  });
  res.redirect(buildVkAuthorizeUrl({ responseType: 'code', redirectUrl: env.vkPublicRedirectUrl, state }));
});

authRouter.get('/vk/implicit-start', (_req, res) => {
  const state = randomBytes(24).toString('hex');

  res.cookie(env.oauthStateCookie, state, {
    ...sessionCookieOptions,
    maxAge: 10 * 60 * 1000
  });
  res.redirect(buildVkAuthorizeUrl({ responseType: 'token', redirectUrl: env.vkImplicitRedirectUrl, state }));
});

authRouter.get('/vk/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const expectedState = req.cookies?.[env.oauthStateCookie];

    if (!code || !state || !expectedState || state !== expectedState) {
      res.status(400).json({
        success: false,
        error: 'INVALID_OAUTH_STATE',
        message:
          'Не совпала OAuth state cookie. Начните вход с того же адреса фронта, куда VK возвращает callback.',
        details: {
          hasCode: Boolean(code),
          hasState: Boolean(state),
          hasExpectedState: Boolean(expectedState),
          stateMatches: Boolean(state && expectedState && state === expectedState),
          callbackHost: req.headers.host,
          expectedCallbackUrl: env.vkPublicRedirectUrl
        }
      });
      return;
    }

    if (!env.vkClientSecret) {
      res.status(500).json({ success: false, error: 'VK_CLIENT_SECRET_REQUIRED' });
      return;
    }

    const tokenParams = new URLSearchParams({
      client_id: env.vkClientId,
      client_secret: env.vkClientSecret,
      redirect_uri: env.vkPublicRedirectUrl,
      code
    });

    const tokenResponse = await fetch(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);
    const tokenPayload = (await tokenResponse.json()) as VkTokenResponse;

    if (!tokenResponse.ok || tokenPayload.error) {
      redirectToLoginWithError(
        res,
        'VK_TOKEN_EXCHANGE_FAILED',
        tokenPayload.error_description ?? tokenPayload.error
      );
      return;
    }

    const session = await createVkSession({
      accessToken: tokenPayload.access_token,
      userId: tokenPayload.user_id,
      expiresIn: tokenPayload.expires_in,
      scope: tokenPayload.scope
    });

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

authRouter.post('/vk/implicit-callback', async (req, res, next) => {
  try {
    const body = req.body as VkImplicitCallbackBody;
    const expectedState = req.cookies?.[env.oauthStateCookie];

    if (!body.accessToken || !body.userId || !body.state || !expectedState || body.state !== expectedState) {
      res.status(400).json({
        success: false,
        error: 'INVALID_OAUTH_STATE',
        message:
          'Не совпала OAuth state cookie для implicit flow. Начните вход с того же адреса фронта, куда VK возвращает callback.',
        details: {
          hasAccessToken: Boolean(body.accessToken),
          hasUserId: Boolean(body.userId),
          hasState: Boolean(body.state),
          hasExpectedState: Boolean(expectedState),
          stateMatches: Boolean(body.state && expectedState && body.state === expectedState),
          callbackHost: req.headers.host,
          expectedCallbackUrl: env.vkImplicitRedirectUrl
        }
      });
      return;
    }

    const session = await createVkSession({
      accessToken: body.accessToken,
      userId: body.userId,
      expiresIn: body.expiresIn,
      scope: body.scope
    });

    res.clearCookie(env.oauthStateCookie, { path: '/' });
    res.cookie(env.sessionCookie, session.token, {
      ...sessionCookieOptions,
      expires: session.expiresAt
    });
    res.json({ success: true, data: { redirectUrl: env.authSuccessRedirectUrl } });
  } catch (error) {
    if (error instanceof VkUserFetchError) {
      res.status(502).json({
        success: false,
        error: 'VK_USER_FETCH_FAILED',
        details: error.message
      });
      return;
    }

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
