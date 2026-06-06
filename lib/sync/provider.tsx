import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { signInWithApple, signInWithGoogle, signOut } from '../auth/providers';
import { clearSession, type Session } from '../auth/tokens';
import {
  cancelRetry,
  getState,
  onAuthError,
  refreshDirtyCount,
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

  useEffect(() => subscribe(setSyncState), []);

  // Unrecoverable auth failure → drop tokens (keep local data) and gate to sign-in.
  useEffect(
    () =>
      onAuthError(() => {
        clearSession().finally(() => setSession(null));
      }),
    [],
  );

  // First-run: if already signed in, refresh the badge and sync once.
  useEffect(() => {
    if (sessionRef.current) {
      void refreshDirtyCount();
      void syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground → sync when signed in; background → stop the retry timer
  // (foreground re-drives a sync and will reschedule if it still fails).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        if (sessionRef.current) void syncNow();
      } else {
        cancelRetry();
      }
    });
    return () => sub.remove();
  }, []);

  const signInApple = useCallback(async () => {
    setSession(await signInWithApple());
    await refreshDirtyCount();
    void syncNow();
  }, []);

  const signInGoogle = useCallback(async () => {
    setSession(await signInWithGoogle());
    await refreshDirtyCount();
    void syncNow();
  }, []);

  const doSignOut = useCallback(async () => {
    cancelRetry(); // no timer should fire syncNow() once the session is gone
    await signOut();
    setSession(null);
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({ session, syncState, signInApple, signInGoogle, signOut: doSignOut, syncNow }),
    [session, syncState, signInApple, signInGoogle, doSignOut],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
