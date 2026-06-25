import type { Shot } from '@/lib/data/models';

export type DriverLane = 'LF' | 'CF' | 'RF';

// Used only to lay out the LF / CF / RF labels along the bottom of the target.
export const CF_LEFT_EDGE = 0.3;
export const CF_RIGHT_EDGE = 0.7;

// The fairway is drawn as an inset, gently tapered oval (see DriverTarget). Lane
// is shape-based: a tap inside that oval is a fairway hit; otherwise it's left or
// right of the fairway by which side of center it lands on.
export const FAIRWAY_INSET = 0.72;

export function fairwayContains(xNorm: number, yNorm: number): boolean {
  const ry = 0.5 * FAIRWAY_INSET;
  const sinT = (yNorm - 0.5) / ry;
  if (Math.abs(sinT) >= 1) return false; // above or below the fairway oval
  const cosT = Math.sqrt(1 - sinT * sinT);
  const taper = 0.82 + 0.18 * Math.abs(sinT); // mirrors fairwayPath()
  const halfWidth = cosT * (0.5 * FAIRWAY_INSET) * taper;
  return Math.abs(xNorm - 0.5) <= halfWidth;
}

export function driverLane(xNorm: number, yNorm: number): DriverLane {
  if (fairwayContains(xNorm, yNorm)) return 'CF';
  return xNorm < 0.5 ? 'LF' : 'RF';
}

export function isFairwayHit(lane: DriverLane): boolean {
  return lane === 'CF';
}

// Yardage marks drawn down the driver target's height (top = farther). This is
// the single source of truth: the DriverTarget visuals and the distance readout
// (driveDistanceFromY) both read it, so the drawn marks and the derived number
// stay aligned — mirroring APPROACH_RINGS for the approach target.
export const DRIVE_YARDAGE_MARKS = [
  { yNorm: 0.78, yds: 100 },
  { yNorm: 0.5, yds: 200 },
  { yNorm: 0.22, yds: 300 },
] as const;

const DRIVE_DISTANCE_MIN = 50;
const DRIVE_DISTANCE_MAX = 360;

// Drive distance down the fairway from the ball's vertical position. Lane
// (x, left/right) does not add yards — distance is purely how far up the ball
// sits, interpolated/extrapolated linearly through the yardage marks, then
// clamped to a realistic range and snapped to 5 (as the old chips did).
export function driveDistanceFromY(yNorm: number): number {
  const a = DRIVE_YARDAGE_MARKS[0];
  const b = DRIVE_YARDAGE_MARKS[DRIVE_YARDAGE_MARKS.length - 1];
  const slope = (b.yds - a.yds) / (b.yNorm - a.yNorm);
  const yds = a.yds + (yNorm - a.yNorm) * slope;
  const clamped = Math.max(DRIVE_DISTANCE_MIN, Math.min(DRIVE_DISTANCE_MAX, yds));
  return Math.round(clamped / 5) * 5;
}

// Ring radii are deliberately kept modest (outermost = the drawn green edge at
// 0.40) so the approach target leaves a green "grass" band on every side — room
// to mark short/long/left/right misses without crowding the edge of the frame.
// This is the single source of truth: the ApproachTarget visuals, the proximity
// readout (approachProximityFt), and the on-green pre-fill guess (isLikelyOnGreen)
// all read it, so the drawn rings and the derived numbers stay aligned.
export const APPROACH_RINGS = [
  { maxR: 0.085, ft: 5 },
  { maxR: 0.165, ft: 10 },
  { maxR: 0.285, ft: 20 },
  { maxR: 0.4, ft: 30 },
] as const;

export type MissDirection = 'short' | 'long' | 'left' | 'right';

// Distance from the pin (target center) in feet, defined everywhere — including
// beyond the outer ring so an off-green miss still reads a real number. Feet are
// interpolated across the ring control points (so a tap on a drawn ring matches
// its label), then extrapolated past the outer ring using the final segment's slope.
export function approachProximityFt(xNorm: number, yNorm: number): number {
  const r = Math.hypot(xNorm - 0.5, yNorm - 0.5);
  const pts = [{ r: 0, ft: 0 }, ...APPROACH_RINGS.map((g) => ({ r: g.maxR, ft: g.ft }))];
  for (let i = 1; i < pts.length; i++) {
    if (r <= pts[i].r) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (r - a.r) / (b.r - a.r);
      return Math.round(a.ft + t * (b.ft - a.ft));
    }
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const slope = (b.ft - a.ft) / (b.r - a.r);
  return Math.round(b.ft + (r - b.r) * slope);
}

// Pre-fill guess only: a tap inside the outer ring usually finished on the green.
// Never authoritative — the player confirms/flips on/off green explicitly, and
// resolveGir() (lib/stats.ts) is the source of truth for whether it was a GIR.
export function isLikelyOnGreen(xNorm: number, yNorm: number): boolean {
  const outer = APPROACH_RINGS[APPROACH_RINGS.length - 1].maxR;
  return Math.hypot(xNorm - 0.5, yNorm - 0.5) <= outer;
}

// Dominant axis of the miss relative to the pin. The player hits "up" the target,
// so above the pin (dy < 0) is long, below is short; sides by dx.
export function approachMissDirection(xNorm: number, yNorm: number): MissDirection {
  const dx = xNorm - 0.5;
  const dy = yNorm - 0.5;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'long' : 'short';
  return dx < 0 ? 'left' : 'right';
}

// Human-readable miss label: the dominant direction, plus the secondary axis when
// it's meaningful (≥ 25% of the dominant offset) → e.g. "short", "short-right".
export function approachMissLabel(xNorm: number, yNorm: number): string {
  const dx = xNorm - 0.5;
  const dy = yNorm - 0.5;
  const primary = approachMissDirection(xNorm, yNorm);
  const vertDominant = Math.abs(dy) >= Math.abs(dx);
  const primaryMag = vertDominant ? Math.abs(dy) : Math.abs(dx);
  const secondaryMag = vertDominant ? Math.abs(dx) : Math.abs(dy);
  if (secondaryMag < primaryMag * 0.25) return primary;
  const secondary = vertDominant ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'long' : 'short';
  return `${primary}-${secondary}`;
}

export type DriverDispersionStats = {
  total: number;
  fairwayHits: number;
  firPct: number | null;
  laneCounts: Record<DriverLane, number>;
};

export function driverDispersionStats(shots: Shot[]): DriverDispersionStats {
  const drives = shots.filter((s) => s.shotType === 'driver');
  const laneCounts: Record<DriverLane, number> = { LF: 0, CF: 0, RF: 0 };
  let fairwayHits = 0;
  for (const shot of drives) {
    const lane = driverLane(shot.xNorm, shot.yNorm);
    laneCounts[lane] += 1;
    if (isFairwayHit(lane)) fairwayHits += 1;
  }
  return {
    total: drives.length,
    fairwayHits,
    firPct: drives.length > 0 ? fairwayHits / drives.length : null,
    laneCounts,
  };
}
