import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { HoleJumpPicker } from '@/components/hole-jump-picker';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole } from '@/lib/data/models';

type Props = {
  holeNumber: number;
  holeCount: number;
  holes: Hole[];
  isFirstHole: boolean;
  isLastHole: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJump: (n: number) => void;
  onFinish: () => void;
};

export function StickyHoleNav({
  holeNumber,
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
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.outer}>
      <GlassSurface />
      <SketchDivider seed="nav-divider" color={colors.borderStrong} />
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}>
        <Pressable
          onPress={onPrev}
          disabled={isFirstHole}
          hitSlop={6}
          style={({ pressed }) => [
            styles.chevronWrap,
            isFirstHole && styles.disabled,
            pressed && !isFirstHole && styles.pressed,
          ]}>
          <SketchSurface seed="nav-prev" style={styles.chevron}>
            <ThemedText style={styles.chevronLabel}>‹</ThemedText>
          </SketchSurface>
        </Pressable>

        <HoleJumpPicker
          holeNumber={holeNumber}
          holeCount={holeCount}
          holes={holes}
          onJump={onJump}
          onFinish={onFinish}
          placement="above"
          triggerStyle={styles.title}>
          <ThemedText style={styles.titleText}>Hole {holeNumber}</ThemedText>
          {isLastHole ? (
            <ThemedText style={styles.subTitle}>Finish round</ThemedText>
          ) : null}
        </HoleJumpPicker>

        <Pressable
          onPress={isLastHole ? onFinish : onNext}
          hitSlop={6}
          style={({ pressed }) => [styles.chevronWrap, pressed && styles.pressed]}>
          <SketchSurface
            seed="nav-next"
            fill={colors.accent}
            stroke={colors.accent}
            grain
            style={styles.chevron}>
            <ThemedText style={[styles.chevronLabel, styles.chevronLabelPrimary]}>
              {isLastHole ? '✓' : '›'}
            </ThemedText>
          </SketchSurface>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  chevronWrap: {
    width: 48,
    height: 48,
  },
  chevron: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.3,
  },
  chevronLabel: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 30,
  },
  chevronLabelPrimary: {
    color: colors.accentOn,
  },
  title: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  titleText: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.5,
  },
});
