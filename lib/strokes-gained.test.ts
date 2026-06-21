// Unit tests for lib/strokes-gained.ts. No test runner is configured in this repo
// (see lib/handicap.test.ts), so run standalone: `npx tsx lib/strokes-gained.test.ts`.
import assert from 'node:assert/strict';

import {
  addHoleSG,
  bandVsBaseline,
  benchmarkSG,
  driverDistanceFor,
  EMPTY_ROUND_SG,
  estimateHoleLength,
  expectedApproach,
  expectedPutt,
  expectedTee,
  formatSG,
  holeStrokesGained,
  impliedHandicap,
  scenarioDelta,
  SG_BASELINES,
  sgPer18,
  sgVsBaseline,
  type HoleSGInput,
  type SGBreakdown,
} from './strokes-gained';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function approx(actual: number, expected: number, tol = 0.02): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${actual} ≈ ${expected} (±${tol})`,
  );
}

// --- Baseline tables -------------------------------------------------------

test('expectedPutt hits known anchors and interpolates', () => {
  approx(expectedPutt(10), 1.61);
  approx(expectedPutt(0), 0);
  approx(expectedPutt(11), 1.655); // halfway between 10 (1.61) and 12 (1.70)
  approx(expectedPutt(1000), 2.4); // clamps to the far end
});

test('expectedApproach distinguishes lie and interpolates', () => {
  approx(expectedApproach(150, 'fairway'), 2.945); // between 140 and 160
  assert.ok(expectedApproach(150, 'rough') > expectedApproach(150, 'fairway'));
  assert.ok(expectedApproach(150, 'sand') > expectedApproach(150, 'fairway'));
});

test('expectedTee grows with hole length', () => {
  approx(expectedTee(400), 3.99);
  assert.ok(expectedTee(500) > expectedTee(400));
});

// --- Hole-length + driver estimates ----------------------------------------

test('estimateHoleLength: par 4 is drive + remaining, par 5 adds a layup', () => {
  approx(estimateHoleLength(4, 150, 270), 420, 0.001);
  approx(estimateHoleLength(5, 120, 270), 590, 0.001); // 270 + 200 layup + 120
  approx(estimateHoleLength(4, 10, 270), 280, 0.001); // clamped to >= 270
});

test('driverDistanceFor prefers logged yardage, else handicap default', () => {
  approx(driverDistanceFor(250, 5), 250, 0.001);
  approx(driverDistanceFor(undefined, 0), 270, 0.001);
  approx(driverDistanceFor(undefined, 20), 215, 0.001);
  approx(driverDistanceFor(undefined, null), 230, 0.001); // null → ~15 hcp
});

// --- Per-hole strokes gained ----------------------------------------------

const girPar4: HoleSGInput = {
  par: 4,
  score: 4,
  putts: 2,
  fir: true,
  onGreen: true,
  proximityFt: 10,
  firstPuttFt: 10,
  approachDistanceYds: 150,
  driverDistance: 270,
};

test('a clean GIR par leaves ~0 short game (categories sum to total)', () => {
  const sg = holeStrokesGained(girPar4)!;
  assert.ok(sg != null);
  approx(sg.total, 0.06); // 4.06 expected from the tee − 4 strokes
  approx(sg.ott!, 0.115); // 4.06 − 2.945 − 1
  approx(sg.approach, 0.335); // 2.945 − 1.61 − 1
  approx(sg.putting, -0.39); // 1.61 − 2 putts
  approx(sg.aroundGreen, 0, 0.001); // no short-game shot on a GIR hole
  approx(sg.ott! + sg.approach + sg.aroundGreen + sg.putting, sg.total, 0.001);
});

test('a stuffed approach to 10ft gains ~+0.33 on approach', () => {
  // 150 fairway → 10 ft: 2.945 − 1.61 − 1
  approx(girPar4 && holeStrokesGained(girPar4)!.approach, 0.335);
});

test('par 3 has no OTT category; total anchors on the approach', () => {
  const par3: HoleSGInput = {
    par: 3,
    score: 3,
    putts: 2,
    fir: null,
    onGreen: true,
    proximityFt: 20,
    firstPuttFt: 20,
    approachDistanceYds: 160,
    driverDistance: 270,
  };
  const sg = holeStrokesGained(par3)!;
  assert.equal(sg.ott, null);
  approx(sg.total, expectedApproach(160, 'fairway') - 3);
  approx(sg.ott ?? 0 + sg.approach + sg.aroundGreen + sg.putting, sg.total, 0.001);
});

test('missing first-putt data with putts taken is not decomposable', () => {
  const blocked: HoleSGInput = {
    ...girPar4,
    onGreen: false,
    proximityFt: null,
    firstPuttFt: null,
    putts: 2,
  };
  assert.equal(holeStrokesGained(blocked), null);
});

test('a missed green with a mediocre chip shows the loss in short game', () => {
  // Bogey 5 on a par 4: drive, missed green, chip to 25 ft, 2 putts.
  const bogey: HoleSGInput = {
    par: 4,
    score: 5,
    putts: 2,
    fir: true,
    onGreen: false,
    proximityFt: null,
    firstPuttFt: 25,
    approachDistanceYds: 150,
    driverDistance: 270,
  };
  const sg = holeStrokesGained(bogey)!;
  approx(sg.total, expectedTee(420) - 5); // ~ -0.94
  assert.ok(sg.aroundGreen < 0); // the chip to 25 ft underperformed the baseline
  approx((sg.ott ?? 0) + sg.approach + sg.aroundGreen + sg.putting, sg.total, 0.001);
});

// --- Aggregation + per-18 normalization ------------------------------------

test('addHoleSG accumulates and sgPer18 scales to an 18-hole basis', () => {
  let acc = EMPTY_ROUND_SG;
  for (let i = 0; i < 9; i++) acc = addHoleSG(acc, holeStrokesGained(girPar4)!);
  assert.equal(acc.holesWithSG, 9);
  const per18 = sgPer18(acc)!;
  approx(per18.total, 0.06 * 18, 0.05); // 9 holes doubled to 18
  assert.equal(sgPer18(EMPTY_ROUND_SG), null);
});

// --- Benchmarks, scenarios, implied handicap -------------------------------

test('benchmarkSG matches the published per-round handicap offsets', () => {
  approx(benchmarkSG('total', 0), -3.2);
  approx(benchmarkSG('total', 10), -9.2);
  approx(benchmarkSG('approach', 20), -7.5);
  approx(benchmarkSG('total', 7.5), -7.7); // interpolated between 5 and 10
});

test('scenarioDelta is player minus that handicap golfer', () => {
  approx(scenarioDelta('total', -9.2, 10), 0); // exactly a 10 handicap
  approx(scenarioDelta('total', -6.2, 10), 3.0); // 3 strokes better than a 10
  approx(scenarioDelta('total', -12.2, 10), -3.0); // 3 worse
});

test('impliedHandicap reads a category SG back as a handicap', () => {
  approx(impliedHandicap('total', -9.2), 10, 0.05);
  approx(impliedHandicap('putting', -1.2), 10, 0.05);
  assert.equal(impliedHandicap('total', 0), 0); // better than scratch clamps to 0
  assert.equal(impliedHandicap('total', -100), 30); // worse than the ladder clamps to 30
});

// --- Baseline toggle helpers -----------------------------------------------

test('SG_BASELINES lists Tour then the four handicap rungs', () => {
  assert.deepEqual(
    SG_BASELINES.map((b) => b.key),
    ['tour', '0', '5', '10', '15', '20'],
  );
  assert.equal(SG_BASELINES[0].hcp, null); // Tour
  assert.equal(SG_BASELINES[1].hcp, 0); // Scratch
});

test('sgVsBaseline subtracts the handicap benchmark per category', () => {
  const per18: SGBreakdown = {
    ott: -2.0,
    approach: -4.5,
    aroundGreen: -1.5,
    putting: -1.2,
    total: -9.2,
  };
  // Tour (null) is the identity.
  assert.deepEqual(sgVsBaseline(per18, null), per18);
  // vs a 10 handicap: this player IS a 10, so every category nets ~0.
  const vs10 = sgVsBaseline(per18, 10);
  approx(vs10.total, 0);
  approx(vs10.approach, 0);
  // The recomputed total equals the sum of the four recomputed categories.
  approx(vs10.ott + vs10.approach + vs10.aroundGreen + vs10.putting, vs10.total, 0.001);
  // vs a 20 handicap the same player looks better (positive).
  assert.ok(sgVsBaseline(per18, 20).total > 0);
});

test('bandVsBaseline: null is identity; a rung sums to the category vs-baseline', () => {
  // Three approach distance bands whose per-18 SG (vs Tour) sum to -4.5 — the
  // card's APPR bar for a player who plays the approach category like a 10-hcp.
  const bands = [
    { sgPer18: -1.0, holes: 30 },
    { sgPer18: -2.0, holes: 40 },
    { sgPer18: -1.5, holes: 20 },
  ];
  // Tour (null) leaves the raw per-18 values untouched.
  assert.deepEqual(bandVsBaseline(bands, 'approach', null), bands.map((b) => b.sgPer18));
  // vs a 10-handicap the bands shift up and re-sum to sgVsBaseline.approach (≈ 0).
  const vs10 = bandVsBaseline(bands, 'approach', 10);
  approx(
    vs10.reduce((s, v) => s + v, 0),
    -4.5 - benchmarkSG('approach', 10), // = Σraw − benchmark
    0.001,
  );
  // The biggest-sample band absorbs the largest share of the benchmark shift.
  const shift = vs10.map((v, i) => v - bands[i].sgPer18);
  assert.ok(shift[1] > shift[0] && shift[0] > shift[2]);
  // Empty series (no holes) is safe — identity, no divide-by-zero.
  assert.deepEqual(bandVsBaseline([{ sgPer18: 0, holes: 0 }], 'putting', 10), [0]);
});

test('formatSG renders signed one-decimal, collapsing zero', () => {
  assert.equal(formatSG(0), 'E');
  assert.equal(formatSG(-0.04), 'E'); // rounds to 0 → E (no -0)
  assert.equal(formatSG(1.25), '+1.3');
  assert.equal(formatSG(-2.14), '-2.1');
});

console.log(`\n${passed} passed`);
