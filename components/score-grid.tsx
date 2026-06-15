import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ScoreGlyph, SketchSurface, type ScoreIndicator } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { scoreIndicator } from '@/lib/stats';

const ROWS: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const HIGH_SCORE_ROWS: number[][] = [
  [10, 11, 12],
  [13, 14, 15],
];

const GLYPH = 46;

type Props = {
  par: number | null;
  value: number | null;
  onChange: (next: number | null) => void;
};

export function ScoreGrid({ par, value, onChange }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [moreOpen, setMoreOpen] = useState(false);
  const highSelected = value != null && value > 9;
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

      <View style={styles.moreRow}>
        <Pressable
          onPress={() => setMoreOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Enter a higher score"
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText style={styles.moreLabel}>
            {highSelected ? `Score ${value} ›` : 'More ›'}
          </ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <Pressable>
            <SketchSurface seed="score-more-menu" radius={14} grain style={styles.menu}>
              <ThemedText style={styles.caption}>HIGH SCORE</ThemedText>
              <View style={styles.menuGrid}>
                {HIGH_SCORE_ROWS.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.menuRow}>
                    {row.map((n) => {
                      const isCurrent = value === n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => {
                            onChange(isCurrent ? null : n);
                            setMoreOpen(false);
                          }}
                          style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}>
                          <SketchSurface
                            seed={`score-more-tile-${n}`}
                            radius={10}
                            fill={isCurrent ? colors.accent : undefined}
                            stroke={isCurrent ? colors.accent : undefined}
                            grain={isCurrent}
                            style={styles.tile}>
                            <ThemedText
                              style={[styles.tileLabel, isCurrent && styles.tileLabelCurrent]}>
                              {n}
                            </ThemedText>
                          </SketchSurface>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </SketchSurface>
          </Pressable>
        </Pressable>
      </Modal>
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
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
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

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  moreRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  moreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: '#0000001A',
  },
  menu: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
    textAlign: 'center',
  },
  menuGrid: {
    gap: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tileWrap: {
    width: 56,
  },
  tile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  tileLabelCurrent: {
    color: colors.accentOn,
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
