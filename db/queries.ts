import { getDb } from './client';
import type {
  CommonMiss,
  Course,
  Hole,
  JournalEntry,
  JournalTag,
  MostCostly,
  PostRoundReview,
  PreRoundGoals,
  Putt,
  RangeFocus,
  Round,
  Shot,
  ShotType,
  Tee,
} from './types';
import { uuid } from '@/lib/uuid';

// Appended to the SET clause of every local UPDATE/soft-delete so the row is
// re-pushed on the next sync. Inserts stamp the same pair inline
// (`updated_at, dirty` → `datetime('now'), 1`). The Phase 2 pull/apply path
// writes updated_at explicitly with dirty = 0 and must NOT use this.
const TOUCH = "updated_at = datetime('now'), dirty = 1";

// Soft-delete: tombstone the row (and re-push it) instead of removing it, so the
// deletion can propagate to other devices. Used in place of `DELETE`.
const SOFT_DELETE = `deleted_at = datetime('now'), ${TOUCH}`;

type HoleRow = {
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

type RoundRow = {
  id: string;
  course_name: string;
  date_played: string;
  hole_count: number;
  completed_at: string | null;
  tee_name: string | null;
  course_rating: number | null;
  slope_rating: number | null;
  include_in_handicap: number;
  exclude_from_sharing: number;
  created_at: string;
};

function rowToHole(row: HoleRow): Hole {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    par: row.par,
    fir: row.fir == null ? null : row.fir === 1,
    gir: row.gir == null ? null : row.gir === 1,
    upAndDown: row.up_and_down == null ? null : row.up_and_down === 1,
    approachDistanceYds: row.approach_distance_yds,
    approachClub: row.approach_club,
    driveClub: row.drive_club,
    score: row.score,
    putts: row.putts,
    chipShots: row.chip_shots,
    sandShots: row.sand_shots,
    penalties: row.penalties,
    greenBlocked: row.green_blocked == null ? null : row.green_blocked === 1,
    notes: row.notes,
  };
}

function rowToRound(row: RoundRow): Round {
  return {
    id: row.id,
    courseName: row.course_name,
    datePlayed: row.date_played,
    holeCount: row.hole_count,
    completedAt: row.completed_at,
    teeName: row.tee_name,
    courseRating: row.course_rating,
    slopeRating: row.slope_rating,
    includeInHandicap: row.include_in_handicap === 1,
    excludeFromSharing: row.exclude_from_sharing === 1,
    createdAt: row.created_at,
  };
}

export type CreateRoundInput = {
  courseName: string;
  datePlayed: string;
  holeCount: number;
  teeName?: string | null;
  courseRating?: number | null;
  slopeRating?: number | null;
  includeInHandicap?: boolean;
  excludeFromSharing?: boolean;
};

export async function createRound(input: CreateRoundInput): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO rounds
         (id, course_name, date_played, hole_count, tee_name, course_rating, slope_rating, include_in_handicap, exclude_from_sharing, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
      [
        id,
        input.courseName,
        input.datePlayed,
        input.holeCount,
        input.teeName ?? null,
        input.courseRating ?? null,
        input.slopeRating ?? null,
        (input.includeInHandicap ?? true) ? 1 : 0,
        (input.excludeFromSharing ?? false) ? 1 : 0,
      ],
    );
    for (let n = 1; n <= input.holeCount; n++) {
      await db.runAsync(
        `INSERT INTO holes (id, round_id, hole_number, updated_at, dirty)
         VALUES (?, ?, ?, datetime('now'), 1);`,
        [uuid(), id, n],
      );
    }
  });
  return id;
}

export async function listRounds(): Promise<Round[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoundRow>(
    `SELECT id, course_name, date_played, hole_count, completed_at,
            tee_name, course_rating, slope_rating, include_in_handicap,
            exclude_from_sharing, created_at
     FROM rounds
     WHERE deleted_at IS NULL
     ORDER BY date_played DESC, created_at DESC;`,
  );
  return rows.map(rowToRound);
}

export async function getRound(id: string): Promise<Round | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoundRow>(
    `SELECT id, course_name, date_played, hole_count, completed_at,
            tee_name, course_rating, slope_rating, include_in_handicap,
            exclude_from_sharing, created_at
     FROM rounds WHERE id = ? AND deleted_at IS NULL;`,
    [id],
  );
  return row ? rowToRound(row) : null;
}

export async function setRoundCompletedAt(
  id: string,
  completedAt: string | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE rounds SET completed_at = ?, ${TOUCH} WHERE id = ?;`, [
    completedAt,
    id,
  ]);
}

export async function setRoundIncludeInHandicap(
  id: string,
  include: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE rounds SET include_in_handicap = ?, ${TOUCH} WHERE id = ?;`, [
    include ? 1 : 0,
    id,
  ]);
}

// Toggle whether the round appears in friends' Community feed (0 = shared).
export async function setRoundExcludeFromSharing(
  id: string,
  exclude: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE rounds SET exclude_from_sharing = ?, ${TOUCH} WHERE id = ?;`, [
    exclude ? 1 : 0,
    id,
  ]);
}

// Update the per-round rating/slope snapshot used for the handicap differential.
// Either may be null (→ falls back to par / 113 in scoreDifferential).
export async function setRoundRatingSlope(
  id: string,
  courseRating: number | null,
  slopeRating: number | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE rounds SET course_rating = ?, slope_rating = ?, ${TOUCH} WHERE id = ?;`,
    [courseRating, slopeRating, id],
  );
}

// Soft-delete the round and cascade to its children. The FK ON DELETE CASCADE
// no longer fires (we don't hard-delete the parent), so each child table is
// tombstoned explicitly in the same transaction.
const ROUND_CHILD_TABLES = ['holes', 'shots', 'putts', 'post_round_reviews', 'pre_round_goals'];

export async function deleteRound(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE rounds SET ${SOFT_DELETE} WHERE id = ? AND deleted_at IS NULL;`, [
      id,
    ]);
    for (const table of ROUND_CHILD_TABLES) {
      await db.runAsync(
        `UPDATE ${table} SET ${SOFT_DELETE} WHERE round_id = ? AND deleted_at IS NULL;`,
        [id],
      );
    }
  });
}

// --- Saved courses + tees (for handicap rating/slope autofill) -------------

type CourseRow = { id: string; name: string; created_at: string };

function rowToCourse(row: CourseRow): Course {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

type TeeRow = {
  id: string;
  course_id: string;
  name: string;
  course_rating: number;
  slope_rating: number;
  par: number | null;
  created_at: string;
};

function rowToTee(row: TeeRow): Tee {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    courseRating: row.course_rating,
    slopeRating: row.slope_rating,
    par: row.par,
    createdAt: row.created_at,
  };
}

export async function getCourses(): Promise<Course[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CourseRow>(
    `SELECT id, name, created_at FROM courses
     WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC;`,
  );
  return rows.map(rowToCourse);
}

export async function getTeesForCourse(courseId: string): Promise<Tee[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TeeRow>(
    `SELECT id, course_id, name, course_rating, slope_rating, par, created_at
     FROM tees WHERE course_id = ? AND deleted_at IS NULL
     ORDER BY course_rating DESC, created_at ASC;`,
    [courseId],
  );
  return rows.map(rowToTee);
}

// Find an existing course by name (case-insensitive) or create it. Returns the
// course id so a tee can be attached.
export async function findOrCreateCourse(name: string): Promise<string> {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM courses WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL;`,
    [trimmed],
  );
  if (existing) return existing.id;
  const id = uuid();
  await db.runAsync(
    `INSERT INTO courses (id, name, updated_at, dirty) VALUES (?, ?, datetime('now'), 1);`,
    [id, trimmed],
  );
  return id;
}

export type CreateTeeInput = {
  courseId: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  par?: number | null;
};

export async function createTee(input: CreateTeeInput): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO tees (id, course_id, name, course_rating, slope_rating, par, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
    [id, input.courseId, input.name.trim(), input.courseRating, input.slopeRating, input.par ?? null],
  );
  return id;
}

export async function getHolesForRound(roundId: string): Promise<Hole[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HoleRow>(
    `SELECT id, round_id, hole_number, par, fir, gir, up_and_down,
            approach_distance_yds, approach_club, drive_club, score, putts,
            chip_shots, sand_shots, penalties, green_blocked, notes
     FROM holes
     WHERE round_id = ? AND deleted_at IS NULL
     ORDER BY hole_number ASC;`,
    [roundId],
  );
  return rows.map(rowToHole);
}

// Whole-table fetch for the lifetime stats tab. Local SQLite + a pre-launch
// data volume make a single SELECT cheaper than per-round round-trips; the
// stats screen groups these by round_id in JS.
export async function getAllHoles(): Promise<Hole[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HoleRow>(
    `SELECT id, round_id, hole_number, par, fir, gir, up_and_down,
            approach_distance_yds, approach_club, drive_club, score, putts,
            chip_shots, sand_shots, penalties, green_blocked, notes
     FROM holes
     WHERE deleted_at IS NULL
     ORDER BY round_id ASC, hole_number ASC;`,
  );
  return rows.map(rowToHole);
}

export async function getHole(roundId: string, holeNumber: number): Promise<Hole | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<HoleRow>(
    `SELECT id, round_id, hole_number, par, fir, gir, up_and_down,
            approach_distance_yds, approach_club, drive_club, score, putts,
            chip_shots, sand_shots, penalties, green_blocked, notes
     FROM holes
     WHERE round_id = ? AND hole_number = ? AND deleted_at IS NULL;`,
    [roundId, holeNumber],
  );
  return row ? rowToHole(row) : null;
}

type HoleUpdatableFields = Omit<Hole, 'id' | 'roundId' | 'holeNumber'>;

const FIELD_TO_COLUMN: Record<keyof HoleUpdatableFields, string> = {
  par: 'par',
  fir: 'fir',
  gir: 'gir',
  upAndDown: 'up_and_down',
  approachDistanceYds: 'approach_distance_yds',
  approachClub: 'approach_club',
  driveClub: 'drive_club',
  score: 'score',
  putts: 'putts',
  chipShots: 'chip_shots',
  sandShots: 'sand_shots',
  penalties: 'penalties',
  greenBlocked: 'green_blocked',
  notes: 'notes',
};

function toSqlValue(field: keyof HoleUpdatableFields, value: unknown): unknown {
  if (value == null) return null;
  if (field === 'fir' || field === 'gir' || field === 'upAndDown' || field === 'greenBlocked') {
    return value ? 1 : 0;
  }
  return value;
}

export async function updateHole(
  roundId: string,
  holeNumber: number,
  patch: Partial<HoleUpdatableFields>,
): Promise<void> {
  const entries = (Object.entries(patch) as [keyof HoleUpdatableFields, unknown][]).filter(
    ([key]) => key in FIELD_TO_COLUMN,
  );
  if (entries.length === 0) return;

  const setClause = entries.map(([key]) => `${FIELD_TO_COLUMN[key]} = ?`).join(', ');
  const values = entries.map(([key, value]) => toSqlValue(key, value));

  const db = await getDb();
  await db.runAsync(
    `UPDATE holes SET ${setClause}, ${TOUCH} WHERE round_id = ? AND hole_number = ?;`,
    [...(values as (string | number | null)[]), roundId, holeNumber],
  );
}

type ShotRow = {
  id: string;
  round_id: string;
  hole_number: number;
  shot_type: ShotType;
  x_norm: number;
  y_norm: number;
  intended_x_norm: number | null;
  intended_y_norm: number | null;
  notes: string | null;
};

function rowToShot(row: ShotRow): Shot {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    shotType: row.shot_type,
    xNorm: row.x_norm,
    yNorm: row.y_norm,
    intendedXNorm: row.intended_x_norm,
    intendedYNorm: row.intended_y_norm,
    notes: row.notes,
  };
}

export type UpsertShotInput = {
  roundId: string;
  holeNumber: number;
  shotType: ShotType;
  xNorm: number;
  yNorm: number;
  notes?: string | null;
};

export async function upsertShot(input: UpsertShotInput): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.withTransactionAsync(async () => {
    // Tombstone any existing live shot in this slot, then insert the replacement.
    await db.runAsync(
      `UPDATE shots SET ${SOFT_DELETE}
       WHERE round_id = ? AND hole_number = ? AND shot_type = ? AND deleted_at IS NULL;`,
      [input.roundId, input.holeNumber, input.shotType],
    );
    await db.runAsync(
      `INSERT INTO shots (id, round_id, hole_number, shot_type, x_norm, y_norm, notes, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
      [
        id,
        input.roundId,
        input.holeNumber,
        input.shotType,
        input.xNorm,
        input.yNorm,
        input.notes ?? null,
      ],
    );
  });
  return id;
}

export async function deleteShot(
  roundId: string,
  holeNumber: number,
  shotType: ShotType,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE shots SET ${SOFT_DELETE}
     WHERE round_id = ? AND hole_number = ? AND shot_type = ? AND deleted_at IS NULL;`,
    [roundId, holeNumber, shotType],
  );
}

export async function getShotsForRound(roundId: string): Promise<Shot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ShotRow>(
    `SELECT id, round_id, hole_number, shot_type, x_norm, y_norm,
            intended_x_norm, intended_y_norm, notes
     FROM shots WHERE round_id = ? AND deleted_at IS NULL
     ORDER BY hole_number ASC, shot_type ASC;`,
    [roundId],
  );
  return rows.map(rowToShot);
}

export async function getAllShots(): Promise<Shot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ShotRow>(
    `SELECT id, round_id, hole_number, shot_type, x_norm, y_norm,
            intended_x_norm, intended_y_norm, notes
     FROM shots
     WHERE deleted_at IS NULL
     ORDER BY round_id ASC, hole_number ASC, shot_type ASC;`,
  );
  return rows.map(rowToShot);
}

export async function getShotsForHole(
  roundId: string,
  holeNumber: number,
): Promise<Shot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ShotRow>(
    `SELECT id, round_id, hole_number, shot_type, x_norm, y_norm,
            intended_x_norm, intended_y_norm, notes
     FROM shots WHERE round_id = ? AND hole_number = ? AND deleted_at IS NULL;`,
    [roundId, holeNumber],
  );
  return rows.map(rowToShot);
}

type PuttRow = {
  id: string;
  round_id: string;
  hole_number: number;
  distance_ft: number;
  made: number;
  created_at: string;
};

function rowToPutt(row: PuttRow): Putt {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    distanceFt: row.distance_ft,
    made: row.made === 1,
    createdAt: row.created_at,
  };
}

export type CreatePuttInput = {
  roundId: string;
  holeNumber: number;
  distanceFt: number;
  made: boolean;
};

async function syncHolePuttsCount(
  db: Awaited<ReturnType<typeof getDb>>,
  roundId: string,
  holeNumber: number,
): Promise<void> {
  const result = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM putts
     WHERE round_id = ? AND hole_number = ? AND deleted_at IS NULL;`,
    [roundId, holeNumber],
  );
  await db.runAsync(
    `UPDATE holes SET putts = ?, ${TOUCH} WHERE round_id = ? AND hole_number = ?;`,
    [result?.c ?? 0, roundId, holeNumber],
  );
}

export async function createPutt(input: CreatePuttInput): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO putts (id, round_id, hole_number, distance_ft, made, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 1);`,
      [id, input.roundId, input.holeNumber, input.distanceFt, input.made ? 1 : 0],
    );
    await syncHolePuttsCount(db, input.roundId, input.holeNumber);
  });
  return id;
}

export async function deletePutt(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ round_id: string; hole_number: number }>(
      `SELECT round_id, hole_number FROM putts WHERE id = ? AND deleted_at IS NULL;`,
      [id],
    );
    if (!row) return;
    await db.runAsync(`UPDATE putts SET ${SOFT_DELETE} WHERE id = ?;`, [id]);
    await syncHolePuttsCount(db, row.round_id, row.hole_number);
  });
}

export async function getPuttsForRound(roundId: string): Promise<Putt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PuttRow>(
    `SELECT id, round_id, hole_number, distance_ft, made, created_at
     FROM putts WHERE round_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC;`,
    [roundId],
  );
  return rows.map(rowToPutt);
}

export async function getAllPutts(): Promise<Putt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PuttRow>(
    `SELECT id, round_id, hole_number, distance_ft, made, created_at
     FROM putts
     WHERE deleted_at IS NULL
     ORDER BY round_id ASC, created_at ASC;`,
  );
  return rows.map(rowToPutt);
}

export async function getPuttsForHole(
  roundId: string,
  holeNumber: number,
): Promise<Putt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PuttRow>(
    `SELECT id, round_id, hole_number, distance_ft, made, created_at
     FROM putts WHERE round_id = ? AND hole_number = ? AND deleted_at IS NULL
     ORDER BY created_at ASC;`,
    [roundId, holeNumber],
  );
  return rows.map(rowToPutt);
}

type PostRoundReviewRow = {
  id: string;
  round_id: string;
  most_costly: string | null;
  decision_making_rating: number | null;
  common_miss: string | null;
  range_focus: string | null;
  overall_rating: number | null;
  created_at: string;
};

function rowToReview(row: PostRoundReviewRow): PostRoundReview {
  return {
    id: row.id,
    roundId: row.round_id,
    mostCostly: (row.most_costly as MostCostly | null) ?? null,
    decisionMakingRating: row.decision_making_rating,
    commonMiss:
      row.common_miss != null && row.common_miss.length > 0
        ? ((row.common_miss.split(',')[0] || null) as CommonMiss | null)
        : null,
    rangeFocus: (row.range_focus as RangeFocus | null) ?? null,
    overallRating: row.overall_rating,
    createdAt: row.created_at,
  };
}

export async function getReview(roundId: string): Promise<PostRoundReview | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PostRoundReviewRow>(
    `SELECT id, round_id, most_costly, decision_making_rating, common_miss,
            range_focus, overall_rating, created_at
     FROM post_round_reviews
     WHERE round_id = ? AND deleted_at IS NULL;`,
    [roundId],
  );
  return row ? rowToReview(row) : null;
}

export async function getAllReviews(): Promise<PostRoundReview[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PostRoundReviewRow>(
    `SELECT id, round_id, most_costly, decision_making_rating, common_miss,
            range_focus, overall_rating, created_at
     FROM post_round_reviews
     WHERE deleted_at IS NULL;`,
  );
  return rows.map(rowToReview);
}

export type UpsertReviewInput = {
  roundId: string;
  mostCostly: MostCostly;
  decisionMakingRating: number;
  commonMiss: CommonMiss;
  rangeFocus: RangeFocus;
  overallRating: number;
};

export async function upsertReview(input: UpsertReviewInput): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM post_round_reviews WHERE round_id = ?;`,
    [input.roundId],
  );
  const commonMiss = input.commonMiss;
  if (existing) {
    await db.runAsync(
      `UPDATE post_round_reviews
       SET most_costly = ?, decision_making_rating = ?, common_miss = ?,
           range_focus = ?, overall_rating = ?, ${TOUCH}
       WHERE round_id = ?;`,
      [
        input.mostCostly,
        input.decisionMakingRating,
        commonMiss,
        input.rangeFocus,
        input.overallRating,
        input.roundId,
      ],
    );
  } else {
    await db.runAsync(
      `INSERT INTO post_round_reviews
         (id, round_id, most_costly, decision_making_rating, common_miss,
          range_focus, overall_rating, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
      [
        uuid(),
        input.roundId,
        input.mostCostly,
        input.decisionMakingRating,
        commonMiss,
        input.rangeFocus,
        input.overallRating,
      ],
    );
  }
}

// --- Pre-round goals -------------------------------------------------------

type PreRoundGoalsRow = {
  id: string;
  round_id: string;
  execution_goal: string | null;
  strategic_goal: string | null;
  mental_goal: string | null;
  created_at: string;
};

function rowToGoals(row: PreRoundGoalsRow): PreRoundGoals {
  return {
    id: row.id,
    roundId: row.round_id,
    execution: row.execution_goal,
    strategic: row.strategic_goal,
    mental: row.mental_goal,
    createdAt: row.created_at,
  };
}

export async function getGoals(roundId: string): Promise<PreRoundGoals | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PreRoundGoalsRow>(
    `SELECT id, round_id, execution_goal, strategic_goal, mental_goal, created_at
     FROM pre_round_goals
     WHERE round_id = ? AND deleted_at IS NULL;`,
    [roundId],
  );
  return row ? rowToGoals(row) : null;
}

export type UpsertGoalsInput = {
  roundId: string;
  execution: string | null;
  strategic: string | null;
  mental: string | null;
};

export async function upsertGoals(input: UpsertGoalsInput): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM pre_round_goals WHERE round_id = ?;`,
    [input.roundId],
  );
  if (existing) {
    await db.runAsync(
      `UPDATE pre_round_goals
       SET execution_goal = ?, strategic_goal = ?, mental_goal = ?, ${TOUCH}
       WHERE round_id = ?;`,
      [input.execution, input.strategic, input.mental, input.roundId],
    );
  } else {
    await db.runAsync(
      `INSERT INTO pre_round_goals
         (id, round_id, execution_goal, strategic_goal, mental_goal, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 1);`,
      [uuid(), input.roundId, input.execution, input.strategic, input.mental],
    );
  }
}

// --- App settings (global, not per-round) ---------------------------------

const BAG_KEY = 'bag';

// The player's club bag, stored as a JSON array of club names. Returns [] when
// never set — callers treat an empty bag as "all clubs".
export async function getBag(): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM app_settings WHERE key = ? AND deleted_at IS NULL;`,
    [BAG_KEY],
  );
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export async function setBag(clubs: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at, dirty)
       VALUES (?, ?, datetime('now'), 1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, ${TOUCH};`,
    [BAG_KEY, JSON.stringify(clubs)],
  );
}

const CLUB_YARDAGES_KEY = 'club_yardages';

// The player's stock (full-swing) carry per club, stored as a JSON map of
// club name -> yards. This is the single source of truth for a club's full
// distance — the wedge grid's "full" column reads from here too. Returns {}
// when never set.
export async function getClubYardages(): Promise<Record<string, number>> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM app_settings WHERE key = ? AND deleted_at IS NULL;`,
    [CLUB_YARDAGES_KEY],
  );
  if (!row?.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    if (parsed == null || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [club, yds] of Object.entries(parsed)) {
      if (typeof yds === 'number' && Number.isFinite(yds)) out[club] = yds;
    }
    return out;
  } catch {
    return {};
  }
}

// Set (or, with null, clear) a single club's stock yardage via read-modify-write
// of the stored map.
export async function setClubYardage(club: string, yds: number | null): Promise<void> {
  const map = await getClubYardages();
  if (yds == null) {
    delete map[club];
  } else {
    map[club] = yds;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at, dirty)
       VALUES (?, ?, datetime('now'), 1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, ${TOUCH};`,
    [CLUB_YARDAGES_KEY, JSON.stringify(map)],
  );
}

// Generic string-valued setting (key/value), for small UI prefs like the wedge
// grid's axis-label mode.
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM app_settings WHERE key = ? AND deleted_at IS NULL;`,
    [key],
  );
  return row?.value ?? null;
}

// Settings that must NOT sync: the sync engine's own bookkeeping (cursor +
// last-synced timestamp) is inherently per-device. Everything else in
// app_settings (bag, yardages, theme, intro-seen, …) syncs. These keys don't
// exist until Phase 2, but the guard lives here so the denylist is in place.
const LOCAL_ONLY_SETTING_KEYS = new Set(['sync_cursor', 'sync_last_synced_at']);

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  const dirty = LOCAL_ONLY_SETTING_KEYS.has(key) ? 0 : 1;
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at, dirty)
       VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now'), dirty = ?;`,
    [key, value, dirty, dirty],
  );
}

// --- Journal (standalone, not per-round) -----------------------------------

type JournalEntryRow = {
  id: string;
  tag: string;
  body: string | null;
  created_at: string;
  updated_at: string;
};

function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    tag: row.tag as JournalTag,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<JournalEntryRow>(
    `SELECT id, tag, body, created_at, updated_at
     FROM journal_entries
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC, created_at DESC;`,
  );
  return rows.map(rowToJournalEntry);
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<JournalEntryRow>(
    `SELECT id, tag, body, created_at, updated_at
     FROM journal_entries WHERE id = ? AND deleted_at IS NULL;`,
    [id],
  );
  return row ? rowToJournalEntry(row) : null;
}

export async function createJournalEntry(input: {
  tag: JournalTag;
  body: string | null;
}): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO journal_entries (id, tag, body) VALUES (?, ?, ?);`,
    [id, input.tag, input.body ?? null],
  );
  return id;
}

export async function updateJournalEntry(
  id: string,
  patch: { tag?: JournalTag; body?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  if (patch.tag !== undefined) {
    sets.push('tag = ?');
    values.push(patch.tag);
  }
  if (patch.body !== undefined) {
    sets.push('body = ?');
    values.push(patch.body);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  sets.push('dirty = 1');

  const db = await getDb();
  await db.runAsync(
    `UPDATE journal_entries SET ${sets.join(', ')} WHERE id = ?;`,
    [...values, id],
  );
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE journal_entries SET ${SOFT_DELETE} WHERE id = ? AND deleted_at IS NULL;`, [
    id,
  ]);
}

const WEDGE_PARTIALS_KEY = 'wedge_partials';

// The ¾ and ½ swing carries per wedge. The "full" carry is the club's stock
// yardage (see getClubYardages) — the single source of truth shared with the
// Stock Yardages screen. Only the partials live here.
export type WedgePartials = { tq: number | null; half: number | null; quarter: number | null };

const EMPTY_PARTIALS: WedgePartials = { tq: null, half: null, quarter: null };

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function getWedgePartials(): Promise<Record<string, WedgePartials>> {
  const raw = await getSetting(WEDGE_PARTIALS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object') return {};
    const out: Record<string, WedgePartials> = {};
    for (const [club, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v == null || typeof v !== 'object') continue;
      const rec = v as Record<string, unknown>;
      out[club] = { tq: num(rec.tq), half: num(rec.half), quarter: num(rec.quarter) };
    }
    return out;
  } catch {
    return {};
  }
}

export async function setWedgePartial(
  club: string,
  kind: keyof WedgePartials,
  yds: number | null,
): Promise<void> {
  const map = await getWedgePartials();
  const next: WedgePartials = { ...(map[club] ?? EMPTY_PARTIALS), [kind]: yds };
  if (next.tq == null && next.half == null && next.quarter == null) {
    delete map[club];
  } else {
    map[club] = next;
  }
  await setSetting(WEDGE_PARTIALS_KEY, JSON.stringify(map));
}
