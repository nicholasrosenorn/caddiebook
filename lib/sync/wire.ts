// Client mirror of the server sync wire contract (server/src/wire.ts). The app
// can't import across the Metro blockList, so these are re-declared here and
// must stay in sync with the server.

export type SyncTable =
  | 'rounds'
  | 'courses'
  | 'tees'
  | 'holes'
  | 'shots'
  | 'putts'
  | 'post_round_reviews'
  | 'pre_round_goals'
  | 'journal_entries'
  | 'app_settings';

export type WireValue = string | number | boolean | null;
export type WireRow = Record<string, WireValue>;

export type WireChange = { table: SyncTable; row: WireRow };

export type PushRequest = { changes: WireChange[] };
export type PushResponse = { applied: number; serverHighWater: number };

export type PullResponse = {
  changes: WireChange[];
  nextCursor: number;
  hasMore: boolean;
};

export type AuthUser = { id: string; email: string | null };
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
// Refresh rotates server-side: a fresh refresh token comes back with the access
// token, and the old one is now revoked. The client persists both.
export type RefreshResponse = { accessToken: string; refreshToken: string };
