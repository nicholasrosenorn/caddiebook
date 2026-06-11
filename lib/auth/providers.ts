import {
  GoogleSignin,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

import { authApple, authGoogle, logout } from '../api/client';
import { googleIosClientId, googleWebClientId } from '../config';
import { clearSession, getRefreshToken, saveSession, type Session } from './tokens';

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
  const auth = await authApple(credential.identityToken);
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
  const auth = await authGoogle(idToken);
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
