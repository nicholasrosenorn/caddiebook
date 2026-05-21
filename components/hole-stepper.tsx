import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

type Props = {
  holeNumber: number;
  par: number | null;
  isFirstHole: boolean;
  isLastHole: boolean;
  onPrev: () => void;
  onNext: () => void;
};

// Floating top-center pill for jumping between holes while entering data.
export function HoleStepper({ holeNumber, par, isFirstHole, isLastHole, onPrev, onNext }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.outer} pointerEvents="box-none">
      <SketchSurface seed="hole-stepper" radius={spacing.md} style={styles.pill}>
        <Pressable
          onPress={onPrev}
          disabled={isFirstHole}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous hole"
          style={({ pressed }) => [
            styles.chevron,
            isFirstHole && styles.disabled,
            pressed && !isFirstHole && styles.pressed,
          ]}>
          <ThemedText style={styles.chevronLabel}>‹</ThemedText>
        </Pressable>

        <ThemedText style={styles.title}>
          Hole {holeNumber}
          {par != null ? ` · Par ${par}` : ''}
        </ThemedText>

        <Pressable
          onPress={onNext}
          disabled={isLastHole}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next hole"
          style={({ pressed }) => [
            styles.chevron,
            isLastHole && styles.disabled,
            pressed && !isLastHole && styles.pressed,
          ]}>
          <ThemedText style={styles.chevronLabel}>›</ThemedText>
        </Pressable>
      </SketchSurface>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  outer: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    gap: spacing.xs,
  },
  chevron: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronLabel: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.25,
  },
  title: {
    fontFamily: fontFamily.serifBold,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
});
