'use client';

// The Admin login response returns the CSRF token directly in its JSON
// body (unlike the Consumer realm, which sets it as a readable cookie) —
// so this tab has to hold onto it itself to send back on later mutating
// requests. sessionStorage keeps it for the tab's lifetime and drops it on
// close, which is a reasonable match for an 8-hour admin session.
const CSRF_KEY = 'wyn_admin_csrf';

export function setCsrfToken(token: string): void {
  sessionStorage.setItem(CSRF_KEY, token);
}

export function clearCsrfToken(): void {
  sessionStorage.removeItem(CSRF_KEY);
}

function csrfToken(): string {
  return sessionStorage.getItem(CSRF_KEY) ?? '';
}

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { data: T; request_id: string };

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

/**
 * All requests are same-origin (/admin/v1/*, proxied to the API by
 * next.config.ts) so the __Host- admin session cookie is sent
 * automatically; this only needs to attach the CSRF header for mutations.
 */
export async function adminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const mutating = method !== 'GET';
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(mutating ? { 'x-admin-csrf-token': csrfToken() } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | ApiResult<T>
    | { error: ApiError }
    | null;
  if (!response.ok) {
    const code =
      body && 'error' in body ? body.error.code : `HTTP_${response.status}`;
    throw new AdminApiError(response.status, code);
  }
  return (body as ApiResult<T>).data;
}
