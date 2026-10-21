export class ApiError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message) }
}

// Browser requests always use the Next.js same-origin rewrite. The backend
// address is configured server-side through BACKEND_URL in next.config.ts.
const API_URL = '/api/v1';
export const AUTH_LOGOUT_EVENT = 'marketplace:auth-logout';
let accessToken: string | null = null;
let sessionExpired = false;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) sessionExpired = false;
  if (typeof window !== 'undefined') {
    if (token) sessionStorage.setItem('access_token', token);
    else sessionStorage.removeItem('access_token');
  }
};

export const getAccessToken = () => accessToken ?? (typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null);

export function clearLocalSession() {
  sessionExpired = true;
  setAccessToken(null);
}

function expireSession() {
  if (sessionExpired) return;
  clearLocalSession();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!response.ok) { expireSession(); return null }
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) { expireSession(); return null }
    setAccessToken(data.access_token);
    return data.access_token;
  } catch {
    expireSession();
    return null;
  }
}

function refresh(): Promise<string | null> {
  if (sessionExpired) return Promise.resolve(null);
  if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null });
  return refreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const requestController = new AbortController();
  const forwardAbort = () => requestController.abort(init.signal?.reason);
  if (init.signal?.aborted) forwardAbort();
  else init.signal?.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(() => requestController.abort(new DOMException('Request timed out', 'TimeoutError')), 12_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include', signal: requestController.signal });
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ApiError(
      timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      0,
      timedOut ? 'Сервер не ответил вовремя' : 'Не удалось связаться с сервером',
    );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', forwardAbort);
  }
  if (response.status === 401 && !retried && await refresh()) return api<T>(path, init, true);
  if (response.status === 401 && retried) expireSession();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = body.error ?? {};
    throw new ApiError(error.code ?? 'REQUEST_FAILED', response.status, error.message ?? 'Не удалось выполнить запрос');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const get = <T>(path: string, init?: RequestInit) => api<T>(path, init);
export const post = <T>(path: string, body: unknown, headers?: HeadersInit) => api<T>(path, { method: 'POST', body: JSON.stringify(body), headers });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const remove = <T>(path: string) => api<T>(path, { method: 'DELETE' });
