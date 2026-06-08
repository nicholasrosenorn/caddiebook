import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { onLocalMutation } from '@/db/mutation-events';

import {
  getMe,
  registerPushToken,
  unregisterPushToken,
  updateProfile as apiUpdateProfile,
} from '../api/client';
import { signInWithApple, signInWithGoogle, signOut } from '../auth/providers';
import { registerForPushNotificationsAsync } from '../notifications';
import { clearSession, setSessionUser, type Session } from '../auth/tokens';
import type { ProfileUpdate } from './wire';
import {
  cancelRetry,
  cancelScheduledSync,
  getState,
  onAuthError,
  refreshDirtyCount,
  scheduleSync,
  subscribe,
  syncNow,
  type SyncState,
} from './engine';

type SyncContextValue = {
  session: Session | null;
  syncState: SyncState;
  signInApple: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({
  initialSession,
  children,
}: {
  initialSession: Session | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [syncState, setSyncState] = useState<SyncState>(getState());

  // Mirror the engine's state into React; keep a session ref for the AppState
  // handler so it always sees the latest value without re-subscribing.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Last Expo push token registered this launch, so sign-out can unregister it.
  const pushTokenRef = useRef<string | null>(null);

  useEffect(() => subscribe(setSyncState), []);

  // Unrecoverable auth failure → drop tokens (keep local data) and gate to sign-in.
  useEffect(
    () =>
      onAuthError(() => {
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
  // so friends' completed rounds can notify us. Silent on failure (simulator,
  // denied permission, offline) — the cached token ref lets sign-out clean up.
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

  // First-run: if already signed in, refresh the badge, sync once, pull the
  // latest profile (it may have been edited on another device), and register
  // for push.
  useEffect(() => {
    if (sessionRef.current) {
      void refreshDirtyCount();
      void syncNow();
      void refreshProfile();
      void registerPush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground → sync when signed in; background → stop the retry + any pending
  // debounced sync (foreground re-drives a sync and will reschedule if it fails).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        if (sessionRef.current) void syncNow();
      } else {
        cancelRetry();
        cancelScheduledSync();
      }
    });
    return () => sub.remove();
  }, []);

  // Auto-sync local writes: while signed in, any dirtying mutation schedules a
  // debounced push and refreshes the dirty badge. Subscribed only with a session
  // so signed-out edits stay purely local (no AuthError-driven sign-out).
  useEffect(() => {
    if (!session) return;
    return onLocalMutation(() => {
      void refreshDirtyCount();
      scheduleSync();
    });
  }, [session]);

  const signInApple = useCallback(async () => {
    setSession(await signInWithApple());
    await refreshDirtyCount();
    void syncNow();
    void registerPush();
  }, [registerPush]);

  const signInGoogle = useCallback(async () => {
    setSession(await signInWithGoogle());
    await refreshDirtyCount();
    void syncNow();
    void registerPush();
  }, [registerPush]);

  const doSignOut = useCallback(async () => {
    // No timer should fire syncNow() once the session is gone.
    cancelRetry();
    cancelScheduledSync();
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
    setSession(null);
  }, []);

  // Persist a profile edit: write it server-side, then mirror into session state
  // and the keychain so it survives a relaunch.
  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const user = await apiUpdateProfile(patch);
    setSession((prev) => (prev ? { ...prev, user } : prev));
    await setSessionUser(user);
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({
      session,
      syncState,
      signInApple,
      signInGoogle,
      signOut: doSignOut,
      updateProfile,
      syncNow,
    }),
    [session, syncState, signInApple, signInGoogle, doSignOut, updateProfile],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
