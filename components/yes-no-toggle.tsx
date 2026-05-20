import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';

type Value = boolean | null;

type YesNoToggleProps = {
  value: Value;
  onChange: (next: Value) => void;
  allowClear?: boolean;
};

const OPTIONS: { label: string; value: Value }[] = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

export function YesNoToggle({ value, onChange, allowClear = true }: YesNoToggleProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              if (selected && allowClear) {
                onChange(null);
              } else {
                onChange(option.value);
              }
            }}
            style={({ pressed }) => [
              styles.pill,
              selected && styles.pillSelected,
              pressed && !selected && styles.pillPressed,
            ]}>
            <ThemedText style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 64,
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillPressed: {
    backgroundColor: colors.accentMuted,
  },
  label: {
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.accentOn,
    fontWeight: '600',
  },
});
