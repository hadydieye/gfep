import { cookies } from 'next/headers';
import type { ApiResult } from './types';

// Appels serveur → backend (Server Components uniquement). Le navigateur passe
// par les rewrites /api/v1 ; côté serveur on joint directement le backend en
// relayant le cookie de session.
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
export const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'gfep_session';

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return { ok: false, status: 401 };
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1${path}`, {
      headers: { Cookie: `${sessionCookieName}=${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch {
    // Backend injoignable
    return { ok: false, status: 0 };
  }
}
