import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokens';
import { apiUrl } from '../config';
import type {
  AcceptResponse,
  AuthResponse,
  AuthUser,
  BlockedUsersResponse,
  FeedResponse,
  FriendRoundDetail,
  FriendsResponse,
  IncomingRequestsResponse,
  LikeResponse,
  NotificationItem,
  NotificationsResponse,
  ProfileUpdate,
  ProviderName,
  PublicProfile,
  PushResponse,
  RefreshResponse,
  ReportRequest,
  RequestCountResponse,
  RoundLikersResponse,
  SendRequestResponse,
  UserSearchResult,
  WireChange,
} from './types';

// Thrown when the session is unrecoverable (no token, or refresh rejected).
// The provider catches this to force a sign-out. Network failures throw a plain
// Error instead, which the sync engine swallows (retry later).
export class AuthError extends Error {}

// Thrown by updateProfile when the requested username is already in use, so the
// onboarding/edit UI can prompt for a different one.
export class UsernameTakenError extends Error {}

// Thrown by sendFriendRequest so the add-friend UI can give a precise message.
export class UserNotFoundError extends Error {}
export class AlreadyFriendsError extends Error {}

// Thrown when the server rejects a write (422) for objectionable language, so
// the profile UI can show "let's keep it clean" instead of a generic failure.
export class ObjectionableLanguageError extends Error {}

// Thrown by authedRequest for a non-ok response, carrying the status so callers
// (the outbox) can distinguish a permanent 4xx from a transient 5xx/429.
export class ApiStatusError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`request to ${path} failed: ${status}`);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

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
async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await rawRequest('/auth/refresh', { method: 'POST', body: { refreshToken } });
  if (!res.ok) return null;
  const data = (await res.json()) as RefreshResponse;
  await Promise.all([setAccessToken(data.accessToken), setRefreshToken(data.refreshToken)]);
  return data.accessToken;
}

// Single-flight guard around doRefresh. On foreground the app fires many authed
// requests at once (every stale query refetches + the outbox drains); with an
// expired access token they'd all 401 and each call /auth/refresh with the SAME
// rotating refresh token. The server revokes a token on rotation, so the first
// wins and the rest present an already-revoked token — which trips theft
// detection and kills the whole family, forcing a re-login. Collapsing the
// stampede into one in-flight refresh (all callers await it and reuse its token)
// keeps rotation to exactly one hop per access-token expiry.
let refreshInFlight: Promise<string | null> | null = null;

function tryRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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

export async function authedRequest<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const res = await authedRaw(path, method, body);
  if (!res.ok) throw new ApiStatusError(res.status, path);
  return (await res.json()) as T;
}

// --- Auth (unauthenticated) ------------------------------------------------

async function exchangeProviderToken(path: string, body: unknown): Promise<AuthResponse> {
  const res = await rawRequest(path, { method: 'POST', body });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`);
  return (await res.json()) as AuthResponse;
}

// `name` is the provider-supplied name (Apple only returns it on first auth);
// the server uses it to seed a brand-new account and ignores it otherwise.
export function authApple(identityToken: string, name?: ProviderName): Promise<AuthResponse> {
  return exchangeProviderToken('/auth/apple', { identityToken, ...name });
}

export function authGoogle(idToken: string, name?: ProviderName): Promise<AuthResponse> {
  return exchangeProviderToken('/auth/google', { idToken, ...name });
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
  if (res.status === 422) throw new ObjectionableLanguageError('objectionable language');
  if (!res.ok) throw new Error(`profile update failed: ${res.status}`);
  return (await res.json()) as AuthUser;
}

// Permanently delete the signed-in account and everything it owns. Needs a live
// access token, so the caller must invoke this before clearing the session.
export async function deleteAccount(): Promise<void> {
  await authedRequest('/auth/me', 'DELETE');
}

// --- Legacy sync (authenticated) ---------------------------------------------
//
// Only the one-time upgrade flush (lib/migration/legacy-flush.ts) and the dev
// seeder still batch through /sync/push; it goes away with them.

export function pushChanges(changes: WireChange[]): Promise<PushResponse> {
  return authedRequest<PushResponse>('/sync/push', 'POST', { changes });
}

// --- Community (authenticated) ---------------------------------------------

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const { users } = await authedRequest<{ users: UserSearchResult[] }>(
    `/community/users/search?q=${encodeURIComponent(q)}`,
    'GET',
  );
  return users;
}

// Send a friend request by handle. Maps server errors to typed exceptions so the
// UI can react: 404 → unknown user, 409 → already friends.
export async function sendFriendRequest(username: string): Promise<SendRequestResponse> {
  const res = await authedRaw('/community/friend-requests', 'POST', { username });
  if (res.status === 404) throw new UserNotFoundError('user not found');
  if (res.status === 409) throw new AlreadyFriendsError('already friends');
  if (!res.ok) throw new Error(`friend request failed: ${res.status}`);
  return (await res.json()) as SendRequestResponse;
}

export async function listIncomingRequests(): Promise<IncomingRequestsResponse['requests']> {
  const { requests } = await authedRequest<IncomingRequestsResponse>(
    '/community/friend-requests/incoming',
    'GET',
  );
  return requests;
}

export async function getIncomingRequestCount(): Promise<number> {
  const { count } = await authedRequest<RequestCountResponse>(
    '/community/friend-requests/count',
    'GET',
  );
  return count;
}

export function acceptFriendRequest(id: string): Promise<AcceptResponse> {
  return authedRequest<AcceptResponse>(`/community/friend-requests/${id}/accept`, 'POST');
}

export async function declineFriendRequest(id: string): Promise<void> {
  await authedRequest(`/community/friend-requests/${id}/decline`, 'POST');
}

export async function listFriends(): Promise<FriendsResponse['friends']> {
  const { friends } = await authedRequest<FriendsResponse>('/community/friends', 'GET');
  return friends;
}

export async function unfriend(friendUserId: string): Promise<void> {
  await authedRequest(`/community/friends/${friendUserId}`, 'DELETE');
}

export function getFeed(cursor?: string, limit?: number): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const q = params.toString();
  return authedRequest<FeedResponse>(`/community/feed${q ? `?${q}` : ''}`, 'GET');
}

export function getFriendRound(ownerId: string, roundId: string): Promise<FriendRoundDetail> {
  return authedRequest<FriendRoundDetail>(`/community/rounds/${ownerId}/${roundId}`, 'GET');
}

export async function getRoundLikers(
  ownerId: string,
  roundId: string,
): Promise<PublicProfile[]> {
  const { likers } = await authedRequest<RoundLikersResponse>(
    `/community/rounds/${ownerId}/${roundId}/likes`,
    'GET',
  );
  return likers;
}

export function likeRound(ownerId: string, roundId: string): Promise<LikeResponse> {
  return authedRequest<LikeResponse>(`/community/rounds/${ownerId}/${roundId}/like`, 'POST');
}

export function unlikeRound(ownerId: string, roundId: string): Promise<LikeResponse> {
  return authedRequest<LikeResponse>(`/community/rounds/${ownerId}/${roundId}/like`, 'DELETE');
}

// --- Notifications (authenticated) -----------------------------------------

export async function listNotifications(): Promise<NotificationItem[]> {
  const { notifications } = await authedRequest<NotificationsResponse>(
    '/community/notifications',
    'GET',
  );
  return notifications;
}

// --- Moderation (authenticated) --------------------------------------------

export async function blockUser(userId: string): Promise<void> {
  await authedRequest(`/community/users/${userId}/block`, 'POST');
}

export async function unblockUser(userId: string): Promise<void> {
  await authedRequest(`/community/users/${userId}/block`, 'DELETE');
}

export async function listBlockedUsers(): Promise<PublicProfile[]> {
  const { blocked } = await authedRequest<BlockedUsersResponse>('/community/blocks', 'GET');
  return blocked;
}

export async function reportContent(payload: ReportRequest): Promise<void> {
  await authedRequest('/community/reports', 'POST', payload);
}

// --- Push tokens (authenticated) -------------------------------------------

export async function registerPushToken(token: string, platform?: string): Promise<void> {
  await authedRequest('/notifications/token', 'POST', { token, platform });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await authedRequest('/notifications/token', 'DELETE', { token });
}
