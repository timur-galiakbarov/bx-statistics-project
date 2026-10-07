import { getVisitId } from '../utils/visitId';

export type ApiResult<T> = {
  success?: boolean;
  data: T;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiBase = import.meta.env.VITE_API_BASE ?? '';

// Сервер привязывает действия пользователя к текущему визиту для статистики в админке.
const visitHeaders = () => ({ 'X-Socstat-Visit': getVisitId() });

async function getErrorMessage(response: Response, path: string) {
  try {
    const result = (await response.json()) as { message?: string; error?: string };
    return result.message ?? result.error ?? `API ${response.status}: ${path}`;
  } catch {
    return `API ${response.status}: ${path}`;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: visitHeaders()
  });

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response, path), response.status);
  }

  const result = (await response.json()) as ApiResult<T>;
  return result.data;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...visitHeaders()
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response, path), response.status);
  }

  const result = (await response.json()) as ApiResult<T>;
  return result.data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', ...visitHeaders() }, body: JSON.stringify(body) });
  if (!response.ok) throw new ApiError(await getErrorMessage(response, path), response.status);
  return ((await response.json()) as ApiResult<T>).data;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: visitHeaders()
  });

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response, path), response.status);
  }

  const result = (await response.json()) as ApiResult<T>;
  return result.data;
}
