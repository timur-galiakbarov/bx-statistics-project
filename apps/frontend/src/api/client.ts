export type ApiResult<T> = {
  success?: boolean;
  data: T;
};

const apiBase = import.meta.env.VITE_API_BASE ?? '';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  const result = (await response.json()) as ApiResult<T>;
  return result.data;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${path}`);
  }

  const result = (await response.json()) as ApiResult<T>;
  return result.data;
}
