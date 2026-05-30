// Unit tests for lib/handicap.ts. No test runner is configured in this repo, so
// these run standalone: compile with tsc to a temp dir and execute with node
// (see the command in the handicap build notes), or `npx tsx lib/handicap.test.ts`.
import assert from 'node:assert/strict';

import {
  MAX_INDEX,
  bestCountFor,
  computeHandicapHistory,
  courseHandicap,
  handicapIndexFromDifferentials,
  scoreDifferential,
  type HandicapRound,
} from './handicap';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// Build an 18-hole round of uniform par/score.
function flatRound(
  overrides: Partial<Omit<HandicapRound, 'holes'>> & { par: number; score: number; count?: number },
): HandicapRound {
  const n = overrides.count ?? 18;
  return {
    id: overrides.id ?? 'r',
    holeCount: overrides.holeCount ?? n,
    courseRating: overrides.courseRating ?? null,
    slopeRating: overrides.slopeRating ?? null,
    datePlayed: overrides.datePlayed ?? '2026-01-01',
    createdAt: overrides.createdAt ?? '2026-01-01 12:00:00',
    holes: Array.from({ length: n }, () => ({ par: overrides.par, score: overrides.score })),
  };
}

console.log('handicap.ts');

test('bestCountFor follows the 18Birdies table (1-round minimum, no adjustments)', () => {
  assert.equal(bestCountFor(0), 0);
  assert.equal(bestCountFor(1), 1);
  assert.equal(bestCountFor(5), 1);
  assert.equal(bestCountFor(6), 2);
  assert.equal(bestCountFor(8), 2);
  assert.equal(bestCountFor(9), 3);
  assert.equal(bestCountFor(11), 3);
  assert.equal(bestCountFor(14), 4);
  assert.equal(bestCountFor(16), 5);
  assert.equal(bestCountFor(18), 6);
  assert.equal(bestCountFor(19), 7);
  assert.equal(bestCountFor(20), 8);
  assert.equal(bestCountFor(50), 8);
});

test('courseHandicap = round(index·slope/113 + (rating−par))', () => {
  assert.equal(courseHandicap(10, 113, 72, 72), 10);
  assert.equal(courseHandicap(10, 130, 74, 72), Math.round(10 * (130 / 113) + 2)); // 13.5 → 14
});

test('even-par round on a rating=par course yields a 0 differential', () => {
  const diff = scoreDifferential(flatRound({ par: 4, score: 4, courseRating: 72, slopeRating: 113 }), null);
  assert.equal(diff, 0);
  assert.equal(handicapIndexFromDifferentials([0]), 0);
});

test('Net Double Bogey caps a blow-up hole (par+5 with no prior index)', () => {
  // 17 holes of par, one hole of 12 strokes on a par 4. Cap = 4+2+3 = 9.
  const round = flatRound({ par: 4, score: 4, courseRating: 72, slopeRating: 113 });
  round.holes[0] = { par: 4, score: 12 };
  // AGS = 17·4 + min(12,9) = 68 + 9 = 77 → diff = 77 − 72 = 5 (uncapped would be 8).
  assert.equal(scoreDifferential(round, null), 5);
});

test('slope normalizes the differential', () => {
  // AGS 82 on a 72.0/130 course: (113/130)·(82−72) = 8.692...
  const round = flatRound({ par: 4, score: 4, courseRating: 72, slopeRating: 130 });
  for (let i = 0; i < 10; i++) round.holes[i] = { par: 4, score: 5 }; // +10 strokes, all under cap
  assert.ok(Math.abs(scoreDifferential(round, null)! - (113 / 130) * 10) < 1e-9);
});

test('9-hole round scales to an 18-hole equivalent', () => {
  // 9 holes par4 (par 36) scored 5 each (45), rating 36.0. raw nine = 45−36 = 9.
  const nine = flatRound({ par: 4, score: 5, count: 9, holeCount: 9, courseRating: 36, slopeRating: 113 });
  // No prior index → expected other nine falls back to doubling: 9 + 9 = 18.
  assert.equal(scoreDifferential(nine, null), 18);
  // With a prior index of 10, expected other nine = 5, and NDB strokes shrink:
  // ch = round(10·113/113 + (36−36)) = 10; per hole = round(10/9) = 1; cap = 7 (5 < 7).
  // raw nine = 9, + 5 = 14.
  assert.equal(scoreDifferential(nine, 10), 14);
});

test('index = average of best N, rounded to 0.1, capped at 54.0', () => {
  // 4 rounds → best 1 → lowest differential.
  assert.equal(handicapIndexFromDifferentials([5, 10, 2, 8]), 2);
  // rounding to 0.1: single differential 5.07 → 5.1
  assert.equal(handicapIndexFromDifferentials([5.07]), 5.1);
  // cap: twenty huge differentials → 54.0
  assert.equal(handicapIndexFromDifferentials(Array(20).fill(100)), MAX_INDEX);
});

test('index uses only the most recent 20 differentials', () => {
  // 19 great rounds then 20 terrible recent ones: the old greats fall out of window.
  const diffs = [...Array(19).fill(0), ...Array(20).fill(30)];
  assert.equal(handicapIndexFromDifferentials(diffs), 30); // best 8 of the recent 20 (all 30)
});

test('computeHandicapHistory posts one point per scored round, current = last index', () => {
  const rounds: HandicapRound[] = [
    flatRound({ id: 'a', par: 4, score: 5, courseRating: 72, slopeRating: 113, datePlayed: '2026-01-01' }),
    flatRound({ id: 'b', par: 4, score: 4, courseRating: 72, slopeRating: 113, datePlayed: '2026-01-08' }),
  ];
  const h = computeHandicapHistory(rounds);
  assert.equal(h.points.length, 2);
  assert.equal(h.points[0].roundId, 'a');
  assert.equal(h.points[1].roundId, 'b');
  assert.equal(h.current, h.points[1].index);
  assert.equal(h.indexByRound.get('b'), h.current);
});

test('a round with no scored holes is skipped', () => {
  const empty: HandicapRound = {
    id: 'e', holeCount: 18, courseRating: 72, slopeRating: 113,
    datePlayed: '2026-01-01', createdAt: '2026-01-01 12:00:00',
    holes: Array.from({ length: 18 }, () => ({ par: 4, score: null })),
  };
  const h = computeHandicapHistory([empty]);
  assert.equal(h.current, null);
  assert.equal(h.points.length, 0);
});

test('null rating/slope defaults to par / 113', () => {
  // No rating → rating = par (72); no slope → 113. Score 75 (all under cap) → diff 3.
  const round = flatRound({ par: 4, score: 4 });
  for (let i = 0; i < 3; i++) round.holes[i] = { par: 4, score: 5 };
  assert.equal(scoreDifferential(round, null), 3);
});

console.log(`\n${passed} passed`);
