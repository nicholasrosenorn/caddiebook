import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokens';
import { apiUrl } from '../config';
import type {
  AuthResponse,
  PullResponse,
  PushResponse,
  RefreshResponse,
  WireChange,
} from '../sync/wire';

// Thrown when the session is unrecoverable (no token, or refresh rejected).
// The provider catches this to force a sign-out. Network failures throw a plain
// Error instead, which the sync engine swallows (retry later).
export class AuthError extends Error {}

type Method = 'GET' | 'POST';

async function rawRequest(
  path: string,
  opts: { method: Method; body?: unknown; token?: string },
): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    method: opts.method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

// Exchange the refresh token for a fresh access token; null if it can't.
// Refresh rotates server-side, so persist the new refresh token too — the old
// one is now revoked and reusing it would trip the server's theft detection.
async function tryRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await rawRequest('/auth/refresh', { method: 'POST', body: { refreshToken } });
  if (!res.ok) return null;
  const data = (await res.json()) as RefreshResponse;
  await Promise.all([setAccessToken(data.accessToken), setRefreshToken(data.refreshToken)]);
  return data.accessToken;
}

// Authenticated request with one transparent refresh-and-retry on 401.
async function authedRequest<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new AuthError('not signed in');

  let res = await rawRequest(path, { method, body, token });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new AuthError('session expired');
    res = await rawRequest(path, { method, body, token: refreshed });
    if (res.status === 401) throw new AuthError('session expired');
  }
  if (!res.ok) throw new Error(`request to ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

// --- Auth (unauthenticated) ------------------------------------------------

async function exchangeProviderToken(path: string, body: unknown): Promise<AuthResponse> {
  const res = await rawRequest(path, { method: 'POST', body });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`);
  return (await res.json()) as AuthResponse;
}

export function authApple(identityToken: string): Promise<AuthResponse> {
  return exchangeProviderToken('/auth/apple', { identityToken });
}

export function authGoogle(idToken: string): Promise<AuthResponse> {
  return exchangeProviderToken('/auth/google', { idToken });
}

// Revoke the refresh-token family on the server (sign-out). Best-effort: the
// server always 200s, and the caller ignores network failures so offline
// sign-out still clears the device.
export async function logout(refreshToken: string): Promise<void> {
  await rawRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
}

// --- Sync (authenticated) --------------------------------------------------

export function pushChanges(changes: WireChange[]): Promise<PushResponse> {
  return authedRequest<PushResponse>('/sync/push', 'POST', { changes });
}

export function pull(since: number, limit?: number): Promise<PullResponse> {
  const q = limit ? `?since=${since}&limit=${limit}` : `?since=${since}`;
  return authedRequest<PullResponse>(`/sync/pull${q}`, 'GET');
}
