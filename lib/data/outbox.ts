import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiStatusError, AuthError, authedRequest } from '@/lib/api/client';
import { emitAuthFailure } from '@/lib/auth/events';
import { uuid } from '@/lib/uuid';

import type { QueryKey } from './keys';

// The write outbox: a persisted FIFO command log. Every data mutation is an
// idempotent PUT/DELETE against /data keyed by a client UUID, applied
// optimistically to the query cache by its hook and enqueued here. The drain
// loop replays commands strictly in order (head-of-line blocking is the
// correctness model — a hole write must never overtake its round's creation)
// and retries with backoff until the server accepts them, so a dead zone
// mid-round never loses a shot. There is no merge logic and no pull cursor:
// the server applies commands in arrival order, last write wins.

export type OutboxEntry = {
  id: string;
  method: 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Query keys to invalidate once the queue fully drains. */
  touches: QueryKey[];
  createdAt: string;
};

type Listener = (pendingCount: number) => void;

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;

let userId: string | null = null;
let entries: OutboxEntry[] = [];
let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
// Touched keys accumulated across the current drain session, invalidated in one
// batch when the queue empties so server truth reconciles the optimistic cache.
let drainedTouches: QueryKey[] = [];
const listeners = new Set<Listener>();

// Wired by query-client.ts (avoids an import cycle): invalidate these keys.
let onDrained: (touches: QueryKey[]) => void = () => {};
export function configureOutbox(opts: { onDrained: (touches: QueryKey[]) => void }): void {
  onDrained = opts.onDrained;
}

function storageKey(uid: string): string {
  return `outbox:v1:${uid}`;
}

function notify(): void {
  for (const l of listeners) l(entries.length);
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  fn(entries.length);
  return () => listeners.delete(fn);
}

export function pendingCount(): number {
  return entries.length;
}

// A query must not refetch (and clobber its optimistic data) while a pending
// command still targets it. Keys compare by serialized equality.
export function hasPendingFor(queryKey: QueryKey): boolean {
  const qk = JSON.stringify(queryKey);
  return entries.some((e) => e.touches.some((t) => JSON.stringify(t) === qk));
}

async function persist(): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(entries));
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// Load the signed-in user's queue and start delivering it.
export async function initOutbox(uid: string): Promise<void> {
  userId = uid;
  retryAttempt = 0;
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    entries = raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    entries = [];
  }
  notify();
  void drain();
}

// Sign-out (or account switch): stop delivering and drop the in-memory queue.
// The persisted key is removed too — commands must never replay under another
// account, and an explicit sign-out already attempted a final drain.
export async function clearOutbox(): Promise<void> {
  clearRetryTimer();
  const uid = userId;
  userId = null;
  entries = [];
  drainedTouches = [];
  notify();
  if (uid) await AsyncStorage.removeItem(storageKey(uid));
}

export async function enqueue(entry: Omit<OutboxEntry, 'id' | 'createdAt'>): Promise<void> {
  if (!userId) return; // signed out — nothing to deliver to
  entries.push({ ...entry, id: uuid(), createdAt: new Date().toISOString() });
  notify();
  await persist();
  void drain();
}

// Kick the queue (foreground, reconnect). Cancels a pending backoff so the
// retry happens now.
export function drainNow(): void {
  clearRetryTimer();
  retryAttempt = 0;
  void drain();
}

// Bounded final drain for sign-out: deliver what we can within `ms`, then stop.
export async function drainWithTimeout(ms: number): Promise<void> {
  await Promise.race([drain(), new Promise<void>((r) => setTimeout(r, ms))]);
}

async function drain(): Promise<void> {
  if (draining || !userId) return;
  draining = true;
  try {
    while (entries.length > 0 && userId) {
      const head = entries[0]!;
      try {
        await authedRequest(head.path, head.method, head.body);
      } catch (err) {
        if (err instanceof AuthError) {
          // Session is unrecoverable: halt — the provider clears the session
          // and the queue stays persisted for this user's next sign-in.
          emitAuthFailure();
          return;
        }
        const status = err instanceof ApiStatusError ? err.status : null;
        const poison = status !== null && status >= 400 && status < 500 && status !== 429;
        if (poison) {
          // The server permanently rejected this command (should be
          // near-unreachable given the column allowlists). Don't block the
          // queue behind it: drop it and let a refetch restore server truth.
          console.warn(`[outbox] dropping rejected command ${head.method} ${head.path}`, err);
          entries.shift();
          drainedTouches.push(...head.touches);
          notify();
          await persist();
          continue;
        }
        // Transient (network, 5xx, 429): back off and retry from the head.
        retryAttempt += 1;
        const delay = Math.min(BACKOFF_BASE_MS * 2 ** (retryAttempt - 1), BACKOFF_MAX_MS);
        clearRetryTimer();
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void drain();
        }, delay);
        return;
      }
      retryAttempt = 0;
      entries.shift();
      drainedTouches.push(...head.touches);
      notify();
      await persist();
    }
    if (entries.length === 0 && drainedTouches.length > 0) {
      // Queue fully delivered: reconcile the optimistic cache against the
      // server (putt recounts, server-stamped timestamps, …).
      const unique = new Map(drainedTouches.map((k) => [JSON.stringify(k), k]));
      drainedTouches = [];
      onDrained([...unique.values()]);
    }
  } finally {
    draining = false;
  }
}
