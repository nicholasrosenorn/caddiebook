import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export type OptionRowOption = { value: number; label: string };

export const COUNT_OPTIONS: OptionRowOption[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '≥4' },
];

type Props = {
  label: string;
  value: number | null;
  options?: OptionRowOption[];
  // When set and the field is unset (`value == null`), this value is shown as
  // selected with an "auto" marker — derived, not written. Tapping confirms it.
  autoValue?: number | null;
  onChange: (next: number | null) => void;
};

export function OptionRow({ label, value, options = COUNT_OPTIONS, autoValue, onChange }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const isAuto = value == null && autoValue != null;
  const displayValue = value ?? autoValue;
  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = displayValue === opt.value;
          return (
            <Pressable
              key={opt.value}
              // Toggle against the real value so tapping the auto-highlighted
              // option persists it rather than clearing.
              onPress={() => onChange(value === opt.value ? null : opt.value)}
              style={({ pressed }) => [
                styles.button,
                pressed && !selected && styles.buttonPressed,
              ]}>
              <SketchSurface
                seed={`opt-${label}-${opt.value}`}
                fill={selected ? colors.accent : colors.surface}
                stroke={selected ? colors.accent : colors.borderStrong}
                grain={selected}
                style={styles.surface}>
                <ThemedText
                  style={[styles.buttonLabel, selected && styles.buttonLabelSelected]}>
                  {opt.label}
                </ThemedText>
              </SketchSurface>
            </Pressable>
          );
        })}
      </View>
      {isAuto && (
        <View style={styles.autoRow}>
          {options.map((opt) => (
            <View key={opt.value} style={styles.autoCell}>
              {opt.value === autoValue ? (
                <ThemedText type="caption">AUTO</ThemedText>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  autoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  autoCell: {
    flex: 1,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    minHeight: 56,
  },
  surface: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonLabelSelected: {
    color: colors.accentOn,
  },
});
