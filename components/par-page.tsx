import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';
import { updateHole } from '@/db/queries';
import type { Hole } from '@/db/types';

const PAR_OPTIONS = [3, 4, 5] as const;

type Props = {
  roundId: string;
  hole: Hole;
  onChange: () => void | Promise<void>;
  onPicked?: () => void;
};

export function ParPage({ roundId, hole, onChange, onPicked }: Props) {
  const handlePick = async (par: number) => {
    try {
      await updateHole(roundId, hole.holeNumber, { par });
      await onChange();
      onPicked?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="caption">HOLE {hole.holeNumber}</ThemedText>
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
                selected && styles.parButtonSelected,
                pressed && !selected && styles.parButtonPressed,
              ]}>
              <ThemedText
                style={[styles.parNumber, selected && styles.parNumberSelected]}>
                {p}
              </ThemedText>
              <ThemedText style={[styles.parWord, selected && styles.parWordSelected]}>
                Par
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="muted" style={styles.hint}>
        {hole.par != null
          ? `Par ${hole.par} · swipe up for ${hole.par === 3 ? 'approach' : 'drive'}`
          : 'Tap to set par'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  parButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  parButtonPressed: {
    backgroundColor: colors.accentMuted,
  },
  parNumber: {
    fontSize: 56,
    fontWeight: '700',
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
  hint: {
    textAlign: 'center',
  },
});
