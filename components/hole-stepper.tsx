import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { HoleJumpPicker } from '@/components/hole-jump-picker';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole } from '@/lib/data/models';

type Props = {
  holeNumber: number;
  par: number | null;
  holeCount: number;
  holes: Hole[];
  isFirstHole: boolean;
  isLastHole: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJump: (n: number) => void;
  onFinish: () => void;
};

// Floating top-center pill for jumping between holes while entering data.
export function HoleStepper({
  holeNumber,
  par,
  holeCount,
  holes,
  isFirstHole,
  isLastHole,
  onPrev,
  onNext,
  onJump,
  onFinish,
}: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.pill}>
        <GlassSurface borderRadius={radius.pill} />
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

        <HoleJumpPicker
          holeNumber={holeNumber}
          holeCount={holeCount}
          holes={holes}
          onJump={onJump}
          onFinish={onFinish}>
          <ThemedText style={styles.title}>
            Hole {holeNumber}
            {par != null ? ` · Par ${par}` : ''}
          </ThemedText>
        </HoleJumpPicker>

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
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
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
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
});
