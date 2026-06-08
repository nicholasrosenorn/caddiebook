import { AuthError, pull, pushChanges } from '../api/client';
import {
  applyServerRow,
  getCursor,
  getDirtyCount,
  getDirtyRows,
  markRowsClean,
  setCursor,
  setLastSyncedAt,
  SYNC_TABLES,
} from './db';
import type { WireChange } from './wire';

// Framework-agnostic sync engine. The React provider subscribes for state; any
// caller (AppState listener, round-finish) can fire syncNow() directly.

export type SyncStatus = 'idle' | 'syncing' | 'error';
export type SyncState = {
  /** 'error' = the last sync attempt failed (transient/offline); a retry is scheduled. */
  status: SyncStatus;
  lastSyncedAt: string | null;
  dirtyCount: number;
  /** Bumps whenever a sync applied remote changes — screens watch it to reload. */
  dataRevision: number;
  /** User-facing message from the last failed sync; cleared on success. */
  lastError: string | null;
  /** ISO time the next backoff retry will fire, or null when none is pending. */
  nextRetryAt: string | null;
};

let state: SyncState = {
  status: 'idle',
  lastSyncedAt: null,
  dirtyCount: 0,
  dataRevision: 0,
  lastError: null,
  nextRetryAt: null,
};

const listeners = new Set<(s: SyncState) => void>();
const authErrorListeners = new Set<() => void>();

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

export function getState(): SyncState {
  return state;
}

export function subscribe(listener: (s: SyncState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

// Fires when the session is unrecoverable — the provider signs the user out.
export function onAuthError(cb: () => void): () => void {
  authErrorListeners.add(cb);
  return () => authErrorListeners.delete(cb);
}

let inFlight: Promise<void> | null = null;

// Exponential backoff for transient failures: 5s, 10s, 20s, 40s, 60s (capped).
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// Schedule the next backoff retry. attempt counter advances until a success
// resets it; the delay is capped so retries don't drift past a minute apart.
function scheduleRetry(): void {
  clearRetryTimer();
  const delay = Math.min(BASE_DELAY_MS * 2 ** retryAttempt, MAX_DELAY_MS);
  retryAttempt++;
  setState({ nextRetryAt: new Date(Date.now() + delay).toISOString() });
  retryTimer = setTimeout(() => {
    void syncNow();
  }, delay);
}

// Stop any pending retry without resetting the attempt counter — used when the
// app backgrounds (foreground re-drives a sync) and before sign-out.
export function cancelRetry(): void {
  clearRetryTimer();
  if (state.nextRetryAt !== null) setState({ nextRetryAt: null });
}

// Debounced auto-sync. Every local write (db/mutation-events) calls this; rapid
// tap-entry (score grid, putts) coalesces into one push ~1.5s after activity
// settles. Session-agnostic — the provider only wires it up while signed in, so
// it never fires a sign-out-inducing AuthError when logged out.
const AUTO_SYNC_DEBOUNCE_MS = 1_500;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSync(): void {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void syncNow();
  }, AUTO_SYNC_DEBOUNCE_MS);
}

// Drop a pending debounced sync (on sign-out and when backgrounding — foreground
// re-drives a full sync).
export function cancelScheduledSync(): void {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
}

// Push local changes then pull remote ones. Concurrent calls coalesce onto the
// in-flight run. Network/offline errors surface as status 'error' and schedule a
// backoff retry (rows stay dirty); only an unrecoverable AuthError forces sign-out.
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<void> {
  // An immediate run supersedes any scheduled retry.
  clearRetryTimer();
  setState({ status: 'syncing' });
  try {
    await pushDirty();
    const applied = await pullAll();

    const now = new Date().toISOString();
    await setLastSyncedAt(now);
    retryAttempt = 0;
    setState({
      status: 'idle',
      lastSyncedAt: now,
      dirtyCount: await getDirtyCount(),
      dataRevision: applied > 0 ? state.dataRevision + 1 : state.dataRevision,
      lastError: null,
      nextRetryAt: null,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      // Sign-out handles recovery; don't leave a stale error or schedule retries.
      setState({ status: 'idle', lastError: null, nextRetryAt: null });
      for (const cb of authErrorListeners) cb();
      return;
    }
    // Offline / transient: surface it, keep dirty rows, and retry with backoff.
    setState({
      status: 'error',
      lastError: e instanceof Error ? e.message : 'Sync failed',
      dirtyCount: await getDirtyCount().catch(() => state.dirtyCount),
    });
    scheduleRetry();
  }
}

async function pushDirty(): Promise<void> {
  const batches: { table: WireChange['table']; rows: Awaited<ReturnType<typeof getDirtyRows>> }[] = [];
  const changes: WireChange[] = [];
  for (const { table } of SYNC_TABLES) {
    const rows = await getDirtyRows(table);
    if (rows.length === 0) continue;
    batches.push({ table, rows });
    for (const row of rows) changes.push({ table, row });
  }
  if (changes.length === 0) return;
  await pushChanges(changes);
  // Clear dirty only after the server has the rows.
  for (const { table, rows } of batches) await markRowsClean(table, rows);
}

async function pullAll(): Promise<number> {
  let since = await getCursor();
  let applied = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await pull(since);
    for (const change of res.changes) {
      await applyServerRow(change.table, change.row);
      applied++;
    }
    since = res.nextCursor;
    await setCursor(since);
    hasMore = res.hasMore;
  }
  return applied;
}

// Recompute the dirty badge after local writes without a full sync.
export async function refreshDirtyCount(): Promise<void> {
  setState({ dirtyCount: await getDirtyCount() });
}
