import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/constants/theme';

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
            style={({ pressed }) => [styles.pill, pressed && !selected && styles.pillPressed]}>
            <SketchSurface
              seed={`ynt-${String(option.value)}`}
              radius={999}
              fill={selected ? colors.accent : colors.surface}
              stroke={selected ? colors.accent : colors.borderStrong}
              grain={selected}
              style={styles.pillSurface}>
              <ThemedText style={[styles.label, selected && styles.labelSelected]}>
                {option.label}
              </ThemedText>
            </SketchSurface>
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
    minWidth: 72,
    height: 40,
  },
  pillSurface: {
    flex: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPressed: {
    opacity: 0.6,
  },
  label: {
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.accentOn,
    fontWeight: '600',
  },
});
