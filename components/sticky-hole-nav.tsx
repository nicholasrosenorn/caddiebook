import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { HoleJumpPicker } from '@/components/hole-jump-picker';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import type { Hole } from '@/db/types';

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

export function StickyHoleNav({
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
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          <ThemedText style={styles.titleText}>
            Hole {holeNumber}
            {par != null ? ` · Par ${par}` : ''}
          </ThemedText>
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

const makeStyles = (colors: Palette) =>
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
    fontFamily: fontFamily.serifBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.5,
  },
});
