import { getDb } from '@/db/client';
import { getSetting, setSetting } from '@/db/queries';

import type { SyncTable, WireRow } from './wire';

// Client mirror of server/src/sync/tables.ts: which tables sync, their identity
// column, and the client-writable column allowlist (used to filter pulled rows
// so a stray server key can't be written). `dirty` is a local-only flag and is
// never part of the wire row.
type TableSpec = { table: SyncTable; idColumn: string; columns: string[] };

export const SYNC_TABLES: TableSpec[] = [
  {
    table: 'rounds',
    idColumn: 'id',
    columns: [
      'id', 'course_name', 'date_played', 'hole_count', 'completed_at', 'tee_name',
      'course_rating', 'slope_rating', 'include_in_handicap', 'exclude_from_sharing',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'courses',
    idColumn: 'id',
    columns: ['id', 'name', 'created_at', 'updated_at', 'deleted_at'],
  },
  {
    table: 'tees',
    idColumn: 'id',
    columns: [
      'id', 'course_id', 'name', 'course_rating', 'slope_rating', 'par',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'holes',
    idColumn: 'id',
    columns: [
      'id', 'round_id', 'hole_number', 'par', 'fir', 'gir', 'up_and_down',
      'approach_distance_yds', 'approach_club', 'drive_club', 'score', 'putts',
      'chip_shots', 'sand_shots', 'penalties', 'green_blocked', 'notes',
      'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'shots',
    idColumn: 'id',
    columns: [
      'id', 'round_id', 'hole_number', 'shot_type', 'x_norm', 'y_norm',
      'intended_x_norm', 'intended_y_norm', 'notes', 'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'putts',
    idColumn: 'id',
    columns: [
      'id', 'round_id', 'hole_number', 'distance_ft', 'made', 'created_at',
      'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'post_round_reviews',
    idColumn: 'id',
    columns: [
      'id', 'round_id', 'most_costly', 'decision_making_rating', 'common_miss',
      'range_focus', 'overall_rating', 'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'pre_round_goals',
    idColumn: 'id',
    columns: [
      'id', 'round_id', 'execution_goal', 'strategic_goal', 'mental_goal',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    table: 'journal_entries',
    idColumn: 'id',
    columns: ['id', 'tag', 'body', 'created_at', 'updated_at', 'deleted_at'],
  },
  {
    table: 'app_settings',
    idColumn: 'key',
    columns: ['key', 'value', 'updated_at', 'deleted_at'],
  },
];

const SPEC_BY_TABLE: Record<SyncTable, TableSpec> = Object.fromEntries(
  SYNC_TABLES.map((s) => [s.table, s]),
) as Record<SyncTable, TableSpec>;

const CURSOR_KEY = 'sync_cursor';
const LAST_SYNCED_KEY = 'sync_last_synced_at';

// --- Push side -------------------------------------------------------------

// Local rows needing push. The snake_case row minus `dirty` is the wire row.
export async function getDirtyRows(table: SyncTable): Promise<WireRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE dirty = 1;`,
  );
  return rows.map(({ dirty: _dirty, ...rest }) => rest as WireRow);
}

// Clear dirty only for rows whose updated_at is unchanged since we read them —
// an edit mid-push bumps updated_at, so that row stays dirty and re-pushes.
export async function markRowsClean(table: SyncTable, rows: WireRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { idColumn } = SPEC_BY_TABLE[table];
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        `UPDATE ${table} SET dirty = 0 WHERE ${idColumn} = ? AND updated_at = ?;`,
        [row[idColumn] as string, row.updated_at as string],
      );
    }
  });
}

// --- Pull side -------------------------------------------------------------

// Apply one pulled row under last-write-wins, preserving un-pushed local edits.
export async function applyServerRow(table: SyncTable, row: WireRow): Promise<void> {
  const spec = SPEC_BY_TABLE[table];
  const idValue = row[spec.idColumn];
  if (idValue == null) return;

  const db = await getDb();
  const local = await db.getFirstAsync<{ dirty: number; updated_at: string | null }>(
    `SELECT dirty, updated_at FROM ${table} WHERE ${spec.idColumn} = ?;`,
    [idValue as string],
  );
  // Skip if we hold a newer un-pushed local edit (it will win on next push).
  if (
    local &&
    local.dirty === 1 &&
    local.updated_at != null &&
    typeof row.updated_at === 'string' &&
    local.updated_at >= row.updated_at
  ) {
    return;
  }

  const cols = spec.columns.filter((c) => Object.prototype.hasOwnProperty.call(row, c));
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => row[c] ?? null);
  const setClause = [
    ...cols.filter((c) => c !== spec.idColumn).map((c) => `${c} = excluded.${c}`),
    'dirty = 0',
  ].join(', ');
  // Pulled rows are authoritative → land them clean (dirty = 0). Use an upsert,
  // NOT INSERT OR REPLACE: REPLACE deletes the conflicting row first, which would
  // cascade-delete a round's holes/shots/putts through the ON DELETE CASCADE
  // foreign keys (a round-level edit echoes back on pull and wiped the children).
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}, dirty) VALUES (${placeholders}, 0)
     ON CONFLICT(${spec.idColumn}) DO UPDATE SET ${setClause};`,
    values as (string | number | null)[],
  );
}

// --- Cursor + status -------------------------------------------------------

export async function getCursor(): Promise<number> {
  const raw = await getSetting(CURSOR_KEY);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function setCursor(value: number): Promise<void> {
  await setSetting(CURSOR_KEY, String(value));
}

export async function getLastSyncedAt(): Promise<string | null> {
  return getSetting(LAST_SYNCED_KEY);
}

export async function setLastSyncedAt(iso: string): Promise<void> {
  await setSetting(LAST_SYNCED_KEY, iso);
}

export async function getDirtyCount(): Promise<number> {
  const db = await getDb();
  let total = 0;
  for (const { table } of SYNC_TABLES) {
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM ${table} WHERE dirty = 1;`,
    );
    total += row?.c ?? 0;
  }
  return total;
}

// Sign-out: hard-delete all local data (it's safe on the server) so the next
// account can't inherit it. Also clears the cursor (app_settings is wiped too).
export async function wipeLocalData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const { table } of SYNC_TABLES) {
      await db.runAsync(`DELETE FROM ${table};`);
    }
  });
}
