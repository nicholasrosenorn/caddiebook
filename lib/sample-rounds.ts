// Pure golfer-season simulation, shared by the dev seeder (lib/dev-seed.ts) and
// the onboarding tour's mock progress story (lib/sample-stats.ts). One source of
// truth for "what an improving mid-handicap golfer's numbers look like".
//
// Everything here is pure and parameterized by an RNG, so the same simulation
// can run randomly (Math.random, for the dev seeder) or deterministically (a
// fixed-seed mulberry32, so the tour renders the exact same season every time
// and never hits a bad random run). Nothing here touches the network — the dev
// seeder maps these seeds to wire rows; the tour maps them to domain models.

export type Rng = () => number;

/** A tiny, fast seeded PRNG. Deterministic in `seed` — same seed, same stream. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rand(rng, min, max + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

// Box–Muller normal sample.
export function gauss(rng: Rng, mean = 0, sd = 1): number {
  const u = 1 - rng();
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Weighted pick: keys are values, weights are relative probabilities.
export function weightedPick<T extends number | string>(rng: Rng, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Each course carries a tee with an 18-hole Course/Slope Rating so the handicap
// section has realistic inputs. 9-hole rounds snapshot roughly half the rating.
export const COURSES: { name: string; tee: string; rating: number; slope: number }[] = [
  { name: 'Pebble Creek', tee: 'Blue', rating: 71.2, slope: 128 },
  { name: 'Highland Links', tee: 'White', rating: 70.1, slope: 122 },
  { name: 'Riverbend G&CC', tee: 'Blue', rating: 72.4, slope: 134 },
  { name: 'Oakmont Muni', tee: 'White', rating: 69.3, slope: 118 },
  { name: 'Cypress Hollow', tee: 'Gold', rating: 73.0, slope: 140 },
  { name: 'The Meadows', tee: 'White', rating: 68.8, slope: 113 },
  { name: 'Stonebridge', tee: 'Blue', rating: 71.8, slope: 131 },
];

// Standard par layouts. 9-hole rounds use the front nine (par 36).
export const FRONT_NINE = [4, 5, 3, 4, 4, 3, 5, 4, 4];
export const BACK_NINE = [4, 3, 5, 4, 4, 3, 4, 5, 4];
export const PARS_18 = [...FRONT_NINE, ...BACK_NINE];

export const MOST_COSTLY = ['putting', 'driving', 'wedge_play', 'mid_irons', 'long_irons'];
export const COMMON_MISS = ['left', 'right', 'long', 'short', 'mixed'];
export const RANGE_FOCUS = [
  'tempo',
  'technique',
  'approach_game',
  'chipping',
  'putting',
  'pre_shot_routine',
  'short_game',
];

export const APPROACH_CLUBS = ['PW', '9i', '8i', '7i', '6i', '52°', '56°'];
// Tee clubs, weighted toward the driver but spanning woods, hybrids, and high
// irons so the per-club driver dispersion filter has plenty to slice by.
export const DRIVE_CLUBS = [
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

export type HoleSeed = {
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

export function buildPuttRows(
  rng: Rng,
  putts: number,
  gir: boolean,
): { distanceFt: number; made: number }[] {
  if (putts <= 0) return [];
  if (putts === 1) {
    const d = weightedPick<number>(rng, [
      [3, gir ? 0.35 : 0.55],
      [10, 0.4],
      [15, 0.18],
      [25, 0.07],
    ]);
    return [{ distanceFt: d, made: 1 }];
  }
  if (putts === 2) {
    const first = weightedPick<number>(rng, [
      [10, 0.2],
      [15, 0.3],
      [25, 0.3],
      [50, 0.2],
    ]);
    const second = weightedPick<number>(rng, [
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
      { distanceFt: weightedPick<number>(rng, [[25, 0.4], [50, 0.6]]), made: 0 },
      { distanceFt: weightedPick<number>(rng, [[10, 0.4], [15, 0.4], [25, 0.2]]), made: 0 },
      { distanceFt: weightedPick<number>(rng, [[3, 0.7], [10, 0.3]]), made: 1 },
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

// Skill is 0→1; the score / putts / FIR / GIR distributions all shift toward the
// good end as it rises, so a season of these (skill ramping up) tells a clear
// improvement story.
export function buildHole(rng: Rng, holeNumber: number, par: number, skill: number): HoleSeed {
  // Score relative to par, distribution shifts toward par/birdie as skill rises.
  let delta = weightedPick<number>(rng, [
    [-1, 0.03 + 0.1 * skill],
    [0, 0.28 + 0.27 * skill],
    [1, 0.4 - 0.12 * skill],
    [2, 0.2 - 0.15 * skill],
    [3, 0.09 - 0.1 * skill],
  ]);
  // Occasional eagle on par 5.
  if (par === 5 && delta === -1 && chance(rng, 0.12)) delta = -2;
  const score = Math.max(2, par + delta);

  // Putts, capped so there's at least one stroke to reach the green.
  let putts = weightedPick<number>(rng, [
    [1, 0.15 + 0.1 * skill],
    [2, 0.6],
    [3, 0.2 - 0.12 * skill],
    [4, 0.05 - 0.04 * skill],
  ]);
  putts = clamp(putts, 0, score - 1);

  const gir = score - putts <= par - 2;

  const fir = par >= 4 ? (chance(rng, 0.4 + 0.25 * skill) ? 1 : 0) : null;

  // Drive position consistent with the FIR flag (CF when hit, LF/RF when missed).
  let drive: { x: number; y: number } | null = null;
  if (par >= 4) {
    if (fir === 1) {
      drive = {
        x: clamp(gauss(rng, 0.5, 0.06), 0.34, 0.66),
        y: clamp(gauss(rng, 0.4, 0.12), 0.12, 0.85),
      };
    } else {
      const left = chance(rng, 0.5);
      drive = {
        x: left ? rand(rng, 0.08, 0.27) : rand(rng, 0.73, 0.92),
        y: clamp(gauss(rng, 0.42, 0.12), 0.12, 0.85),
      };
    }
  }

  // Approach position consistent with GIR (inside the rings vs. just off).
  const angle = rand(rng, 0, Math.PI * 2);
  const r = gir
    ? Math.min(0.44, Math.abs(gauss(rng, 0, 0.18)))
    : clamp(0.47 + Math.abs(gauss(rng, 0, 0.06)), 0.47, 0.63);
  const approach = {
    x: clamp(0.5 + r * Math.cos(angle), 0.03, 0.97),
    y: clamp(0.5 + r * Math.sin(angle), 0.03, 0.97),
  };

  const chipShots = !gir ? (chance(rng, 0.65) ? (chance(rng, 0.85) ? 1 : 2) : 0) : 0;
  const sandShots = chance(rng, 0.08) ? 1 : 0;
  const penalties = chance(rng, 0.12) ? (chance(rng, 0.2) ? 2 : 1) : 0;

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
    approachDistance: randInt(rng, 70, 190),
    approachClub: pick(rng, APPROACH_CLUBS),
    driveClub: drive ? pick(rng, DRIVE_CLUBS) : null,
    drive,
    approach,
    puttRows: buildPuttRows(rng, putts, gir),
  };
}
