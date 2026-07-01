import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

/**
 * A small directional figure: `▾`/`▴` + an unsigned magnitude, tinted by whether
 * the change is good or bad. "Lower is better" for the figures it serves
 * (scoring, handicap, to-par), so a fall reads as improvement in the accent ink
 * and a rise reads as a soft red — keeping the tint confined to these tiny
 * directional numerals rather than chrome (see DESIGN.md).
 */
export function DeltaBadge({
  delta,
  lowerIsBetter = true,
  format,
  size = 'md',
}: {
  /** Recent-vs-prior shift; `null` (too little data) renders nothing. */
  delta: number | null;
  lowerIsBetter?: boolean;
  /** Formats the unsigned magnitude (e.g. `formatDelta`). */
  format: (n: number) => string;
  size?: 'sm' | 'md';
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (delta == null) return null;
  const magnitude = format(Math.abs(delta));
  // Hide a flat reading (rounds to zero at the formatted precision).
  if (Number(magnitude) === 0) return null;

  const falling = delta < 0;
  const improving = falling === lowerIsBetter;
  const color = improving ? colors.accent : colors.negative;
  const arrow = falling ? '▾' : '▴';

  return (
    <ThemedText style={[size === 'sm' ? styles.sm : styles.md, { color }]} numberOfLines={1}>
      {arrow}
      {magnitude}
    </ThemedText>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    md: {
      fontFamily: fonts.serif,
      fontSize: 14,
      lineHeight: 18,
    },
    sm: {
      fontFamily: fonts.serif,
      fontSize: 12,
      lineHeight: 16,
    },
  });
