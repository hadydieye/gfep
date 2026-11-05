import type { ApiResult } from './types';

// Wrapper fetch côté navigateur : passe par les rewrites same-origin /api/v1,
// le cookie de session httpOnly est joint automatiquement.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init?.headers);
    if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(`/api/v1${path}`, {
      credentials: 'include',
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
      return { ok: false, status: response.status, message };
    }
    const data = response.status === 204 ? undefined : await response.json();
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
