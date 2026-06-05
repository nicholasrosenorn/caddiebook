import { pool } from '../db/client';
import type { PullResponse, WireChange, WireRow } from '../wire';
import { SYNCABLE_TABLES, TABLE_SPECS } from './tables';

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PULL_LIMIT = 1000;

type Gathered = { seq: number; change: WireChange };

// Return all changes for a user with server_seq > since, globally ordered by
// server_seq and capped at `limit`. Each of the 10 tables is range-scanned via
// its (user_id, server_seq) index; results merge into one cursor-ordered stream.
// Tombstones (deleted_at set) are included so clients delete locally.
//
// nextCursor is the last emitted seq; hasMore is true when more rows exist past
// the cap (either we trimmed the merged set, or a table filled its own limit).
export async function pullChanges(
  userId: string,
  since: number,
  limit: number,
): Promise<PullResponse> {
  const cap = Math.min(Math.max(1, limit), MAX_PULL_LIMIT);
  const gathered: Gathered[] = [];
  let tableHitCap = false;

  for (const table of SYNCABLE_TABLES) {
    const spec = TABLE_SPECS[table];
    const res = await pool.query(
      `SELECT * FROM ${ident(table)} WHERE user_id = $1 AND server_seq > $2 ` +
        `ORDER BY server_seq ASC LIMIT $3`,
      [userId, since, cap],
    );
    if (res.rowCount === cap) tableHitCap = true;
    for (const dbRow of res.rows) {
      // Project to the client-known columns only — drop user_id/server_seq,
      // which the local SQLite schema doesn't have.
      const row: WireRow = {};
      for (const c of spec.columns) row[c] = dbRow[c] ?? null;
      gathered.push({ seq: Number(dbRow.server_seq), change: { table, row } });
    }
  }

  gathered.sort((a, b) => a.seq - b.seq);

  const trimmed = gathered.length > cap;
  const slice = trimmed ? gathered.slice(0, cap) : gathered;
  const nextCursor = slice.length > 0 ? slice[slice.length - 1]!.seq : since;

  return {
    changes: slice.map((g) => g.change),
    nextCursor,
    hasMore: trimmed || tableHitCap,
  };
}
