import type { PoolClient } from 'pg';

import { pool } from '../db/client';
import { containsProfanity } from '../moderation/profanity';
import { TABLE_SPECS, type SyncableTable } from '../sync/tables';
import type {
  CoursesResponse,
  DataRoundsResponse,
  RoundFullResponse,
  RoundUpsertRequest,
  SettingsResponse,
  StatsBundleResponse,
  WireHole,
  WireJournalEntry,
  WirePutt,
  WireReview,
  WireRound,
  WireRow,
  WireShot,
  WireValue,
} from '../wire';

// Thrown by service functions for client mistakes; routes map it to a 4xx.
export class DataError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 422 = 400,
  ) {
    super(message);
  }
}

function ident(name: string): string {
  // Identifiers come only from TABLE_SPECS (our code), never client input, but
  // quote defensively anyway.
  return `"${name.replace(/"/g, '""')}"`;
}

function normalize(v: WireValue | undefined): WireValue {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v ?? null;
}

// Per-column free-text ceilings. Anything longer is rejected (400) to blunt
// storage abuse and oversized rows. Long-form fields (round/journal prose and
// the settings value blob, which holds the bag/yardage JSON) get more room;
// everything else (names, clubs, review answers, goals, tags) is short.
const LONG_TEXT_COLUMNS = new Set(['notes', 'body', 'value']);
const MAX_TEXT_LEN = 1_000;
const MAX_LONG_TEXT_LEN = 10_000;

function checkTextLength(column: string, value: WireValue): void {
  if (typeof value !== 'string') return;
  const max = LONG_TEXT_COLUMNS.has(column) ? MAX_LONG_TEXT_LEN : MAX_TEXT_LEN;
  if (value.length > max) {
    throw new DataError(`${column} exceeds ${max} characters`);
  }
}

// Columns whose text is visible to other users (feed cards + friend round
// detail), so they must pass the profanity gate. Private blobs (settings JSON,
// journal body) and fixed-vocabulary columns (clubs) are intentionally absent.
const PROFANITY_COLUMNS = new Set([
  'course_name',
  'notes',
  'most_costly',
  'common_miss',
  'range_focus',
  'execution_goal',
  'strategic_goal',
  'mental_goal',
]);

function checkProfanity(column: string, value: WireValue): void {
  if (!PROFANITY_COLUMNS.has(column)) return;
  if (typeof value !== 'string') return;
  if (containsProfanity(value)) {
    throw new DataError('objectionable_language', 422);
  }
}

// Run both content gates on a writable column's value.
function checkColumnValue(column: string, value: WireValue): WireValue {
  checkTextLength(column, value);
  checkProfanity(column, value);
  return value;
}

function now(): string {
  return new Date().toISOString();
}

async function withTx<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// updated_at/deleted_at are server-stamped on /data writes — there is no client
// LWW clock anymore, and a /data upsert authoritatively means "this row exists"
// (deleted_at is force-cleared so legacy tombstones can't shadow a live write).
const SERVER_STAMPED = new Set(['updated_at', 'deleted_at']);

// Idempotent allowlisted upsert scoped to the user. `conflictCols` defaults to
// the table's identity; slot-style endpoints (holes by hole_number, shots by
// slot, review/goals by round) arbitrate on their unique index instead — the
// existing row keeps its id and only the provided columns change.
async function upsertRow(
  tx: PoolClient,
  userId: string,
  table: SyncableTable,
  row: WireRow,
  conflictCols: string[] = TABLE_SPECS[table].idColumns,
): Promise<void> {
  const spec = TABLE_SPECS[table];
  const cols = spec.columns.filter(
    (c) => !SERVER_STAMPED.has(c) && Object.prototype.hasOwnProperty.call(row, c),
  );
  for (const required of new Set([...spec.idColumns, ...conflictCols])) {
    if (!cols.includes(required) || normalize(row[required]) === null) {
      throw new DataError(`${table}.${required} required`);
    }
  }

  const insertCols = [...cols, 'user_id', 'updated_at', 'deleted_at'];
  const values: WireValue[] = [
    ...cols.map((c) => checkColumnValue(c, normalize(row[c]))),
    userId,
    now(),
    null,
  ];
  const placeholders = insertCols.map((_, i) => `$${i + 1}`);

  const skip = new Set([...spec.idColumns, ...conflictCols]);
  const setClause = [
    ...cols.filter((c) => !skip.has(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`),
    `"updated_at" = excluded."updated_at"`,
    `"deleted_at" = NULL`,
  ].join(', ');

  await tx.query(
    `INSERT INTO ${ident(table)} (${insertCols.map(ident).join(', ')}) ` +
      `VALUES (${placeholders.join(', ')}) ` +
      `ON CONFLICT (${['user_id', ...conflictCols].map(ident).join(', ')}) ` +
      `DO UPDATE SET ${setClause}`,
    values,
  );
}

// Patch an existing hole's allowlisted columns (no insert — holes are created
// with their round, so a missing row means the patch has nothing to apply to).
async function patchHole(
  tx: PoolClient,
  userId: string,
  roundId: string,
  holeNumber: number,
  patch: WireRow,
): Promise<void> {
  const cols = TABLE_SPECS.holes.columns.filter(
    (c) =>
      !SERVER_STAMPED.has(c) &&
      !['id', 'round_id', 'hole_number'].includes(c) &&
      Object.prototype.hasOwnProperty.call(patch, c),
  );
  if (cols.length === 0) return;
  const values: WireValue[] = cols.map((c) => checkColumnValue(c, normalize(patch[c])));
  const set = cols.map((c, i) => `${ident(c)} = $${i + 1}`).join(', ');
  values.push(now(), userId, roundId, holeNumber);
  const base = cols.length;
  await tx.query(
    `UPDATE holes SET ${set}, "updated_at" = $${base + 1}, "deleted_at" = NULL ` +
      `WHERE user_id = $${base + 2} AND round_id = $${base + 3} AND hole_number = $${base + 4}`,
    values,
  );
}

// Recompute holes.putts from the live putt rows (the invariant the client's
// SQLite transaction used to maintain).
async function recountHolePutts(
  tx: PoolClient,
  userId: string,
  roundId: string,
  holeNumber: number,
): Promise<void> {
  await tx.query(
    `UPDATE holes SET putts = (
       SELECT COUNT(*)::int FROM putts
       WHERE user_id = $1 AND round_id = $2 AND hole_number = $3 AND deleted_at IS NULL
     ), "updated_at" = $4
     WHERE user_id = $1 AND round_id = $2 AND hole_number = $3`,
    [userId, roundId, holeNumber, now()],
  );
}

// --- Writes -----------------------------------------------------------------

export async function upsertRound(
  userId: string,
  roundId: string,
  body: RoundUpsertRequest,
): Promise<void> {
  const { holes, ...roundFields } = body;
  await withTx(async (tx) => {
    await upsertRow(tx, userId, 'rounds', { ...(roundFields as WireRow), id: roundId });
    for (const hole of holes ?? []) {
      const holeNumber = normalize(hole.hole_number);
      if (typeof holeNumber !== 'number') throw new DataError('holes[].hole_number required');
      await upsertRow(tx, userId, 'holes', { ...hole, round_id: roundId }, [
        'round_id',
        'hole_number',
      ]);
    }
  });
}

export async function deleteRound(userId: string, roundId: string): Promise<void> {
  await withTx(async (tx) => {
    for (const table of ['holes', 'shots', 'putts', 'post_round_reviews', 'pre_round_goals']) {
      await tx.query(`DELETE FROM ${ident(table)} WHERE user_id = $1 AND round_id = $2`, [
        userId,
        roundId,
      ]);
    }
    await tx.query(`DELETE FROM round_likes WHERE round_owner_id = $1 AND round_id = $2`, [
      userId,
      roundId,
    ]);
    await tx.query(`DELETE FROM rounds WHERE user_id = $1 AND id = $2`, [userId, roundId]);
  });
}

// Permanently erase an account: every row this user owns across the data tables
// plus their server-owned social/auth state, finishing with the users row, all in
// one transaction. The schema has no FK cascades (composite (user_id, id) PKs), so
// each table is cleared explicitly. Irreversible — there is no soft-delete.
export async function deleteAccount(userId: string): Promise<void> {
  await withTx(async (tx) => {
    // Per-user data tables (all keyed by user_id).
    for (const table of [
      'holes',
      'shots',
      'putts',
      'post_round_reviews',
      'pre_round_goals',
      'rounds',
      'courses',
      'tees',
      'journal_entries',
      'app_settings',
      'refresh_tokens',
      'push_tokens',
    ]) {
      await tx.query(`DELETE FROM ${ident(table)} WHERE user_id = $1`, [userId]);
    }
    // Round-share notification ledger is keyed by round_owner_id.
    await tx.query(`DELETE FROM round_share_notifications WHERE round_owner_id = $1`, [userId]);
    // Social/moderation state where the user appears on either side.
    await tx.query(`DELETE FROM friendships WHERE user_low = $1 OR user_high = $1`, [userId]);
    await tx.query(`DELETE FROM friend_requests WHERE from_user_id = $1 OR to_user_id = $1`, [
      userId,
    ]);
    await tx.query(`DELETE FROM round_likes WHERE round_owner_id = $1 OR liker_id = $1`, [userId]);
    await tx.query(`DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]);
    await tx.query(`DELETE FROM content_reports WHERE reporter_id = $1 OR target_owner_id = $1`, [
      userId,
    ]);
    // Finally the account row itself.
    await tx.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
}

export async function upsertHole(
  userId: string,
  roundId: string,
  holeNumber: number,
  row: WireRow,
): Promise<void> {
  await withTx((tx) =>
    upsertRow(tx, userId, 'holes', { ...row, round_id: roundId, hole_number: holeNumber }, [
      'round_id',
      'hole_number',
    ]),
  );
}

export async function upsertShot(
  userId: string,
  roundId: string,
  holeNumber: number,
  shotType: string,
  shot: WireRow,
  holePatch?: WireRow,
): Promise<void> {
  await withTx(async (tx) => {
    await upsertRow(
      tx,
      userId,
      'shots',
      { ...shot, round_id: roundId, hole_number: holeNumber, shot_type: shotType },
      ['round_id', 'hole_number', 'shot_type'],
    );
    if (holePatch) await patchHole(tx, userId, roundId, holeNumber, holePatch);
  });
}

export async function deleteShot(
  userId: string,
  roundId: string,
  holeNumber: number,
  shotType: string,
  holePatch?: WireRow,
): Promise<void> {
  await withTx(async (tx) => {
    await tx.query(
      `DELETE FROM shots
       WHERE user_id = $1 AND round_id = $2 AND hole_number = $3 AND shot_type = $4`,
      [userId, roundId, holeNumber, shotType],
    );
    if (holePatch) await patchHole(tx, userId, roundId, holeNumber, holePatch);
  });
}

export async function putPutt(userId: string, puttId: string, row: WireRow): Promise<void> {
  const roundId = normalize(row.round_id);
  const holeNumber = normalize(row.hole_number);
  if (typeof roundId !== 'string' || typeof holeNumber !== 'number') {
    throw new DataError('putt round_id and hole_number required');
  }
  await withTx(async (tx) => {
    // A hole can only be holed out once: a new made putt replaces any other.
    if (normalize(row.made) === 1) {
      await tx.query(
        `DELETE FROM putts
         WHERE user_id = $1 AND round_id = $2 AND hole_number = $3 AND made = 1 AND id <> $4`,
        [userId, roundId, holeNumber, puttId],
      );
    }
    await upsertRow(tx, userId, 'putts', { ...row, id: puttId });
    await recountHolePutts(tx, userId, roundId, holeNumber);
  });
}

export async function deletePutt(userId: string, puttId: string): Promise<void> {
  await withTx(async (tx) => {
    const res = await tx.query<{ round_id: string; hole_number: number }>(
      `DELETE FROM putts WHERE user_id = $1 AND id = $2 RETURNING round_id, hole_number`,
      [userId, puttId],
    );
    const gone = res.rows[0];
    if (gone) await recountHolePutts(tx, userId, gone.round_id, gone.hole_number);
  });
}

export async function upsertReview(userId: string, roundId: string, row: WireRow): Promise<void> {
  await withTx((tx) =>
    upsertRow(tx, userId, 'post_round_reviews', { ...row, round_id: roundId }, ['round_id']),
  );
}

export async function upsertGoals(userId: string, roundId: string, row: WireRow): Promise<void> {
  await withTx((tx) =>
    upsertRow(tx, userId, 'pre_round_goals', { ...row, round_id: roundId }, ['round_id']),
  );
}

export async function upsertJournalEntry(userId: string, id: string, row: WireRow): Promise<void> {
  await withTx((tx) => upsertRow(tx, userId, 'journal_entries', { ...row, id }));
}

export async function deleteJournalEntry(userId: string, id: string): Promise<void> {
  await pool.query(`DELETE FROM journal_entries WHERE user_id = $1 AND id = $2`, [userId, id]);
}

export async function putSetting(userId: string, key: string, value: string): Promise<void> {
  await withTx((tx) => upsertRow(tx, userId, 'app_settings', { key, value }));
}

export async function upsertCourse(userId: string, id: string, row: WireRow): Promise<void> {
  await withTx((tx) => upsertRow(tx, userId, 'courses', { ...row, id }));
}

export async function upsertTee(userId: string, id: string, row: WireRow): Promise<void> {
  await withTx((tx) => upsertRow(tx, userId, 'tees', { ...row, id }));
}

// --- Reads --------------------------------------------------------------------
//
// deleted_at IS NULL filters stay through the transition window: old app
// versions can still write tombstones via the retained /sync/push.

const ROUND_COLS =
  'id, course_name, date_played, hole_count, completed_at, tee_name, course_rating, ' +
  'slope_rating, include_in_handicap, exclude_from_sharing, created_at';

const HOLE_COLS =
  'id, round_id, hole_number, par, fir, gir, up_and_down, approach_distance_yds, ' +
  'approach_club, drive_club, drive_distance_yds, score, putts, chip_shots, sand_shots, penalties, ' +
  'green_blocked, notes';

const SHOT_COLS =
  'id, round_id, hole_number, shot_type, x_norm, y_norm, intended_x_norm, ' +
  'intended_y_norm, notes';

const PUTT_COLS = 'id, round_id, hole_number, distance_ft, made, created_at';

const REVIEW_COLS =
  'id, round_id, most_costly, decision_making_rating, common_miss, range_focus, ' +
  'overall_rating, created_at';

const GOALS_COLS = 'id, round_id, execution_goal, strategic_goal, mental_goal, created_at';

export async function listRounds(userId: string): Promise<DataRoundsResponse> {
  const [roundsRes, holesRes] = await Promise.all([
    pool.query(
      `SELECT ${ROUND_COLS} FROM rounds WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY date_played DESC, created_at DESC`,
      [userId],
    ),
    pool.query(
      `SELECT ${HOLE_COLS} FROM holes WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY round_id, hole_number`,
      [userId],
    ),
  ]);
  const holesByRound = new Map<string, WireHole[]>();
  for (const hole of holesRes.rows as WireHole[]) {
    const arr = holesByRound.get(hole.round_id);
    if (arr) arr.push(hole);
    else holesByRound.set(hole.round_id, [hole]);
  }
  return {
    rounds: (roundsRes.rows as WireRound[]).map((round) => ({
      ...round,
      holes: holesByRound.get(round.id) ?? [],
    })),
  };
}

export async function getRoundFull(userId: string, roundId: string): Promise<RoundFullResponse> {
  const [roundRes, holesRes, shotsRes, puttsRes, reviewRes, goalsRes] = await Promise.all([
    pool.query(
      `SELECT ${ROUND_COLS} FROM rounds WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [userId, roundId],
    ),
    pool.query(
      `SELECT ${HOLE_COLS} FROM holes
       WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL ORDER BY hole_number`,
      [userId, roundId],
    ),
    pool.query(
      `SELECT ${SHOT_COLS} FROM shots
       WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [userId, roundId],
    ),
    pool.query(
      `SELECT ${PUTT_COLS} FROM putts
       WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL ORDER BY created_at`,
      [userId, roundId],
    ),
    pool.query(
      `SELECT ${REVIEW_COLS} FROM post_round_reviews
       WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [userId, roundId],
    ),
    pool.query(
      `SELECT ${GOALS_COLS} FROM pre_round_goals
       WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [userId, roundId],
    ),
  ]);
  const round = roundRes.rows[0] as WireRound | undefined;
  if (!round) throw new DataError('round not found', 404);
  return {
    round,
    holes: holesRes.rows as WireHole[],
    shots: shotsRes.rows as WireShot[],
    putts: puttsRes.rows as WirePutt[],
    review: (reviewRes.rows[0] as WireReview | undefined) ?? null,
    goals: (goalsRes.rows[0] as RoundFullResponse['goals']) ?? null,
  };
}

export async function getStatsBundle(userId: string): Promise<StatsBundleResponse> {
  const live = (table: string, cols: string, order: string) =>
    pool.query(
      `SELECT ${cols} FROM ${ident(table)} WHERE user_id = $1 AND deleted_at IS NULL ${order}`,
      [userId],
    );
  const [rounds, holes, shots, putts, reviews] = await Promise.all([
    live('rounds', ROUND_COLS, 'ORDER BY date_played DESC, created_at DESC'),
    live('holes', HOLE_COLS, 'ORDER BY round_id, hole_number'),
    live('shots', SHOT_COLS, ''),
    live('putts', PUTT_COLS, ''),
    live('post_round_reviews', REVIEW_COLS, ''),
  ]);
  return {
    rounds: rounds.rows as WireRound[],
    holes: holes.rows as WireHole[],
    shots: shots.rows as WireShot[],
    putts: putts.rows as WirePutt[],
    reviews: reviews.rows as WireReview[],
  };
}

export async function listCourses(userId: string): Promise<CoursesResponse> {
  const [coursesRes, teesRes] = await Promise.all([
    pool.query(
      `SELECT id, name, created_at FROM courses
       WHERE user_id = $1 AND deleted_at IS NULL ORDER BY lower(name)`,
      [userId],
    ),
    pool.query(
      `SELECT id, course_id, name, course_rating, slope_rating, par, created_at FROM tees
       WHERE user_id = $1 AND deleted_at IS NULL ORDER BY course_rating DESC, created_at`,
      [userId],
    ),
  ]);
  const teesByCourse = new Map<string, CoursesResponse['courses'][number]['tees']>();
  for (const tee of teesRes.rows) {
    const arr = teesByCourse.get(tee.course_id);
    if (arr) arr.push(tee);
    else teesByCourse.set(tee.course_id, [tee]);
  }
  return {
    courses: coursesRes.rows.map((course) => ({
      ...course,
      tees: teesByCourse.get(course.id) ?? [],
    })),
  };
}

export async function listJournal(userId: string): Promise<WireJournalEntry[]> {
  const res = await pool.query(
    `SELECT id, tag, body, created_at, updated_at FROM journal_entries
     WHERE user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, created_at DESC`,
    [userId],
  );
  return res.rows as WireJournalEntry[];
}

export async function getSettings(userId: string): Promise<SettingsResponse> {
  const res = await pool.query<{ key: string; value: string | null }>(
    `SELECT key, value FROM app_settings WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const settings: Record<string, string> = {};
  for (const row of res.rows) if (row.value !== null) settings[row.key] = row.value;
  return { settings };
}
