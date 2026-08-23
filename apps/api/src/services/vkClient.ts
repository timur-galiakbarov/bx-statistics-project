const VK_API_BASE_URL = 'https://api.vk.com/method';
const VK_API_VERSION = '5.131';

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

export async function vkApiRequest<T>(
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
