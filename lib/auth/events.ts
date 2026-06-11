// Tiny emitter for unrecoverable auth failures (refresh rejected). The outbox
// and any query can hit one; the AuthProvider subscribes and clears the session.

type Listener = () => void;

const listeners = new Set<Listener>();

export function onAuthFailure(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitAuthFailure(): void {
  for (const l of listeners) l();
}
