// Handicap Index calculation — a WHS-lite scheme tuned for this app.
//
// Core formula matches the World Handicap System and 18Birdies:
//   Score Differential = (113 / Slope) × (Adjusted Gross Score − Course Rating)
//   Handicap Index     = average of the best N of your most recent 20 differentials
//
// Deliberate choices (see DESIGN/notes — cross-checked vs 18Birdies):
//   • Adjusted Gross Score caps each hole at Net Double Bogey (we HAVE hole-by-hole
//     data, so this is nearly free and more accurate than a raw total).
//   • The "fewer than 20 rounds" table is 18Birdies-style: a handicap exists from a
//     single round, with NO low-sample adjustment subtractions.
//   • 9-hole rounds are scaled to an 18-hole-equivalent differential (WHS-style),
//     not crudely doubled.
//   • Handicap Index is capped at the official 54.0 ceiling and rounded to 0.1.
//   • PCC (weather) is treated as 0 — it can't be derived without a field of scores.
//
// Everything here is pure (no DB, no React) so it can be unit-tested directly.

export const NEUTRAL_SLOPE = 113;
export const MAX_INDEX = 54.0;
/** Net Double Bogey for a player with no established index yet: par + 5. */
const PRE_INDEX_STROKES = 3;

export type HandicapHole = { par: number | null; score: number | null };

export type HandicapRound = {
  id: string;
  /** Scheduled length; 9-hole rounds get scaled to an 18-hole differential. */
  holeCount: number;
  /** Snapshot rating/slope for the holes played; null → default to par / 113. */
  courseRating: number | null;
  slopeRating: number | null;
  holes: HandicapHole[];
  // Ordering keys (oldest → newest).
  datePlayed: string;
  createdAt: string;
};

/**
 * How many of the lowest differentials feed the average, by sample size.
 * 18Birdies table: a handicap exists from 1 round, no adjustment subtractions.
 * 20+ always uses the best 8 of the most recent 20.
 */
export function bestCountFor(rounds: number): number {
  if (rounds <= 0) return 0;
  if (rounds <= 5) return 1;
  if (rounds <= 8) return 2;
  if (rounds <= 11) return 3;
  if (rounds <= 14) return 4;
  if (rounds <= 16) return 5;
  if (rounds <= 18) return 6;
  if (rounds === 19) return 7;
  return 8;
}

/** Course Handicap = Index × (Slope / 113) + (Rating − Par), rounded. */
export function courseHandicap(
  index: number,
  slope: number,
  rating: number,
  par: number,
): number {
  return Math.round(index * (slope / NEUTRAL_SLOPE) + (rating - par));
}

type PlayedHole = { par: number; score: number };

function playedHoles(holes: HandicapHole[]): PlayedHole[] {
  const out: PlayedHole[] = [];
  for (const h of holes) {
    if (h.par != null && h.score != null) out.push({ par: h.par, score: h.score });
  }
  return out;
}

/**
 * Adjusted Gross Score: each hole capped at Net Double Bogey
 * (par + 2 + handicap strokes received). Without a per-hole stroke index we
 * spread the Course Handicap evenly across the holes played. Before an index is
 * established the cap is a flat par + 5 (WHS's rule for unestablished players).
 */
export function adjustedGrossScore(
  played: PlayedHole[],
  priorIndex: number | null,
  rating: number,
  slope: number,
): number {
  const par = played.reduce((s, h) => s + h.par, 0);
  let strokesPerHole: number;
  if (priorIndex == null) {
    strokesPerHole = PRE_INDEX_STROKES;
  } else {
    const ch = courseHandicap(priorIndex, slope, rating, par);
    strokesPerHole = Math.max(0, Math.round(ch / played.length));
  }
  return played.reduce((sum, h) => {
    const cap = h.par + 2 + strokesPerHole;
    return sum + Math.min(h.score, cap);
  }, 0);
}

/**
 * One round's 18-hole Score Differential, or null if no holes were scored.
 * `priorIndex` (the index from earlier rounds) is used for the Net Double Bogey
 * cap and for scaling a 9-hole round; null when no index exists yet.
 */
export function scoreDifferential(
  round: HandicapRound,
  priorIndex: number | null,
): number | null {
  const played = playedHoles(round.holes);
  if (played.length === 0) return null;

  const par = played.reduce((s, h) => s + h.par, 0);
  const rating = round.courseRating ?? par;
  const slope = round.slopeRating ?? NEUTRAL_SLOPE;

  const ags = adjustedGrossScore(played, priorIndex, rating, slope);
  const raw = (NEUTRAL_SLOPE / slope) * (ags - rating);

  if (round.holeCount === 9 || played.length <= 9) {
    // 18-hole equivalent = this 9 + the expected other 9. Expected nine ≈ half
    // the current index; with no index yet, fall back to doubling this nine.
    const expectedNine = priorIndex != null ? priorIndex / 2 : raw;
    return raw + expectedNine;
  }
  return raw;
}

function roundToTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Handicap Index from a list of differentials (any order): best N of the most
 * recent 20, averaged, rounded to 0.1, capped at 54.0. Null when the list is
 * empty. `differentials` should be chronological (oldest → newest) so the
 * "most recent 20" window is correct.
 */
export function handicapIndexFromDifferentials(differentials: number[]): number | null {
  if (differentials.length === 0) return null;
  const recent = differentials.slice(-20);
  const k = Math.min(bestCountFor(recent.length), recent.length);
  const lowest = [...recent].sort((a, b) => a - b).slice(0, k);
  const avg = lowest.reduce((s, d) => s + d, 0) / lowest.length;
  return Math.min(roundToTenth(avg), MAX_INDEX);
}

export type HandicapPoint = {
  roundId: string;
  /** 18-hole differential posted by this round. */
  differential: number;
  /** Handicap Index after this round was posted. */
  index: number;
};

export type HandicapHistory = {
  /** Current Handicap Index, or null when there are no scored rounds. */
  current: number | null;
  /** Chronological (oldest → newest) per-round points for the trend chart. */
  points: HandicapPoint[];
  /** Index as of each round, keyed by round id (for the round summary). */
  indexByRound: Map<string, number>;
};

/**
 * Walk rounds oldest → newest, posting one differential each and recomputing the
 * rolling index. Each round's Net Double Bogey cap (and 9-hole scaling) uses the
 * index established by the *prior* rounds, which keeps the AGS→index chain
 * non-circular and reproduces the official progression. Rounds with no scored
 * holes are skipped.
 */
export function computeHandicapHistory(rounds: HandicapRound[]): HandicapHistory {
  const ordered = [...rounds].sort((a, b) => {
    const byDate = a.datePlayed.localeCompare(b.datePlayed);
    return byDate !== 0 ? byDate : a.createdAt.localeCompare(b.createdAt);
  });

  const differentials: number[] = [];
  const points: HandicapPoint[] = [];
  const indexByRound = new Map<string, number>();
  let current: number | null = null;

  for (const round of ordered) {
    const diff = scoreDifferential(round, current);
    if (diff == null) continue;
    differentials.push(diff);
    current = handicapIndexFromDifferentials(differentials);
    if (current == null) continue;
    points.push({ roundId: round.id, differential: diff, index: current });
    indexByRound.set(round.id, current);
  }

  return { current, points, indexByRound };
}
