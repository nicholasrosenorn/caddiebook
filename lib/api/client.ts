import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokens';
import { apiUrl } from '../config';
import type {
  AuthResponse,
  AuthUser,
  ProfileUpdate,
  PullResponse,
  PushResponse,
  RefreshResponse,
  WireChange,
} from '../sync/wire';

// Thrown when the session is unrecoverable (no token, or refresh rejected).
// The provider catches this to force a sign-out. Network failures throw a plain
// Error instead, which the sync engine swallows (retry later).
export class AuthError extends Error {}

// Thrown by updateProfile when the requested username is already in use, so the
// onboarding/edit UI can prompt for a different one.
export class UsernameTakenError extends Error {}

type Method = 'GET' | 'POST' | 'PATCH';

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

// Authenticated request with one transparent refresh-and-retry on 401. Returns
// the raw Response so callers that care about specific statuses (e.g. 409) can
// branch before the generic ok-check in authedRequest.
async function authedRaw(path: string, method: Method, body?: unknown): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new AuthError('not signed in');

  let res = await rawRequest(path, { method, body, token });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new AuthError('session expired');
    res = await rawRequest(path, { method, body, token: refreshed });
    if (res.status === 401) throw new AuthError('session expired');
  }
  return res;
}

async function authedRequest<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const res = await authedRaw(path, method, body);
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

// --- Profile (authenticated) -----------------------------------------------

// Current account profile from the server (refreshes what was cached at sign-in).
export function getMe(): Promise<AuthUser> {
  return authedRequest<AuthUser>('/auth/me', 'GET');
}

// Persist the account profile. Throws UsernameTakenError on a 409 so the caller
// can surface "that handle's taken" without treating it as a hard failure.
export async function updateProfile(patch: ProfileUpdate): Promise<AuthUser> {
  const res = await authedRaw('/auth/me', 'PATCH', patch);
  if (res.status === 409) throw new UsernameTakenError('username taken');
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
  return (await res.json()) as AuthUser;
}

// --- Sync (authenticated) --------------------------------------------------

export function pushChanges(changes: WireChange[]): Promise<PushResponse> {
  return authedRequest<PushResponse>('/sync/push', 'POST', { changes });
}

export function pull(since: number, limit?: number): Promise<PullResponse> {
  const q = limit ? `?since=${since}&limit=${limit}` : `?since=${since}`;
  return authedRequest<PullResponse>(`/sync/pull${q}`, 'GET');
}
