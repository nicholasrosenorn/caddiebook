import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

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
  onChange: (next: number | null) => void;
};

export function OptionRow({ label, value, options = COUNT_OPTIONS, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(selected ? null : opt.value)}
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
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
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
