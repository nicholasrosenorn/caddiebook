import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable, type GlassStyle } from 'expo-glass-effect';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

type GlassSurfaceProps = {
  /** Corner radius of the surface; the glass/blur clip to it. */
  borderRadius?: number;
  /** Optional tint applied to the liquid-glass material (iOS 26+). */
  tintColor?: string;
  /** Liquid-glass material style (iOS 26+). */
  glassEffectStyle?: GlassStyle;
};

/**
 * Absolute-fill frosted "liquid glass" backdrop. Drop it in as the first child
 * of any chrome container (button, pill, bar) to sit behind its content. On
 * iOS 26+ this is Apple's real Liquid Glass material (GlassView); elsewhere it
 * falls back to a BlurView tinted toward the warm paper so the chrome stays
 * on-palette. A rounded drawn-outline border traces the shape to echo the
 * two-color print system. Pointer events pass through to the content above.
 */
export function GlassSurface({
  borderRadius = 0,
  tintColor,
  glassEffectStyle = 'regular',
}: GlassSurfaceProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const outline = [styles.outline, { borderRadius }];

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GlassView
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          glassEffectStyle={glassEffectStyle}
          tintColor={tintColor}
        />
        <View style={outline} />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 24}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
      />
      {/* Warm wash so the blur reads as paper, not neutral grey. */}
      <View style={[StyleSheet.absoluteFill, styles.wash, { borderRadius }]} />
      <View style={outline} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wash: {
      backgroundColor: colors.surface + '80', // ~50% — translucent but legible
    },
    outline: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
  });
