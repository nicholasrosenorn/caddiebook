import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  getMe,
  registerPushToken,
  unregisterPushToken,
  updateProfile as apiUpdateProfile,
} from '@/lib/api/client';
import { onAuthFailure } from '@/lib/auth/events';
import { signInWithApple, signInWithGoogle, signOut } from '@/lib/auth/providers';
import { clearSession, setSessionUser, type Session } from '@/lib/auth/tokens';
import { clearOutbox, drainWithTimeout, initOutbox } from '@/lib/data/outbox';
import { ensureLegacyFlush } from '@/lib/migration/legacy-flush';
import {
  QUERY_PERSIST_MAX_AGE_MS,
  queryClient,
  queryPersister,
  setupQueryEnvironment,
} from '@/lib/data/query-client';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import type { ProfileUpdate } from '@/lib/api/types';

// Session + account context. The server is the source of truth for all data;
// this provider owns who is signed in, wires the outbox to the session, and
// mounts the persisted query cache (busted per user id, so another account can
// never rehydrate this one's data).

type AuthContextValue = {
  session: Session | null;
  signInApple: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession: Session | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Last Expo push token registered this launch, so sign-out can unregister it.
  const pushTokenRef = useRef<string | null>(null);

  // Unrecoverable auth failure (refresh rejected anywhere — a query or the
  // outbox) → drop the session and gate to sign-in. The outbox queue stays
  // persisted for this user's next sign-in.
  useEffect(
    () =>
      onAuthFailure(() => {
        clearSession().finally(() => setSession(null));
      }),
    [],
  );

  // Best-effort refresh of the cached profile from the server. Stays silent on
  // failure (offline, etc.) — the cached session is still trusted.
  const refreshProfile = useCallback(async () => {
    try {
      const user = await getMe();
      setSession((prev) => (prev ? { ...prev, user } : prev));
      await setSessionUser(user);
    } catch {
      // ignore — keep the cached profile
    }
  }, []);

  // Register this device for push (best-effort) and tell the server its token,
  // so friends' completed rounds can notify us.
  const registerPush = useCallback(async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      pushTokenRef.current = token;
      await registerPushToken(token, Platform.OS);
    } catch {
      // ignore — notifications are best-effort
    }
  }, []);

  // First-run: wire focus/online listeners, and if already signed in, start
  // delivering any queued commands and refresh the profile.
  useEffect(() => {
    setupQueryEnvironment();
    const current = sessionRef.current;
    if (current) {
      void initOutbox(current.user.id);
      void ensureLegacyFlush();
      void refreshProfile();
      void registerPush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSignedIn = useCallback(
    async (next: Session) => {
      setSession(next);
      await initOutbox(next.user.id);
      void ensureLegacyFlush();
      void registerPush();
    },
    [registerPush],
  );

  const signInApple = useCallback(async () => {
    await onSignedIn(await signInWithApple());
  }, [onSignedIn]);

  const signInGoogle = useCallback(async () => {
    await onSignedIn(await signInWithGoogle());
  }, [onSignedIn]);

  const doSignOut = useCallback(async () => {
    // Deliver what we can, briefly — then the queue is dropped: sign-out is an
    // explicit "I'm done on this device".
    await drainWithTimeout(5_000);
    // Stop this device receiving pushes — must run before signOut() drops the
    // access token. Best-effort: the server also prunes dead tokens on send.
    const token = pushTokenRef.current ?? (await registerForPushNotificationsAsync());
    if (token) {
      try {
        await unregisterPushToken(token);
      } catch {
        // offline or already gone — ignore
      }
      pushTokenRef.current = null;
    }
    await signOut();
    await clearOutbox();
    queryClient.clear();
    await queryPersister.removeClient();
    setSession(null);
  }, []);

  // Persist a profile edit: write it server-side, then mirror into session state
  // and the keychain so it survives a relaunch.
  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const user = await apiUpdateProfile(patch);
    setSession((prev) => (prev ? { ...prev, user } : prev));
    await setSessionUser(user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signInApple,
      signInGoogle,
      signOut: doSignOut,
      updateProfile,
    }),
    [session, signInApple, signInGoogle, doSignOut, updateProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: QUERY_PERSIST_MAX_AGE_MS,
          buster: session?.user.id ?? 'anon',
        }}>
        {children}
      </PersistQueryClientProvider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// Convenience: the signed-in user id for query keys. Screens behind the Gate
// always have a session; the empty-string fallback only exists for type safety.
export function useUserId(): string {
  const { session } = useAuth();
  return session?.user.id ?? '';
}
