export const SCHEMA_VERSION = 1;

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY NOT NULL,
    course_name TEXT NOT NULL,
    date_played TEXT NOT NULL,
    hole_count INTEGER NOT NULL DEFAULT 18,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

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
    notes TEXT,
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
    notes TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS putts (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    distance_ft INTEGER NOT NULL,
    made INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_holes_round_id ON holes(round_id);`,
  `CREATE INDEX IF NOT EXISTS idx_shots_round_id ON shots(round_id);`,
  `CREATE INDEX IF NOT EXISTS idx_shots_round_hole ON shots(round_id, hole_number);`,
];
