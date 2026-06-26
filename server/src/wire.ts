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
export type AuthUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatar: string | null;
};
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};
// POST /auth/apple|/auth/google. The provider name (Apple `fullName`, Google
// profile) rides along so a brand-new account is created with a prefilled name —
// Apple only shares it on the FIRST authorization. It's only applied on create,
// never overwriting an existing/edited name.
export type AppleAuthRequest = {
  identityToken: string;
  firstName?: string | null;
  lastName?: string | null;
};
export type GoogleAuthRequest = {
  idToken: string;
  firstName?: string | null;
  lastName?: string | null;
};
// Refresh rotates: the response carries a fresh refresh token too (the old one
// is now revoked server-side). The client must persist both.
export type RefreshResponse = { accessToken: string; refreshToken: string };
// Profile fields the client can set during onboarding / edit later. The server
// validates `username` (unique, lowercased, `^[a-z0-9_]{3,20}$`).
export type ProfileUpdate = {
  firstName: string | null;
  lastName: string | null;
  username: string;
  avatar: string | null;
};

// --- Community --------------------------------------------------------------
//
// The /community API is a server-mediated read layer over friends' synced data;
// it is NOT part of the SQLite sync pipe. The client mirrors these shapes in
// lib/sync/wire.ts. Hole/shot/putt rows travel snake_case (like sync wire rows)
// so the client can reuse its existing row→model mappers.

// The other-user view of an account: never the email or provider subs.
export type PublicProfile = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
};

// How the viewer relates to a searched user, so the UI shows the right action.
export type Relation = 'none' | 'friends' | 'request_sent' | 'request_received';

export type UserSearchResult = PublicProfile & { relation: Relation };
export type UserSearchResponse = { users: UserSearchResult[] };

export type SendRequestResponse =
  | { status: 'pending' }
  | { status: 'accepted'; friend: PublicProfile };

export type IncomingRequest = { id: string; createdAt: string; from: PublicProfile };
export type IncomingRequestsResponse = { requests: IncomingRequest[] };
export type RequestCountResponse = { count: number };
export type AcceptResponse = { ok: true; friend: PublicProfile };
export type FriendsResponse = { friends: PublicProfile[] };

// --- Invite links ----------------------------------------------------------
//
// Each account owns one stable, unguessable invite code. GET returns it (minting
// one on first use); redeeming someone else's code auto-friends both users.
export type InviteLinkResponse = { code: string; url: string };
export type RedeemInviteRequest = { code: string };
export type RedeemInviteResponse =
  | { status: 'friended'; friend: PublicProfile }
  | { status: 'already'; friend: PublicProfile }
  | { status: 'self' };

// --- Moderation ------------------------------------------------------------

export type BlockedUsersResponse = { blocked: PublicProfile[] };

export type ReportReason = 'spam' | 'harassment' | 'objectionable' | 'other';
export type ReportRequest = {
  targetType: 'round' | 'user';
  targetOwnerId: string;
  targetRoundId?: string | null;
  reason: ReportReason;
  note?: string | null;
};

// --- Admin moderation queue ------------------------------------------------

export type AdminReport = {
  id: string;
  reporter: PublicProfile | null;
  target: PublicProfile | null;
  targetType: 'round' | 'user';
  targetOwnerId: string;
  targetRoundId: string | null;
  reason: string;
  note: string | null;
  status: string;
  action: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
export type AdminReportsResponse = { reports: AdminReport[] };
export type AdminResolveRequest = { action: 'remove_content' | 'ban_user' | 'dismiss' };

// A single notification-feed entry. Derived on the fly (no stored read-state):
// pending friend requests always sort first, then likes on my rounds and new
// friendships by recency. `id` is a synthetic stable key for React lists; for a
// friend_request it carries the underlying request uuid so it can be accepted.
export type NotificationItem =
  | { kind: 'friend_request'; id: string; requestId: string; createdAt: string; from: PublicProfile }
  | {
      kind: 'like';
      id: string;
      createdAt: string;
      from: PublicProfile;
      roundId: string;
      courseName: string | null;
    }
  | { kind: 'friendship'; id: string; createdAt: string; from: PublicProfile };
export type NotificationsResponse = { notifications: NotificationItem[] };

// A hole as it crosses the community wire (snake_case, mirrors the client's
// HoleRow so computeRoundSummary works after a trivial map).
export type WireHole = {
  id: string;
  round_id: string;
  hole_number: number;
  par: number | null;
  fir: number | null;
  gir: number | null;
  up_and_down: number | null;
  approach_distance_yds: number | null;
  approach_club: string | null;
  drive_club: string | null;
  drive_distance_yds: number | null;
  score: number | null;
  putts: number | null;
  chip_shots: number | null;
  sand_shots: number | null;
  penalties: number | null;
  green_blocked: number | null;
  notes: string | null;
};

export type WireShot = {
  id: string;
  round_id: string;
  hole_number: number;
  shot_type: string;
  x_norm: number;
  y_norm: number;
  intended_x_norm: number | null;
  intended_y_norm: number | null;
  notes: string | null;
};

export type WirePutt = {
  id: string;
  round_id: string;
  hole_number: number;
  distance_ft: number;
  made: number;
  created_at: string | null;
};

export type WireReview = {
  id: string;
  round_id: string;
  most_costly: string | null;
  decision_making_rating: number | null;
  common_miss: string | null;
  range_focus: string | null;
  overall_rating: number | null;
};

export type WireGoals = {
  id: string;
  round_id: string;
  execution_goal: string | null;
  strategic_goal: string | null;
  mental_goal: string | null;
};

// One round in the feed: enough to render a card and reuse computeRoundSummary.
export type FeedRound = {
  ownerId: string;
  owner: PublicProfile;
  id: string;
  courseName: string | null;
  datePlayed: string | null;
  holeCount: number | null;
  completedAt: string | null;
  createdAt: string | null;
  holes: WireHole[];
  likeCount: number;
  likedByMe: boolean;
};

export type FeedResponse = { rounds: FeedRound[]; nextCursor: string | null };

// The read-only detail view of a friend's round.
export type FriendRoundDetail = FeedRound & {
  shots: WireShot[];
  putts: WirePutt[];
  review: WireReview | null;
  goals: WireGoals | null;
};

export type LikeResponse = { likeCount: number; likedByMe: boolean };

// Who liked a round, most-recent first.
export type RoundLikersResponse = { likers: PublicProfile[] };

// --- Notifications --------------------------------------------------------

// Register/unregister a device's Expo push token. `platform` is 'ios'|'android'
// (free-form; only stored for diagnostics).
export type RegisterPushTokenRequest = { token: string; platform?: string };
export type UnregisterPushTokenRequest = { token: string };

// --- /data ------------------------------------------------------------------
//
// The request/response CRUD layer that replaced the SQLite sync pipe. Rows
// travel snake_case (same as the community wire) so the client reuses its
// row→model mappers. Writes are idempotent upserts/deletes keyed by
// client-generated UUIDs; the server stamps updated_at.

export type WireRound = {
  id: string;
  course_name: string | null;
  date_played: string | null;
  hole_count: number | null;
  completed_at: string | null;
  tee_name: string | null;
  course_rating: number | null;
  slope_rating: number | null;
  include_in_handicap: number | null;
  exclude_from_sharing: number | null;
  created_at: string | null;
};

export type WireCourse = { id: string; name: string | null; created_at: string | null };
export type WireTee = {
  id: string;
  course_id: string | null;
  name: string | null;
  course_rating: number | null;
  slope_rating: number | null;
  par: number | null;
  created_at: string | null;
};
export type WireJournalEntry = {
  id: string;
  tag: string | null;
  body: string | null;
  created_at: string | null;
  updated_at: string | null;
};

// GET /data/rounds — the rounds tab in one request.
export type DataRoundsResponse = { rounds: (WireRound & { holes: WireHole[] })[] };

// GET /data/rounds/:id/full — everything the round flow renders, one payload.
export type RoundFullResponse = {
  round: WireRound;
  holes: WireHole[];
  shots: WireShot[];
  putts: WirePutt[];
  review: WireReview | null;
  goals: WireGoals | null;
};

// GET /data/stats — the lifetime-stats corpus (live rows, flat arrays).
export type StatsBundleResponse = {
  rounds: WireRound[];
  holes: WireHole[];
  shots: WireShot[];
  putts: WirePutt[];
  reviews: WireReview[];
};

export type CoursesResponse = { courses: (WireCourse & { tees: WireTee[] })[] };
export type JournalResponse = { entries: WireJournalEntry[] };
export type SettingsResponse = { settings: Record<string, string> };

// PUT /data/rounds/:id — round upsert, optionally carrying its holes so round
// creation is a single (offline-replayable) command.
export type RoundUpsertRequest = Partial<WireRound> & { holes?: WireRow[] };
// PUT/DELETE …/shots/:shotType — the shot row plus an optional hole patch
// (fir/gir/…) applied in the same transaction.
export type ShotUpsertRequest = WireRow & { hole?: WireRow };
export type ShotDeleteRequest = { hole?: WireRow };
