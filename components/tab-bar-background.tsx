import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

/**
 * Frosted "liquid glass" backdrop for the floating tab bar. On iOS 26+ this is
 * Apple's real Liquid Glass material (GlassView); elsewhere it falls back to a
 * BlurView tinted toward the warm paper so the chrome stays on-palette. A
 * hairline drawn-outline color sits on top to echo the two-color print system.
 */
export function TabBarBackground() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
        <View style={styles.hairline} />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 24}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {/* Warm wash so the blur reads as paper, not neutral grey. */}
      <View style={[StyleSheet.absoluteFill, styles.wash]} />
      <View style={styles.hairline} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wash: {
      backgroundColor: colors.surface + 'B3', // ~70% to keep labels legible over content
    },
    hairline: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
    },
  });
