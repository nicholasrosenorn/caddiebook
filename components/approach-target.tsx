import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg';

import type { TargetPin } from '@/components/driver-target';
import { ThemedText } from '@/components/themed-text';
import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { APPROACH_RINGS } from '@/lib/shots';
import { roughCirclePath, stippleInEllipse } from '@/lib/sketch';

const DEFAULT_SIZE = 280;
const PIN_SIZE = 13;

type ApproachTargetProps = {
  pins?: TargetPin[];
  onTap?: (xNorm: number, yNorm: number) => void;
  size?: number;
  /** Pin diameter in px. Shrink for dense multi-round dispersion overlays. */
  pinSize?: number;
};

function ApproachTargetImpl({
  pins = [],
  onTap,
  size = DEFAULT_SIZE,
  pinSize = PIN_SIZE,
}: ApproachTargetProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Same palette as the driver target: light beige-green putting surface with a
  // slightly darker fringe band around it.
  const GREEN_FILL = colors.fairway;
  const FRINGE_GREEN = colors.rough;
  const handlePress = (e: GestureResponderEvent) => {
    if (!onTap) return;
    const x = e.nativeEvent.locationX / size;
    const y = e.nativeEvent.locationY / size;
    onTap(clamp(x), clamp(y));
  };

  const c = size / 2;
  // Outermost grass band — the slightly darker green, mirroring the driver
  // target's fairway → rough → roughDeep nesting. Off-green misses on every
  // side read as tappable surface.
  const SURROUND_GREEN = colors.roughDeep;
  // Seeded geometry is deterministic in size — compute once, not every render.
  const { surfaceR, surroundD, surroundGrain, fringeD, greenD, grain, rings } = useMemo(() => {
    // The putting surface fills all the way out to the outermost ring.
    const surfaceR = APPROACH_RINGS[APPROACH_RINGS.length - 1].maxR * size;
    const fringeR = surfaceR + size * 0.04;
    const rings = APPROACH_RINGS.flatMap((ring) => {
      const r = ring.maxR * size;
      if (r >= surfaceR) return [];
      return [{ ft: ring.ft, d: roughCirclePath(c, c, r, `approach-ring-${ring.ft}`, { jitter: 0.018 }) }];
    });
    // The grass surround is a larger circle filling the frame behind the green,
    // keeping the whole target circular.
    const surroundR = size * 0.49;
    return {
      surfaceR,
      surroundD: roughCirclePath(c, c, surroundR, 'approach-surround', { jitter: 0.008, points: 28 }),
      surroundGrain: stippleInEllipse(c, c, surroundR, surroundR, 40, 'approach-surround-grain'),
      fringeD: roughCirclePath(c, c, fringeR, 'approach-fringe', { jitter: 0.008, points: 28 }),
      greenD: roughCirclePath(c, c, surfaceR, 'approach-green', { jitter: 0.009, points: 28 }),
      grain: stippleInEllipse(c, c, surfaceR, surfaceR, 70, 'approach-green-grain'),
      rings,
    };
  }, [c, size]);

  // Dispersion overlays (no onTap) are fully static — rasterize so scrolling
  // blits a cached bitmap instead of recompositing the SVG + pins every frame.
  const rasterize = !onTap;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      shouldRasterizeIOS={rasterize}
      renderToHardwareTextureAndroid={rasterize}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Grass surround — darkest green field filling the frame, so off-green
            misses on every side read as tappable ground (not dead paper) */}
        <Path
          d={surroundD}
          fill={SURROUND_GREEN}
          stroke={colors.accent}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
        <G>
          {surroundGrain.map((dot, i) => (
            <Circle key={`sg-${i}`} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.accent} opacity={0.1} />
          ))}
        </G>

        {/* Fringe — slightly darker green band ringing the whole surface */}
        <Path
          d={fringeD}
          fill={FRINGE_GREEN}
          stroke={colors.accent}
          strokeWidth={1.6}
          strokeOpacity={0.5}
        />

        {/* The green — light beige-green surface, out to the outermost ring */}
        <Path d={greenD} fill={GREEN_FILL} stroke={colors.accent} strokeWidth={1.4} />
        <G>
          {grain.map((dot, i) => (
            <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.accent} opacity={0.1} />
          ))}
        </G>

        {/* Contour rings drawn over the green (skip the outermost — it's the edge) */}
        {rings.map((ring) => (
          <Path
            key={`in-${ring.ft}`}
            d={ring.d}
            stroke={colors.accent}
            strokeWidth={1}
            strokeOpacity={0.22}
            fill="none"
          />
        ))}

        {/* Pin flag */}
        <Line x1={c} y1={c} x2={c} y2={c - size * 0.14} stroke={colors.accent} strokeWidth={1.6} />
        <Polygon
          points={`${c},${c - size * 0.14} ${c + size * 0.07},${c - size * 0.115} ${c},${c - size * 0.09}`}
          fill={colors.accent}
        />
        <Circle cx={c} cy={c} r={2} fill={colors.accent} />
      </Svg>

      {/* Decorative chrome (taps fall through) */}
      {/* <View style={styles.cornerTL} pointerEvents="none">
        <CornerDots />
      </View>
      <View style={styles.cornerTR} pointerEvents="none">
        <Crosshair />
      </View> */}

      {/* Ring labels */}
      {APPROACH_RINGS.map((ring) => {
        const r = ring.maxR * size;
        const overGreen = r <= surfaceR;
        return (
          <View
            key={`label-${ring.ft}`}
            pointerEvents="none"
            style={[styles.ringLabel, { top: c + r - 15, left: c - 18, width: 36 }]}>
            <ThemedText
              type="label"
              style={[styles.ringLabelText, overGreen && styles.ringLabelOver]}>
              {ring.ft}
            </ThemedText>
          </View>
        );
      })}

      {/* Directional cues — the player hits "up" the target, so the dot's
          position relative to the pin carries the miss direction (long over the
          top, short toward the player, left/right by side). */}
      {(
        [
          { key: 'long', text: 'LONG', box: { top: c - size * 0.47, left: 0, width: size } },
          { key: 'short', text: 'SHORT', box: { top: c + size * 0.43, left: 0, width: size } },
          { key: 'left', text: 'L', box: { top: c - 8, left: size * 0.02, width: 22 } },
          { key: 'right', text: 'R', box: { top: c - 8, left: size - size * 0.02 - 22, width: 22 } },
        ] as const
      ).map((d) => (
        <View key={d.key} pointerEvents="none" style={[styles.dirCue, d.box]}>
          <ThemedText type="label" style={styles.dirCueText}>
            {d.text}
          </ThemedText>
        </View>
      ))}

      {/* Tap surface */}
      <Pressable
        disabled={!onTap}
        onPress={handlePress}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />

      {/* Shot pins — one SVG layer of circles rather than N absolute Views, so
          a dense dispersion overlay stays a single native view. Kept on top of
          the chrome to preserve the previous z-order. The View wrapper carries
          pointerEvents="none" (react-native-svg's <Svg> doesn't reliably honor
          it) so taps fall through to the Pressable below. */}
      {pins.length > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            {pins.map((pin, i) => (
              <PinCircle
                key={pin.key ?? i}
                cx={pin.xNorm * size}
                cy={pin.yNorm * size}
                size={pinSize}
                variant={pin.variant ?? 'primary'}
              />
            ))}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

export const ApproachTarget = memo(ApproachTargetImpl);

function PinCircle({
  cx,
  cy,
  size,
  variant,
}: {
  cx: number;
  cy: number;
  size: number;
  variant: 'primary' | 'muted';
}) {
  const colors = useColors();
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={size / 2}
      fill={colors.accentPressed}
      stroke={colors.accentOn}
      strokeWidth={size <= 8 ? 1 : 2}
      opacity={variant === 'muted' ? 0.45 : 1}
    />
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 2,
    left: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringLabelText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  ringLabelOver: {
    color: colors.accent,
    opacity: 0.7,
  },
  dirCue: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirCueText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
    opacity: 0.6,
  },
});
