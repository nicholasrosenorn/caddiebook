import {
  GoogleSignin,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { authApple, authGoogle, logout } from '../api/client';
import { googleIosClientId, googleWebClientId } from '../config';
import type { ProviderName } from '../api/types';
import { clearSession, getRefreshToken, saveSession, type Session } from './tokens';

// Empty/whitespace → null so the server stores a real name or nothing.
function cleanName(first?: string | null, last?: string | null): ProviderName {
  const trim = (v?: string | null) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { firstName: trim(first), lastName: trim(last) };
}

let googleConfigured = false;
function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
  });
  googleConfigured = true;
}

// Native Sign in with Apple → verify on the server → persist the session.
export async function signInWithApple(): Promise<Session> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('No Apple identity token returned');
  // Apple only returns fullName on the FIRST authorization — capture it now to
  // prefill the onboarding profile; the server stores it on account creation.
  const name = cleanName(credential.fullName?.givenName, credential.fullName?.familyName);
  const auth = await authApple(credential.identityToken, name);
  const session: Session = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    user: auth.user,
  };
  await saveSession(session);
  return session;
}

// Native Google sign-in → verify on the server → persist the session.
export async function signInWithGoogle(): Promise<Session> {
  ensureGoogleConfigured();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error('Google sign-in was cancelled');
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('No Google id token returned');
  const name = cleanName(response.data.user.givenName, response.data.user.familyName);
  const auth = await authGoogle(idToken, name);
  const session: Session = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    user: auth.user,
  };
  await saveSession(session);
  return session;
}

// Revoke the session server-side, then clear it. The caller (AuthProvider)
// clears the query cache + outbox so a different account can't inherit them.
export async function signOut(): Promise<void> {
  // Best-effort server revocation before we drop the token locally. Don't block
  // sign-out on the network — clearing the device is what matters here.
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await logout(refreshToken);
    } catch {
      // Offline or server unreachable — the token will still be cleared locally.
    }
  }
  await clearSession();
  try {
    ensureGoogleConfigured();
    await GoogleSignin.signOut();
  } catch {
    // Google session may not exist (e.g. signed in via Apple) — ignore.
  }
}
