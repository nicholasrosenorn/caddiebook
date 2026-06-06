import * as SecureStore from 'expo-secure-store';

import type { AuthUser } from '../sync/wire';

// Session tokens live in the device keychain/keystore via expo-secure-store.
const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

// Read the stored session. The app trusts this on launch without contacting the
// server, so a cached session keeps the app usable fully offline.
export async function loadSession(): Promise<Session | null> {
  const [accessToken, refreshToken, userRaw] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!accessToken || !refreshToken || !userRaw) return null;
  try {
    return { accessToken, refreshToken, user: JSON.parse(userRaw) as AuthUser };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, token);
}
