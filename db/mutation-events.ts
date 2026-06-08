// A dependency-free notifier for "the user changed local data". Mutation
// functions in db/queries.ts call emitLocalMutation() after a dirtying write;
// the sync layer (lib/sync/provider.tsx) subscribes to schedule a debounced
// push. Kept here — not in lib/sync — so db/queries.ts never imports the sync
// engine (which would cycle: engine's db.ts already imports from queries.ts).
type Listener = () => void;

const listeners = new Set<Listener>();

export function onLocalMutation(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitLocalMutation(): void {
  for (const l of listeners) l();
}
