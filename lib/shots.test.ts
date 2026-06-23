// Unit tests for the approach helpers in lib/shots.ts. No test runner is
// configured in this repo (see lib/handicap.test.ts), so run standalone:
// `npx tsx lib/shots.test.ts`.
import assert from 'node:assert/strict';

import {
  APPROACH_RINGS,
  approachMissDirection,
  approachMissLabel,
  approachProximityFt,
  isLikelyOnGreen,
} from './shots';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// The pin sits at the target center (0.5, 0.5); a tap straight "up" is long.
const C = 0.5;

// --- approachProximityFt ---------------------------------------------------

test('approachProximityFt is 0 at the pin', () => {
  assert.equal(approachProximityFt(C, C), 0);
});

test('approachProximityFt matches the ring labels on each ring', () => {
  // A tap sitting exactly on a drawn ring should read that ring's label.
  for (const ring of APPROACH_RINGS) {
    assert.equal(approachProximityFt(C, C - ring.maxR), ring.ft);
    assert.equal(approachProximityFt(C + ring.maxR, C), ring.ft);
  }
});

test('approachProximityFt interpolates between rings', () => {
  // Midway (radius) between the 5 ft (0.085) and 10 ft (0.165) rings → ~7-8 ft.
  const midR = (0.085 + 0.165) / 2;
  const ft = approachProximityFt(C, C - midR);
  assert.ok(ft > 5 && ft < 10, `expected 5 < ${ft} < 10`);
});

test('approachProximityFt extrapolates beyond the outer ring', () => {
  // Past the outermost ring (0.4 → 30 ft) the number keeps climbing.
  assert.ok(approachProximityFt(C, C - 0.49) > 30);
});

// --- isLikelyOnGreen -------------------------------------------------------

test('isLikelyOnGreen is true inside the outer ring, false beyond it', () => {
  const outer = APPROACH_RINGS[APPROACH_RINGS.length - 1].maxR;
  assert.equal(isLikelyOnGreen(C, C), true);
  assert.equal(isLikelyOnGreen(C, C - (outer - 0.01)), true);
  assert.equal(isLikelyOnGreen(C, C - (outer + 0.05)), false);
});

// --- approachMissDirection / approachMissLabel -----------------------------

test('approachMissDirection reads the dominant axis', () => {
  assert.equal(approachMissDirection(C, C - 0.3), 'long'); // above pin
  assert.equal(approachMissDirection(C, C + 0.3), 'short'); // below pin
  assert.equal(approachMissDirection(C - 0.3, C), 'left');
  assert.equal(approachMissDirection(C + 0.3, C), 'right');
});

test('approachMissDirection breaks vertical/horizontal ties toward the axis', () => {
  // Equal offsets → vertical wins (|dy| >= |dx|).
  assert.equal(approachMissDirection(C + 0.2, C - 0.2), 'long');
});

test('approachMissLabel drops a negligible secondary axis', () => {
  // Almost straight short → just "short".
  assert.equal(approachMissLabel(C + 0.01, C + 0.3), 'short');
});

test('approachMissLabel includes a meaningful secondary axis, dominant first', () => {
  // Mostly short, clearly right → "short-right".
  assert.equal(approachMissLabel(C + 0.2, C + 0.3), 'short-right');
  // Mostly right, clearly long → "right-long".
  assert.equal(approachMissLabel(C + 0.3, C - 0.2), 'right-long');
});

console.log(`\n${passed} passed`);
