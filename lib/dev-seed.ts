import { getDb } from '@/db/client';
import { uuid } from '@/lib/uuid';

// Dev-only sample-data generator for testing the Stats tab on a simulator.
// Seeds realistic, completed rounds whose skill improves over time so the
// over-time trends actually have a story to tell. Never shipped (gated by
// __DEV__ at the call site).

// Each course carries a tee with an 18-hole Course/Slope Rating so the handicap
// section has realistic inputs. 9-hole rounds snapshot roughly half the rating.
const COURSES: { name: string; tee: string; rating: number; slope: number }[] = [
  { name: 'Pebble Creek', tee: 'Blue', rating: 71.2, slope: 128 },
  { name: 'Highland Links', tee: 'White', rating: 70.1, slope: 122 },
  { name: 'Riverbend G&CC', tee: 'Blue', rating: 72.4, slope: 134 },
  { name: 'Oakmont Muni', tee: 'White', rating: 69.3, slope: 118 },
  { name: 'Cypress Hollow', tee: 'Gold', rating: 73.0, slope: 140 },
  { name: 'The Meadows', tee: 'White', rating: 68.8, slope: 113 },
  { name: 'Stonebridge', tee: 'Blue', rating: 71.8, slope: 131 },
];

// Standard par layouts. 9-hole rounds use the front nine (par 36).
const FRONT_NINE = [4, 5, 3, 4, 4, 3, 5, 4, 4];
const BACK_NINE = [4, 3, 5, 4, 4, 3, 4, 5, 4];
const PARS_18 = [...FRONT_NINE, ...BACK_NINE];

const MOST_COSTLY = ['putting', 'driving', 'wedge_play', 'mid_irons', 'long_irons'];
const COMMON_MISS = ['left', 'right', 'long', 'short', 'mixed'];
const RANGE_FOCUS = [
  'tempo',
  'technique',
  'approach_game',
  'chipping',
  'putting',
  'pre_shot_routine',
  'short_game',
];

const APPROACH_CLUBS = ['PW', '9i', '8i', '7i', '6i', '52°', '56°'];
// Tee clubs, weighted toward the driver but spanning woods, hybrids, and high
// irons so the per-club driver dispersion filter has plenty to slice by.
const DRIVE_CLUBS = [
  'Driver',
  'Driver',
  'Driver',
  'Driver',
  'Mini Driver',
  '3W',
  '5W',
  '7W',
  '3H',
  '4H',
  '5H',
  '2i',
  '3i',
  '4i',
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(p: number): boolean {
  return Math.random() < p;
}

// Box–Muller normal sample.
function gauss(mean = 0, sd = 1): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Weighted pick: keys are values, weights are relative probabilities.
function weightedPick<T extends number | string>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = Math.random() * total;
  for (const [value, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

type HoleSeed = {
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fir: number | null;
  gir: boolean;
  chipShots: number | null;
  sandShots: number | null;
  penalties: number | null;
  approachDistance: number | null;
  approachClub: string | null;
  driveClub: string | null;
  drive: { x: number; y: number } | null;
  approach: { x: number; y: number };
  puttRows: { distanceFt: number; made: number }[];
};

function buildPuttRows(putts: number, gir: boolean): { distanceFt: number; made: number }[] {
  if (putts <= 0) return [];
  if (putts === 1) {
    const d = weightedPick<number>([
      [3, gir ? 0.35 : 0.55],
      [10, 0.4],
      [15, 0.18],
      [25, 0.07],
    ]);
    return [{ distanceFt: d, made: 1 }];
  }
  if (putts === 2) {
    const first = weightedPick<number>([
      [10, 0.2],
      [15, 0.3],
      [25, 0.3],
      [50, 0.2],
    ]);
    const second = weightedPick<number>([
      [3, 0.6],
      [10, 0.4],
    ]);
    return [
      { distanceFt: first, made: 0 },
      { distanceFt: second, made: 1 },
    ];
  }
  if (putts === 3) {
    return [
      { distanceFt: weightedPick<number>([[25, 0.4], [50, 0.6]]), made: 0 },
      { distanceFt: weightedPick<number>([[10, 0.4], [15, 0.4], [25, 0.2]]), made: 0 },
      { distanceFt: weightedPick<number>([[3, 0.7], [10, 0.3]]), made: 1 },
    ];
  }
  // 4-putt — rare.
  return [
    { distanceFt: 50, made: 0 },
    { distanceFt: 25, made: 0 },
    { distanceFt: 10, made: 0 },
    { distanceFt: 3, made: 1 },
  ];
}

function buildHole(holeNumber: number, par: number, skill: number): HoleSeed {
  // Score relative to par, distribution shifts toward par/birdie as skill rises.
  let delta = weightedPick<number>([
    [-1, 0.03 + 0.1 * skill],
    [0, 0.28 + 0.27 * skill],
    [1, 0.4 - 0.12 * skill],
    [2, 0.2 - 0.15 * skill],
    [3, 0.09 - 0.1 * skill],
  ]);
  // Occasional eagle on par 5.
  if (par === 5 && delta === -1 && chance(0.12)) delta = -2;
  const score = Math.max(2, par + delta);

  // Putts, capped so there's at least one stroke to reach the green.
  let putts = weightedPick<number>([
    [1, 0.15 + 0.1 * skill],
    [2, 0.6],
    [3, 0.2 - 0.12 * skill],
    [4, 0.05 - 0.04 * skill],
  ]);
  putts = clamp(putts, 0, score - 1);

  const gir = score - putts <= par - 2;

  const fir = par >= 4 ? (chance(0.4 + 0.25 * skill) ? 1 : 0) : null;

  // Drive position consistent with the FIR flag (CF when hit, LF/RF when missed).
  let drive: { x: number; y: number } | null = null;
  if (par >= 4) {
    if (fir === 1) {
      drive = { x: clamp(gauss(0.5, 0.06), 0.34, 0.66), y: clamp(gauss(0.4, 0.12), 0.12, 0.85) };
    } else {
      const left = chance(0.5);
      drive = {
        x: left ? rand(0.08, 0.27) : rand(0.73, 0.92),
        y: clamp(gauss(0.42, 0.12), 0.12, 0.85),
      };
    }
  }

  // Approach position consistent with GIR (inside the rings vs. just off).
  const angle = rand(0, Math.PI * 2);
  const r = gir ? Math.min(0.44, Math.abs(gauss(0, 0.18))) : clamp(0.47 + Math.abs(gauss(0, 0.06)), 0.47, 0.63);
  const approach = {
    x: clamp(0.5 + r * Math.cos(angle), 0.03, 0.97),
    y: clamp(0.5 + r * Math.sin(angle), 0.03, 0.97),
  };

  const chipShots = !gir ? (chance(0.65) ? (chance(0.85) ? 1 : 2) : 0) : 0;
  const sandShots = chance(0.08) ? 1 : 0;
  const penalties = chance(0.12) ? (chance(0.2) ? 2 : 1) : 0;

  return {
    holeNumber,
    par,
    score,
    putts,
    fir,
    gir,
    chipShots,
    sandShots,
    penalties,
    approachDistance: randInt(70, 190),
    approachClub: pick(APPROACH_CLUBS),
    driveClub: drive ? pick(DRIVE_CLUBS) : null,
    drive,
    approach,
    puttRows: buildPuttRows(putts, gir),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function seedSampleRounds(count = 70): Promise<void> {
  const db = await getDb();

  // Dates ascending, ending today; ~weekly cadence.
  const today = new Date();
  let cursor = new Date(today.getTime() - count * 7 * 86400000 - 7 * 86400000);

  await db.withTransactionAsync(async () => {
    // Seed the saved courses + tees so the New Round picker is populated.
    for (const c of COURSES) {
      await db.runAsync(
        `INSERT INTO courses (id, name, updated_at, dirty)
         SELECT ?, ?, datetime('now'), 1
         WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = ? COLLATE NOCASE);`,
        [uuid(), c.name, c.name],
      );
      const row = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM courses WHERE name = ? COLLATE NOCASE;`,
        [c.name],
      );
      if (row) {
        await db.runAsync(
          `INSERT INTO tees (id, course_id, name, course_rating, slope_rating, par, updated_at, dirty)
           SELECT ?, ?, ?, ?, ?, ?, datetime('now'), 1
           WHERE NOT EXISTS (SELECT 1 FROM tees WHERE course_id = ? AND name = ?);`,
          [uuid(), row.id, c.tee, c.rating, c.slope, 72, row.id, c.tee],
        );
      }
    }

    const holeStmt = await db.prepareAsync(
      `INSERT INTO holes (id, round_id, hole_number, par, fir, gir, up_and_down,
        approach_distance_yds, approach_club, drive_club, score, putts, chip_shots, sand_shots,
        penalties, notes, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), 1);`,
    );
    const shotStmt = await db.prepareAsync(
      `INSERT INTO shots (id, round_id, hole_number, shot_type, x_norm, y_norm, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
    );
    const puttStmt = await db.prepareAsync(
      `INSERT INTO putts (id, round_id, hole_number, distance_ft, made, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
    );

    try {
      for (let i = 0; i < count; i++) {
        cursor = new Date(cursor.getTime() + randInt(3, 11) * 86400000);
        if (cursor > today) cursor = today;
        const date = isoDate(cursor);

        // Skill 0→1 over the season, plus a per-round form swing.
        const baseSkill = 0.15 + 0.7 * (i / Math.max(1, count - 1));
        const skill = clamp(baseSkill + gauss(0, 0.12), 0, 1);

        const holeCount = chance(0.78) ? 18 : 9;
        const pars = holeCount === 18 ? PARS_18 : FRONT_NINE;

        const roundId = uuid();
        const course = pick(COURSES);
        // 9-hole rounds snapshot roughly half the 18-hole rating.
        const rating =
          holeCount === 18 ? course.rating : Math.round((course.rating / 2) * 10) / 10;
        await db.runAsync(
          `INSERT INTO rounds
             (id, course_name, date_played, hole_count, completed_at, created_at,
              tee_name, course_rating, slope_rating, updated_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
          [
            roundId,
            course.name,
            date,
            holeCount,
            `${date}T20:30:00.000Z`,
            `${date} 12:00:00`,
            course.tee,
            rating,
            course.slope,
          ],
        );

        for (let h = 0; h < pars.length; h++) {
          const hole = buildHole(h + 1, pars[h], skill);
          await holeStmt.executeAsync([
            uuid(),
            roundId,
            hole.holeNumber,
            hole.par,
            hole.fir,
            hole.approachDistance,
            hole.approachClub,
            hole.driveClub,
            hole.score,
            hole.putts,
            hole.chipShots,
            hole.sandShots,
            hole.penalties,
          ]);

          if (hole.drive) {
            await shotStmt.executeAsync([
              uuid(),
              roundId,
              hole.holeNumber,
              'driver',
              hole.drive.x,
              hole.drive.y,
            ]);
          }
          await shotStmt.executeAsync([
            uuid(),
            roundId,
            hole.holeNumber,
            'approach',
            hole.approach.x,
            hole.approach.y,
          ]);

          for (const p of hole.puttRows) {
            await puttStmt.executeAsync([
              uuid(),
              roundId,
              hole.holeNumber,
              p.distanceFt,
              p.made,
              `${date} 13:00:00`,
            ]);
          }
        }

        // Post-round review — ratings improve with skill.
        await db.runAsync(
          `INSERT INTO post_round_reviews
            (id, round_id, most_costly, decision_making_rating, common_miss,
             range_focus, overall_rating, created_at, updated_at, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1);`,
          [
            uuid(),
            roundId,
            pick(MOST_COSTLY),
            Math.round(clamp(4 + 5 * skill + gauss(0, 1), 1, 10)),
            pick(COMMON_MISS),
            pick(RANGE_FOCUS),
            Math.round(clamp(3 + 6 * skill + gauss(0, 1), 1, 10)),
            `${date} 20:45:00`,
          ],
        );
      }
    } finally {
      await holeStmt.finalizeAsync();
      await shotStmt.finalizeAsync();
      await puttStmt.finalizeAsync();
    }
  });
}

export async function clearAllRounds(): Promise<void> {
  const db = await getDb();
  // Dev reset: a real hard wipe, not a user soft-delete. FK cascade
  // (foreign_keys = ON in initDb) removes holes/shots/putts/reviews.
  await db.runAsync(`DELETE FROM rounds;`);
  // Drop the local sync cursor too (keys arrive in Phase 2; this is a harmless
  // no-op until then) so a reseed forces a clean re-pull from the server.
  await db.runAsync(
    `DELETE FROM app_settings WHERE key IN ('sync_cursor', 'sync_last_synced_at');`,
  );
}
