import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/constants/theme';

type Props = {
  holeNumber: number;
  par: number | null;
  isFirstHole: boolean;
  isLastHole: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
};

export function StickyHoleNav({
  holeNumber,
  par,
  isFirstHole,
  isLastHole,
  onPrev,
  onNext,
  onFinish,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}>
      <Pressable
        onPress={onPrev}
        disabled={isFirstHole}
        style={({ pressed }) => [
          styles.chevron,
          isFirstHole && styles.chevronDisabled,
          pressed && !isFirstHole && styles.chevronPressed,
        ]}>
        <ThemedText style={styles.chevronLabel}>‹</ThemedText>
      </Pressable>

      <View style={styles.title}>
        <ThemedText style={styles.titleText}>
          Hole {holeNumber}
          {par != null ? ` · Par ${par}` : ''}
        </ThemedText>
        {isLastHole ? (
          <ThemedText style={styles.subTitle}>Finish round</ThemedText>
        ) : null}
      </View>

      <Pressable
        onPress={isLastHole ? onFinish : onNext}
        style={({ pressed }) => [
          styles.chevron,
          styles.chevronPrimary,
          pressed && styles.chevronPrimaryPressed,
        ]}>
        <ThemedText style={[styles.chevronLabel, styles.chevronLabelPrimary]}>
          {isLastHole ? '✓' : '›'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  chevron: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chevronPrimaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  chevronPressed: {
    backgroundColor: colors.accentMuted,
  },
  chevronDisabled: {
    opacity: 0.35,
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
});
