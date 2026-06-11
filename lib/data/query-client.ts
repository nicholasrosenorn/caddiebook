import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { AuthError } from '@/lib/api/client';
import { emitAuthFailure } from '@/lib/auth/events';

import { configureOutbox, drainNow, hasPendingFor } from './outbox';

// One QueryClient for the app. Server data is the source of truth; the cache
// (persisted below) is only a render buffer — stale-while-revalidate with a
// refetch on focus/foreground is what keeps a second device current.

const GC_TIME_MS = 14 * 24 * 60 * 60 * 1_000; // keep offline-readable for 2 weeks

// A query whose data is still optimistically ahead of the server (pending
// outbox commands) must not refetch — the response would clobber taps the
// user just made. The drain-complete invalidation refetches it instead.
const unlessPending = (query: { queryKey: readonly unknown[] }) =>
  hasPendingFor(query.queryKey) ? false : true;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AuthError) emitAuthFailure();
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: GC_TIME_MS,
      retry: (failureCount, error) => !(error instanceof AuthError) && failureCount < 2,
      refetchOnWindowFocus: unlessPending,
      refetchOnReconnect: unlessPending,
    },
  },
});

// When the queue fully drains, pull server truth for everything it touched
// (putt recounts, server-stamped fields) to converge any optimistic drift.
configureOutbox({
  onDrained: (touches) => {
    for (const queryKey of touches) void queryClient.invalidateQueries({ queryKey });
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rq-cache-v1',
});

export const QUERY_PERSIST_MAX_AGE_MS = GC_TIME_MS;

// React Native wiring: "window focus" = app foreground, "online" = expo-network
// state. Both also kick the outbox so queued taps deliver immediately.
let environmentReady = false;
export function setupQueryEnvironment(): void {
  if (environmentReady) return;
  environmentReady = true;

  AppState.addEventListener('change', (status) => {
    const active = status === 'active';
    focusManager.setFocused(active);
    if (active) drainNow();
  });

  Network.addNetworkStateListener((state) => {
    const online = (state.isConnected ?? true) && (state.isInternetReachable ?? true);
    onlineManager.setOnline(online);
    if (online) drainNow();
  });
}
