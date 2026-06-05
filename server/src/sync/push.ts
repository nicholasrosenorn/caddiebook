import { pool } from '../db/client';
import type { PushResponse, WireChange, WireValue } from '../wire';
import { TABLE_SPECS, isSyncableTable } from './tables';

function ident(name: string): string {
  // Identifiers come only from TABLE_SPECS (our code), never client input, but
  // quote defensively anyway.
  return `"${name.replace(/"/g, '""')}"`;
}

// SQLite booleans travel as 0/1, but coerce any stray boolean so pg doesn't
// send 't'/'f' to an integer column.
function normalize(v: WireValue | undefined): WireValue {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v ?? null;
}

// Apply a batch of client changes under row-level last-write-wins. Each row is
// upserted scoped to the JWT user; the conflict update only fires when the
// incoming updated_at is strictly newer, so an older client write never clobbers
// a newer server row. The BEFORE UPDATE trigger / column default bumps
// server_seq on every applied write.
export async function applyPush(userId: string, changes: WireChange[]): Promise<PushResponse> {
  const client = await pool.connect();
  let applied = 0;
  try {
    await client.query('BEGIN');
    for (const change of changes) {
      if (!isSyncableTable(change.table)) continue;
      const spec = TABLE_SPECS[change.table];

      // Allowlist: only known columns present on the row. Strips user_id,
      // server_seq, dirty, and anything unexpected.
      const cols = spec.columns.filter((c) =>
        Object.prototype.hasOwnProperty.call(change.row, c),
      );
      // A row is only writable if it carries its identity and an LWW clock.
      if (!spec.idColumns.every((c) => cols.includes(c)) || !cols.includes('updated_at')) {
        continue;
      }

      const insertCols = [...cols, 'user_id'];
      const values = cols.map((c) => normalize(change.row[c]));
      values.push(userId);
      const placeholders = insertCols.map((_, i) => `$${i + 1}`);

      const conflictCols = [...spec.idColumns, 'user_id'];
      const updateCols = cols.filter((c) => !spec.idColumns.includes(c));
      const setClause = updateCols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ');

      const sql =
        `INSERT INTO ${ident(change.table)} (${insertCols.map(ident).join(', ')}) ` +
        `VALUES (${placeholders.join(', ')}) ` +
        `ON CONFLICT (${conflictCols.map(ident).join(', ')}) DO UPDATE SET ${setClause} ` +
        `WHERE excluded."updated_at" > ${ident(change.table)}."updated_at"`;

      const res = await client.query(sql, values);
      applied += res.rowCount ?? 0;
    }

    const hw = await client.query<{ v: number }>(`SELECT last_value::bigint AS v FROM global_seq`);
    await client.query('COMMIT');
    return { applied, serverHighWater: Number(hw.rows[0]?.v ?? 0) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
