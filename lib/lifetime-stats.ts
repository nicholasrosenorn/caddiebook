import type {
  CommonMiss,
  Hole,
  MostCostly,
  PostRoundReview,
  Putt,
  RangeFocus,
  Round,
  Shot,
} from '@/db/types';
import {
  COMMON_MISS_OPTIONS,
  MOST_COSTLY_OPTIONS,
  RANGE_FOCUS_OPTIONS,
  type Option,
} from '@/lib/review';
import {
  computeHandicapHistory,
  type HandicapHistory,
  type HandicapRound,
} from '@/lib/handicap';
import { approachResult, driverLane, type DriverLane } from '@/lib/shots';
import {
  computePerParAverages,
  computeScoreDistribution,
  resolveGir,
  resolveUpAndDown,
  type PerParAverages,
  type ScoreDistribution,
} from '@/lib/stats';

// Putt distance buckets — kept in sync with components/putting-page.tsx (BANDS)
// and app/round/[id]/summary.tsx (PUTT_BUCKETS). distance_ft is the upper bound.
export const PUTT_BUCKETS = [
  { ft: 3, label: '<3 ft' },
  { ft: 10, label: '3–10 ft' },
  { ft: 15, label: '10–15 ft' },
  { ft: 25, label: '15–25 ft' },
  { ft: 50, label: '25+ ft' },
] as const;

export type HoleCountFilter = 'all' | 9 | 18;
export type RoundsFilter = 20 | 40 | 60 | 'all';

// Approach-distance histogram buckets (yards). `max` is the exclusive upper
// bound; the last bucket is open-ended.
export const APPROACH_BUCKETS = [
  { label: '<100', max: 100 },
  { label: '100–125', max: 125 },
  { label: '125–150', max: 150 },
  { label: '150–175', max: 175 },
  { label: '175–200', max: 200 },
  { label: '200+', max: Infinity },
] as const;

/** Per-round rollup used for both the headline averages and the trend line. */
export type RoundDerived = {
  round: Round;
  holesPlayed: number;
  totalScore: number;
  totalPar: number;
  toPar: number;
  /** to-par projected to an 18-hole basis, so 9s and 18s sit on one axis. */
  toPar18: number;
  totalPutts: number;
  puttsPer18: number;
  girPct: number | null;
  firPct: number | null;
};

export function deriveRound(round: Round, holes: Hole[]): RoundDerived | null {
  let holesPlayed = 0;
  let totalScore = 0;
  let totalPar = 0;
  let totalPutts = 0;
  let girEligible = 0;
  let girMade = 0;
  let firEligible = 0;
  let firMade = 0;

  for (const hole of holes) {
    if (hole.score != null && hole.par != null) {
      holesPlayed += 1;
      totalScore += hole.score;
      totalPar += hole.par;
    }
    if (hole.putts != null) totalPutts += hole.putts;

    const gir = resolveGir(hole);
    if (gir != null) {
      girEligible += 1;
      if (gir) girMade += 1;
    }
    if (hole.par != null && hole.par >= 4 && hole.fir != null) {
      firEligible += 1;
      if (hole.fir) firMade += 1;
    }
  }

  if (holesPlayed === 0) return null;
  const toPar = totalScore - totalPar;
  return {
    round,
    holesPlayed,
    totalScore,
    totalPar,
    toPar,
    toPar18: (toPar / holesPlayed) * 18,
    totalPutts,
    puttsPer18: (totalPutts / holesPlayed) * 18,
    girPct: girEligible > 0 ? girMade / girEligible : null,
    firPct: firEligible > 0 ? firMade / firEligible : null,
  };
}

export type LifetimeStats = {
  roundCount: number;
  holesTracked: number;
  shotsMapped: number;
  puttsLogged: number;

  /** True when every round in the set shares one hole count (9 or 18). */
  uniformLength: boolean;

  avgScore: number | null;
  avgToPar: number | null;
  /** to-par averaged on an 18-hole basis (the fair, mixed-length number). */
  avgToPar18: number | null;
  bestRound: RoundDerived | null;

  girPct: number | null;
  firPct: number | null;
  udPct: number | null;

  puttsPerHole: number | null;
  puttsPerRound: number | null;
  threePuttCount: number;
  onePuttCount: number;

  perPar: PerParAverages;
  distribution: ScoreDistribution;

  penaltiesPerRound: number | null;
  penaltiesTotal: number;
  sandShotsPerRound: number | null;
  chipShotsPerRound: number | null;
  sandShots: number;
  chipShots: number;

  puttBuckets: { ft: number; label: string; makes: number; total: number; makePct: number | null }[];
  approachByDistance: { label: string; hit: number; missed: number; total: number }[];

  driverLanes: Record<DriverLane, number>;
  driverTotal: number;
  /** Par-4+ holes where the player couldn't reach the green (no real approach). */
  noApproachHoles: number;
  approachTotal: number;
  avgApproachProximity: number | null;
};

function flatten<T>(rounds: Round[], byRound: Map<string, T[]>): T[] {
  const out: T[] = [];
  for (const r of rounds) {
    const items = byRound.get(r.id);
    if (items) out.push(...items);
  }
  return out;
}

export function aggregateStats(
  rounds: Round[],
  holesByRound: Map<string, Hole[]>,
  shotsByRound: Map<string, Shot[]>,
  puttsByRound: Map<string, Putt[]>,
): LifetimeStats {
  const derived = rounds
    .map((r) => deriveRound(r, holesByRound.get(r.id) ?? []))
    .filter((d): d is RoundDerived => d != null);

  const holes = flatten(rounds, holesByRound);
  const shots = flatten(rounds, shotsByRound);
  const putts = flatten(rounds, puttsByRound);

  const uniformLength =
    rounds.length > 0 && rounds.every((r) => r.holeCount === rounds[0].holeCount);

  // Scoring — pooled averages over rounds that have any scored holes.
  const roundCount = derived.length;
  const avgScore =
    roundCount > 0 ? derived.reduce((s, d) => s + d.totalScore, 0) / roundCount : null;
  const avgToPar =
    roundCount > 0 ? derived.reduce((s, d) => s + d.toPar, 0) / roundCount : null;
  const avgToPar18 =
    roundCount > 0 ? derived.reduce((s, d) => s + d.toPar18, 0) / roundCount : null;
  const bestRound =
    derived.length > 0
      ? derived.reduce((best, d) => (d.toPar18 < best.toPar18 ? d : best))
      : null;

  // Pooled percentages across every hole.
  let girEligible = 0;
  let girMade = 0;
  let firEligible = 0;
  let firMade = 0;
  let udEligible = 0;
  let udMade = 0;
  let holesScored = 0;

  let puttsTotal = 0;
  let holesWithPutts = 0;
  let threePuttCount = 0;
  let onePuttCount = 0;
  let penaltiesTotal = 0;
  let sandShots = 0;
  let chipShots = 0;
  let noApproachHoles = 0;

  for (const hole of holes) {
    if (hole.score != null) holesScored += 1;
    if (hole.greenBlocked && hole.par != null && hole.par >= 4) noApproachHoles += 1;

    const gir = resolveGir(hole);
    if (gir != null) {
      girEligible += 1;
      if (gir) girMade += 1;
    }
    if (hole.par != null && hole.par >= 4 && hole.fir != null) {
      firEligible += 1;
      if (hole.fir) firMade += 1;
    }
    const ud = resolveUpAndDown(hole);
    if (ud != null) {
      udEligible += 1;
      if (ud) udMade += 1;
    }

    if (hole.putts != null) {
      puttsTotal += hole.putts;
      holesWithPutts += 1;
      if (hole.putts >= 3) threePuttCount += 1;
      if (hole.putts === 1) onePuttCount += 1;
    }
    if (hole.penalties != null) penaltiesTotal += hole.penalties;
    if (hole.sandShots != null) sandShots += hole.sandShots;
    if (hole.chipShots != null) chipShots += hole.chipShots;
  }

  // Approach-distance histogram, split by whether the green was hit (GIR).
  const approachByDistance = APPROACH_BUCKETS.map((b) => ({
    label: b.label,
    hit: 0,
    missed: 0,
    total: 0,
  }));
  for (const hole of holes) {
    if (hole.greenBlocked) continue; // no genuine approach to measure
    if (hole.approachDistanceYds == null) continue;
    const gir = resolveGir(hole);
    if (gir == null) continue;
    const idx = APPROACH_BUCKETS.findIndex((b) => hole.approachDistanceYds! < b.max);
    const bucket = approachByDistance[idx === -1 ? approachByDistance.length - 1 : idx];
    bucket.total += 1;
    if (gir) bucket.hit += 1;
    else bucket.missed += 1;
  }

  // Putting make-rate by distance bucket.
  const puttBuckets = PUTT_BUCKETS.map((b) => {
    const inBucket = putts.filter((p) => p.distanceFt === b.ft);
    const makes = inBucket.filter((p) => p.made).length;
    return {
      ft: b.ft,
      label: b.label,
      makes,
      total: inBucket.length,
      makePct: inBucket.length > 0 ? makes / inBucket.length : null,
    };
  });

  // Driver dispersion (lane split) + approach proximity, pooled.
  const driverLanes: Record<DriverLane, number> = { LF: 0, CF: 0, RF: 0 };
  let driverTotal = 0;
  let approachTotal = 0;
  let proximitySum = 0;
  let proximityCount = 0;
  for (const shot of shots) {
    if (shot.shotType === 'driver') {
      driverLanes[driverLane(shot.xNorm, shot.yNorm)] += 1;
      driverTotal += 1;
    } else {
      approachTotal += 1;
      const res = approachResult(shot.xNorm, shot.yNorm);
      if (res.onGreen && res.proximityFt != null) {
        proximitySum += res.proximityFt;
        proximityCount += 1;
      }
    }
  }

  return {
    roundCount,
    holesTracked: holesScored,
    shotsMapped: shots.length,
    puttsLogged: putts.length,
    uniformLength,
    avgScore,
    avgToPar,
    avgToPar18,
    bestRound,
    girPct: girEligible > 0 ? girMade / girEligible : null,
    firPct: firEligible > 0 ? firMade / firEligible : null,
    udPct: udEligible > 0 ? udMade / udEligible : null,
    puttsPerHole: holesWithPutts > 0 ? puttsTotal / holesWithPutts : null,
    puttsPerRound: roundCount > 0 ? puttsTotal / roundCount : null,
    threePuttCount,
    onePuttCount,
    perPar: computePerParAverages(holes),
    distribution: computeScoreDistribution(holes),
    penaltiesPerRound: roundCount > 0 ? penaltiesTotal / roundCount : null,
    penaltiesTotal,
    sandShotsPerRound: roundCount > 0 ? sandShots / roundCount : null,
    chipShotsPerRound: roundCount > 0 ? chipShots / roundCount : null,
    sandShots,
    chipShots,
    puttBuckets,
    approachByDistance,
    driverLanes,
    driverTotal,
    noApproachHoles,
    approachTotal,
    avgApproachProximity: proximityCount > 0 ? proximitySum / proximityCount : null,
  };
}

// --- Approach view, filterable by club -------------------------------------

export type ApproachStats = {
  approachByDistance: { label: string; hit: number; missed: number; total: number }[];
  approachTotal: number;
  avgApproachProximity: number | null;
  /** Normalized pin positions for the approach dispersion target. */
  pins: { xNorm: number; yNorm: number; key: string }[];
};

/**
 * Approach dispersion + distance histogram, optionally narrowed to a single
 * club. Clubs live on the hole (`approachClub`), so shots are matched back to
 * their hole via `(roundId, holeNumber)`. `club == null` means "all clubs".
 *
 * Kept separate from `aggregateStats` so changing the club filter only
 * recomputes the approach sections, not scoring/putting/trends.
 */
export function aggregateApproach(
  rounds: Round[],
  holesByRound: Map<string, Hole[]>,
  shotsByRound: Map<string, Shot[]>,
  club: string | null,
): ApproachStats {
  const holes = flatten(rounds, holesByRound);
  const shots = flatten(rounds, shotsByRound);

  // (roundId:holeNumber) → that hole's approach club, for matching shots.
  const holeClub = new Map<string, string | null>();
  for (const r of rounds) {
    for (const h of holesByRound.get(r.id) ?? []) {
      holeClub.set(`${h.roundId}:${h.holeNumber}`, h.approachClub);
    }
  }
  const matches = (clubValue: string | null) => club == null || clubValue === club;

  const approachByDistance = APPROACH_BUCKETS.map((b) => ({
    label: b.label,
    hit: 0,
    missed: 0,
    total: 0,
  }));
  for (const hole of holes) {
    if (hole.greenBlocked) continue; // no genuine approach to measure
    if (hole.approachDistanceYds == null) continue;
    if (!matches(hole.approachClub)) continue;
    const gir = resolveGir(hole);
    if (gir == null) continue;
    const idx = APPROACH_BUCKETS.findIndex((b) => hole.approachDistanceYds! < b.max);
    const bucket = approachByDistance[idx === -1 ? approachByDistance.length - 1 : idx];
    bucket.total += 1;
    if (gir) bucket.hit += 1;
    else bucket.missed += 1;
  }

  const pins: ApproachStats['pins'] = [];
  let approachTotal = 0;
  let proximitySum = 0;
  let proximityCount = 0;
  for (const shot of shots) {
    if (shot.shotType !== 'approach') continue;
    if (!matches(holeClub.get(`${shot.roundId}:${shot.holeNumber}`) ?? null)) continue;
    approachTotal += 1;
    pins.push({ xNorm: shot.xNorm, yNorm: shot.yNorm, key: shot.id });
    const res = approachResult(shot.xNorm, shot.yNorm);
    if (res.onGreen && res.proximityFt != null) {
      proximitySum += res.proximityFt;
      proximityCount += 1;
    }
  }

  return {
    approachByDistance,
    approachTotal,
    avgApproachProximity: proximityCount > 0 ? proximitySum / proximityCount : null,
    pins,
  };
}

// --- Driver dispersion, filterable by club ---------------------------------

export type DriverStats = {
  driverLanes: Record<DriverLane, number>;
  driverTotal: number;
  /** Normalized pin positions for the driver dispersion target. */
  pins: { xNorm: number; yNorm: number; key: string }[];
};

/**
 * Driver dispersion (lane split + pins), optionally narrowed to a single club.
 * Like approaches, the tee club lives on the hole (`driveClub`), so driver
 * shots are matched back via `(roundId, holeNumber)`. `club == null` = all.
 */
export function aggregateDriver(
  rounds: Round[],
  holesByRound: Map<string, Hole[]>,
  shotsByRound: Map<string, Shot[]>,
  club: string | null,
): DriverStats {
  const shots = flatten(rounds, shotsByRound);

  const holeClub = new Map<string, string | null>();
  for (const r of rounds) {
    for (const h of holesByRound.get(r.id) ?? []) {
      holeClub.set(`${h.roundId}:${h.holeNumber}`, h.driveClub);
    }
  }
  const matches = (clubValue: string | null) => club == null || clubValue === club;

  const driverLanes: Record<DriverLane, number> = { LF: 0, CF: 0, RF: 0 };
  const pins: DriverStats['pins'] = [];
  let driverTotal = 0;
  for (const shot of shots) {
    if (shot.shotType !== 'driver') continue;
    if (!matches(holeClub.get(`${shot.roundId}:${shot.holeNumber}`) ?? null)) continue;
    driverLanes[driverLane(shot.xNorm, shot.yNorm)] += 1;
    driverTotal += 1;
    pins.push({ xNorm: shot.xNorm, yNorm: shot.yNorm, key: shot.id });
  }

  return { driverLanes, driverTotal, pins };
}

/**
 * Chronological per-round points (oldest → newest) for the trend sparklines.
 * Carries both raw and per-18 figures so the screen plots the right basis for
 * the active hole-count filter.
 */
export function perRoundTrend(
  rounds: Round[],
  holesByRound: Map<string, Hole[]>,
): RoundDerived[] {
  return rounds
    .map((r) => deriveRound(r, holesByRound.get(r.id) ?? []))
    .filter((d): d is RoundDerived => d != null)
    .sort((a, b) => {
      const byDate = a.round.datePlayed.localeCompare(b.round.datePlayed);
      return byDate !== 0 ? byDate : a.round.createdAt.localeCompare(b.round.createdAt);
    });
}

// --- Post-round review insights -------------------------------------------

export type ReviewBreakdownItem<T extends string> = {
  value: T;
  label: string;
  count: number;
};

export type ReviewInsights = {
  /** Number of reviews in the round set. */
  count: number;
  /** Full frequency breakdowns (cited values only, count desc, ties by canonical order). */
  mostCostly: ReviewBreakdownItem<MostCostly>[];
  commonMiss: ReviewBreakdownItem<CommonMiss>[];
  rangeFocus: ReviewBreakdownItem<RangeFocus>[];
  avgDecision: number | null;
  decisionCount: number;
  avgOverall: number | null;
  overallCount: number;
  /** Chronological (oldest→newest) rating series; null = round had no review/rating. */
  decisionTrend: (number | null)[];
  overallTrend: (number | null)[];
};

/**
 * Tally a categorical review field into a sorted frequency breakdown. Only
 * cited values appear; ties break by the field's canonical option order so the
 * result is deterministic.
 */
function breakdownOf<T extends string>(
  values: (T | null)[],
  options: Option<T>[],
): ReviewBreakdownItem<T>[] {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const rank = (v: T) => options.findIndex((o) => o.value === v);
  const label = (v: T) => options.find((o) => o.value === v)?.label ?? v;
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => b.count - a.count || rank(a.value) - rank(b.value));
}

function avgOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}

function countOf(values: (number | null)[]): number {
  return values.filter((v): v is number => v != null).length;
}

export function aggregateReview(
  rounds: Round[],
  reviewsByRound: Map<string, PostRoundReview>,
): ReviewInsights {
  const reviews: PostRoundReview[] = [];
  for (const r of rounds) {
    const rv = reviewsByRound.get(r.id);
    if (rv) reviews.push(rv);
  }

  // Chronological rating series (oldest→newest), same ordering as perRoundTrend.
  const chronological = [...rounds].sort((a, b) => {
    const byDate = a.datePlayed.localeCompare(b.datePlayed);
    return byDate !== 0 ? byDate : a.createdAt.localeCompare(b.createdAt);
  });
  const decisionTrend = chronological.map(
    (r) => reviewsByRound.get(r.id)?.decisionMakingRating ?? null,
  );
  const overallTrend = chronological.map(
    (r) => reviewsByRound.get(r.id)?.overallRating ?? null,
  );

  return {
    count: reviews.length,
    mostCostly: breakdownOf(reviews.map((r) => r.mostCostly), MOST_COSTLY_OPTIONS),
    commonMiss: breakdownOf(reviews.map((r) => r.commonMiss), COMMON_MISS_OPTIONS),
    rangeFocus: breakdownOf(reviews.map((r) => r.rangeFocus), RANGE_FOCUS_OPTIONS),
    avgDecision: avgOf(reviews.map((r) => r.decisionMakingRating)),
    decisionCount: countOf(reviews.map((r) => r.decisionMakingRating)),
    avgOverall: avgOf(reviews.map((r) => r.overallRating)),
    overallCount: countOf(reviews.map((r) => r.overallRating)),
    decisionTrend,
    overallTrend,
  };
}

// --- Handicap Index --------------------------------------------------------

function toHandicapRound(round: Round, holes: Hole[]): HandicapRound {
  return {
    id: round.id,
    holeCount: round.holeCount,
    courseRating: round.courseRating,
    slopeRating: round.slopeRating,
    datePlayed: round.datePlayed,
    createdAt: round.createdAt,
    holes: holes.map((h) => ({ par: h.par, score: h.score })),
  };
}

/**
 * Handicap Index history for a set of rounds (intended to be the player's
 * completed rounds). The index always reflects the most recent 20 differentials
 * regardless of any stats-screen filters, so callers pass the full set.
 */
export function handicapHistoryFor(
  rounds: Round[],
  holesByRound: Map<string, Hole[]>,
): HandicapHistory {
  return computeHandicapHistory(
    rounds.map((r) => toHandicapRound(r, holesByRound.get(r.id) ?? [])),
  );
}

/** Display form for a Handicap Index: negatives are "plus" handicaps (+2.1). */
export function formatHandicapIndex(index: number): string {
  const v = Math.abs(index).toFixed(1);
  return index < 0 ? `+${v}` : v;
}

export function formatToPar(toPar: number, decimals = 0): string {
  const v = decimals > 0 ? toPar.toFixed(decimals) : String(Math.round(toPar));
  const n = Number(v);
  if (n === 0) return 'E';
  return n > 0 ? `+${v}` : `${v}`;
}
