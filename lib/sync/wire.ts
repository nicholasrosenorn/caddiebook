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
// Profile fields set during onboarding / edits. Mirrors server/src/wire.ts.
export type ProfileUpdate = {
  firstName: string | null;
  lastName: string | null;
  username: string;
  avatar: string | null;
};
// Refresh rotates server-side: a fresh refresh token comes back with the access
// token, and the old one is now revoked. The client persists both.
export type RefreshResponse = { accessToken: string; refreshToken: string };

// --- Community (mirrors server/src/wire.ts) --------------------------------

export type PublicProfile = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
};

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

// Hole/shot/putt rows travel snake_case so the client can reuse its row mappers.
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

export type FriendRoundDetail = FeedRound & {
  shots: WireShot[];
  putts: WirePutt[];
  review: WireReview | null;
  goals: WireGoals | null;
};

export type LikeResponse = { likeCount: number; likedByMe: boolean };

// Who liked a round, most-recent first.
export type RoundLikersResponse = { likers: PublicProfile[] };
