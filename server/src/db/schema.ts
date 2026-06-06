import {
  bigint,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// --- Sync metadata shared by every syncable table --------------------------
//
// The server is a deliberately *tolerant* store: only the identity (id/key),
// the owner (user_id), the LWW clock (updated_at) and the cursor (server_seq)
// are NOT NULL. Every data column is nullable so a partial row or a future
// client column never fails an insert — the client (SQLite) remains the
// integrity authority. `dirty` is local-only and intentionally absent here.
//
// server_seq advances on every write: a column default (nextval) covers
// inserts and a BEFORE UPDATE trigger covers updates — both added by the
// hand-written 0001 migration (Drizzle can't express sequences/triggers).
const syncMeta = {
  userId: uuid('user_id').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  serverSeq: bigint('server_seq', { mode: 'number' }).notNull(),
};

const id = text('id').notNull();

export const rounds = pgTable(
  'rounds',
  {
    id,
    courseName: text('course_name'),
    datePlayed: text('date_played'),
    holeCount: integer('hole_count'),
    completedAt: text('completed_at'),
    teeName: text('tee_name'),
    courseRating: doublePrecision('course_rating'),
    slopeRating: doublePrecision('slope_rating'),
    includeInHandicap: integer('include_in_handicap'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const courses = pgTable(
  'courses',
  {
    id,
    name: text('name'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const tees = pgTable(
  'tees',
  {
    id,
    courseId: text('course_id'),
    name: text('name'),
    courseRating: doublePrecision('course_rating'),
    slopeRating: doublePrecision('slope_rating'),
    par: integer('par'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const holes = pgTable(
  'holes',
  {
    id,
    roundId: text('round_id'),
    holeNumber: integer('hole_number'),
    par: integer('par'),
    fir: integer('fir'),
    gir: integer('gir'),
    upAndDown: integer('up_and_down'),
    approachDistanceYds: integer('approach_distance_yds'),
    approachClub: text('approach_club'),
    driveClub: text('drive_club'),
    score: integer('score'),
    putts: integer('putts'),
    chipShots: integer('chip_shots'),
    sandShots: integer('sand_shots'),
    penalties: integer('penalties'),
    greenBlocked: integer('green_blocked'),
    notes: text('notes'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const shots = pgTable(
  'shots',
  {
    id,
    roundId: text('round_id'),
    holeNumber: integer('hole_number'),
    shotType: text('shot_type'),
    xNorm: doublePrecision('x_norm'),
    yNorm: doublePrecision('y_norm'),
    intendedXNorm: doublePrecision('intended_x_norm'),
    intendedYNorm: doublePrecision('intended_y_norm'),
    notes: text('notes'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const putts = pgTable(
  'putts',
  {
    id,
    roundId: text('round_id'),
    holeNumber: integer('hole_number'),
    distanceFt: integer('distance_ft'),
    made: integer('made'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const postRoundReviews = pgTable(
  'post_round_reviews',
  {
    id,
    roundId: text('round_id'),
    mostCostly: text('most_costly'),
    decisionMakingRating: integer('decision_making_rating'),
    commonMiss: text('common_miss'),
    rangeFocus: text('range_focus'),
    overallRating: integer('overall_rating'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const preRoundGoals = pgTable(
  'pre_round_goals',
  {
    id,
    roundId: text('round_id'),
    executionGoal: text('execution_goal'),
    strategicGoal: text('strategic_goal'),
    mentalGoal: text('mental_goal'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const journalEntries = pgTable(
  'journal_entries',
  {
    id,
    tag: text('tag'),
    body: text('body'),
    createdAt: text('created_at'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

// app_settings is keyed by `key`, not `id` — its identity within a user is the
// setting key, so the composite PK is (user_id, key).
export const appSettings = pgTable(
  'app_settings',
  {
    key: text('key').notNull(),
    value: text('value'),
    ...syncMeta,
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// --- Accounts --------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  appleSub: text('apple_sub').unique(),
  googleSub: text('google_sub').unique(),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Server-side refresh-token store for rotation + reuse detection. Each row is one
// issued refresh token (id = the token's jti); `familyId` groups a rotation chain
// so replaying a revoked token can revoke the whole family (theft detection).
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    familyId: uuid('family_id').notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byUser: index('refresh_tokens_user_idx').on(t.userId),
    byFamily: index('refresh_tokens_family_idx').on(t.familyId),
  }),
);

export const schema = {
  rounds,
  courses,
  tees,
  holes,
  shots,
  putts,
  postRoundReviews,
  preRoundGoals,
  journalEntries,
  appSettings,
  users,
  refreshTokens,
};
