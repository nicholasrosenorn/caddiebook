import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScoreGlyph, type ScoreIndicator } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { scoreIndicator } from '@/lib/stats';

const ROWS: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const GLYPH = 46;

type Props = {
  par: number | null;
  value: number | null;
  onChange: (next: number | null) => void;
};

export function ScoreGrid({ par, value, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <ThemedText type="label" style={styles.label}>Score</ThemedText>
      <View style={styles.grid}>
        {ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((n) => (
              <ScoreCell
                key={n}
                n={n}
                par={par}
                selected={value === n}
                onPress={() => onChange(value === n ? null : n)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function ScoreCell({
  n,
  par,
  selected,
  onPress,
}: {
  n: number;
  par: number | null;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const indicator: ScoreIndicator = par != null ? scoreIndicator(n, par) : 'none';
  const shapeColor = selected ? colors.accentOn : colors.borderStrong;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        selected && styles.cellSelected,
        pressed && !selected && styles.cellPressed,
      ]}>
      <View style={styles.glyphWrap}>
        {indicator !== 'none' && indicator !== 'par' && (
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.glyphCenter}>
              <ScoreGlyph kind={indicator} size={GLYPH} color={shapeColor} />
            </View>
          </View>
        )}
        <ThemedText style={[styles.scoreNumber, selected && styles.scoreNumberSelected]}>
          {n}
        </ThemedText>
      </View>
      {indicator === 'par' && (
        <ThemedText type="label" style={[styles.parLabel, selected && styles.parLabelSelected]}>
          Par
        </ThemedText>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  grid: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cell: {
    flex: 1,
    height: 68,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellPressed: {
    backgroundColor: colors.accentMuted,
  },
  glyphWrap: {
    width: GLYPH,
    height: GLYPH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  scoreNumberSelected: {
    color: colors.accentOn,
  },
  parLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 12,
  },
  parLabelSelected: {
    color: colors.accentOn,
    opacity: 0.85,
  },
});
