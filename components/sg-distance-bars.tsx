import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { sgBarColor } from '@/components/sg-bar-chart';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { formatSG } from '@/lib/strokes-gained';

// A horizontal diverging strokes-gained chart: one row per distance band, the bar
// growing right (a gain, accent) or left (a loss, ramped by severity) from a
// centred zero line, with the band label on the left and the signed value on the
// right. Pure flexbox (mirrors SplitDistanceBars) — each half spans `axisMax`, the
// bar a percentage of its half. Used for SG by approach / putt distance.

export type SgDistanceRow = { key: string; label: string; value: number };

export function SgDistanceBars({ rows }: { rows: SgDistanceRow[] }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  // Largest magnitude sets the half-axis; a small floor keeps tiny bars visible.
  const axisMax = Math.max(0.5, ...rows.map((r) => Math.abs(r.value)));

  return (
    <View style={styles.list}>
      {rows.map((r) => {
        const color = sgBarColor(r.value, colors);
        const frac = Math.min(1, Math.abs(r.value) / axisMax);
        const pct = `${frac * 100}%` as const;
        const gain = r.value > 0;
        const loss = r.value < 0;
        return (
          <View key={r.key} style={styles.row}>
            <ThemedText style={styles.label} numberOfLines={1}>
              {r.label}
            </ThemedText>
            <View style={styles.track}>
              <View style={styles.half}>
                {loss ? (
                  <View style={[styles.bar, { width: pct, backgroundColor: color }]} />
                ) : null}
              </View>
              <View style={[styles.zeroLine, { backgroundColor: colors.borderStrong }]} />
              <View style={[styles.half, styles.halfRight]}>
                {gain ? (
                  <View style={[styles.bar, { width: pct, backgroundColor: color }]} />
                ) : null}
              </View>
            </View>
            <ThemedText style={[styles.value, { color }]} numberOfLines={1}>
              {formatSG(r.value)}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const BAR_HEIGHT = 14;

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    label: {
      width: 92,
      fontFamily: fonts.serif,
      fontSize: 14,
      color: colors.textPrimary,
    },
    track: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: BAR_HEIGHT,
    },
    half: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end', // losses grow leftward toward the centre line
    },
    halfRight: {
      justifyContent: 'flex-start', // gains grow rightward from the centre line
    },
    zeroLine: {
      width: 1,
      alignSelf: 'stretch',
    },
    bar: {
      height: BAR_HEIGHT,
      borderRadius: 3,
    },
    value: {
      width: 44,
      textAlign: 'right',
      fontFamily: fonts.serifBold,
      fontSize: 15,
      lineHeight: 20,
    },
  });
