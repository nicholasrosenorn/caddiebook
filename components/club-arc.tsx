import { memo } from 'react';
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg';

import { isWedge } from '@/constants/clubs';
import { useColors } from '@/constants/theme-context';
import { trajectoryPath } from '@/lib/sketch';

// The shared carry scale: every arc (cards + the bag fan) maps a yardage onto
// the same domain, so a longer carry literally throws a longer arc across the
// whole screen. Driver lands near the right edge; a lob wedge stays short-left.
export const CARRY_MIN = 30;
export const CARRY_MAX = 320;
export const CARRY_STEP = 5;

const PAD_L = 16;
const PAD_R = 16;

function carryFrac(carry: number): number {
  return Math.max(0, Math.min(1, (carry - CARRY_MIN) / (CARRY_MAX - CARRY_MIN)));
}

// Map a yardage to an x within a band of the given width (shared by render +
// the inverse used for drag-to-set).
export function carryToX(carry: number, width: number): number {
  const usable = Math.max(1, width - PAD_L - PAD_R);
  return PAD_L + carryFrac(carry) * usable;
}

export function xToCarry(x: number, width: number): number {
  const usable = Math.max(1, width - PAD_L - PAD_R);
  const raw = CARRY_MIN + ((x - PAD_L) / usable) * (CARRY_MAX - CARRY_MIN);
  const snapped = Math.round(raw / CARRY_STEP) * CARRY_STEP;
  return Math.max(CARRY_MIN, Math.min(CARRY_MAX, snapped));
}

// Loft factor 0..1 — how high the arc rises relative to its span. Wedges fly
// steep and high; long irons, hybrids, woods and the driver fly flatter.
export function clubLoft(club: string): number {
  if (isWedge(club)) return 1;
  if (/^[89]i$/.test(club)) return 0.78;
  if (/^[567]i$/.test(club)) return 0.58;
  if (/^[1-4]i$/.test(club)) return 0.42;
  if (club.endsWith('H')) return 0.4;
  if (club.endsWith('W') || club.includes('Driver')) return 0.26;
  return 0.5;
}

function apexHeight(span: number, loft: number, maxH: number): number {
  return Math.max(12, Math.min(maxH, span * (0.4 + loft * 0.32)));
}

// One drawn trajectory: a ground line, a tee with a teed ball, a dotted arc,
// and a flag at the landing point. Position-aware — the flag's x IS the
// yardage. `active` inks it green (set); otherwise it's a muted resting line.
// When carry is null it parks muted at `parkedAt`. Set `flag={false}` to omit
// the landing flag so a caller can render it as an animated overlay instead
// (see `ArcFlag`).
type ClubArcProps = {
  width: number;
  height: number;
  carry: number | null;
  active?: boolean;
  loft?: number;
  parkedAt?: number;
  flag?: boolean;
};

function ClubArcImpl({
  width,
  height,
  carry,
  active = false,
  loft = 0.5,
  parkedAt = 100,
  flag = true,
}: ClubArcProps) {
  const colors = useColors();
  const groundY = height - 12;
  const x0 = PAD_L;
  const value = carry ?? parkedAt;
  const x1 = carryToX(value, width);
  const span = x1 - x0;
  const apexH = apexHeight(span, loft, groundY - 6);
  const d = trajectoryPath(x0, x1, groundY, apexH);

  const set = carry != null;
  const ink = !set ? colors.borderStrong : active ? colors.accent : colors.textSecondary;
  const flagInk = !set ? colors.borderStrong : colors.accent;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      {/* Ground line */}
      <Line
        x1={PAD_L}
        y1={groundY}
        x2={width - PAD_R}
        y2={groundY}
        stroke={colors.borderStrong}
        strokeWidth={1}
        opacity={0.5}
      />

      {/* Tee + teed ball */}
      <Line x1={x0} y1={groundY} x2={x0} y2={groundY - 7} stroke={colors.borderStrong} strokeWidth={1.4} />
      <Circle cx={x0} cy={groundY - 9} r={2.4} fill={colors.surface} stroke={ink} strokeWidth={1.2} />

      {/* The flight path */}
      <Path
        d={d}
        stroke={ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray="0.5 5"
        fill="none"
        opacity={set ? 1 : 0.7}
      />

      {/* Flag at the landing (omitted when a caller renders ArcFlag itself) */}
      {flag && (
        <>
          <Line x1={x1} y1={groundY} x2={x1} y2={groundY - 16} stroke={flagInk} strokeWidth={1.6} />
          <Polygon
            points={`${x1},${groundY - 16} ${x1 + 9},${groundY - 13} ${x1},${groundY - 10}`}
            fill={flagInk}
            opacity={set ? 1 : 0.6}
          />
          <Circle cx={x1} cy={groundY} r={2.2} fill={flagInk} />
        </>
      )}
    </Svg>
  );
}

export const ClubArc = memo(ClubArcImpl);

// The landing flag, extracted so it can ride an animated overlay (gliding to a
// new carry on commit) while `ClubArc` redraws the static flight path beneath.
// Drawn in a compact SVG with the pole at a fixed local x; the caller positions
// it with `flagOffsetX(carry, width)` as a `translateX`.
const FLAG_W = 24;
const FLAG_POLE_X = 4;

// translateX that lands ArcFlag's pole exactly at `carry`'s x on the band.
export function flagOffsetX(carry: number, width: number): number {
  return carryToX(carry, width) - FLAG_POLE_X;
}

type ArcFlagProps = { height: number; set: boolean };

function ArcFlagImpl({ height, set }: ArcFlagProps) {
  const colors = useColors();
  const groundY = height - 12;
  const ink = set ? colors.accent : colors.borderStrong;
  const x = FLAG_POLE_X;
  return (
    <Svg width={FLAG_W} height={height} pointerEvents="none">
      <Line x1={x} y1={groundY} x2={x} y2={groundY - 16} stroke={ink} strokeWidth={1.6} />
      <Polygon
        points={`${x},${groundY - 16} ${x + 9},${groundY - 13} ${x},${groundY - 10}`}
        fill={ink}
        opacity={set ? 1 : 0.6}
      />
      <Circle cx={x} cy={groundY} r={2.2} fill={ink} />
    </Svg>
  );
}

export const ArcFlag = memo(ArcFlagImpl);
export { FLAG_W };

// The "your bag" plate: all set clubs as nested arcs from one tee, landing at
// flags along a shared ground line. The silhouette of the whole bag — the gaps
// between landings read as your gapping. Decorative (no interaction).
type BagFanProps = {
  width: number;
  height: number;
  items: { carry: number; loft: number }[];
};

function BagFanImpl({ width, height, items }: BagFanProps) {
  const colors = useColors();
  const groundY = height - 12;
  const x0 = PAD_L;
  const sorted = [...items].sort((a, b) => b.carry - a.carry);

  // Unlike the per-club cards (fixed global scale so arcs stay comparable), the
  // bag plate stretches to fit your actual range: the longest club lands at the
  // right edge, so the whole width is used regardless of how far you hit it.
  const maxCarry = sorted.length > 0 ? sorted[0].carry : CARRY_MAX;
  const fanX = (carry: number) => {
    const usable = Math.max(1, width - PAD_L - PAD_R);
    const f = Math.max(0, Math.min(1, (carry - CARRY_MIN) / Math.max(1, maxCarry - CARRY_MIN)));
    return PAD_L + f * usable;
  };

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Line
        x1={PAD_L}
        y1={groundY}
        x2={width - PAD_R}
        y2={groundY}
        stroke={colors.borderStrong}
        strokeWidth={1}
        opacity={0.6}
      />
      <Line x1={x0} y1={groundY} x2={x0} y2={groundY - 8} stroke={colors.borderStrong} strokeWidth={1.4} />
      <Circle cx={x0} cy={groundY - 10} r={2.4} fill={colors.surface} stroke={colors.accent} strokeWidth={1.2} />

      <G>
        {sorted.map((item, i) => {
          const x1 = fanX(item.carry);
          const apexH = apexHeight(x1 - x0, item.loft, groundY - 6);
          return (
            <Path
              key={i}
              d={trajectoryPath(x0, x1, groundY, apexH)}
              stroke={colors.accent}
              strokeWidth={1.3}
              strokeLinecap="round"
              fill="none"
              opacity={0.45}
            />
          );
        })}
      </G>

      <G>
        {sorted.map((item, i) => {
          const x1 = fanX(item.carry);
          return <Circle key={i} cx={x1} cy={groundY} r={2.2} fill={colors.accent} />;
        })}
      </G>
    </Svg>
  );
}

export const BagFan = memo(BagFanImpl);
