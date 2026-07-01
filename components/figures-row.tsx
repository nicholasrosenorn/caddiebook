import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export type Figure = {
  label: string;
  value: string;
  /** Optional trailing element beside the numeral (e.g. a directional delta). */
  delta?: ReactNode;
};

/**
 * The type-only figures vocabulary: serif numerals over letterspaced caption
 * labels, closed by a hairline rule. Hierarchy from type and air, not boxes —
 * this replaces the boxed stat-tile grid on editorial surfaces.
 */
export function FiguresRow({
  figures,
  size = 'md',
  rule = true,
  boxed = false,
  seed = 'figures',
}: {
  figures: Figure[];
  /** lg = headline figures (masthead, scoring); md = supporting stat rows. */
  size?: 'lg' | 'md';
  /** Hairline rule below the row. Ignored when `boxed` (the tiles carry structure). */
  rule?: boolean;
  /** Wrap each figure in a drawn-border tile — the deep-stats editorial treatment
   *  that reads consistently with the Me tab's cards. */
  boxed?: boolean;
  seed?: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (boxed) {
    return (
      <View style={styles.row}>
        {figures.map((f) => (
          <SketchSurface
            key={f.label}
            seed={`${seed}-${f.label}`}
            radius={12}
            style={styles.tile}>
            <View style={styles.valueRow}>
              <ThemedText style={styles.tileValue} numberOfLines={1}>
                {f.value}
              </ThemedText>
              {f.delta}
            </View>
            <ThemedText type="caption" style={styles.tileLabel} numberOfLines={2}>
              {f.label.toUpperCase()}
            </ThemedText>
          </SketchSurface>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {figures.map((f) => (
          <View key={f.label} style={styles.figure}>
            <View style={styles.valueRow}>
              <ThemedText
                style={size === 'lg' ? styles.valueLg : styles.valueMd}
                numberOfLines={1}>
                {f.value}
              </ThemedText>
              {f.delta}
            </View>
            <ThemedText type="caption" numberOfLines={1}>
              {f.label.toUpperCase()}
            </ThemedText>
          </View>
        ))}
      </View>
      {rule ? <SketchDivider seed={seed} /> : null}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    figure: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    tile: {
      flex: 1,
      minWidth: 0,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
      minHeight: 72,
      alignItems: 'center',
    },
    tileValue: {
      fontFamily: fonts.serifBold,
      fontSize: 22,
      lineHeight: 26,
      color: colors.textPrimary,
    },
    tileLabel: {
      textAlign: 'center',
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs,
    },
    valueLg: {
      fontFamily: fonts.serifBold,
      fontSize: 28,
      lineHeight: 34,
      color: colors.textPrimary,
    },
    valueMd: {
      fontFamily: fonts.serifBold,
      fontSize: 20,
      lineHeight: 26,
      color: colors.textPrimary,
    },
  });
