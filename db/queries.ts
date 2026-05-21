import { getDb } from './client';
import type {
  CommonMiss,
  Hole,
  MostCostly,
  PostRoundReview,
  Putt,
  RangeFocus,
  Round,
  Shot,
  ShotType,
} from './types';
import { uuid } from '@/lib/uuid';

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
  score: number | null;
  putts: number | null;
  chip_shots: number | null;
  sand_shots: number | null;
  penalties: number | null;
  notes: string | null;
};

type RoundRow = {
  id: string;
  course_name: string;
  date_played: string;
  hole_count: number;
  completed_at: string | null;
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
    score: row.score,
    putts: row.putts,
    chipShots: row.chip_shots,
    sandShots: row.sand_shots,
    penalties: row.penalties,
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
    createdAt: row.created_at,
  };
}

export type CreateRoundInput = {
  courseName: string;
  datePlayed: string;
  holeCount: number;
};

export async function createRound(input: CreateRoundInput): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO rounds (id, course_name, date_played, hole_count) VALUES (?, ?, ?, ?);`,
      [id, input.courseName, input.datePlayed, input.holeCount],
    );
    for (let n = 1; n <= input.holeCount; n++) {
      await db.runAsync(
        `INSERT INTO holes (id, round_id, hole_number) VALUES (?, ?, ?);`,
        [uuid(), id, n],
      );
    }
  });
  return id;
}

export async function listRounds(): Promise<Round[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoundRow>(
    `SELECT id, course_name, date_played, hole_count, completed_at, created_at
     FROM rounds
     ORDER BY date_played DESC, created_at DESC;`,
  );
  return rows.map(rowToRound);
}

export async function getRound(id: string): Promise<Round | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoundRow>(
    `SELECT id, course_name, date_played, hole_count, completed_at, created_at
     FROM rounds WHERE id = ?;`,
    [id],
  );
  return row ? rowToRound(row) : null;
}

export async function setRoundCompletedAt(
  id: string,
  completedAt: string | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE rounds SET completed_at = ? WHERE id = ?;`, [completedAt, id]);
}

export async function deleteRound(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM rounds WHERE id = ?;`, [id]);
}

export async function getHolesForRound(roundId: string): Promise<Hole[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HoleRow>(
    `SELECT id, round_id, hole_number, par, fir, gir, up_and_down,
            approach_distance_yds, approach_club, score, putts,
            chip_shots, sand_shots, penalties, notes
     FROM holes
     WHERE round_id = ?
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
            approach_distance_yds, approach_club, score, putts,
            chip_shots, sand_shots, penalties, notes
     FROM holes
     ORDER BY round_id ASC, hole_number ASC;`,
  );
  return rows.map(rowToHole);
}

export async function getHole(roundId: string, holeNumber: number): Promise<Hole | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<HoleRow>(
    `SELECT id, round_id, hole_number, par, fir, gir, up_and_down,
            approach_distance_yds, approach_club, score, putts,
            chip_shots, sand_shots, penalties, notes
     FROM holes
     WHERE round_id = ? AND hole_number = ?;`,
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
  score: 'score',
  putts: 'putts',
  chipShots: 'chip_shots',
  sandShots: 'sand_shots',
  penalties: 'penalties',
  notes: 'notes',
};

function toSqlValue(field: keyof HoleUpdatableFields, value: unknown): unknown {
  if (value == null) return null;
  if (field === 'fir' || field === 'gir' || field === 'upAndDown') {
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
    `UPDATE holes SET ${setClause} WHERE round_id = ? AND hole_number = ?;`,
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
    await db.runAsync(
      `DELETE FROM shots WHERE round_id = ? AND hole_number = ? AND shot_type = ?;`,
      [input.roundId, input.holeNumber, input.shotType],
    );
    await db.runAsync(
      `INSERT INTO shots (id, round_id, hole_number, shot_type, x_norm, y_norm, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
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
    `DELETE FROM shots WHERE round_id = ? AND hole_number = ? AND shot_type = ?;`,
    [roundId, holeNumber, shotType],
  );
}

export async function getShotsForRound(roundId: string): Promise<Shot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ShotRow>(
    `SELECT id, round_id, hole_number, shot_type, x_norm, y_norm,
            intended_x_norm, intended_y_norm, notes
     FROM shots WHERE round_id = ?
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
     FROM shots WHERE round_id = ? AND hole_number = ?;`,
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
    `SELECT COUNT(*) as c FROM putts WHERE round_id = ? AND hole_number = ?;`,
    [roundId, holeNumber],
  );
  await db.runAsync(
    `UPDATE holes SET putts = ? WHERE round_id = ? AND hole_number = ?;`,
    [result?.c ?? 0, roundId, holeNumber],
  );
}

export async function createPutt(input: CreatePuttInput): Promise<string> {
  const db = await getDb();
  const id = uuid();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO putts (id, round_id, hole_number, distance_ft, made)
       VALUES (?, ?, ?, ?, ?);`,
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
      `SELECT round_id, hole_number FROM putts WHERE id = ?;`,
      [id],
    );
    if (!row) return;
    await db.runAsync(`DELETE FROM putts WHERE id = ?;`, [id]);
    await syncHolePuttsCount(db, row.round_id, row.hole_number);
  });
}

export async function getPuttsForRound(roundId: string): Promise<Putt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PuttRow>(
    `SELECT id, round_id, hole_number, distance_ft, made, created_at
     FROM putts WHERE round_id = ?
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
     FROM putts WHERE round_id = ? AND hole_number = ?
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
     WHERE round_id = ?;`,
    [roundId],
  );
  return row ? rowToReview(row) : null;
}

export async function getAllReviews(): Promise<PostRoundReview[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PostRoundReviewRow>(
    `SELECT id, round_id, most_costly, decision_making_rating, common_miss,
            range_focus, overall_rating, created_at
     FROM post_round_reviews;`,
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
           range_focus = ?, overall_rating = ?
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
          range_focus, overall_rating)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
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

// --- App settings (global, not per-round) ---------------------------------

const BAG_KEY = 'bag';

// The player's club bag, stored as a JSON array of club names. Returns [] when
// never set — callers treat an empty bag as "all clubs".
export async function getBag(): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM app_settings WHERE key = ?;`,
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
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
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
    `SELECT value FROM app_settings WHERE key = ?;`,
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
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [CLUB_YARDAGES_KEY, JSON.stringify(map)],
  );
}

// Generic string-valued setting (key/value), for small UI prefs like the wedge
// grid's axis-label mode.
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM app_settings WHERE key = ?;`,
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value],
  );
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
