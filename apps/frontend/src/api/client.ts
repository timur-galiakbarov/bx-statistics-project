export type ApiResult<T> = {
  success?: boolean;
  data: T;
};

const apiBase = import.meta.env.VITE_API_BASE ?? '';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: {
      'x-socstat-session': 'dev'
    }
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  const result = (await response.json()) as ApiResult<T>;
  return result.data;
}
