import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { SketchDivider } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { revealRule, revealUp } from '@/lib/motion';
import { topoRings } from '@/lib/sketch';

// The cover plate settles in as a whole (never from scale 0), then the flag
// rises out of the cup once the green has landed.
export const heroIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(650);

const flagIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 10 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
})
  .duration(450)
  .delay(380);

/**
 * The app's cover illustration: a green drawn in plan view (a faint wash + rough
 * contour rings via topoRings) with a flag rising from the cup, framed by two
 * faint crop marks. Decorative — pointerEvents none. Two colors only. The flag
 * layer is separate so it can rise out of the cup after the plate settles.
 * Shared by the intro cover and the launch splash.
 */
export function CoverHero({ size }: { size: number }) {
  const colors = useColors();
  const cx = size / 2;
  const cy = size * 0.56;
  const maxR = size * 0.36;
  const rings = useMemo(() => topoRings(cx, cy, maxR, 4, 'cover-green'), [cx, cy, maxR]);
  const stickTop = size * 0.12;
  const pennant = `M${cx} ${stickTop} L${cx + size * 0.15} ${stickTop + size * 0.045} L${cx} ${
    stickTop + size * 0.09
  } Z`;
  const crop = size * 0.06;
  const tick = size * 0.06;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={maxR} fill={colors.accent} fillOpacity={0.08} />
        {rings.map((d, i) => (
          <Path key={i} d={d} stroke={colors.borderStrong} strokeWidth={1} fill="none" opacity={0.6} />
        ))}
        {/* crop marks — top-left + bottom-right, an architect's-plate framing */}
        <Line x1={crop} y1={crop} x2={crop + tick} y2={crop} stroke={colors.borderStrong} strokeWidth={1} />
        <Line x1={crop} y1={crop} x2={crop} y2={crop + tick} stroke={colors.borderStrong} strokeWidth={1} />
        <Line
          x1={size - crop}
          y1={size - crop}
          x2={size - crop - tick}
          y2={size - crop}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />
        <Line
          x1={size - crop}
          y1={size - crop}
          x2={size - crop}
          y2={size - crop - tick}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />
      </Svg>
      <Animated.View entering={flagIn} style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Line x1={cx} y1={cy} x2={cx} y2={stickTop} stroke={colors.accent} strokeWidth={1.6} />
          <Path d={pennant} fill={colors.accent} />
          <Circle cx={cx} cy={cy} r={size * 0.018} fill={colors.accent} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * The wordmark lockup beneath the hero — kicker, "Caddie Book", a drawn rule,
 * and the tagline — revealing in the cover's stagger order (2..5, after the
 * hero settles at 0).
 */
export function CoverLockup() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.coverTitle}>
      <Animated.View entering={revealUp(2)}>
        <ThemedText type="caption" style={styles.kicker}>
          A GOLFER&apos;S FIELD NOTEBOOK
        </ThemedText>
      </Animated.View>
      <Animated.View entering={revealUp(3)}>
        <ThemedText style={styles.coverWordmark} numberOfLines={1}>
          Caddie Book
        </ThemedText>
      </Animated.View>
      <Animated.View entering={revealRule(4)} style={styles.coverDivider}>
        <SketchDivider seed="cover-rule" />
      </Animated.View>
      <Animated.View entering={revealUp(5)}>
        <ThemedText style={styles.coverTagline}>
          Track every shot. Visualize your game.
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    coverTitle: {
      alignItems: 'center',
    },
    kicker: {
      fontWeight: '500',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    coverWordmark: {
      fontFamily: fonts.serifBold,
      fontSize: 48,
      lineHeight: 54,
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: spacing.md,
      letterSpacing: -0.5,
    },
    coverDivider: {
      width: 72,
      marginVertical: spacing.sm,
    },
    coverTagline: {
      fontFamily: fonts.serif,
      fontSize: 15,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
