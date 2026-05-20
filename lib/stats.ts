import type { Hole, RoundSummary } from '@/db/types';

export function deriveGir(
  par: number | null,
  score: number | null,
  putts: number | null,
): boolean | null {
  if (par == null || score == null || putts == null) return null;
  return score - putts <= par - 2;
}

export function resolveGir(hole: Hole): boolean | null {
  if (hole.gir != null) return hole.gir;
  return deriveGir(hole.par, hole.score, hole.putts);
}

export function deriveUpAndDown(
  par: number | null,
  score: number | null,
  resolvedGir: boolean | null,
): boolean | null {
  if (resolvedGir !== false) return null;
  if (par == null || score == null) return null;
  return score <= par;
}

export function resolveUpAndDown(hole: Hole): boolean | null {
  const gir = resolveGir(hole);
  if (gir !== false) return null;
  if (hole.upAndDown != null) return hole.upAndDown;
  return deriveUpAndDown(hole.par, hole.score, gir);
}

export function computeRoundSummary(holes: Hole[]): RoundSummary {
  let holesPlayed = 0;
  let totalScore = 0;
  let totalPutts = 0;

  let firEligible = 0;
  let firMade = 0;
  let girEligible = 0;
  let girMade = 0;
  let udEligible = 0;
  let udMade = 0;

  for (const hole of holes) {
    const hasScore = hole.score != null;
    if (hasScore) {
      holesPlayed += 1;
      totalScore += hole.score!;
    }
    if (hole.putts != null) {
      totalPutts += hole.putts;
    }

    if (hole.par != null && hole.par >= 4 && hole.fir != null) {
      firEligible += 1;
      if (hole.fir) firMade += 1;
    }

    const resolved = resolveGir(hole);
    if (resolved != null) {
      girEligible += 1;
      if (resolved) girMade += 1;
    }

    const resolvedUd = resolveUpAndDown(hole);
    if (resolvedUd != null) {
      udEligible += 1;
      if (resolvedUd) udMade += 1;
    }
  }

  return {
    holesPlayed,
    totalScore,
    totalPutts,
    firPct: firEligible > 0 ? firMade / firEligible : null,
    girPct: girEligible > 0 ? girMade / girEligible : null,
    udPct: udEligible > 0 ? udMade / udEligible : null,
  };
}

export function formatPct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

export type ScoreDistribution = {
  eagleOrBetter: number;
  birdie: number;
  par: number;
  bogey: number;
  doubleBogey: number;
  tripleOrWorse: number;
};

export function computeScoreDistribution(holes: Hole[]): ScoreDistribution {
  const dist: ScoreDistribution = {
    eagleOrBetter: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    doubleBogey: 0,
    tripleOrWorse: 0,
  };
  for (const hole of holes) {
    if (hole.par == null || hole.score == null) continue;
    const diff = hole.score - hole.par;
    if (diff <= -2) dist.eagleOrBetter += 1;
    else if (diff === -1) dist.birdie += 1;
    else if (diff === 0) dist.par += 1;
    else if (diff === 1) dist.bogey += 1;
    else if (diff === 2) dist.doubleBogey += 1;
    else dist.tripleOrWorse += 1;
  }
  return dist;
}

export function totalPar(holes: Hole[]): number {
  let total = 0;
  for (const hole of holes) {
    if (hole.par != null && hole.score != null) total += hole.par;
  }
  return total;
}

export type PerParAverages = {
  par3: number | null;
  par4: number | null;
  par5: number | null;
};

export function computePerParAverages(holes: Hole[]): PerParAverages {
  const sums = { 3: 0, 4: 0, 5: 0 };
  const counts = { 3: 0, 4: 0, 5: 0 };
  for (const hole of holes) {
    if (hole.par == null || hole.score == null) continue;
    if (hole.par === 3 || hole.par === 4 || hole.par === 5) {
      sums[hole.par] += hole.score;
      counts[hole.par] += 1;
    }
  }
  return {
    par3: counts[3] > 0 ? sums[3] / counts[3] : null,
    par4: counts[4] > 0 ? sums[4] / counts[4] : null,
    par5: counts[5] > 0 ? sums[5] / counts[5] : null,
  };
}

export type PuttingStats = {
  total: number;
  perHole: number | null;
  threePuttCount: number;
};

export function computePuttingStats(holes: Hole[]): PuttingStats {
  let total = 0;
  let holesWithPutts = 0;
  let threePuttCount = 0;
  for (const hole of holes) {
    if (hole.putts == null) continue;
    total += hole.putts;
    holesWithPutts += 1;
    if (hole.putts >= 3) threePuttCount += 1;
  }
  return {
    total,
    perHole: holesWithPutts > 0 ? total / holesWithPutts : null,
    threePuttCount,
  };
}

export function totalPenalties(holes: Hole[]): number {
  let total = 0;
  for (const hole of holes) {
    if (hole.penalties != null) total += hole.penalties;
  }
  return total;
}
