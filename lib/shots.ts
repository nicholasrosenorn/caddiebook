import type { Shot } from '@/db/types';

export type DriverLane = 'LF' | 'CF' | 'RF';

export const CF_LEFT_EDGE = 0.3;
export const CF_RIGHT_EDGE = 0.7;

export function driverLane(xNorm: number): DriverLane {
  if (xNorm < CF_LEFT_EDGE) return 'LF';
  if (xNorm < CF_RIGHT_EDGE) return 'CF';
  return 'RF';
}

export function isFairwayHit(lane: DriverLane): boolean {
  return lane === 'CF';
}

export const APPROACH_RINGS = [
  { maxR: 0.1, ft: 5 },
  { maxR: 0.19, ft: 10 },
  { maxR: 0.33, ft: 20 },
  { maxR: 0.46, ft: 30 },
] as const;

export type ApproachResult = {
  onGreen: boolean;
  proximityFt: number | null;
};

export function approachResult(xNorm: number, yNorm: number): ApproachResult {
  const dx = xNorm - 0.5;
  const dy = yNorm - 0.5;
  const r = Math.hypot(dx, dy);
  for (const ring of APPROACH_RINGS) {
    if (r <= ring.maxR) return { onGreen: true, proximityFt: ring.ft };
  }
  return { onGreen: false, proximityFt: null };
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
    const lane = driverLane(shot.xNorm);
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

export type ApproachDispersionStats = {
  total: number;
  onGreen: number;
  girPct: number | null;
  avgProximityFt: number | null;
};

export function approachDispersionStats(shots: Shot[]): ApproachDispersionStats {
  const approaches = shots.filter((s) => s.shotType === 'approach');
  let onGreen = 0;
  let proximitySum = 0;
  let proximityCount = 0;
  for (const shot of approaches) {
    const res = approachResult(shot.xNorm, shot.yNorm);
    if (res.onGreen) {
      onGreen += 1;
      if (res.proximityFt != null) {
        proximitySum += res.proximityFt;
        proximityCount += 1;
      }
    }
  }
  return {
    total: approaches.length,
    onGreen,
    girPct: approaches.length > 0 ? onGreen / approaches.length : null,
    avgProximityFt: proximityCount > 0 ? proximitySum / proximityCount : null,
  };
}
