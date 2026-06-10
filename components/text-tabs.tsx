import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { SketchDivider } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export type TextTabOption<T extends string> = { value: T; label: string };

/**
 * Editorial text-tabs: serif labels set between hairline rules, separated by an
 * interpunct. The quiet alternative to a boxed segmented control — selection is
 * carried by ink weight, not a filled pill.
 */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
  seed = 'text-tabs',
}: {
  options: TextTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  seed?: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View>
      <SketchDivider seed={`${seed}-top`} />
      <View style={styles.row}>
        {options.map((option, i) => {
          const selected = option.value === value;
          return (
            <View key={option.value} style={styles.tabGroup}>
              {i > 0 ? <ThemedText style={styles.dot}>·</ThemedText> : null}
              <PressableScale
                onPress={() => {
                  if (!selected) onChange(option.value);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={styles.tab}>
                <ThemedText
                  style={selected ? styles.labelSelected : styles.label}
                  numberOfLines={1}>
                  {option.label}
                </ThemedText>
                {/* Always mounted so selection never shifts layout. */}
                <View style={[styles.underline, selected && styles.underlineActive]} />
              </PressableScale>
            </View>
          );
        })}
      </View>
      <SketchDivider seed={`${seed}-bottom`} />
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
    },
    tabGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // No horizontal padding: the first label sits flush with the page's left
    // edge, aligned with the lockup and figures above (hitSlop keeps the
    // touch target generous).
    tab: {
      paddingVertical: spacing.xs,
      gap: 3,
    },
    underline: {
      height: 2,
      borderRadius: 1,
      alignSelf: 'stretch',
      backgroundColor: 'transparent',
    },
    underlineActive: {
      backgroundColor: colors.accent,
    },
    dot: {
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textMuted,
      paddingHorizontal: spacing.sm,
    },
    label: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textMuted,
    },
    labelSelected: {
      fontFamily: fonts.serifBold,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
  });
