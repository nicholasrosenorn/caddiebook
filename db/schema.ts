export const SCHEMA_VERSION = 1;

// Tables that participate in server sync. Every row in these tables carries the
// sync trio (updated_at / deleted_at / dirty); the sync engine (Phase 2) reads
// dirty rows to push and applies pulled rows back. Keep in sync with the
// CREATE TABLE statements below and the ensureColumn calls in db/client.ts.
export const SYNCABLE_TABLES = [
  'rounds',
  'courses',
  'tees',
  'holes',
  'shots',
  'putts',
  'post_round_reviews',
  'pre_round_goals',
  'journal_entries',
  'app_settings',
] as const;

export type SyncableTable = (typeof SYNCABLE_TABLES)[number];

// The three sync columns, inlined into each fresh-install CREATE TABLE.
// updated_at: last-write-wins clock, rewritten on every local write.
// deleted_at: soft-delete tombstone (NULL = live) so deletions can propagate.
// dirty: 1 = local changes not yet pushed (the push set is WHERE dirty = 1).
// NOTE: existing installs add these via ensureColumn in db/client.ts, where the
// non-constant default below is illegal for ALTER TABLE — see that file.
const SYNC_COLUMNS = `updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    dirty INTEGER NOT NULL DEFAULT 1`;

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY NOT NULL,
    course_name TEXT NOT NULL,
    date_played TEXT NOT NULL,
    hole_count INTEGER NOT NULL DEFAULT 18,
    completed_at TEXT,
    tee_name TEXT,
    course_rating REAL,
    slope_rating REAL,
    include_in_handicap INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ${SYNC_COLUMNS}
  );`,

  `CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ${SYNC_COLUMNS}
  );`,

  `CREATE TABLE IF NOT EXISTS tees (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    course_rating REAL NOT NULL,
    slope_rating REAL NOT NULL,
    par INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ${SYNC_COLUMNS}
  );`,

  `CREATE INDEX IF NOT EXISTS idx_tees_course_id ON tees(course_id);`,

  `CREATE TABLE IF NOT EXISTS holes (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    par INTEGER,
    fir INTEGER,
    gir INTEGER,
    up_and_down INTEGER,
    approach_distance_yds INTEGER,
    approach_club TEXT,
    drive_club TEXT,
    score INTEGER,
    putts INTEGER,
    chip_shots INTEGER,
    sand_shots INTEGER,
    penalties INTEGER,
    green_blocked INTEGER,
    notes TEXT,
    ${SYNC_COLUMNS},
    UNIQUE (round_id, hole_number)
  );`,

  `CREATE TABLE IF NOT EXISTS shots (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    shot_type TEXT NOT NULL CHECK (shot_type IN ('driver', 'approach')),
    x_norm REAL NOT NULL,
    y_norm REAL NOT NULL,
    intended_x_norm REAL,
    intended_y_norm REAL,
    notes TEXT,
    ${SYNC_COLUMNS}
  );`,

  `CREATE TABLE IF NOT EXISTS putts (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    distance_ft INTEGER NOT NULL,
    made INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ${SYNC_COLUMNS}
  );`,

  `CREATE INDEX IF NOT EXISTS idx_putts_round_id ON putts(round_id);`,
  `CREATE INDEX IF NOT EXISTS idx_putts_round_hole ON putts(round_id, hole_number);`,

  `CREATE TABLE IF NOT EXISTS post_round_reviews (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
    most_costly TEXT,
    decision_making_rating INTEGER,
    common_miss TEXT,
    range_focus TEXT,
    overall_rating INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ${SYNC_COLUMNS}
  );`,

  `CREATE TABLE IF NOT EXISTS pre_round_goals (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
    execution_goal TEXT,
    strategic_goal TEXT,
    mental_goal TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    ${SYNC_COLUMNS}
  );`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT,
    ${SYNC_COLUMNS}
  );`,

  `CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY NOT NULL,
    tag TEXT NOT NULL CHECK (tag IN ('swing_thought', 'practice_session', 'round_summary')),
    body TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    dirty INTEGER NOT NULL DEFAULT 1
  );`,

  `CREATE INDEX IF NOT EXISTS idx_journal_updated_at ON journal_entries(updated_at);`,

  `CREATE INDEX IF NOT EXISTS idx_holes_round_id ON holes(round_id);`,
  `CREATE INDEX IF NOT EXISTS idx_shots_round_id ON shots(round_id);`,
  `CREATE INDEX IF NOT EXISTS idx_shots_round_hole ON shots(round_id, hole_number);`,
];
