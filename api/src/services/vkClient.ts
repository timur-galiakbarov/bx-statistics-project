const VK_API_BASE_URL = 'https://api.vk.com/method';
const VK_API_VERSION = '5.131';
const VK_TOO_MANY_REQUESTS_CODE = 6;
const VK_PERMISSION_DENIED_CODES = new Set([7, 15]);
const VK_RETRY_DELAYS_MS = [450, 900, 1500];

type VkApiPayload<T> = {
  response?: T;
  error?: {
    error_code: number;
    error_msg: string;
    request_params?: Array<{ key: string; value: string }>;
  };
};

export class VkApiError extends Error {
  status: number;
  code: string;
  vkCode?: number;

  constructor(message: string, options: { status?: number; code?: string; vkCode?: number } = {}) {
    super(message);
    this.name = 'VkApiError';
    this.status = options.status ?? 502;
    this.code = options.code ?? 'VK_API_ERROR';
    this.vkCode = options.vkCode;
  }
}

/** VK uses both 7 (permission denied) and 15 (access denied) for restricted data. */
export function isVkPermissionDeniedError(error: unknown): error is VkApiError {
  return error instanceof VkApiError && VK_PERMISSION_DENIED_CODES.has(error.vkCode ?? -1);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function performVkApiRequest<T>(
  method: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined>
) {
  const query = new URLSearchParams({
    access_token: accessToken,
    v: VK_API_VERSION
  });

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  const response = await fetch(`${VK_API_BASE_URL}/${method}?${query.toString()}`);
  const payload = (await response.json()) as VkApiPayload<T>;

  if (!response.ok || payload.error) {
    throw new VkApiError(payload.error?.error_msg ?? 'VK API request failed', {
      vkCode: payload.error?.error_code
    });
  }

  if (payload.response === undefined) {
    throw new VkApiError('VK API returned an empty response');
  }

  return payload.response;
}

export async function vkApiRequest<T>(
  method: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined>
) {
  for (let attempt = 0; attempt <= VK_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await performVkApiRequest<T>(method, accessToken, params);
    } catch (error) {
      if (
        error instanceof VkApiError &&
        error.vkCode === VK_TOO_MANY_REQUESTS_CODE &&
        attempt < VK_RETRY_DELAYS_MS.length
      ) {
        await delay(VK_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw error;
    }
  }

  throw new VkApiError('VK API request failed');
}
