import * as SQLite from 'expo-sqlite';

import { SCHEMA_STATEMENTS, SCHEMA_VERSION, SYNCABLE_TABLES } from './schema';

// Syncable tables that already carry a created_at we can seed updated_at from
// during the one-time backfill. The rest (holes, shots, app_settings) have no
// natural timestamp, so their backfill falls back to datetime('now').
const TABLES_WITH_CREATED_AT = new Set([
  'rounds',
  'courses',
  'tees',
  'putts',
  'post_round_reviews',
  'pre_round_goals',
  'journal_entries',
]);

const DATABASE_NAME = 'caddy-book.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  ddlFragment: string,
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  if (cols.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddlFragment};`);
}

type Migration = { version: number; up: (db: SQLite.SQLiteDatabase) => Promise<void> };

// Versioned migration runner. Each migration whose version exceeds the DB's
// PRAGMA user_version runs once, in order, inside a transaction that also stamps
// the new version. Migration 1 is the original idempotent bootstrap, so existing
// installs (user_version = 0 but already fully migrated via the old ad-hoc path)
// re-run it as a no-op and simply get stamped to version 1; fresh installs build
// everything through the same path. Append future schema changes as new entries.
const MIGRATIONS: Migration[] = [
  { version: 1, up: migrateV1 },
  { version: 2, up: migrateV2 },
  { version: 3, up: migrateV3 },
];

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;'); // must stay outside the txn
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      // PRAGMA can't be parameterized; version comes from our own constant list.
      await db.execAsync(`PRAGMA user_version = ${m.version};`);
    });
  }
}

// Migration 1 — the cumulative baseline schema. Every step is idempotent
// (CREATE TABLE IF NOT EXISTS, ensureColumn existence-checks, backfill WHERE
// updated_at IS NULL) so it is safe to run on a pre-existing install.
async function migrateV1(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execAsync(statement);
  }
  await ensureColumn(db, 'rounds', 'hole_count', 'hole_count INTEGER NOT NULL DEFAULT 18');
  await ensureColumn(db, 'rounds', 'completed_at', 'completed_at TEXT');
  await ensureColumn(db, 'rounds', 'tee_name', 'tee_name TEXT');
  await ensureColumn(db, 'rounds', 'course_rating', 'course_rating REAL');
  await ensureColumn(db, 'rounds', 'slope_rating', 'slope_rating REAL');
  await ensureColumn(
    db,
    'rounds',
    'include_in_handicap',
    'include_in_handicap INTEGER NOT NULL DEFAULT 1',
  );
  await ensureColumn(db, 'holes', 'chip_shots', 'chip_shots INTEGER');
  await ensureColumn(db, 'holes', 'sand_shots', 'sand_shots INTEGER');
  await ensureColumn(db, 'holes', 'penalties', 'penalties INTEGER');
  await ensureColumn(db, 'holes', 'drive_club', 'drive_club TEXT');
  await ensureColumn(db, 'holes', 'green_blocked', 'green_blocked INTEGER');
  await ensureColumn(db, 'post_round_reviews', 'most_costly', 'most_costly TEXT');
  await ensureColumn(
    db,
    'post_round_reviews',
    'decision_making_rating',
    'decision_making_rating INTEGER',
  );
  await ensureColumn(db, 'post_round_reviews', 'common_miss', 'common_miss TEXT');
  await ensureColumn(db, 'post_round_reviews', 'range_focus', 'range_focus TEXT');
  await ensureColumn(db, 'post_round_reviews', 'overall_rating', 'overall_rating INTEGER');
  await ensureColumn(
    db,
    'post_round_reviews',
    'created_at',
    "created_at TEXT NOT NULL DEFAULT (datetime('now'))",
  );
  await ensureColumn(db, 'pre_round_goals', 'execution_goal', 'execution_goal TEXT');
  await ensureColumn(db, 'pre_round_goals', 'strategic_goal', 'strategic_goal TEXT');
  await ensureColumn(db, 'pre_round_goals', 'mental_goal', 'mental_goal TEXT');

  await ensureSyncColumns(db);
}

// Migration 2 — add the per-round "exclude from sharing" flag (0 = shared to the
// Community feed, 1 = hidden). ensureColumn keeps it idempotent for installs that
// already picked up the column via the fresh-install CREATE TABLE.
async function migrateV2(db: SQLite.SQLiteDatabase): Promise<void> {
  await ensureColumn(
    db,
    'rounds',
    'exclude_from_sharing',
    'exclude_from_sharing INTEGER NOT NULL DEFAULT 0',
  );
}

// Migration 3 — repair migration. Some installs got stamped to user_version = 2
// during development before migrateV2 added exclude_from_sharing in its final
// form, so the gated runner now skips v2 and those DBs lack the column — every
// query touching rounds (listRounds, the sync engine's applyServerRow) then
// fails to prepare. This idempotent ensureColumn backfills it for those installs
// and no-ops everywhere else.
async function migrateV3(db: SQLite.SQLiteDatabase): Promise<void> {
  await ensureColumn(
    db,
    'rounds',
    'exclude_from_sharing',
    'exclude_from_sharing INTEGER NOT NULL DEFAULT 0',
  );
}

// Add the sync trio (updated_at / deleted_at / dirty) to every syncable table
// on existing installs, then backfill updated_at once. SQLite forbids a
// non-constant default in ALTER TABLE ADD COLUMN, so updated_at is added
// nullable here (fresh installs get the NOT NULL DEFAULT from schema.ts) and
// populated by the backfill below. dirty defaults to 1 so the first sync pushes
// the user's entire pre-existing history up to the server.
async function ensureSyncColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const table of SYNCABLE_TABLES) {
    // journal_entries already had updated_at before sync; don't re-add it.
    if (table !== 'journal_entries') {
      await ensureColumn(db, table, 'updated_at', 'updated_at TEXT');
    }
    await ensureColumn(db, table, 'deleted_at', 'deleted_at TEXT');
    await ensureColumn(db, table, 'dirty', 'dirty INTEGER NOT NULL DEFAULT 1');

    // Idempotent backfill: only touches rows added before the column existed.
    const seed = TABLES_WITH_CREATED_AT.has(table)
      ? "COALESCE(created_at, datetime('now'))"
      : "datetime('now')";
    await db.execAsync(
      `UPDATE ${table} SET updated_at = ${seed} WHERE updated_at IS NULL;`,
    );
  }
}
