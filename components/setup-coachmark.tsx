import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

/**
 * First-login coachmark: a small green bubble tucked under the header, just
 * below the hamburger + its setup dot, pointing up at the menu. Tapping it
 * dismisses (the caller persists the "seen" flag). It's an absolute overlay so
 * it floats over the masthead without disturbing layout — render it inside a
 * `Screen` and let the caller gate it on `useSetupTooltip().show`.
 */
export function SetupCoachmark({ onDismiss }: { onDismiss: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Create your bag and set your stock yardages. Tap to dismiss."
        style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}>
        {/* A rotated square tucked half behind the bubble: same fill, so the
            overlap is seamless and only the tip shows above the edge — no thin
            border-triangle seam. */}
        <View style={styles.caret} pointerEvents="none" />
        <ThemedText style={styles.text}>
          Create your bag and set your stock yardages
        </ThemedText>
        <ThemedText style={styles.dismiss}>GOT IT</ThemedText>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      top: spacing.sm,
      left: 0,
      zIndex: 50,
    },
    bubble: {
      marginLeft: spacing.md,
      maxWidth: 244,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    // Diamond whose top half pokes above the bubble as the pointer; left to sit
    // under the hamburger glyph.
    caret: {
      position: 'absolute',
      top: -5,
      left: 12,
      width: 13,
      height: 13,
      borderRadius: 2,
      backgroundColor: colors.accent,
      transform: [{ rotate: '45deg' }],
    },
    pressed: {
      opacity: 0.88,
    },
    text: {
      fontFamily: fonts.serif,
      fontSize: 15,
      lineHeight: 21,
      color: colors.accentOn,
    },
    dismiss: {
      fontFamily: fonts.body,
      fontSize: 10,
      letterSpacing: 1.5,
      color: colors.accentOn,
      opacity: 0.7,
    },
  });
