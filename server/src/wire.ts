import type { SyncableTable } from './sync/tables';

// The canonical sync wire contract. The Phase 2 client mirrors these shapes.
//
// A wire row is the SQLite row (snake_case keys) minus the local-only `dirty`
// flag. On push the client omits `user_id`/`server_seq` (server owns them); on
// pull they're present. Values are JSON scalars — note SQLite booleans travel
// as 0/1 integers, which the passthrough Postgres columns accept as-is.

export type WireValue = string | number | boolean | null;
export type WireRow = Record<string, WireValue>;

export type WireChange = {
  table: SyncableTable;
  row: WireRow;
};

// POST /sync/push
export type PushRequest = { changes: WireChange[] };
export type PushResponse = {
  /** Rows actually written (insert or LWW-winning update). */
  applied: number;
  /** Highest server_seq assigned during this push. */
  serverHighWater: number;
};

// GET /sync/pull?since=<cursor>&limit=<n>
export type PullResponse = {
  changes: WireChange[];
  /** Pass back as `since` on the next pull. */
  nextCursor: number;
  hasMore: boolean;
};

// Auth
export type AuthUser = { id: string; email: string | null };
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
export type RefreshResponse = { accessToken: string };
