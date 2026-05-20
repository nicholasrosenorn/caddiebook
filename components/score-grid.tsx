import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';

type Indicator =
  | 'doubleCircle'
  | 'circle'
  | 'par'
  | 'square'
  | 'doubleSquare'
  | 'tripleSquare'
  | 'none';

const ROWS: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

type Props = {
  par: number | null;
  value: number | null;
  onChange: (next: number | null) => void;
};

export function ScoreGrid({ par, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>Score</ThemedText>
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
  const indicator: Indicator = par != null ? getIndicator(n, par) : 'none';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        selected && styles.cellSelected,
        pressed && !selected && styles.cellPressed,
      ]}>
      <ScoreShape kind={indicator} selected={selected}>
        <ThemedText
          style={[styles.scoreNumber, selected && styles.scoreNumberSelected]}>
          {n}
        </ThemedText>
      </ScoreShape>
      {indicator === 'par' && (
        <ThemedText
          style={[styles.parLabel, selected && styles.parLabelSelected]}>
          Par
        </ThemedText>
      )}
    </Pressable>
  );
}

function getIndicator(score: number, par: number): Indicator {
  const delta = score - par;
  if (delta <= -2) return 'doubleCircle';
  if (delta === -1) return 'circle';
  if (delta === 0) return 'par';
  if (delta === 1) return 'square';
  if (delta === 2) return 'doubleSquare';
  return 'tripleSquare';
}

function ScoreShape({
  kind,
  selected,
  children,
}: {
  kind: Indicator;
  selected: boolean;
  children: ReactNode;
}) {
  const borderColor = selected ? colors.accentOn : colors.borderStrong;

  const circle = (size: number, inner: ReactNode) => (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {inner}
    </View>
  );
  const square = (size: number, inner: ReactNode) => (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 1.5,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {inner}
    </View>
  );

  switch (kind) {
    case 'doubleCircle':
      return circle(40, circle(30, children));
    case 'circle':
      return circle(36, children);
    case 'square':
      return square(34, children);
    case 'doubleSquare':
      return square(40, square(30, children));
    case 'tripleSquare':
      return square(44, square(34, square(24, children)));
    default:
      return <>{children}</>;
  }
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    height: 72,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  cellSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cellPressed: {
    backgroundColor: colors.accentMuted,
  },
  scoreNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  scoreNumberSelected: {
    color: colors.accentOn,
  },
  parLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 12,
  },
  parLabelSelected: {
    color: colors.accentOn,
    opacity: 0.85,
  },
});
