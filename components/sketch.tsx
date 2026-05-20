import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';
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
  color = colors.borderStrong,
}: {
  size?: number;
  gap?: number;
  r?: number;
  color?: string;
}) {
  const a = (size - gap) / 2;
  const b = a + gap;
  return (
    <Svg width={size} height={size}>
      {[a, b].map((cx) =>
        [a, b].map((cy) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={color} />
        )),
      )}
    </Svg>
  );
}

// Small registration crosshair (ticks + ring).
export function Crosshair({
  size = 22,
  color = colors.borderStrong,
  strokeWidth = 1.2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const c = size / 2;
  const r = size * 0.22;
  const tick = size * 0.16;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Line x1={c} y1={0} x2={c} y2={tick} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={c} y1={size - tick} x2={c} y2={size} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={0} y1={c} x2={tick} y2={c} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={size - tick} y1={c} x2={size} y2={c} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

// A small registration plus mark.
export function PlusMark({
  size = 14,
  color = colors.borderStrong,
  strokeWidth = 1.2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Line x1={c} y1={0} x2={c} y2={size} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={0} y1={c} x2={size} y2={c} stroke={color} strokeWidth={strokeWidth} />
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
      {marks && size.w > 0 && (
        <>
          <View style={paperStyles.markTL}>
            <CornerDots />
          </View>
          <View style={paperStyles.markTR}>
            <Crosshair />
          </View>
        </>
      )}
    </View>
  );
}

// A surface (card / button / input) framed by a hand-drawn rough rectangle.
// fill controls the body color; selected swaps to the accent fill.
export function SketchSurface({
  seed,
  fill = colors.surface,
  stroke = colors.borderStrong,
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

  return (
    <View style={style} onLayout={onLayout} {...rest}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path d={path} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
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
  color = colors.border,
  strokeWidth = 1.2,
}: {
  seed?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };
  const path = useMemo(() => (width > 0 ? sketchDividerPath(width, seed) : ''), [width, seed]);
  return (
    <View style={dividerStyles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={4}>
          <Path d={path} stroke={color} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      )}
    </View>
  );
}

const paperStyles = StyleSheet.create({
  markTL: { position: 'absolute', top: 8, left: 8 },
  markTR: { position: 'absolute', top: 8, right: 8 },
});

const dividerStyles = StyleSheet.create({
  wrap: { height: 4, width: '100%' },
});

// A pair of short stacked tick lines used as a minimalist label mark.
export function TickPair({
  width = 16,
  color = colors.borderStrong,
  strokeWidth = 1.2,
}: {
  width?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={width} height={8}>
      <Line x1={0} y1={2} x2={width} y2={2} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={0} y1={6} x2={width * 0.6} y2={6} stroke={color} strokeWidth={strokeWidth} />
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
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.42;
  const ry = height * 0.42;
  const path = bunkerPath(cx, cy, rx, ry, seed, { rotation });
  const grain = stippleInEllipse(cx, cy, rx, ry, 26, `${seed}-grain`);
  return (
    <Svg width={width} height={height}>
      <Path d={path} fill={colors.surfaceAlt} stroke={colors.borderStrong} strokeWidth={1} />
      <G>
        {grain.map((dot, i) => (
          <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.borderStrong} opacity={0.5} />
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
  color = colors.textPrimary,
  strokeWidth = 1.6,
}: {
  kind: ScoreIndicator;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const c = size / 2;
  const ring = (r: number, key: string) => (
    <Circle key={key} cx={c} cy={c} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" />
  );
  const box = (s: number, key: string) => {
    const off = c - s / 2;
    return (
      <Path
        key={key}
        d={`M${off} ${off} H${off + s} V${off + s} H${off} Z`}
        stroke={color}
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
