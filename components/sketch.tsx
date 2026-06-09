import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { useChrome, useColors } from '@/constants/theme-context';
import {
  bunkerPath,
  roughRectPath,
  sketchDividerPath,
  stippleInEllipse,
  stippleInRect,
  topoRings,
} from '@/lib/sketch';

// 2x2 registration dots — a recurring corner ornament from the mood board.
export function CornerDots({
  size = 20,
  gap = 7,
  r = 1.6,
  color,
}: {
  size?: number;
  gap?: number;
  r?: number;
  color?: string;
}) {
  const colors = useColors();
  const tint = color ?? colors.borderStrong;
  const a = (size - gap) / 2;
  const b = a + gap;
  return (
    <Svg width={size} height={size}>
      {[a, b].map((cx) =>
        [a, b].map((cy) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={tint} />
        )),
      )}
    </Svg>
  );
}

// Small registration crosshair (ticks + ring).
export function Crosshair({
  size = 22,
  color,
  strokeWidth = 1.2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const tint = color ?? colors.borderStrong;
  const c = size / 2;
  const r = size * 0.22;
  const tick = size * 0.16;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={tint} strokeWidth={strokeWidth} fill="none" />
      <Line x1={c} y1={0} x2={c} y2={tick} stroke={tint} strokeWidth={strokeWidth} />
      <Line x1={c} y1={size - tick} x2={c} y2={size} stroke={tint} strokeWidth={strokeWidth} />
      <Line x1={0} y1={c} x2={tick} y2={c} stroke={tint} strokeWidth={strokeWidth} />
      <Line x1={size - tick} y1={c} x2={size} y2={c} stroke={tint} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// A small registration plus mark.
export function PlusMark({
  size = 14,
  color,
  strokeWidth = 1.2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const tint = color ?? colors.borderStrong;
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Line x1={c} y1={0} x2={c} y2={size} stroke={tint} strokeWidth={strokeWidth} />
      <Line x1={0} y1={c} x2={size} y2={c} stroke={tint} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// Full-bleed paper backdrop: a faint, deterministic grain field with optional
// corner registration marks. Sits behind screen content (pointerEvents none).
// Grain density is capped and memoized so it never reflows or re-randomizes.
export function Paper({
  marks = true,
  seed = 'paper',
  grainOpacity = 0.5,
}: {
  marks?: boolean;
  seed?: string;
  grainOpacity?: number;
}) {
  const colors = useColors();
  const chrome = useChrome();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const dots = useMemo(() => {
    if (size.w === 0 || size.h === 0) return [];
    // ~1 dot per 1600px², capped so large screens stay cheap.
    const count = Math.min(420, Math.round((size.w * size.h) / 1600));
    return stippleInRect(size.w, size.h, count, seed);
  }, [size.w, size.h, seed]);

  // Editorial chrome: a clean page — no grain field.
  if (chrome === 'editorial') return null;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <G>
            {dots.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={colors.borderStrong} opacity={grainOpacity * 0.4} />
            ))}
          </G>
        </Svg>
      )}
    </View>
  );
}

// A surface (card / button / input) framed by a hand-drawn rough rectangle.
// fill controls the body color; selected swaps to the accent fill.
export function SketchSurface({
  seed,
  fill,
  stroke,
  strokeWidth = 1.3,
  radius = 10,
  grain = false,
  style,
  children,
  ...rest
}: ViewProps & {
  seed: string | number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  grain?: boolean;
}) {
  const colors = useColors();
  const chrome = useChrome();
  const fillColor = fill ?? colors.surface;
  const strokeColor = stroke ?? colors.borderStrong;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const { path, dots } = useMemo(() => {
    if (size.w === 0 || size.h === 0) return { path: '', dots: [] as ReturnType<typeof stippleInRect> };
    return {
      path: roughRectPath(size.w, size.h, radius, seed),
      dots: grain
        ? stippleInRect(size.w, size.h, Math.min(160, Math.round((size.w * size.h) / 900)), `${seed}-grain`)
        : [],
    };
  }, [size.w, size.h, radius, seed, grain]);

  // Editorial chrome: a crisp native-bordered surface — no grain, no SVG frame.
  // `grain`/`seed` are accepted-and-ignored so the 119 call sites stay unchanged;
  // selection still reads via the accent `fill`.
  if (chrome === 'editorial') {
    return (
      <View
        style={[
          {
            backgroundColor: fillColor,
            borderColor: strokeColor,
            borderWidth: strokeWidth <= 1.3 ? 1 : Math.round(strokeWidth),
            borderRadius: radius,
          },
          style,
        ]}
        {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View style={style} onLayout={onLayout} {...rest}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path d={path} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
          {dots.map((d, i) => (
            <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={colors.accentOn} opacity={0.16} />
          ))}
        </Svg>
      )}
      {children}
    </View>
  );
}

// A faintly hand-drawn horizontal divider.
export function SketchDivider({
  seed = 'divider',
  color,
  strokeWidth = 1.2,
}: {
  seed?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const chrome = useChrome();
  const tint = color ?? colors.border;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };
  const path = useMemo(() => (width > 0 ? sketchDividerPath(width, seed) : ''), [width, seed]);

  // Editorial chrome: a 1px hairline rule.
  if (chrome === 'editorial') return <View style={{ height: 1, backgroundColor: tint }} />;

  return (
    <View style={dividerStyles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={4}>
          <Path d={path} stroke={tint} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      )}
    </View>
  );
}

const dividerStyles = StyleSheet.create({
  wrap: { height: 4, width: '100%' },
});

// A pair of short stacked tick lines used as a minimalist label mark.
export function TickPair({
  width = 16,
  color,
  strokeWidth = 1.2,
}: {
  width?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const tint = color ?? colors.borderStrong;
  return (
    <Svg width={width} height={8}>
      <Line x1={0} y1={2} x2={width} y2={2} stroke={tint} strokeWidth={strokeWidth} />
      <Line x1={0} y1={6} x2={width * 0.6} y2={6} stroke={tint} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// Topographic map chip — a tiny framed contour tile with a filled green corner.
export function TopoChip({
  width = 88,
  height = 64,
  seed = 'topo',
}: {
  width?: number;
  height?: number;
  seed?: string;
}) {
  const colors = useColors();
  const rings = topoRings(width * 0.62, height * 0.5, height * 0.46, 5, seed);
  return (
    <Svg width={width} height={height}>
      <Path
        d={`M2 2 H${width - 2} V${height - 2} H2 Z`}
        stroke={colors.borderStrong}
        strokeWidth={1}
        fill={colors.surface}
      />
      <Path
        d={`M2 ${height * 0.45} Q ${width * 0.18} ${height * 0.2} ${width * 0.34} ${height * 0.5} T ${width * 0.34} ${height - 2} L2 ${height - 2} Z`}
        fill={colors.accent}
        opacity={0.9}
      />
      {rings.map((d, i) => (
        <Path key={i} d={d} stroke={colors.borderStrong} strokeWidth={0.8} fill="none" />
      ))}
    </Svg>
  );
}

// A peanut bunker with sand-grain stipple. Decorative.
export function BunkerBlob({
  width = 70,
  height = 44,
  seed = 'bunker',
  rotation = 0,
}: {
  width?: number;
  height?: number;
  seed?: string;
  rotation?: number;
}) {
  const colors = useColors();
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.42;
  const ry = height * 0.42;
  const path = bunkerPath(cx, cy, rx, ry, seed, { rotation, lobe: 0.14, jitter: 0.02, points: 32 });
  const grain = stippleInEllipse(cx, cy, rx * 0.9, ry * 0.9, 14, `${seed}-grain`, { minR: 0.4, maxR: 0.9 });
  return (
    <Svg width={width} height={height}>
      <Path d={path} fill={colors.surfaceAlt} stroke={colors.borderStrong} strokeWidth={1} />
      <G>
        {grain.map((dot, i) => (
          <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.borderStrong} opacity={0.4} />
        ))}
      </G>
    </Svg>
  );
}

export type ScoreIndicator =
  | 'doubleCircle'
  | 'circle'
  | 'par'
  | 'square'
  | 'doubleSquare'
  | 'tripleSquare'
  | 'none';

// Open-stroke par-relative score glyph (circle = under, square = over).
// Renders only the shape; the number/label is layered by the caller.
export function ScoreGlyph({
  kind,
  size = 44,
  color,
  strokeWidth = 1.6,
}: {
  kind: ScoreIndicator;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const tint = color ?? colors.textPrimary;
  const c = size / 2;
  const ring = (r: number, key: string) => (
    <Circle key={key} cx={c} cy={c} r={r} stroke={tint} strokeWidth={strokeWidth} fill="none" />
  );
  const box = (s: number, key: string) => {
    const off = c - s / 2;
    return (
      <Path
        key={key}
        d={`M${off} ${off} H${off + s} V${off + s} H${off} Z`}
        stroke={tint}
        strokeWidth={strokeWidth}
        fill="none"
      />
    );
  };

  let shapes: React.ReactNode = null;
  switch (kind) {
    case 'doubleCircle':
      shapes = [ring(size * 0.44, 'o'), ring(size * 0.33, 'i')];
      break;
    case 'circle':
      shapes = ring(size * 0.4, 'o');
      break;
    case 'square':
      shapes = box(size * 0.74, 'o');
      break;
    case 'doubleSquare':
      shapes = [box(size * 0.82, 'o'), box(size * 0.6, 'i')];
      break;
    case 'tripleSquare':
      shapes = [box(size * 0.88, 'o'), box(size * 0.68, 'm'), box(size * 0.48, 'i')];
      break;
    default:
      shapes = null;
  }

  return (
    <Svg width={size} height={size} pointerEvents="none">
      {shapes}
    </Svg>
  );
}
