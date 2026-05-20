import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';

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
                selected && styles.buttonSelected,
                pressed && !selected && styles.buttonPressed,
              ]}>
              <ThemedText
                style={[styles.buttonLabel, selected && styles.buttonLabelSelected]}>
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonPressed: {
    backgroundColor: colors.accentMuted,
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
