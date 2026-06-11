import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InfoHint } from '@/components/info-hint';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole } from '@/lib/data/models';
import { useUpdateHole } from '@/lib/data/rounds';

const PAR_OPTIONS = [3, 4, 5] as const;

type Props = {
  roundId: string;
  hole: Hole;
  onPicked?: () => void;
};

export function ParPage({ roundId, hole, onPicked }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const updateHole = useUpdateHole();
  const handlePick = async (par: number) => {
    try {
      await updateHole(roundId, hole.holeNumber, { par });
      onPicked?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="caption">PAR</ThemedText>
        <ThemedText type="title">Select par</ThemedText>
      </View>

      <View style={styles.buttons}>
        {PAR_OPTIONS.map((p) => {
          const selected = hole.par === p;
          return (
            <Pressable
              key={p}
              onPress={() => handlePick(p)}
              style={({ pressed }) => [
                styles.parButton,
                pressed && !selected && styles.parButtonPressed,
              ]}>
              <SketchSurface
                seed={`par-${p}`}
                radius={16}
                fill={selected ? colors.accent : colors.surface}
                stroke={selected ? colors.accent : colors.borderStrong}
                grain={selected}
                style={styles.parSurface}>
                <ThemedText
                  style={[styles.parNumber, selected && styles.parNumberSelected]}>
                  {p}
                </ThemedText>
                <ThemedText style={[styles.parWord, selected && styles.parWordSelected]}>
                  Par
                </ThemedText>
              </SketchSurface>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.hintRow}>
        <InfoHint
          title="Setting the par"
          message="Tap a button to set this hole's par. The flow then advances automatically to your score. Par 3s later skip the drive page and go straight to the approach; par 4s and 5s include the drive. Swipe up to move between the pages of a hole."
        />
        <ThemedText type="muted" style={styles.hint}>
          {hole.par != null ? `Par ${hole.par} · swipe up for score` : 'Tap to set par'}
        </ThemedText>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 100,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  parButton: {
    flex: 1,
    aspectRatio: 1,
  },
  parSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  parButtonPressed: {
    opacity: 0.6,
  },
  parNumber: {
    fontFamily: fonts.serif,
    fontSize: 48,
    color: colors.textPrimary,
    lineHeight: 60,
  },
  parNumberSelected: {
    color: colors.accentOn,
  },
  parWord: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  parWordSelected: {
    color: colors.accentOn,
    opacity: 0.85,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  hint: {
    flexShrink: 1,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
