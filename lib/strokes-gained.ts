// Strokes Gained — the Mark Broadie framework, measured against a single PGA
// Tour baseline and then re-expressed as a comparison to handicap "scenarios"
// (scratch / 5 / 10 / 15 / 20) so a player can see how they'd stack up.
//
// SG for a shot = E(start) − E(end) − 1, where E(·) is the *expected strokes to
// hole out* from a position (distance + lie). Summed over a hole this telescopes
// to E(start of hole) − strokes, so the per-category numbers always add to the
// total. Because SG_vs_Hcp = SG_vs_Tour − (that handicap's SG_vs_Tour), we only
// need ONE position baseline (the Tour) plus the published per-round handicap
// benchmark offsets — no separate per-handicap baseline tables.
//
// What the app can measure from existing data:
//   • Putting    — real, from logged putt distances + counts.
//   • Approach   — real, from approachDistanceYds (start) + on-green/proximity (end).
//   • Off-the-tee— estimated: hole length ≈ driverDistance + approachDistanceYds.
//   • Short game — residual (total − ott − approach − putting); absorbs chips,
//                  sand, penalties, and the OTT length-estimate error. Crucially
//                  the length estimate cancels out of the residual (it appears with
//                  equal/opposite sign in `total` and `ott`), so short game stays
//                  robust even though OTT/total carry the estimate's bias.
//
// Everything here is pure (no React, no '@/' value imports) so it unit-tests with
// `npx tsx lib/strokes-gained.test.ts`, exactly like lib/handicap.ts. Callers
// (lib/lifetime-stats.ts) derive the on-green/proximity/gir inputs from shots.

// ---------------------------------------------------------------------------
// PGA Tour expected-strokes baselines (Mark Broadie, "Every Shot Counts").
// Stored as anchor points; intermediate distances are linearly interpolated and
// the ends are clamped. Putting is keyed in feet; everything else in yards.
// These are a faithful reproduction of the widely-published Tour benchmark — the
// handicap offsets below are coarse per-round figures, so anchor precision to the
// hundredth is not load-bearing.
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

function interp(x: number, table: readonly Pt[]): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let k = 1; k < table.length; k++) {
    const [x1, y1] = table[k];
    if (x <= x1) {
      const [x0, y0] = table[k - 1];
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

// Putting: expected putts from distance (feet).
const PUTT_E: readonly Pt[] = [
  [0, 0], [2, 1.01], [3, 1.04], [4, 1.13], [5, 1.23], [6, 1.34], [7, 1.42],
  [8, 1.5], [9, 1.56], [10, 1.61], [12, 1.7], [15, 1.78], [20, 1.87],
  [25, 1.93], [30, 1.98], [40, 2.06], [50, 2.14], [60, 2.21], [90, 2.4],
];

// Tee shots on par 4/5, by hole length (yards).
const TEE_E: readonly Pt[] = [
  [100, 2.92], [150, 3.0], [180, 3.05], [200, 3.1], [240, 3.2], [260, 3.3],
  [280, 3.5], [300, 3.62], [320, 3.71], [340, 3.79], [360, 3.86], [380, 3.92],
  [400, 3.99], [420, 4.06], [440, 4.13], [460, 4.2], [480, 4.27], [500, 4.34],
  [520, 4.4], [540, 4.46], [560, 4.52], [580, 4.57], [600, 4.62], [640, 4.7],
];

// Approach shots from the fairway (yards).
const FAIRWAY_E: readonly Pt[] = [
  [20, 2.4], [40, 2.6], [60, 2.69], [80, 2.74], [100, 2.8], [120, 2.85],
  [140, 2.91], [160, 2.98], [180, 3.08], [200, 3.19], [220, 3.32], [240, 3.45],
  [260, 3.58], [280, 3.7], [300, 3.8],
];

// Approach shots from the rough (yards).
const ROUGH_E: readonly Pt[] = [
  [20, 2.59], [40, 2.78], [60, 2.88], [80, 2.96], [100, 3.03], [120, 3.1],
  [140, 3.17], [160, 3.25], [180, 3.34], [200, 3.45], [220, 3.58], [240, 3.72],
  [260, 3.85],
];

// Approach shots from sand (yards).
const SAND_E: readonly Pt[] = [
  [20, 2.53], [40, 2.82], [60, 3.08], [80, 3.15], [100, 3.21], [120, 3.28],
  [140, 3.36], [160, 3.45], [180, 3.55], [200, 3.65],
];

// Expected strokes after a missed green when the miss distance isn't known
// (a short pitch/chip from just off the surface).
const MISS_GREEN_E = 2.5;

export type ApproachLie = 'fairway' | 'rough' | 'sand';

export function expectedPutt(ft: number): number {
  return interp(ft, PUTT_E);
}

export function expectedTee(yds: number): number {
  return interp(yds, TEE_E);
}

export function expectedApproach(yds: number, lie: ApproachLie): number {
  const table = lie === 'rough' ? ROUGH_E : lie === 'sand' ? SAND_E : FAIRWAY_E;
  return interp(yds, table);
}

// ---------------------------------------------------------------------------
// Hole-length estimate (the "smart" part of Off-the-Tee). We don't store hole
// yardage, but we know the distance remaining for the approach, and the player's
// own driver distance. par 3 has no tee category — the tee shot IS the approach.
// ---------------------------------------------------------------------------

const PAR5_LAYUP_YDS = 200; // a typical second shot between drive and approach

export function estimateHoleLength(
  par: number,
  approachDistanceYds: number,
  driverDistance: number,
): number {
  if (par >= 5) {
    return clamp(driverDistance + PAR5_LAYUP_YDS + approachDistanceYds, 460, 640);
  }
  return clamp(driverDistance + approachDistanceYds, 270, 520);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// Driver distance for the hole-length estimate: the player's own logged driver
// yardage if set, otherwise a handicap-derived default (better players hit it
// farther). Index null → assume a mid (~15) handicap.
const DRIVER_BY_HCP: readonly Pt[] = [
  [0, 270], [5, 258], [10, 245], [15, 230], [20, 215], [30, 190],
];

export function driverDistanceFor(
  driverYardage: number | undefined,
  handicapIndex: number | null,
): number {
  if (driverYardage != null && driverYardage > 0) return driverYardage;
  return interp(handicapIndex ?? 15, DRIVER_BY_HCP);
}

// ---------------------------------------------------------------------------
// Per-hole strokes gained. Pure: callers pass already-derived end-state inputs.
// Returns null when the hole lacks the data to decompose (no approach distance,
// no putt count, a blocked green, etc.).
// ---------------------------------------------------------------------------

/** Per-player inputs the round/aggregate helpers carry into every hole. */
export type SGContext = {
  /** Estimated driver distance (yards) for the hole-length estimate. */
  driverDistance: number;
};

export type HoleSGInput = {
  par: number;
  score: number;
  /** Putts taken on the hole (holes.putts — the authoritative recount). */
  putts: number;
  /** Fairway hit (par 4+); null/true → fairway lie, false → rough. */
  fir: boolean | null;
  /** Whether the approach finished on the green. */
  onGreen: boolean;
  /** Approach proximity in feet when on the green (= the first putt distance). */
  proximityFt: number | null;
  /** Longest logged putt distance (feet); falls back to proximity when absent. */
  firstPuttFt: number | null;
  approachDistanceYds: number;
  /** Value fed into the hole-length estimate (logged carry, else the default). */
  driverDistance: number;
  /** The actually-logged drive distance (yards), or null — used to band OTT. */
  driveDistanceYds: number | null;
};

export type HoleSG = {
  /** null on par 3 (the tee shot is the approach — no separate OTT category). */
  ott: number | null;
  approach: number;
  aroundGreen: number;
  putting: number;
  total: number;
};

export function holeStrokesGained(i: HoleSGInput): HoleSG | null {
  const isPar3 = i.par <= 3;
  const lie: ApproachLie = !isPar3 && i.fir === false ? 'rough' : 'fairway';
  const startApproachE = expectedApproach(i.approachDistanceYds, lie);
  const endApproachE = i.onGreen ? expectedPutt(i.proximityFt ?? 24) : MISS_GREEN_E;
  const approach = startApproachE - endApproachE - 1;

  // Putting — telescopes to E(first putt) − putts taken.
  let putting: number;
  if (i.putts <= 0) {
    putting = 0;
  } else {
    const firstPutt = i.firstPuttFt ?? (i.onGreen ? i.proximityFt : null);
    if (firstPutt == null) return null; // can't decompose this hole
    putting = expectedPutt(firstPutt) - i.putts;
  }

  // Total is anchored on the start of the hole; OTT is the drive's slice of it.
  let startE: number;
  let ott: number | null;
  if (isPar3) {
    startE = startApproachE;
    ott = null;
  } else {
    const holeLength = estimateHoleLength(i.par, i.approachDistanceYds, i.driverDistance);
    startE = expectedTee(holeLength);
    ott = startE - startApproachE - 1;
  }
  const total = startE - i.score;
  const aroundGreen = total - (ott ?? 0) - approach - putting;

  return { ott, approach, aroundGreen, putting, total };
}

// ---------------------------------------------------------------------------
// Round / aggregate accumulation.
// ---------------------------------------------------------------------------

export type RoundStrokesGained = {
  /** Holes that contributed a decomposed SG total. */
  holesWithSG: number;
  ott: number;
  approach: number;
  aroundGreen: number;
  putting: number;
  total: number;
};

export const EMPTY_ROUND_SG: RoundStrokesGained = {
  holesWithSG: 0,
  ott: 0,
  approach: 0,
  aroundGreen: 0,
  putting: 0,
  total: 0,
};

export function addHoleSG(acc: RoundStrokesGained, hole: HoleSG): RoundStrokesGained {
  return {
    holesWithSG: acc.holesWithSG + 1,
    ott: acc.ott + (hole.ott ?? 0),
    approach: acc.approach + hole.approach,
    aroundGreen: acc.aroundGreen + hole.aroundGreen,
    putting: acc.putting + hole.putting,
    total: acc.total + hole.total,
  };
}

export type SGBreakdown = Pick<
  RoundStrokesGained,
  'ott' | 'approach' | 'aroundGreen' | 'putting' | 'total'
>;

/** Project a round's SG sums onto an 18-hole basis so they're comparable to the
 *  per-round handicap benchmarks (and so 9s and 18s sit on one axis). */
export function sgPer18(sg: RoundStrokesGained): SGBreakdown | null {
  if (sg.holesWithSG === 0) return null;
  const f = 18 / sg.holesWithSG;
  return {
    ott: sg.ott * f,
    approach: sg.approach * f,
    aroundGreen: sg.aroundGreen * f,
    putting: sg.putting * f,
    total: sg.total * f,
  };
}

// ---------------------------------------------------------------------------
// Handicap benchmarks (per round, vs Tour) — Mark Broadie / "Every Shot Counts".
// Used both to draw the scenario comparison and to translate a category SG into
// an "you play like an N-handicap" reading.
// ---------------------------------------------------------------------------

export type SGCategory = 'ott' | 'approach' | 'aroundGreen' | 'putting' | 'total';

const BENCHMARK_LADDERS: Record<SGCategory, readonly Pt[]> = {
  ott: [[0, -0.8], [5, -1.4], [10, -2.0], [15, -2.7], [20, -3.4], [25, -4.2], [30, -5.0]],
  approach: [[0, -1.5], [5, -3.0], [10, -4.5], [15, -6.0], [20, -7.5], [25, -9.0], [30, -10.5]],
  aroundGreen: [[0, -0.5], [5, -1.0], [10, -1.5], [15, -2.0], [20, -2.5], [25, -3.0], [30, -3.5]],
  putting: [[0, -0.4], [5, -0.8], [10, -1.2], [15, -1.5], [20, -1.8], [25, -2.2], [30, -2.5]],
  total: [[0, -3.2], [5, -6.2], [10, -9.2], [15, -12.2], [20, -15.2], [25, -18.4], [30, -21.5]],
};

/** The handicap scenarios the player compares against, best → worst. */
export const SG_SCENARIOS = [
  { hcp: 0, label: 'Scratch' },
  { hcp: 5, label: '5 hcp' },
  { hcp: 10, label: '10 hcp' },
  { hcp: 15, label: '15 hcp' },
  { hcp: 20, label: '20 hcp' },
] as const;

/** That handicap golfer's expected SG (vs Tour) in a category, per round. */
export function benchmarkSG(category: SGCategory, hcp: number): number {
  return interp(hcp, BENCHMARK_LADDERS[category]);
}

/** Player − scenario: positive means the player would beat that handicap golfer.
 *  `playerPer18` is the player's SG for the category on an 18-hole basis. */
export function scenarioDelta(
  category: SGCategory,
  playerPer18: number,
  hcp: number,
): number {
  return playerPer18 - benchmarkSG(category, hcp);
}

/** Translate a per-18 category SG into the handicap it corresponds to (0 = scratch
 *  or better, capped at 30). The headline "your putting plays like an 8". */
export function impliedHandicap(category: SGCategory, playerPer18: number): number {
  const ladder = BENCHMARK_LADDERS[category];
  if (playerPer18 >= ladder[0][1]) return 0; // scratch or better
  for (let k = 1; k < ladder.length; k++) {
    const [h1, b1] = ladder[k];
    if (playerPer18 >= b1) {
      const [h0, b0] = ladder[k - 1];
      const t = (playerPer18 - b0) / (b1 - b0);
      return h0 + t * (h1 - h0);
    }
  }
  return ladder[ladder.length - 1][0];
}

/** Signed, one-decimal SG for display: "+1.4", "-2.1", "E". */
export function formatSG(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return 'E'; // also collapses -0
  return r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1);
}

// ---------------------------------------------------------------------------
// Baseline comparison. The card lets the player pick what to measure against —
// the Tour (raw SG) or a handicap scenario — and shows all four categories vs
// that one baseline at a time, rather than every scenario at once.
// ---------------------------------------------------------------------------

/** The baselines the player can toggle between, best → worst. `hcp: null` = Tour
 *  (raw SG). The single source of truth for the toggle and its caption. */
export const SG_BASELINES: { key: string; label: string; hcp: number | null }[] = [
  { key: 'tour', label: 'PGA Tour', hcp: null },
  { key: '0', label: 'Scratch', hcp: 0 },
  { key: '5', label: '5 hcp', hcp: 5 },
  { key: '10', label: '10 hcp', hcp: 10 },
  { key: '15', label: '15 hcp', hcp: 15 },
  { key: '20', label: '20 hcp', hcp: 20 },
];

/** Re-express a per-18 SG breakdown relative to a chosen baseline: subtract that
 *  handicap golfer's expected SG from each category (Tour / `null` → unchanged).
 *  Positive then means "better than that golfer". */
export function sgVsBaseline(per18: SGBreakdown, hcp: number | null): SGBreakdown {
  if (hcp == null) return per18;
  return {
    ott: per18.ott - benchmarkSG('ott', hcp),
    approach: per18.approach - benchmarkSG('approach', hcp),
    aroundGreen: per18.aroundGreen - benchmarkSG('aroundGreen', hcp),
    putting: per18.putting - benchmarkSG('putting', hcp),
    total: per18.total - benchmarkSG('total', hcp),
  };
}

/** Re-express a per-18 SG *distance-band* series (each band's per-18 SG vs Tour,
 *  plus its hole count) relative to a chosen baseline. Broadie's benchmarks are
 *  per category, not per band, so the category benchmark is distributed across the
 *  bands proportional to each band's share of holes — the simplest honest split,
 *  and one that keeps Σ(bands) equal to `sgVsBaseline(...)[category]`. Tour /
 *  `null` → the raw per-18 values unchanged. */
export function bandVsBaseline(
  rows: { sgPer18: number; holes: number }[],
  category: SGCategory,
  hcp: number | null,
): number[] {
  if (hcp == null) return rows.map((r) => r.sgPer18);
  const totalHoles = rows.reduce((s, r) => s + r.holes, 0);
  const benchmark = benchmarkSG(category, hcp);
  return rows.map((r) =>
    totalHoles > 0 ? r.sgPer18 - benchmark * (r.holes / totalHoles) : r.sgPer18,
  );
}
