import * as SQLite from 'expo-sqlite';

import { SCHEMA_STATEMENTS } from './schema';

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

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execAsync(statement);
  }
  await ensureColumn(db, 'rounds', 'hole_count', 'hole_count INTEGER NOT NULL DEFAULT 18');
  await ensureColumn(db, 'rounds', 'completed_at', 'completed_at TEXT');
  await ensureColumn(db, 'holes', 'chip_shots', 'chip_shots INTEGER');
  await ensureColumn(db, 'holes', 'sand_shots', 'sand_shots INTEGER');
  await ensureColumn(db, 'holes', 'penalties', 'penalties INTEGER');
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
}
