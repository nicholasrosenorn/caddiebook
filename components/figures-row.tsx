import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SketchDivider } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export type Figure = { label: string; value: string };

/**
 * The type-only figures vocabulary: serif numerals over letterspaced caption
 * labels, closed by a hairline rule. Hierarchy from type and air, not boxes —
 * this replaces the boxed stat-tile grid on editorial surfaces.
 */
export function FiguresRow({
  figures,
  size = 'md',
  rule = true,
  seed = 'figures',
}: {
  figures: Figure[];
  /** lg = headline figures (masthead, scoring); md = supporting stat rows. */
  size?: 'lg' | 'md';
  /** Hairline rule below the row. */
  rule?: boolean;
  seed?: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {figures.map((f) => (
          <View key={f.label} style={styles.figure}>
            <ThemedText
              style={size === 'lg' ? styles.valueLg : styles.valueMd}
              numberOfLines={1}>
              {f.value}
            </ThemedText>
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
